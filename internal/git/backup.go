package git

import (
	"context"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

// BackupWorktree creates a stash commit without modifying the working tree. The
// returned commit captures tracked staged and unstaged changes.
func (r *Runner) BackupWorktree(ctx context.Context, root string) (string, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return "", err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "stash", "create", "puffgittt backup")
	if err != nil {
		return "", r.OutputError(out, errOut, err)
	}
	return strings.TrimSpace(out), nil
}

func (r *Runner) ApplyBackup(ctx context.Context, root, ref string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	if strings.TrimSpace(ref) == "" {
		return model.OperationResult{}, nil
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "stash", "apply", "--index", ref)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Backup restore failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Backup restored", Output: strings.TrimSpace(out)}, nil
}
