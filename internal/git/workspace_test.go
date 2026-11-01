package git

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWorkspaceStatus(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()
	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\nworld\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "new.txt"), []byte("new\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	entry, ok := runner.WorkspaceStatus(ctx, dir)
	if !ok {
		t.Fatal("expected repository to be recognized")
	}
	if entry.Name != filepath.Base(dir) || entry.Branch != "main" {
		t.Fatalf("entry = %#v", entry)
	}
	if entry.Changes != 2 {
		t.Fatalf("changes = %d, want 2", entry.Changes)
	}
	if !strings.HasSuffix(entry.Path, filepath.ToSlash(filepath.Base(dir))) {
		t.Fatalf("path = %q", entry.Path)
	}

	if _, ok := runner.WorkspaceStatus(ctx, t.TempDir()); ok {
		t.Fatal("non-repository should not be recognized")
	}
}
