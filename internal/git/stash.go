package git

import (
	"context"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) StashList(ctx context.Context, root string) ([]model.StashEntry, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "stash", "list", "--format=%gd%x1f%H%x1f%gs%x1f%cI")
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	entries := []model.StashEntry{}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Split(line, "\x1f")
		if len(fields) < 4 {
			continue
		}
		entries = append(entries, model.StashEntry{Ref: fields[0], Oid: fields[1], Message: fields[2], Date: fields[3]})
	}
	return entries, nil
}

func (r *Runner) StashPush(ctx context.Context, root, message string, includeUntracked bool) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{"stash", "push"}
	if includeUntracked {
		args = append(args, "-u")
	}
	if strings.TrimSpace(message) != "" {
		args = append(args, "-m", message)
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Stashed", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) StashApply(ctx context.Context, root, ref string, drop bool) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	action := "apply"
	if drop {
		action = "pop"
	}
	if strings.TrimSpace(ref) == "" {
		ref = "stash@{0}"
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "stash", action, ref)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Stash needs attention", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Stash applied", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) StashDrop(ctx context.Context, root, ref string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	if strings.TrimSpace(ref) == "" {
		ref = "stash@{0}"
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "stash", "drop", ref)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Stash dropped", Output: strings.TrimSpace(out)}, nil
}
