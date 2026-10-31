package git

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestWorktreeLifecycle(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()
	worktreePath := filepath.Join(t.TempDir(), "feature-worktree")

	worktrees, err := runner.Worktrees(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(worktrees) != 1 {
		t.Fatalf("initial worktrees = %#v", worktrees)
	}

	if _, err := runner.AddWorktree(ctx, dir, worktreePath, "feature", true); err != nil {
		t.Fatal(err)
	}
	worktrees, err = runner.Worktrees(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(worktrees) != 2 {
		t.Fatalf("worktrees after add = %#v", worktrees)
	}
	found := false
	for _, worktree := range worktrees {
		if worktree.Path == filepath.ToSlash(worktreePath) || worktree.Path == worktreePath {
			found = worktree.Branch == "feature"
		}
	}
	if !found {
		t.Fatalf("feature worktree not found: %#v", worktrees)
	}
	if _, err := os.Stat(worktreePath); err != nil {
		t.Fatalf("worktree directory missing: %v", err)
	}

	if _, err := runner.RemoveWorktree(ctx, dir, worktreePath, true); err != nil {
		t.Fatal(err)
	}
	worktrees, err = runner.Worktrees(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(worktrees) != 1 {
		t.Fatalf("worktrees after remove = %#v", worktrees)
	}
}
