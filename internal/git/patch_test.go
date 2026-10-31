package git

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/felixgugu/puffgittt/internal/model"
)

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func indexContent(t *testing.T, runner *Runner, dir, name string) string {
	t.Helper()
	out, err := runner.Run(context.Background(), dir, "show", ":"+name)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func commitAll(t *testing.T, runner *Runner, dir, message string) {
	t.Helper()
	if _, err := runner.Run(context.Background(), dir, "add", "-A"); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(context.Background(), dir, "commit", "-m", message); err != nil {
		t.Fatal(err)
	}
}

func TestApplyHunksStagesSingleHunk(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	base := strings.Join([]string{
		"line01", "line02", "line03", "line04", "line05", "line06",
		"line07", "line08", "line09", "line10", "line11", "line12",
		"line13", "line14", "line15", "line16", "line17", "line18",
		"line19", "line20", "",
	}, "\n")
	writeFile(t, dir, "hello.txt", base)
	commitAll(t, runner, dir, "base")

	changed := strings.Replace(base, "line02", "line02-changed", 1)
	changed = strings.Replace(changed, "line19", "line19-changed", 1)
	writeFile(t, dir, "hello.txt", changed)

	doc, err := runner.Diff(ctx, dir, "hello.txt", "unstaged", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(doc.Hunks) != 2 {
		t.Fatalf("expected 2 hunks, got %d", len(doc.Hunks))
	}
	if doc.PatchHash == "" {
		t.Fatal("expected patch hash")
	}
	if _, err := runner.ApplyHunks(ctx, dir, "hello.txt", "unstaged", doc.PatchHash, []model.HunkSelection{{Hunk: 0}}); err != nil {
		t.Fatal(err)
	}
	staged := indexContent(t, runner, dir, "hello.txt")
	if !strings.Contains(staged, "line02-changed") {
		t.Fatalf("first hunk was not staged:\n%s", staged)
	}
	if strings.Contains(staged, "line19-changed") {
		t.Fatalf("second hunk should not be staged:\n%s", staged)
	}
}

func TestApplyHunksLineSelectionAndUnstage(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	writeFile(t, dir, "hello.txt", "alpha\nbeta\ngamma\n")
	commitAll(t, runner, dir, "base")
	writeFile(t, dir, "hello.txt", "alpha\nbeta-one\nbeta-two\ngamma\n")

	doc, err := runner.Diff(ctx, dir, "hello.txt", "unstaged", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(doc.Hunks) != 1 {
		t.Fatalf("expected 1 hunk, got %d", len(doc.Hunks))
	}
	addLines := []int{}
	for index, line := range doc.Hunks[0].Lines {
		if line.Kind == "add" {
			addLines = append(addLines, index)
		}
	}
	if len(addLines) != 2 {
		t.Fatalf("expected 2 added lines, got %d", len(addLines))
	}
	if _, err := runner.ApplyHunks(ctx, dir, "hello.txt", "unstaged", doc.PatchHash, []model.HunkSelection{{Hunk: 0, Lines: addLines[:1]}}); err != nil {
		t.Fatal(err)
	}
	staged := indexContent(t, runner, dir, "hello.txt")
	if !strings.Contains(staged, "beta-one") || strings.Contains(staged, "beta-two") {
		t.Fatalf("expected only beta-one in index:\n%s", staged)
	}
	if !strings.Contains(staged, "beta") {
		t.Fatalf("unselected deletion should remain in index:\n%s", staged)
	}

	stagedDoc, err := runner.Diff(ctx, dir, "hello.txt", "staged", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(stagedDoc.Hunks) != 1 {
		t.Fatalf("expected 1 staged hunk, got %d", len(stagedDoc.Hunks))
	}
	addedIndex := -1
	for index, line := range stagedDoc.Hunks[0].Lines {
		if line.Kind == "add" && line.Text == "beta-one" {
			addedIndex = index
		}
	}
	if addedIndex < 0 {
		t.Fatalf("staged hunk has no beta-one addition: %#v", stagedDoc.Hunks[0].Lines)
	}
	if _, err := runner.ApplyHunks(ctx, dir, "hello.txt", "staged", stagedDoc.PatchHash, []model.HunkSelection{{Hunk: 0, Lines: []int{addedIndex}}}); err != nil {
		t.Fatal(err)
	}
	unstaged := indexContent(t, runner, dir, "hello.txt")
	if strings.Contains(unstaged, "beta-one") {
		t.Fatalf("beta-one should be unstaged:\n%s", unstaged)
	}
	if !strings.Contains(unstaged, "beta") {
		t.Fatalf("index should be back at HEAD:\n%s", unstaged)
	}
}

func TestApplyHunksRejectsStalePatch(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()
	writeFile(t, dir, "hello.txt", "hello\nworld\n")

	doc, err := runner.Diff(ctx, dir, "hello.txt", "unstaged", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := runner.ApplyHunks(ctx, dir, "hello.txt", "unstaged", "stale", []model.HunkSelection{{Hunk: 0}}); err == nil {
		t.Fatal("expected stale patch error")
	}
	if strings.Contains(indexContent(t, runner, dir, "hello.txt"), "world") {
		t.Fatal("index should not change on stale patch")
	}
	_ = doc
}

func TestApplyHunksPreservesNoNewline(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	writeFile(t, dir, "hello.txt", "alpha\nbeta")
	commitAll(t, runner, dir, "no newline")
	writeFile(t, dir, "hello.txt", "alpha\nbeta-changed")

	doc, err := runner.Diff(ctx, dir, "hello.txt", "unstaged", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(doc.Hunks) != 1 {
		t.Fatalf("expected 1 hunk, got %d", len(doc.Hunks))
	}
	if _, err := runner.ApplyHunks(ctx, dir, "hello.txt", "unstaged", doc.PatchHash, []model.HunkSelection{{Hunk: 0}}); err != nil {
		t.Fatal(err)
	}
	staged := indexContent(t, runner, dir, "hello.txt")
	if !strings.HasSuffix(staged, "beta-changed") {
		t.Fatalf("index content = %q", staged)
	}
}

func TestApplyHunksUnstagePartialNewFile(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	writeFile(t, dir, "new.txt", "one\ntwo\nthree\n")
	if _, err := runner.Run(ctx, dir, "add", "new.txt"); err != nil {
		t.Fatal(err)
	}
	doc, err := runner.Diff(ctx, dir, "new.txt", "staged", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(doc.Hunks) != 1 {
		t.Fatalf("expected 1 hunk, got %d", len(doc.Hunks))
	}
	selected := -1
	for index, line := range doc.Hunks[0].Lines {
		if line.Kind == "add" && line.Text == "two" {
			selected = index
		}
	}
	if selected < 0 {
		t.Fatalf("no two addition in hunk: %#v", doc.Hunks[0].Lines)
	}
	if _, err := runner.ApplyHunks(ctx, dir, "new.txt", "staged", doc.PatchHash, []model.HunkSelection{{Hunk: 0, Lines: []int{selected}}}); err != nil {
		t.Fatal(err)
	}
	staged := indexContent(t, runner, dir, "new.txt")
	if strings.Contains(staged, "two") || !strings.Contains(staged, "one") || !strings.Contains(staged, "three") {
		t.Fatalf("unexpected partial new file content: %q", staged)
	}
}
