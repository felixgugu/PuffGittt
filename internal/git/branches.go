package git

import (
	"context"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) Branches(ctx context.Context, root string) ([]model.Branch, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil,
		"for-each-ref",
		"--format=%(refname:short)%1f%(objectname)%1f%(refname)%1f%(upstream:short)%1f%(committerdate:iso-strict)%1f%(HEAD)",
		"refs/heads", "refs/remotes")
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}

	merged := map[string]bool{}
	if mergedOut, _, err := r.RunBytes(ctx, repo.RootPath, nil, "branch", "--merged", "HEAD", "--format=%(refname:short)"); err == nil {
		for _, line := range strings.Split(mergedOut, "\n") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "* "))
			if line != "" {
				merged[line] = true
			}
		}
	}

	branches := []model.Branch{}
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Split(line, "\x1f")
		if len(fields) < 6 {
			continue
		}
		name := fields[0]
		fullName := fields[2]
		kind := "local"
		if strings.HasPrefix(fullName, "refs/remotes/") {
			kind = "remote"
			if strings.HasSuffix(name, "/HEAD") {
				continue
			}
		}
		branches = append(branches, model.Branch{
			Name:          name,
			FullName:      fullName,
			Kind:          kind,
			Oid:           fields[1],
			Upstream:      fields[3],
			CommitterDate: fields[4],
			Current:       strings.TrimSpace(fields[5]) == "*",
			Merged:        merged[name],
		})
	}
	return branches, nil
}

func (r *Runner) CreateBranch(ctx context.Context, root, name, startOid string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{"branch", name}
	if strings.TrimSpace(startOid) != "" {
		args = append(args, startOid)
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Branch created", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) SwitchBranch(ctx context.Context, root, name string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "switch", name)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Switched branch", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) DeleteBranch(ctx context.Context, root, name string, force bool) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	flag := "-d"
	if force {
		flag = "-D"
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "branch", flag, name)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Branch deleted", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) Merge(ctx context.Context, root, source, strategy string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{"merge"}
	switch strategy {
	case "no-ff":
		args = append(args, "--no-ff")
	case "squash":
		args = append(args, "--squash")
	}
	args = append(args, source)
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Merge requires attention", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Merged", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) Rebase(ctx context.Context, root, onto string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "rebase", onto)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Rebase requires attention", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Rebased", Output: strings.TrimSpace(out)}, nil
}
