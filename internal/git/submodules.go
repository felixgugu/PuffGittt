package git

import (
	"context"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) Submodules(ctx context.Context, root string) ([]model.Submodule, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "submodule", "status")
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	submodules := []model.Submodule{}
	for _, line := range strings.Split(out, "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		status := "clean"
		prefix := line[0]
		switch prefix {
		case '-':
			status = "uninitialized"
		case '+':
			status = "modified"
		case 'U':
			status = "conflict"
		case ' ':
			status = "clean"
		default:
			status = "unknown"
		}
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 2 {
			continue
		}
		entry := model.Submodule{Status: status, Oid: fields[0]}
		entry.Path = fields[1]
		if start := strings.Index(line, "("); start >= 0 {
			entry.Describe = strings.TrimSuffix(line[start+1:], ")")
		}
		submodules = append(submodules, entry)
	}
	return submodules, nil
}

func (r *Runner) UpdateSubmodule(ctx context.Context, root, path string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{"submodule", "update", "--init", "--recursive"}
	if strings.TrimSpace(path) != "" {
		args = append(args, "--", path)
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Submodule update failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Submodules updated", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) SyncSubmodules(ctx context.Context, root string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "submodule", "sync", "--recursive")
	if err != nil {
		return model.OperationResult{Success: false, Message: "Submodule sync failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Submodules synced", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}
