package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/felixgugu/puffgittt/internal/model"
)

const (
	repoDebounce                = 350 * time.Millisecond
	repoFallbackInterval        = 10 * time.Second
	repoFallbackIntervalNoWatch = 1500 * time.Millisecond
	maxWatchDirectories         = 2500
)

var errWatchLimit = fmt.Errorf("watch directory limit reached")

type repoMonitor struct {
	root string
	stop chan struct{}
	once sync.Once
	last string
}

// WatchRepository starts a filesystem watcher for an open repository. Changes
// are debounced, then confirmed with a porcelain status fingerprint before a
// "repo:changed" event is emitted. Polling remains as a fallback for missed
// events and for repositories that exceed the watch limit.
func (s *Service) WatchRepository(root string) {
	if root == "" {
		return
	}
	key := undoKey(root)
	s.watchMu.Lock()
	if _, exists := s.watchers[key]; exists {
		s.watchMu.Unlock()
		return
	}
	monitor := &repoMonitor{root: root, stop: make(chan struct{})}
	s.watchers[key] = monitor
	s.watchMu.Unlock()
	go s.monitorRepo(monitor)
}

func (s *Service) UnwatchRepository(root string) {
	key := undoKey(root)
	s.watchMu.Lock()
	monitor := s.watchers[key]
	delete(s.watchers, key)
	s.watchMu.Unlock()
	if monitor != nil {
		monitor.once.Do(func() { close(monitor.stop) })
	}
}

func (s *Service) CloseWatchers() {
	s.watchMu.Lock()
	monitors := s.watchers
	s.watchers = map[string]*repoMonitor{}
	s.watchMu.Unlock()
	for _, monitor := range monitors {
		monitor.once.Do(func() { close(monitor.stop) })
	}
}

func (s *Service) monitorRepo(monitor *repoMonitor) {
	s.refreshFingerprint(monitor, false)

	watcher, err := newRepoWatcher(monitor.root)
	if err != nil {
		watcher = nil
	}
	var events <-chan fsnotify.Event
	var errors <-chan error
	interval := repoFallbackIntervalNoWatch
	if watcher != nil {
		defer watcher.Close()
		events = watcher.Events
		errors = watcher.Errors
		interval = repoFallbackInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	var timer *time.Timer
	var debounce <-chan time.Time
	schedule := func() {
		if timer == nil {
			timer = time.NewTimer(repoDebounce)
		} else {
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timer.Reset(repoDebounce)
		}
		debounce = timer.C
	}

	for {
		select {
		case <-monitor.stop:
			if timer != nil {
				timer.Stop()
			}
			return
		case <-ticker.C:
			s.refreshFingerprint(monitor, true)
		case event, ok := <-events:
			if !ok {
				events = nil
				continue
			}
			if shouldIgnoreWatchPath(monitor.root, event.Name) {
				continue
			}
			if event.Op&fsnotify.Create != 0 {
				if info, err := os.Stat(event.Name); err == nil && info.IsDir() {
					_ = addWatchTree(watcher, monitor.root, event.Name)
				}
			}
			schedule()
		case _, ok := <-errors:
			if !ok {
				errors = nil
			}
		case <-debounce:
			debounce = nil
			s.refreshFingerprint(monitor, true)
		}
	}
}

func (s *Service) refreshFingerprint(monitor *repoMonitor, emit bool) {
	status, err := s.runnerWithSettings().Status(s.context(), monitor.root)
	if err != nil {
		return
	}
	fingerprint := statusFingerprint(status)
	if monitor.last == "" {
		monitor.last = fingerprint
		return
	}
	if fingerprint == monitor.last {
		return
	}
	monitor.last = fingerprint
	if !emit {
		return
	}
	s.emitMu.Lock()
	emitter := s.emit
	s.emitMu.Unlock()
	if emitter != nil {
		emitter("repo:changed", map[string]string{"root": monitor.root})
	}
}

func newRepoWatcher(root string) (*fsnotify.Watcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	count := 0
	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !entry.IsDir() {
			return nil
		}
		if shouldIgnoreWatchPath(root, path) {
			return filepath.SkipDir
		}
		if count >= maxWatchDirectories {
			return errWatchLimit
		}
		if err := watcher.Add(path); err != nil {
			return nil
		}
		count++
		return nil
	})
	if err != nil {
		watcher.Close()
		return nil, err
	}
	return watcher, nil
}

func addWatchTree(watcher *fsnotify.Watcher, root, path string) error {
	existing := len(watcher.WatchList())
	return filepath.WalkDir(path, func(current string, entry fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !entry.IsDir() {
			return nil
		}
		if shouldIgnoreWatchPath(root, current) {
			return filepath.SkipDir
		}
		if existing >= maxWatchDirectories {
			return errWatchLimit
		}
		if err := watcher.Add(current); err == nil {
			existing++
		}
		return nil
	})
}

func shouldIgnoreWatchPath(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == "." {
		return false
	}
	rel = filepath.ToSlash(rel)
	parts := strings.Split(rel, "/")
	if len(parts) > 1 && parts[0] == ".git" {
		switch parts[1] {
		case "objects", "logs", "lfs", "modules":
			return true
		}
	}
	for _, part := range parts {
		switch part {
		case "node_modules", ".next", ".nuxt", ".cache", ".venv", "__pycache__",
			"target", "dist", "build", "coverage", ".idea", ".vscode":
			return true
		}
	}
	return false
}

func statusFingerprint(status model.Status) string {
	data, err := json.Marshal(status)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func (s *Service) SetEventEmitter(emit func(name string, data interface{})) {
	s.emitMu.Lock()
	s.emit = emit
	s.emitMu.Unlock()
	if s.tasks != nil {
		s.tasks.SetEmitter(emit)
	}
}

func runTask[T any](s *Service, root, operation string, cancellable bool, fn func(context.Context) (T, error)) (T, error) {
	base := s.context()
	if base == nil {
		base = context.Background()
	}
	value, err := s.tasks.Run(base, root, operation, cancellable, func(ctx context.Context) (any, error) {
		return fn(ctx)
	})
	if value == nil {
		var zero T
		return zero, err
	}
	result, ok := value.(T)
	if !ok {
		var zero T
		return zero, fmt.Errorf("unexpected task result")
	}
	return result, err
}
