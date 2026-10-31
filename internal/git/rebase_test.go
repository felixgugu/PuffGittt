package git

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/felixgugu/puffgittt/internal/model"
)

func TestInteractiveRebaseDropAndSquash(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	base := commitTestFile(t, runner, dir, "a.txt", "A")
	commitTestFile(t, runner, dir, "b.txt", "B")
	third := commitTestFile(t, runner, dir, "c.txt", "C")

	plan, err := runner.RebasePlan(ctx, dir, base)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan) != 2 {
		t.Fatalf("plan = %#v", plan)
	}
	plan[1].Action = "drop"
	result, err := runner.InteractiveRebase(ctx, dir, base, plan)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Success {
		t.Fatalf("result = %#v", result)
	}
	if _, err := os.Stat(filepath.Join(dir, "c.txt")); !os.IsNotExist(err) {
		t.Fatalf("c.txt should be dropped")
	}
	tree, err := runner.Run(ctx, dir, "log", "--format=%s", base+"..HEAD")
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(tree) != "B" {
		t.Fatalf("log = %q", tree)
	}

	// Squash the dropped commit's replacement into a single commit.
	plan, err = runner.RebasePlan(ctx, dir, base)
	if err != nil {
		t.Fatal(err)
	}
	commitTestFile(t, runner, dir, "d.txt", "D")
	_ = third
	plan, err = runner.RebasePlan(ctx, dir, base)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan) != 2 {
		t.Fatalf("plan after d = %#v", plan)
	}
	plan[1].Action = "squash"
	if _, err := runner.InteractiveRebase(ctx, dir, base, plan); err != nil {
		t.Fatal(err)
	}
	count, err := runner.Run(ctx, dir, "rev-list", "--count", base+"..HEAD")
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(count) != "1" {
		t.Fatalf("squashed commit count = %q", count)
	}
}

func TestInteractiveRebaseRejectsStalePlan(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()
	base := commitTestFile(t, runner, dir, "a.txt", "A")
	commitTestFile(t, runner, dir, "b.txt", "B")

	plan, err := runner.RebasePlan(ctx, dir, base)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan) != 1 {
		t.Fatalf("plan = %#v", plan)
	}
	commitTestFile(t, runner, dir, "c.txt", "C")
	if _, err := runner.InteractiveRebase(ctx, dir, base, plan); err == nil {
		t.Fatal("expected stale plan error")
	}
	_ = model.RebaseTodo{}
}
