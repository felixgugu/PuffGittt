//go:build windows

package platform

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestOpenInExplorerRejectsEmptyPath(t *testing.T) {
	err := OpenInExplorer("   ")
	if err == nil || !strings.Contains(err.Error(), "路徑不可為空") {
		t.Fatalf("expected empty-path error, got %v", err)
	}
}

func TestOpenInExplorerReportsMissingPath(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "does-not-exist")
	err := OpenInExplorer(missing)
	if err == nil {
		t.Fatalf("expected missing-path error")
	}
	if !strings.Contains(err.Error(), "無法開啟檔案總管") {
		t.Fatalf("unexpected error: %v", err)
	}
}
