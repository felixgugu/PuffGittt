package git

import (
	"context"
	"fmt"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func commitParents(ctx context.Context, r *Runner, root, oid string) ([]string, error) {
	out, errOut, err := r.RunBytes(ctx, root, nil, "rev-list", "--parents", "-n", "1", oid)
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	fields := strings.Fields(strings.TrimSpace(out))
	if len(fields) == 0 {
		return nil, fmt.Errorf("commit not found: %s", oid)
	}
	return fields[1:], nil
}

func currentHead(ctx context.Context, r *Runner, root string) (string, error) {
	out, errOut, err := r.RunBytes(ctx, root, nil, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return "", r.OutputError(out, errOut, err)
	}
	return strings.TrimSpace(out), nil
}

func isAncestor(ctx context.Context, r *Runner, root, oid, descendant string) bool {
	_, _, err := r.RunBytes(ctx, root, nil, "merge-base", "--is-ancestor", oid, descendant)
	return err == nil
}

func ResetArgs(oid, mode string) ([]string, error) {
	switch mode {
	case "soft", "mixed", "hard":
		return []string{"reset", "--" + mode, oid}, nil
	default:
		return nil, fmt.Errorf("unsupported reset mode %q", mode)
	}
}

func RevertArgs(ctx context.Context, r *Runner, root, oid string) ([]string, error) {
	if err := r.verifyRevision(ctx, root, oid); err != nil {
		return nil, err
	}
	parents, err := commitParents(ctx, r, root, oid)
	if err != nil {
		return nil, err
	}
	if len(parents) > 1 {
		return nil, fmt.Errorf("reverting merge commits is not supported")
	}
	return []string{"revert", "--no-edit", oid}, nil
}

func DropArgs(ctx context.Context, r *Runner, root, oid string) ([]string, error) {
	if err := r.verifyRevision(ctx, root, oid); err != nil {
		return nil, err
	}
	parents, err := commitParents(ctx, r, root, oid)
	if err != nil {
		return nil, err
	}
	if len(parents) == 0 {
		return nil, fmt.Errorf("root commit cannot be dropped")
	}
	if len(parents) > 1 {
		return nil, fmt.Errorf("merge commit cannot be dropped")
	}
	head, err := currentHead(ctx, r, root)
	if err != nil {
		return nil, err
	}
	if oid == head {
		return []string{"reset", "--hard", parents[0]}, nil
	}
	if !isAncestor(ctx, r, root, oid, head) {
		return nil, fmt.Errorf("commit is not on the current branch")
	}
	return []string{"rebase", "--onto", parents[0], oid}, nil
}

func (r *Runner) PreviewHistoryCommand(ctx context.Context, root string, req model.CommandRequest) (model.CommandPreview, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.CommandPreview{}, err
	}

	var args []string
	destructive := false
	switch req.Action {
	case "reset":
		args, err = ResetArgs(req.Target, req.Strategy)
		destructive = req.Strategy == "hard"
	case "revert":
		args, err = RevertArgs(ctx, r, repo.RootPath, req.Target)
	case "drop":
		args, err = DropArgs(ctx, r, repo.RootPath, req.Target)
		destructive = true
	default:
		return model.CommandPreview{}, fmt.Errorf("unsupported history preview action %q", req.Action)
	}
	if err != nil {
		return model.CommandPreview{}, err
	}
	return model.CommandPreview{Command: CommandString(args), Destructive: destructive}, nil
}

func (r *Runner) ResetCommit(ctx context.Context, root, oid, mode string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args, err := ResetArgs(oid, mode)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Reset failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Reset complete", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) RevertCommit(ctx context.Context, root, oid string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args, err := RevertArgs(ctx, r, repo.RootPath, oid)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Revert requires attention", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Reverted", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) DropCommit(ctx context.Context, root, oid string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args, err := DropArgs(ctx, r, repo.RootPath, oid)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Drop requires attention", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Commit dropped", Output: strings.TrimSpace(out)}, nil
}
