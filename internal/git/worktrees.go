package git

import (
	"context"
	"fmt"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) Worktrees(ctx context.Context, root string) ([]model.Worktree, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "worktree", "list", "--porcelain")
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	worktrees := []model.Worktree{}
	current := model.Worktree{}
	flush := func() {
		if current.Path != "" {
			worktrees = append(worktrees, current)
		}
		current = model.Worktree{}
	}
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			flush()
			continue
		}
		switch {
		case strings.HasPrefix(line, "worktree "):
			current.Path = strings.TrimPrefix(line, "worktree ")
		case strings.HasPrefix(line, "HEAD "):
			current.Head = strings.TrimPrefix(line, "HEAD ")
		case strings.HasPrefix(line, "branch "):
			current.Branch = strings.TrimPrefix(strings.TrimPrefix(line, "branch "), "refs/heads/")
		case line == "bare":
			current.Bare = true
		case line == "detached":
			current.Detached = true
		case strings.HasPrefix(line, "locked"):
			current.Locked = true
			current.LockReason = strings.TrimSpace(strings.TrimPrefix(line, "locked"))
		case strings.HasPrefix(line, "prunable"):
			current.Prunable = true
			current.PruneReason = strings.TrimSpace(strings.TrimPrefix(line, "prunable"))
		}
	}
	flush()
	return worktrees, nil
}

func (r *Runner) AddWorktree(ctx context.Context, root, path, branch string, createBranch bool) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	path = strings.TrimSpace(path)
	branch = strings.TrimSpace(branch)
	if path == "" || branch == "" {
		return model.OperationResult{}, fmt.Errorf("worktree path and branch are required")
	}
	args := []string{"worktree", "add"}
	if createBranch {
		args = append(args, "-b", branch, path)
	} else {
		args = append(args, path, branch)
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Worktree added", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) RemoveWorktree(ctx context.Context, root, path string, force bool) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{"worktree", "remove"}
	if force {
		args = append(args, "--force")
	}
	args = append(args, path)
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Worktree removed", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) PruneWorktrees(ctx context.Context, root string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "worktree", "prune")
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Worktrees pruned", Output: strings.TrimSpace(out)}, nil
}
