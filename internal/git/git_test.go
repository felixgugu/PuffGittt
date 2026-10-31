package git

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setupRepo(t *testing.T) (*Runner, string) {
	t.Helper()
	dir := t.TempDir()
	runner := NewRunner()
	ctx := context.Background()
	if _, err := runner.Run(ctx, "", "init", "--initial-branch", "main", dir); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "config", "user.email", "test@example.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "config", "user.name", "Test User"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "add", "hello.txt"); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "commit", "-m", "initial commit"); err != nil {
		t.Fatal(err)
	}
	return runner, dir
}

func TestStatusDiffStageCommit(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\nworld\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	status, err := runner.Status(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if status.Repo.Branch != "main" {
		t.Fatalf("branch = %q", status.Repo.Branch)
	}
	if len(status.Files) != 1 || status.Files[0].Path != "hello.txt" {
		t.Fatalf("files = %#v", status.Files)
	}

	diff, err := runner.Diff(ctx, dir, "hello.txt", "unstaged", "")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(diff.NewText, "world") {
		t.Fatalf("new text = %q", diff.NewText)
	}

	if _, err := runner.Stage(ctx, dir, []string{"hello.txt"}); err != nil {
		t.Fatal(err)
	}
	status, err = runner.Status(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if status.Files[0].IndexStatus == "." {
		t.Fatalf("expected staged status, got %#v", status.Files[0])
	}

	if _, err := runner.Unstage(ctx, dir, []string{"hello.txt"}); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Stage(ctx, dir, []string{"hello.txt"}); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Commit(ctx, dir, "second commit", false); err != nil {
		t.Fatal(err)
	}
	commits, err := runner.Log(ctx, dir, "main", false, 10, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(commits) != 2 || commits[0].Subject != "second commit" {
		t.Fatalf("commits = %#v", commits)
	}

	branches, err := runner.Branches(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	foundMain := false
	for _, branch := range branches {
		if branch.Name == "main" && branch.Current {
			foundMain = true
		}
	}
	if !foundMain {
		t.Fatalf("main branch missing from %#v", branches)
	}
}

func TestUntrackedAndBranch(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()
	if err := os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("notes\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	status, err := runner.Status(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(status.Files) != 1 || status.Files[0].Kind != "untracked" {
		t.Fatalf("files = %#v", status.Files)
	}
	if _, err := runner.CreateBranch(ctx, dir, "feature/test", ""); err != nil {
		t.Fatal(err)
	}
	branches, err := runner.Branches(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, branch := range branches {
		if branch.Name == "feature/test" {
			found = true
		}
	}
	if !found {
		t.Fatalf("branch missing from %#v", branches)
	}
}
