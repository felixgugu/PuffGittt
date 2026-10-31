package git

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestSubmodulesListAndUpdate(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	subDir := t.TempDir()
	if _, err := runner.Run(ctx, "", "init", "--initial-branch", "main", subDir); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, subDir, "config", "user.email", "test@example.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, subDir, "config", "user.name", "Test User"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(subDir, "sub.txt"), []byte("sub\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, subDir, "add", "sub.txt"); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, subDir, "commit", "-m", "sub"); err != nil {
		t.Fatal(err)
	}

	t.Setenv("GIT_ALLOW_PROTOCOL", "file")
	if _, err := runner.Run(ctx, dir, "-c", "protocol.file.allow=always", "submodule", "add", subDir, "vendor/demo"); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "commit", "-m", "add submodule"); err != nil {
		t.Fatal(err)
	}

	submodules, err := runner.Submodules(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(submodules) != 1 || submodules[0].Path != "vendor/demo" {
		t.Fatalf("submodules = %#v", submodules)
	}
	if _, err := runner.UpdateSubmodule(ctx, dir, "vendor/demo"); err != nil {
		t.Fatal(err)
	}
}
