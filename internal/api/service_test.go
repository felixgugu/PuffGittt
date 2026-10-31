package api

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/felixgugu/puffgittt/internal/config"
	"github.com/felixgugu/puffgittt/internal/model"
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

func TestListWorkspaceRepositories(t *testing.T) {
	projects := t.TempDir()
	repoDir := filepath.Join(projects, "alpha")
	if err := os.MkdirAll(repoDir, 0o755); err != nil {
		t.Fatal(err)
	}
	runGit(t, repoDir, "init", "--initial-branch", "main")
	runGit(t, repoDir, "config", "user.email", "test@example.com")
	runGit(t, repoDir, "config", "user.name", "Test User")
	if err := os.WriteFile(filepath.Join(repoDir, "hello.txt"), []byte("hello\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, repoDir, "add", "hello.txt")
	runGit(t, repoDir, "commit", "-m", "initial")
	if err := os.WriteFile(filepath.Join(repoDir, "untracked.txt"), []byte("new\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	cfg := &config.Config{
		AppDir:      t.TempDir(),
		SettingsDir: t.TempDir(),
		CacheDir:    t.TempDir(),
		LogDir:      t.TempDir(),
		BackupDir:   t.TempDir(),
	}
	settings := cfg.LoadSettings()
	settings.ProjectsRoot = projects
	settings.Recent = []model.RecentRepo{{Path: repoDir, Name: "alpha", LastOpened: "2026-01-01T00:00:00Z"}}
	if err := cfg.SaveSettings(settings); err != nil {
		t.Fatal(err)
	}

	service := New(cfg)
	service.SetContext(context.Background())
	repos := NewAppAPI(service).ListWorkspaceRepositories()
	if len(repos) != 1 {
		t.Fatalf("expected deduplicated repository list, got %#v", repos)
	}
	if repos[0].Name != "alpha" || repos[0].Kind != "project" || repos[0].Changes != 1 {
		t.Fatalf("repository = %#v", repos[0])
	}
}
