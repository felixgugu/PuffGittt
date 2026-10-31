package git

import (
	"context"
	"testing"

	"github.com/felixgugu/puffgittt/internal/model"
)

func TestPreviewBranchCommands(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()
	if _, err := runner.Run(ctx, dir, "branch", "feature"); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name        string
		request     model.CommandRequest
		command     string
		destructive bool
	}{
		{
			name:    "merge",
			request: model.CommandRequest{Action: "merge", Source: "feature", Strategy: "merge"},
			command: "git merge feature",
		},
		{
			name:        "rebase",
			request:     model.CommandRequest{Action: "rebase", Target: "main"},
			command:     "git rebase main",
			destructive: true,
		},
		{
			name:    "switch",
			request: model.CommandRequest{Action: "switch", Name: "feature"},
			command: "git switch feature",
		},
		{
			name:        "delete",
			request:     model.CommandRequest{Action: "delete", Name: "feature"},
			command:     "git branch -d feature",
			destructive: true,
		},
		{
			name:    "create",
			request: model.CommandRequest{Action: "create", Name: "topic", StartPoint: "HEAD"},
			command: "git branch topic HEAD",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			preview, err := runner.PreviewBranchCommand(ctx, dir, test.request)
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
}

func TestPreviewSyncCommands(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	tests := []struct {
		request model.CommandRequest
		command string
	}{
		{request: model.CommandRequest{Action: "fetch"}, command: "git fetch --progress"},
		{request: model.CommandRequest{Action: "pull", Strategy: "merge"}, command: "git pull --no-rebase"},
		{request: model.CommandRequest{Action: "push"}, command: "git push --progress"},
	}

	for _, test := range tests {
		preview, err := runner.PreviewSyncCommand(ctx, dir, test.request)
		if err != nil {
			t.Fatal(err)
		}
		if preview.Command != test.command {
			t.Fatalf("command = %q, want %q", preview.Command, test.command)
		}
	}
}
