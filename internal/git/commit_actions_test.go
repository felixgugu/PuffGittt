package git

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/felixgugu/puffgittt/internal/model"
)

func commitTestFile(t *testing.T, runner *Runner, dir, name, message string) string {
	t.Helper()
	ctx := context.Background()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(message+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "add", name); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "commit", "-m", message); err != nil {
		t.Fatal(err)
	}
	out, err := runner.Run(ctx, dir, "rev-parse", "HEAD")
	if err != nil {
		t.Fatal(err)
	}
	return strings.TrimSpace(out)
}

func TestPreviewHistoryCommands(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()
	rootOut, err := runner.Run(ctx, dir, "rev-list", "--max-parents=0", "HEAD")
	if err != nil {
		t.Fatal(err)
	}
	rootOid := strings.TrimSpace(rootOut)
	secondOid := commitTestFile(t, runner, dir, "second.txt", "second")
	thirdOid := commitTestFile(t, runner, dir, "third.txt", "third")

	tests := []struct {
		name        string
		request     model.CommandRequest
		command     string
		destructive bool
	}{
		{
			name:    "reset soft",
			request: model.CommandRequest{Action: "reset", Target: secondOid, Strategy: "soft"},
			command: "git reset --soft " + secondOid,
		},
		{
			name:        "reset hard",
			request:     model.CommandRequest{Action: "reset", Target: secondOid, Strategy: "hard"},
			command:     "git reset --hard " + secondOid,
			destructive: true,
		},
		{
			name:    "revert",
			request: model.CommandRequest{Action: "revert", Target: secondOid},
			command: "git revert --no-edit " + secondOid,
		},
		{
			name:        "drop head",
			request:     model.CommandRequest{Action: "drop", Target: thirdOid},
			command:     "git reset --hard " + secondOid,
			destructive: true,
		},
		{
			name:        "drop middle",
			request:     model.CommandRequest{Action: "drop", Target: secondOid},
			command:     "git rebase --onto " + rootOid + " " + secondOid,
			destructive: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			preview, err := runner.PreviewHistoryCommand(ctx, dir, test.request)
			if err != nil {
				t.Fatal(err)
			}
			if preview.Command != test.command {
				t.Fatalf("command = %q, want %q", preview.Command, test.command)
			}
			if preview.Destructive != test.destructive {
				t.Fatalf("destructive = %v, want %v", preview.Destructive, test.destructive)
			}
		})
	}

	if _, err := runner.PreviewHistoryCommand(ctx, dir, model.CommandRequest{Action: "drop", Target: rootOid}); err == nil {
		t.Fatal("expected root commit drop to fail")
	}
}
