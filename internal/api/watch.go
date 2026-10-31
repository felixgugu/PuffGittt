package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"

	"github.com/felixgugu/puffgittt/internal/model"
)

const repoPollInterval = 1500 * time.Millisecond

type repoMonitor struct {
	root string
	stop chan struct{}
	once sync.Once
	last string
}

// WatchRepository starts a lightweight repository change monitor. It polls the
// porcelain status (which includes HEAD, branch and ahead/behind state) and
// emits a "repo:changed" event when the fingerprint changes. Polling keeps the
// implementation cross-platform and avoids watching large dependency trees.
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
	ticker := time.NewTicker(repoPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-monitor.stop:
			return
		case <-ticker.C:
			status, err := s.runnerWithSettings().Status(s.context(), monitor.root)
			if err != nil {
				continue
			}
			fingerprint := statusFingerprint(status)
			if monitor.last == "" {
				monitor.last = fingerprint
				continue
			}
			if fingerprint == monitor.last {
				continue
			}
			monitor.last = fingerprint
			if s.emit != nil {
				s.emit("repo:changed", map[string]string{"root": monitor.root})
			}
		}
	}
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
}
