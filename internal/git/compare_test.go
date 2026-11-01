package git

import (
	"context"
	"strings"
	"testing"
)

func TestCompareBranches(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	if _, err := runner.Run(ctx, dir, "checkout", "-b", "feature"); err != nil {
		t.Fatal(err)
	}
	commitTestFile(t, runner, dir, "feature.txt", "feature work")
	if _, err := runner.Run(ctx, dir, "checkout", "main"); err != nil {
		t.Fatal(err)
	}
	commitTestFile(t, runner, dir, "main.txt", "main work")

	compare, err := runner.CompareBranches(ctx, dir, "main", "feature")
	if err != nil {
		t.Fatal(err)
	}
	if compare.Ahead != 1 || compare.Behind != 1 {
		t.Fatalf("ahead/behind = %d/%d, want 1/1", compare.Ahead, compare.Behind)
	}
	if len(compare.AheadCommits) != 1 || compare.AheadCommits[0].Subject != "feature work" {
		t.Fatalf("ahead commits = %#v", compare.AheadCommits)
	}
	if len(compare.BehindCommits) != 1 || compare.BehindCommits[0].Subject != "main work" {
		t.Fatalf("behind commits = %#v", compare.BehindCommits)
	}
	found := false
	for _, file := range compare.Files {
		if file.Path == "feature.txt" {
			found = true
		}
	}
	if !found {
		t.Fatalf("files = %#v", compare.Files)
	}

	diff, err := runner.CompareDiff(ctx, dir, "main", "feature", "feature.txt")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(diff.NewText, "feature work") {
		t.Fatalf("diff = %#v", diff)
	}
}
