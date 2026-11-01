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

func TestUndoHistoryIsMultiStepAndPersisted(t *testing.T) {
	dir := t.TempDir()
	runGit(t, dir, "init", "--initial-branch", "main")
	runGit(t, dir, "config", "user.email", "test@example.com")
	runGit(t, dir, "config", "user.name", "Test User")
	commit := func(name, content string) string {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
		runGit(t, dir, "add", name)
		runGit(t, dir, "commit", "-m", content)
		return strings.TrimSpace(runGitOutput(t, dir, "rev-parse", "HEAD"))
	}
	first := commit("a.txt", "a")
	second := commit("b.txt", "b")
	third := commit("c.txt", "c")

	cfg := &config.Config{
		AppDir:      t.TempDir(),
		SettingsDir: t.TempDir(),
		CacheDir:    t.TempDir(),
		LogDir:      t.TempDir(),
		BackupDir:   t.TempDir(),
	}
	service := New(cfg)
	service.SetContext(context.Background())
	history := NewHistoryAPI(service)

	if _, err := history.Reset(dir, second, "hard"); err != nil {
		t.Fatal(err)
	}
	if _, err := history.Reset(dir, first, "hard"); err != nil {
		t.Fatal(err)
	}
	if records := history.UndoHistory(dir); len(records) != 2 {
		t.Fatalf("undo history = %#v", records)
	}

	restarted := New(cfg)
	restarted.SetContext(context.Background())
	history = NewHistoryAPI(restarted)
	if info := history.UndoInfo(dir); info.Operation == "" {
		t.Fatal("undo history should persist across service instances")
	}
	if _, err := history.Undo(dir, ""); err != nil {
		t.Fatal(err)
	}
	if head := strings.TrimSpace(runGitOutput(t, dir, "rev-parse", "HEAD")); head != second {
		t.Fatalf("head after first undo = %q, want %q", head, second)
	}
	if _, err := history.Undo(dir, ""); err != nil {
		t.Fatal(err)
	}
	if head := strings.TrimSpace(runGitOutput(t, dir, "rev-parse", "HEAD")); head != third {
		t.Fatalf("head after second undo = %q, want %q", head, third)
	}
	if info := history.UndoInfo(dir); info.Operation != "" {
		t.Fatalf("undo history should be empty: %#v", info)
	}
}

func TestUndoRestoresWorktreeBackup(t *testing.T) {
	dir := t.TempDir()
	runGit(t, dir, "init", "--initial-branch", "main")
	runGit(t, dir, "config", "user.email", "test@example.com")
	runGit(t, dir, "config", "user.name", "Test User")
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("base\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, dir, "add", "hello.txt")
	runGit(t, dir, "commit", "-m", "initial")
	first := strings.TrimSpace(runGitOutput(t, dir, "rev-parse", "HEAD"))
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("committed\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, dir, "add", "hello.txt")
	runGit(t, dir, "commit", "-m", "second")
	second := strings.TrimSpace(runGitOutput(t, dir, "rev-parse", "HEAD"))
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("dirty\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	cfg := &config.Config{
		AppDir:      t.TempDir(),
		SettingsDir: t.TempDir(),
		CacheDir:    t.TempDir(),
		LogDir:      t.TempDir(),
		BackupDir:   t.TempDir(),
	}
	service := New(cfg)
	service.SetContext(context.Background())
	history := NewHistoryAPI(service)

	if _, err := history.Reset(dir, first, "hard"); err != nil {
		t.Fatal(err)
	}
	info := history.UndoInfo(dir)
	if info.BackupRef == "" {
		t.Fatal("expected a worktree backup")
	}
	if _, err := history.Undo(dir, info.ID); err != nil {
		t.Fatal(err)
	}
	if head := strings.TrimSpace(runGitOutput(t, dir, "rev-parse", "HEAD")); head != second {
		t.Fatalf("head = %q, want %q", head, second)
	}
	content, err := os.ReadFile(filepath.Join(dir, "hello.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "dirty\n" {
		t.Fatalf("worktree content = %q", content)
	}
}

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

	result, err := historyAPI.Undo(dir, "")
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
