package task

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestManagerSerializesPerRepository(t *testing.T) {
	manager := NewManager()
	var mu sync.Mutex
	running := 0
	maxRunning := 0
	order := []string{}
	started := make(chan string, 2)

	run := func(name string) func(context.Context) (any, error) {
		return func(ctx context.Context) (any, error) {
			mu.Lock()
			running++
			if running > maxRunning {
				maxRunning = running
			}
			order = append(order, name)
			mu.Unlock()
			started <- name
			time.Sleep(20 * time.Millisecond)
			mu.Lock()
			running--
			mu.Unlock()
			return name, nil
		}
	}

	done := make(chan error, 2)
	go func() {
		_, err := manager.Run(context.Background(), "repo", "first", true, run("first"))
		done <- err
	}()
	if name := <-started; name != "first" {
		t.Fatalf("started %q", name)
	}
	go func() {
		_, err := manager.Run(context.Background(), "repo", "second", true, run("second"))
		done <- err
	}()
	if name := <-started; name != "second" {
		t.Fatalf("started %q", name)
	}
	for range 2 {
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	}
	if maxRunning != 1 {
		t.Fatalf("max running = %d", maxRunning)
	}
	if len(order) != 2 || order[0] != "first" || order[1] != "second" {
		t.Fatalf("order = %#v", order)
	}
}

func TestManagerCancelRunningTask(t *testing.T) {
	manager := NewManager()
	started := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		_, err := manager.Run(context.Background(), "repo", "long", true, func(ctx context.Context) (any, error) {
			close(started)
			<-ctx.Done()
			return nil, ctx.Err()
		})
		done <- err
	}()
	<-started

	var id string
	for _, task := range manager.List() {
		if task.State == Running {
			id = task.ID
		}
	}
	if id == "" {
		t.Fatal("running task not found")
	}
	manager.Cancel(id)
	if err := <-done; err == nil {
		t.Fatal("expected cancellation error")
	}
	tasks := manager.List()
	if len(tasks) == 0 || tasks[0].State != Cancelled {
		t.Fatalf("tasks = %#v", tasks)
	}
}

func TestManagerEmitsProgress(t *testing.T) {
	manager := NewManager()
	var mu sync.Mutex
	progress := []string{}
	manager.SetEmitter(func(name string, data any) {
		if name == "task:progress" {
			mu.Lock()
			progress = append(progress, data.(Task).Message)
			mu.Unlock()
		}
	})
	_, err := manager.Run(context.Background(), "repo", "progress", true, func(ctx context.Context) (any, error) {
		Report(ctx, "line one")
		Report(ctx, "line two")
		return nil, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(progress) != 2 || progress[0] != "line one" || progress[1] != "line two" {
		t.Fatalf("progress = %#v", progress)
	}
}
