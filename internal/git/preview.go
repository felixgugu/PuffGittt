package git

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func CommandString(args []string) string {
	parts := make([]string, 0, len(args)+1)
	parts = append(parts, "git")
	for _, arg := range args {
		if strings.ContainsAny(arg, " \t\"") {
			parts = append(parts, strconv.Quote(arg))
			continue
		}
		parts = append(parts, arg)
	}
	return strings.Join(parts, " ")
}

func (r *Runner) verifyRevision(ctx context.Context, root, revision string) error {
	if strings.TrimSpace(revision) == "" {
		return fmt.Errorf("revision is required")
	}
	_, errOut, err := r.RunBytes(ctx, root, nil, "rev-parse", "--verify", revision+"^{commit}")
	if err != nil {
		return fmt.Errorf("unknown revision %q: %s", revision, strings.TrimSpace(errOut))
	}
	return nil
}

func (r *Runner) verifyLocalBranch(ctx context.Context, root, name string) error {
	return r.verifyRevision(ctx, root, "refs/heads/"+name)
}

func (r *Runner) verifyBranchName(ctx context.Context, root, name string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("branch name is required")
	}
	_, errOut, err := r.RunBytes(ctx, root, nil, "check-ref-format", "--branch", name)
	if err != nil {
		return fmt.Errorf("invalid branch name %q: %s", name, strings.TrimSpace(errOut))
	}
	return nil
}

func (r *Runner) PreviewBranchCommand(ctx context.Context, root string, req model.CommandRequest) (model.CommandPreview, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.CommandPreview{}, err
	}

	destructive := false
	var args []string
	switch req.Action {
	case "merge":
		if err := r.verifyLocalBranch(ctx, repo.RootPath, req.Source); err != nil {
			return model.CommandPreview{}, err
		}
		args = MergeArgs(req.Source, req.Strategy)
	case "rebase":
		if err := r.verifyLocalBranch(ctx, repo.RootPath, req.Target); err != nil {
			return model.CommandPreview{}, err
		}
		args = RebaseArgs(req.Target)
		destructive = true
	case "switch":
		if err := r.verifyLocalBranch(ctx, repo.RootPath, req.Name); err != nil {
			return model.CommandPreview{}, err
		}
		args = SwitchBranchArgs(req.Name)
	case "delete":
		if err := r.verifyLocalBranch(ctx, repo.RootPath, req.Name); err != nil {
			return model.CommandPreview{}, err
		}
		args = DeleteBranchArgs(req.Name, req.Force)
		destructive = true
	case "create":
		if err := r.verifyBranchName(ctx, repo.RootPath, req.Name); err != nil {
			return model.CommandPreview{}, err
		}
		if strings.TrimSpace(req.StartPoint) != "" {
			if err := r.verifyRevision(ctx, repo.RootPath, req.StartPoint); err != nil {
				return model.CommandPreview{}, err
			}
		}
		args = CreateBranchArgs(req.Name, req.StartPoint)
	default:
		return model.CommandPreview{}, fmt.Errorf("unsupported branch preview action %q", req.Action)
	}

	return model.CommandPreview{Command: CommandString(args), Destructive: destructive}, nil
}

func (r *Runner) PreviewSyncCommand(ctx context.Context, root string, req model.CommandRequest) (model.CommandPreview, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.CommandPreview{}, err
	}

	if strings.TrimSpace(req.Remote) != "" {
		_, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "remote", "get-url", req.Remote)
		if err != nil {
			return model.CommandPreview{}, fmt.Errorf("unknown remote %q: %s", req.Remote, strings.TrimSpace(errOut))
		}
	}

	var args []string
	switch req.Action {
	case "fetch":
		args = FetchArgs(req.Remote)
	case "pull":
		args = PullArgs(req.Remote, req.Branch, req.Strategy)
	case "push":
		args = PushArgs(req.Remote, req.Branch)
	default:
		return model.CommandPreview{}, fmt.Errorf("unsupported sync preview action %q", req.Action)
	}

	return model.CommandPreview{Command: CommandString(args)}, nil
}
