package git

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) Stage(ctx context.Context, root string, paths []string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := append([]string{"--literal-pathspecs", "add", "--"}, paths...)
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Staged", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) Unstage(ctx context.Context, root string, paths []string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := append([]string{"restore", "--staged", "--"}, paths...)
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err == nil {
		return model.OperationResult{Success: true, Message: "Unstaged", Output: strings.TrimSpace(out)}, nil
	}
	// Unborn HEAD: remove entries from the index without touching worktree.
	args = append([]string{"--literal-pathspecs", "rm", "--cached", "--quiet", "--"}, paths...)
	out, errOut, err = r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Unstaged", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) Discard(ctx context.Context, root string, paths []string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	for _, path := range paths {
		abs := filepath.Join(repo.RootPath, filepath.FromSlash(path))
		clean, err := filepath.Abs(abs)
		if err != nil || !strings.HasPrefix(clean, repo.RootPath+string(filepath.Separator)) {
			return model.OperationResult{}, errors.New("invalid path")
		}
		if _, err := r.Run(ctx, repo.RootPath, "ls-files", "--error-unmatch", "--", path); err == nil {
			args := []string{"restore", "--worktree", "--", path}
			out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
			if err != nil {
				return model.OperationResult{}, r.OutputError(out, errOut, err)
			}
			continue
		}
		if err := os.Remove(clean); err != nil && !os.IsNotExist(err) {
			return model.OperationResult{}, err
		}
	}
	return model.OperationResult{Success: true, Message: "Discarded"}, nil
}

func (r *Runner) Commit(ctx context.Context, root, message string, amend bool) (model.OperationResult, error) {
	return r.CommitWithIdentity(ctx, root, message, amend, "", "")
}

func (r *Runner) CommitWithIdentity(ctx context.Context, root, message string, amend bool, name, email string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{}
	if strings.TrimSpace(name) != "" {
		args = append(args, "-c", "user.name="+name)
	}
	if strings.TrimSpace(email) != "" {
		args = append(args, "-c", "user.email="+email)
	}
	args = append(args, "commit", "-F", "-")
	if amend {
		args = append(args, "--amend")
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, []byte(message), args...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Commit failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Committed", Output: strings.TrimSpace(out)}, nil
}
