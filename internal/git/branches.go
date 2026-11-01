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

func CreateBranchArgs(name, startOid string) []string {
	args := []string{"branch", name}
	if strings.TrimSpace(startOid) != "" {
		args = append(args, startOid)
	}
	return args
}

func SwitchBranchArgs(name string) []string {
	return []string{"switch", name}
}

func DeleteBranchArgs(name string, force bool) []string {
	flag := "-d"
	if force {
		flag = "-D"
	}
	return []string{"branch", flag, name}
}

func RenameBranchArgs(oldName, newName string) []string {
	return []string{"branch", "-m", oldName, newName}
}

func SetUpstreamArgs(branch, upstream string) []string {
	return []string{"branch", "--set-upstream-to=" + upstream, branch}
}

func CheckoutRemoteArgs(localName, remoteBranch string) []string {
	return []string{"switch", "-c", localName, "--track", remoteBranch}
}

func MergeArgs(source, strategy string) []string {
	args := []string{"merge"}
	switch strategy {
	case "no-ff":
		args = append(args, "--no-ff")
	case "squash":
		args = append(args, "--squash")
	}
	return append(args, source)
}

func RebaseArgs(onto string) []string {
	return []string{"rebase", onto}
}

func (r *Runner) CreateBranch(ctx context.Context, root, name, startOid string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, CreateBranchArgs(name, startOid)...)
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
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, SwitchBranchArgs(name)...)
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
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, DeleteBranchArgs(name, force)...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Branch deleted", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) RenameBranch(ctx context.Context, root, oldName, newName string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, RenameBranchArgs(oldName, newName)...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Branch renamed", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) SetUpstream(ctx context.Context, root, branch, upstream string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, SetUpstreamArgs(branch, upstream)...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Upstream updated", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) CheckoutRemoteBranch(ctx context.Context, root, localName, remoteBranch string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, CheckoutRemoteArgs(localName, remoteBranch)...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Checked out remote branch", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) Merge(ctx context.Context, root, source, strategy string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunTask(ctx, repo.RootPath, nil, MergeArgs(source, strategy)...)
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
	out, errOut, err := r.RunTask(ctx, repo.RootPath, nil, RebaseArgs(onto)...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Rebase requires attention", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Rebased", Output: strings.TrimSpace(out)}, nil
}
