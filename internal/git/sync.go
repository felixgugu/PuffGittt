package git

import (
	"context"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) Remotes(ctx context.Context, root string) ([]model.Remote, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "remote", "-v")
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	remotes := map[string]*model.Remote{}
	order := []string{}
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		name, url, kind := fields[0], fields[1], fields[2]
		remote, ok := remotes[name]
		if !ok {
			remote = &model.Remote{Name: name}
			remotes[name] = remote
			order = append(order, name)
		}
		if kind == "(fetch)" {
			remote.FetchURL = url
		} else if kind == "(push)" {
			remote.PushURL = url
		}
	}
	result := []model.Remote{}
	for _, name := range order {
		result = append(result, *remotes[name])
	}
	return result, nil
}

func FetchArgs(remote string) []string {
	args := []string{"fetch", "--progress"}
	if strings.TrimSpace(remote) != "" {
		args = append(args, remote)
	}
	return args
}

func PullArgs(remote, branch, strategy string) []string {
	args := []string{"pull"}
	switch strategy {
	case "rebase":
		args = append(args, "--rebase")
	case "ff-only":
		args = append(args, "--ff-only")
	default:
		args = append(args, "--no-rebase")
	}
	if strings.TrimSpace(remote) != "" {
		args = append(args, remote)
		if strings.TrimSpace(branch) != "" {
			args = append(args, branch)
		}
	}
	return args
}

func PushArgs(remote, branch string) []string {
	args := []string{"push", "--progress"}
	if strings.TrimSpace(remote) != "" {
		args = append(args, remote)
		if strings.TrimSpace(branch) != "" {
			args = append(args, branch)
		}
	}
	return args
}

func (r *Runner) Fetch(ctx context.Context, root, remote string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, FetchArgs(remote)...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Fetch failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Fetch complete", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) Pull(ctx context.Context, root, remote, branch, strategy string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, PullArgs(remote, branch, strategy)...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Pull failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Pull complete", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) Push(ctx context.Context, root, remote, branch string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, PushArgs(remote, branch)...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Push failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Push complete", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}
