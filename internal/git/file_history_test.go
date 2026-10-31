package git

import (
	"context"
	"testing"
)

func TestFileHistoryAndBlame(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	commitTestFile(t, runner, dir, "hello.txt", "second hello")
	commitTestFile(t, runner, dir, "hello.txt", "third hello")

	commits, err := runner.FileHistory(ctx, dir, "hello.txt", 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(commits) < 3 {
		t.Fatalf("expected at least 3 file commits, got %d", len(commits))
	}
	if commits[0].Subject != "third hello" {
		t.Fatalf("latest subject = %q", commits[0].Subject)
	}

	lines, err := runner.Blame(ctx, dir, "hello.txt")
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) == 0 || lines[0].Author != "Test User" {
		t.Fatalf("blame lines = %#v", lines)
	}
	if lines[0].Text != "third hello" {
		t.Fatalf("blame text = %q", lines[0].Text)
	}
}
