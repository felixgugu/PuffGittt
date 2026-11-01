package git

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLFSTrackAndUntrack(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	status, err := runner.LFSStatus(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if !status.Installed {
		t.Skip("git lfs is not installed")
	}

	if _, err := runner.TrackLFS(ctx, dir, "*.bin"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(dir, ".gitattributes"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "*.bin filter=lfs") {
		t.Fatalf(".gitattributes = %q", data)
	}
	status, err = runner.LFSStatus(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, pattern := range status.Patterns {
		if pattern == "*.bin" {
			found = true
		}
	}
	if !found {
		t.Fatalf("patterns = %#v", status.Patterns)
	}

	if _, err := runner.UntrackLFS(ctx, dir, "*.bin"); err != nil {
		t.Fatal(err)
	}
	status, err = runner.LFSStatus(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, pattern := range status.Patterns {
		if pattern == "*.bin" {
			t.Fatalf("pattern still tracked: %#v", status.Patterns)
		}
	}
}
