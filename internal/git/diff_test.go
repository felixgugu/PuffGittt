package git

import (
	"bytes"
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func TestDiffReturnsImageData(t *testing.T) {
	runner, dir := setupRepo(t)
	ctx := context.Background()

	oldBytes := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3}
	newBytes := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 4, 5, 6}
	if err := os.WriteFile(filepath.Join(dir, "icon.png"), oldBytes, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "add", "icon.png"); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Run(ctx, dir, "commit", "-m", "icon"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "icon.png"), newBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	doc, err := runner.Diff(ctx, dir, "icon.png", "unstaged", "")
	if err != nil {
		t.Fatal(err)
	}
	if !doc.Image || doc.ImageMime != "image/png" {
		t.Fatalf("document = %#v", doc)
	}
	oldDecoded, err := base64.StdEncoding.DecodeString(doc.OldImage)
	if err != nil {
		t.Fatal(err)
	}
	newDecoded, err := base64.StdEncoding.DecodeString(doc.NewImage)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(oldDecoded, oldBytes) || !bytes.Equal(newDecoded, newBytes) {
		t.Fatalf("image bytes do not round-trip")
	}
}
