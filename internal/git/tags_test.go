package git

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestRemoteTagsAndDetails(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	if _, err := runner.Run(ctx, dir, "tag", "-a", "v1.0.0", "-m", "release one"); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "tag", "v1.0.1"); err != nil {
		t.Fatal(err)
	}
	tags, err := runner.Tags(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	var annotated Tag
	for _, tag := range tags {
		if tag.Name == "v1.0.0" {
			annotated = tag
		}
	}
	if !annotated.Annotated || annotated.Tagger == "" || annotated.TargetOid == "" || annotated.Message != "release one" {
		t.Fatalf("annotated tag = %#v", annotated)
	}

	remote := filepath.Join(t.TempDir(), "remote.git")
	if _, err := runner.Run(ctx, "", "init", "--bare", remote); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "remote", "add", "origin", remote); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "push", "origin", "--tags"); err != nil {
		t.Fatal(err)
	}

	remoteTags, err := runner.RemoteTags(ctx, dir, "origin")
	if err != nil {
		t.Fatal(err)
	}
	if len(remoteTags) != 2 {
		t.Fatalf("remote tags = %#v", remoteTags)
	}
	if _, err := runner.DeleteRemoteTag(ctx, dir, "origin", "v1.0.1"); err != nil {
		t.Fatal(err)
	}
	remoteTags, err = runner.RemoteTags(ctx, dir, "origin")
	if err != nil {
		t.Fatal(err)
	}
	if len(remoteTags) != 1 || remoteTags[0].Name != "v1.0.0" {
		t.Fatalf("remote tags after delete = %#v", remoteTags)
	}
	_ = os.Remove(remote)
}
