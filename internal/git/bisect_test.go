package git

import (
	"context"
	"testing"
)

func TestBisectStartAndReset(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()
	good := commitTestFile(t, runner, dir, "a.txt", "A")
	commitTestFile(t, runner, dir, "b.txt", "B")
	if _, err := runner.Run(ctx, dir, "rev-parse", "HEAD"); err != nil {
		t.Fatal(err)
	}

	state, err := runner.BisectState(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if state.Active {
		t.Fatalf("bisect should not be active: %#v", state)
	}

	if _, err := runner.BisectStart(ctx, dir, "HEAD", good); err != nil {
		t.Fatal(err)
	}
	state, err = runner.BisectState(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if !state.Active || state.Branch != "main" {
		t.Fatalf("bisect state = %#v", state)
	}

	if _, err := runner.BisectReset(ctx, dir); err != nil {
		t.Fatal(err)
	}
	state, err = runner.BisectState(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if state.Active {
		t.Fatalf("bisect should be reset: %#v", state)
	}
}
