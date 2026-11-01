package api

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/felixgugu/puffgittt/internal/config"
)

func TestResetUndoAndReflog(t *testing.T) {
	dir := t.TempDir()
	runGit(t, dir, "init", "--initial-branch", "main")
	runGit(t, dir, "config", "user.email", "test@example.com")
	runGit(t, dir, "config", "user.name", "Test User")
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, dir, "add", "hello.txt")
	runGit(t, dir, "commit", "-m", "initial")
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\nworld\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, dir, "add", "hello.txt")
	runGit(t, dir, "commit", "-m", "second")

	secondOid := strings.TrimSpace(runGitOutput(t, dir, "rev-parse", "HEAD"))

	cfg := &config.Config{
		AppDir:      t.TempDir(),
		SettingsDir: t.TempDir(),
		CacheDir:    t.TempDir(),
		LogDir:      t.TempDir(),
		BackupDir:   t.TempDir(),
	}
	service := New(cfg)
	service.SetContext(context.Background())
	historyAPI := NewHistoryAPI(service)

	commits, err := historyAPI.List(dir, "main", false, 10, "", "message")
	if err != nil {
		t.Fatal(err)
	}
	if len(commits) != 2 {
		t.Fatalf("commits = %#v", commits)
	}

	if _, err := historyAPI.Reset(dir, commits[1].Oid, "hard"); err != nil {
		t.Fatal(err)
	}
	if info := historyAPI.UndoInfo(dir); info.Operation != "Reset (hard)" || info.BeforeOid != secondOid {
		t.Fatalf("undo info = %#v", info)
	}

	result, err := historyAPI.Undo(dir)
	if err != nil {
		t.Fatal(err)
	}
	if result.Message != "已復原上一次操作" {
		t.Fatalf("message = %q", result.Message)
	}
	if head := strings.TrimSpace(runGitOutput(t, dir, "rev-parse", "HEAD")); head != secondOid {
		t.Fatalf("head after undo = %q, want %q", head, secondOid)
	}
	if info := historyAPI.UndoInfo(dir); info.Operation != "" {
		t.Fatalf("undo record should be cleared, got %#v", info)
	}

	entries, err := historyAPI.Reflog(dir, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) == 0 || entries[0].Oid != secondOid {
		t.Fatalf("reflog = %#v", entries)
	}
	if !strings.HasPrefix(entries[0].Selector, "HEAD@{") {
		t.Fatalf("selector = %q", entries[0].Selector)
	}
}

func runGitOutput(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("git %v: %v", args, err)
	}
	return string(out)
}
