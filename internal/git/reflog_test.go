package git

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestReflogReturnsHeadEntries(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hello\nworld\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "add", "hello.txt"); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "commit", "-m", "second commit"); err != nil {
		t.Fatal(err)
	}

	entries, err := runner.Reflog(ctx, dir, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) < 2 {
		t.Fatalf("expected at least 2 reflog entries, got %d", len(entries))
	}
	head, err := runner.HeadOid(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if entries[0].Oid != head {
		t.Fatalf("first reflog oid %q != head %q", entries[0].Oid, head)
	}
	if entries[0].Selector != "HEAD@{0}" || entries[1].Selector != "HEAD@{1}" {
		t.Fatalf("unexpected selectors: %q, %q", entries[0].Selector, entries[1].Selector)
	}
	if entries[0].Action != "commit" || entries[0].Message != "second commit" {
		t.Fatalf("unexpected action/message: %q / %q", entries[0].Action, entries[0].Message)
	}
	if entries[0].PreviousOid != entries[1].Oid {
		t.Fatalf("previous oid %q != second entry %q", entries[0].PreviousOid, entries[1].Oid)
	}
	if _, err := time.Parse(time.RFC3339, entries[0].Date); err != nil {
		t.Fatalf("reflog date %q is not RFC3339: %v", entries[0].Date, err)
	}
}
