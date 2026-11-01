package git

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

// WorkspaceStatus returns the lightweight metadata shown in the sidebar using a
// single `git status --branch` call. It assumes path is already a repository
// root, which avoids the multiple rev-parse calls performed by Open.
func (r *Runner) WorkspaceStatus(ctx context.Context, path string) (model.WorkspaceRepository, bool) {
	clean := filepath.Clean(path)
	entry := model.WorkspaceRepository{
		Name: filepath.Base(clean),
		Path: filepath.ToSlash(clean),
	}
	out, _, err := r.RunBytes(ctx, path, nil,
		"--no-optional-locks", "status", "--porcelain=v2", "-z", "--branch", "--untracked-files=normal")
	if err != nil {
		return model.WorkspaceRepository{}, false
	}
	for _, token := range strings.Split(out, "\x00") {
		switch {
		case strings.HasPrefix(token, "# branch.head "):
			head := strings.TrimSpace(strings.TrimPrefix(token, "# branch.head "))
			if head != "(detached)" {
				entry.Branch = head
			}
		case strings.HasPrefix(token, "1 "), strings.HasPrefix(token, "2 "),
			strings.HasPrefix(token, "u "), strings.HasPrefix(token, "? "):
			entry.Changes++
		}
	}
	return entry, true
}
