package api

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/felixgugu/puffgittt/internal/config"
)

func TestWatchRepositoryEmitsAfterFileChange(t *testing.T) {
	dir := t.TempDir()
	runGit(t, dir, "init", "--initial-branch", "main")
	runGit(t, dir, "config", "user.email", "test@example.com")
	runGit(t, dir, "config", "user.name", "Test User")
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, dir, "add", "hello.txt")
	runGit(t, dir, "commit", "-m", "initial")

	service := New(testConfig(t))
	service.SetContext(t.Context())
	events := make(chan string, 4)
	service.SetEventEmitter(func(name string, data interface{}) {
		if name == "repo:changed" {
			events <- dir
		}
	})
	service.WatchRepository(dir)
	defer service.UnwatchRepository(dir)

	time.Sleep(600 * time.Millisecond)
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\nworld\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	select {
	case <-events:
	case <-time.After(6 * time.Second):
		t.Fatal("timed out waiting for repo:changed")
	}
}

func testConfig(t *testing.T) *config.Config {
	t.Helper()
	return &config.Config{
		AppDir:      t.TempDir(),
		SettingsDir: t.TempDir(),
		CacheDir:    t.TempDir(),
		LogDir:      t.TempDir(),
		BackupDir:   t.TempDir(),
	}
}
