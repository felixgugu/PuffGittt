package git

import (
	"context"
	"strings"
	"testing"
)

func TestLogSearchModes(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()
	commitTestFile(t, runner, dir, "a.txt", "add alpha")
	headOid := commitTestFile(t, runner, dir, "b.txt", "add beta")

	message, err := runner.LogSearch(ctx, dir, "main", false, 20, "add", "message")
	if err != nil {
		t.Fatal(err)
	}
	if len(message) != 2 {
		t.Fatalf("message search = %#v", message)
	}

	author, err := runner.LogSearch(ctx, dir, "main", false, 20, "Test User", "author")
	if err != nil {
		t.Fatal(err)
	}
	if len(author) != 3 {
		t.Fatalf("author search = %#v", author)
	}

	path, err := runner.LogSearch(ctx, dir, "main", false, 20, "a.txt", "path")
	if err != nil {
		t.Fatal(err)
	}
	if len(path) != 1 || path[0].Subject != "add alpha" {
		t.Fatalf("path search = %#v", path)
	}

	sha, err := runner.LogSearch(ctx, dir, "main", false, 20, strings.ToLower(headOid[:8]), "sha")
	if err != nil {
		t.Fatal(err)
	}
	if len(sha) != 1 || sha[0].Oid != headOid {
		t.Fatalf("sha search = %#v", sha)
	}

	empty, err := runner.LogSearch(ctx, dir, "main", false, 20, "Nobody", "author")
	if err != nil {
		t.Fatal(err)
	}
	if len(empty) != 0 {
		t.Fatalf("author miss = %#v", empty)
	}
}
