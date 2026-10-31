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

func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

func TestFacadesAgainstRealRepository(t *testing.T) {
	dir := t.TempDir()
	runGit(t, dir, "init", "--initial-branch", "main")
	runGit(t, dir, "config", "user.email", "test@example.com")
	runGit(t, dir, "config", "user.name", "Test User")
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, dir, "add", "hello.txt")
	runGit(t, dir, "commit", "-m", "initial")

	cfg := &config.Config{
		AppDir:      t.TempDir(),
		SettingsDir: t.TempDir(),
		CacheDir:    t.TempDir(),
		LogDir:      t.TempDir(),
		BackupDir:   t.TempDir(),
	}
	service := New(cfg)
	ctx := context.Background()
	service.SetContext(ctx)

	appAPI := NewAppAPI(service)
	repoAPI := NewRepoAPI(service)
	changeAPI := NewChangeAPI(service)
	commitAPI := NewCommitAPI(service)
	historyAPI := NewHistoryAPI(service)

	repo, err := appAPI.OpenRepository(dir)
	if err != nil {
		t.Fatal(err)
	}
	if repo.Name != filepath.Base(dir) || repo.Branch != "main" {
		t.Fatalf("repo = %#v", repo)
	}

	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\nworld\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	status, err := repoAPI.GetStatus(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(status.Files) != 1 || status.Files[0].Path != "hello.txt" {
		t.Fatalf("status = %#v", status)
	}

	diff, err := changeAPI.GetDiff(dir, "hello.txt", "unstaged", "")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(diff.NewText, "world") {
		t.Fatalf("diff = %#v", diff)
	}

	if _, err := changeAPI.Stage(dir, []string{"hello.txt"}); err != nil {
		t.Fatal(err)
	}
	if _, err := commitAPI.Commit(dir, "second", false); err != nil {
		t.Fatal(err)
	}
	commits, err := historyAPI.List(dir, "main", false, 10, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(commits) != 2 || commits[0].Subject != "second" {
		t.Fatalf("commits = %#v", commits)
	}
}
