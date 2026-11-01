package task

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type State string

const (
	Queued    State = "queued"
	Running   State = "running"
	Succeeded State = "succeeded"
	Failed    State = "failed"
	Cancelled State = "cancelled"
)

type Task struct {
	ID          string `json:"id"`
	Root        string `json:"root"`
	Operation   string `json:"operation"`
	State       State  `json:"state"`
	Cancellable bool   `json:"cancellable"`
	Message     string `json:"message,omitempty"`
	CreatedAt   string `json:"createdAt"`
	StartedAt   string `json:"startedAt,omitempty"`
	FinishedAt  string `json:"finishedAt,omitempty"`
}

type result struct {
	value any
	err   error
}

type entry struct {
	task   *Task
	base   context.Context
	cancel context.CancelFunc
	run    func(context.Context) (any, error)
	done   chan result
}

type queue struct {
	running bool
	pending []*entry
}

type Manager struct {
	mu      sync.Mutex
	queues  map[string]*queue
	tasks   map[string]*Task
	entries map[string]*entry
	order   []string
	emitter func(name string, data any)
	seq     atomic.Uint64
}

func NewManager() *Manager {
	return &Manager{
		queues:  map[string]*queue{},
		tasks:   map[string]*Task{},
		entries: map[string]*entry{},
	}
}

func (m *Manager) SetEmitter(emitter func(name string, data any)) {
	m.mu.Lock()
	m.emitter = emitter
	m.mu.Unlock()
}

// Run enqueues an operation for a repository and blocks until it finishes. The
// returned context is cancelled when the task is cancelled from the UI.
func (m *Manager) Run(ctx context.Context, root, operation string, cancellable bool, fn func(context.Context) (any, error)) (any, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	id := fmt.Sprintf("task-%d", m.seq.Add(1))
	task := &Task{
		ID:          id,
		Root:        root,
		Operation:   operation,
		State:       Queued,
		Cancellable: cancellable,
		CreatedAt:   nowString(),
		Message:     "等待中",
	}
	item := &entry{task: task, base: ctx, run: fn, done: make(chan result, 1)}
	key := queueKey(root)

	m.mu.Lock()
	m.tasks[id] = task
	m.entries[id] = item
	m.order = append(m.order, id)
	m.trimLocked()
	q := m.queues[key]
	if q == nil {
		q = &queue{}
		m.queues[key] = q
	}
	q.pending = append(q.pending, item)
	if !q.running {
		q.running = true
		go m.worker(key, q)
	}
	queued := *task
	m.mu.Unlock()
	m.emit("task:queued", queued)

	res := <-item.done
	return res.value, res.err
}

func (m *Manager) List() []Task {
	m.mu.Lock()
	defer m.mu.Unlock()
	items := make([]Task, 0, len(m.order))
	for index := len(m.order) - 1; index >= 0; index-- {
		if task, ok := m.tasks[m.order[index]]; ok {
			items = append(items, *task)
		}
	}
	return items
}

func (m *Manager) Cancel(id string) {
	m.mu.Lock()
	task := m.tasks[id]
	item := m.entries[id]
	if task == nil {
		m.mu.Unlock()
		return
	}
	emitFinished := false
	switch task.State {
	case Queued:
		task.State = Cancelled
		task.Message = "已取消"
		task.FinishedAt = nowString()
		emitFinished = true
	case Running:
		task.Message = "正在取消…"
		if item != nil && item.cancel != nil {
			item.cancel()
		}
	}
	cancelled := *task
	m.mu.Unlock()
	if emitFinished {
		m.emit("task:finished", cancelled)
	}
}

func (m *Manager) worker(key string, q *queue) {
	for {
		m.mu.Lock()
		if len(q.pending) == 0 {
			q.running = false
			m.mu.Unlock()
			return
		}
		item := q.pending[0]
		q.pending = q.pending[1:]
		m.mu.Unlock()

		if item.task.State == Cancelled {
			item.done <- result{err: context.Canceled}
			continue
		}
		m.runEntry(item)
	}
}

func (m *Manager) runEntry(item *entry) {
	base := item.base
	ctx, cancel := context.WithCancel(base)

	m.mu.Lock()
	item.task.State = Running
	item.task.StartedAt = nowString()
	item.task.Message = "執行中"
	item.cancel = cancel
	started := *item.task
	m.mu.Unlock()
	m.emit("task:started", started)

	ctx = WithReporter(ctx, func(message string) { m.progress(item.task.ID, message) })

	value, err := item.run(ctx)
	cancel()

	m.mu.Lock()
	item.task.FinishedAt = nowString()
	switch {
	case errors.Is(ctx.Err(), context.Canceled):
		item.task.State = Cancelled
		item.task.Message = "已取消"
	case err != nil:
		item.task.State = Failed
		item.task.Message = truncate(err.Error(), 240)
	default:
		item.task.State = Succeeded
		item.task.Message = "完成"
	}
	finished := *item.task
	delete(m.entries, item.task.ID)
	m.mu.Unlock()

	m.emit("task:finished", finished)
	item.done <- result{value: value, err: err}
}

func (m *Manager) progress(id, message string) {
	message = truncate(strings.TrimSpace(message), 240)
	if message == "" {
		return
	}
	m.mu.Lock()
	task := m.tasks[id]
	if task == nil || task.State != Running {
		m.mu.Unlock()
		return
	}
	task.Message = message
	snapshotValue := *task
	m.mu.Unlock()
	m.emit("task:progress", snapshotValue)
}

func (m *Manager) emit(name string, data any) {
	m.mu.Lock()
	emitter := m.emitter
	m.mu.Unlock()
	if emitter != nil {
		emitter(name, data)
	}
}

func (m *Manager) trimLocked() {
	for len(m.order) > 100 {
		oldest := m.order[0]
		m.order = m.order[1:]
		if task, ok := m.tasks[oldest]; ok && task.State != Running && task.State != Queued {
			delete(m.tasks, oldest)
		}
	}
}

func queueKey(root string) string {
	if strings.TrimSpace(root) == "" {
		return "_global"
	}
	return strings.ToLower(strings.ReplaceAll(root, "\\", "/"))
}

func truncate(value string, limit int) string {
	value = strings.TrimSpace(value)
	if len(value) <= limit {
		return value
	}
	return value[:limit-1] + "…"
}

func nowString() string {
	return time.Now().Format(time.RFC3339)
}
