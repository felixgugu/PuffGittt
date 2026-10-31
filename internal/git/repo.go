package git

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/felixgugu/puffgittt/internal/model"
)

var ErrNotRepository = errors.New("not a git repository")

func (r *Runner) Open(ctx context.Context, path string) (model.Repository, error) {
	if strings.TrimSpace(path) == "" {
		return model.Repository{}, ErrNotRepository
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return model.Repository{}, ErrNotRepository
	}
	if st, err := os.Stat(abs); err != nil || !st.IsDir() {
		return model.Repository{}, ErrNotRepository
	}

	root, err := r.Run(ctx, abs, "rev-parse", "--show-toplevel")
	if err != nil {
		return model.Repository{}, ErrNotRepository
	}
	root = strings.TrimSpace(root)
	if root == "" {
		return model.Repository{}, ErrNotRepository
	}
	gitDir, _ := r.Run(ctx, root, "rev-parse", "--absolute-git-dir")
	gitDir = strings.TrimSpace(gitDir)

	repo := model.Repository{
		ID:        root,
		Name:      filepath.Base(root),
		RootPath:  root,
		GitDir:    gitDir,
		Operation: "normal",
		Revision:  time.Now().UnixMilli(),
	}

	if out, err := r.Run(ctx, root, "symbolic-ref", "--short", "-q", "HEAD"); err == nil {
		repo.Branch = strings.TrimSpace(out)
	}
	if repo.Branch == "" {
		repo.Detached = true
	}
	if out, err := r.Run(ctx, root, "rev-parse", "--verify", "HEAD"); err == nil {
		repo.HeadOid = strings.TrimSpace(out)
	} else {
		repo.Unborn = true
	}
	if out, err := r.Run(ctx, root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"); err == nil {
		repo.Upstream = strings.TrimSpace(out)
	}
	repo.Operation = r.detectOperation(ctx, root)
	return repo, nil
}

func (r *Runner) detectOperation(ctx context.Context, root string) string {
	check := func(name string) bool {
		out, err := r.Run(ctx, root, "rev-parse", "--git-path", name)
		if err != nil {
			return false
		}
		_, err = os.Stat(strings.TrimSpace(out))
		return err == nil
	}
	switch {
	case check("rebase-merge"), check("rebase-apply"):
		return "rebasing"
	case check("MERGE_HEAD"):
		return "merging"
	case check("CHERRY_PICK_HEAD"):
		return "cherryPicking"
	case check("REVERT_HEAD"):
		return "reverting"
	case check("sequencer"):
		return "cherryPicking"
	default:
		return "normal"
	}
}

func (r *Runner) ValidateRoot(ctx context.Context, root string) (string, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return "", err
	}
	return repo.RootPath, nil
}

func (r *Runner) Init(ctx context.Context, path, initialBranch string) (model.Repository, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return model.Repository{}, err
	}
	args := []string{"init"}
	if strings.TrimSpace(initialBranch) != "" {
		args = append(args, "--initial-branch", initialBranch)
	}
	args = append(args, abs)
	if _, err := r.Run(ctx, "", args...); err != nil {
		return model.Repository{}, err
	}
	return r.Open(ctx, abs)
}

func (r *Runner) Clone(ctx context.Context, url, parentPath, directoryName string) (model.Repository, error) {
	parent, err := filepath.Abs(parentPath)
	if err != nil {
		return model.Repository{}, err
	}
	target := filepath.Join(parent, directoryName)
	if _, err := os.Stat(target); err == nil {
		return model.Repository{}, errors.New("target already exists")
	}
	if _, err := r.Run(ctx, "", "clone", "--progress", url, target); err != nil {
		return model.Repository{}, err
	}
	return r.Open(ctx, target)
}

func (r *Runner) BranchExists(ctx context.Context, root, name string) bool {
	_, err := r.Run(ctx, root, "show-ref", "--verify", "--quiet", "refs/heads/"+name)
	return err == nil
}

func (r *Runner) Head(ctx context.Context, root string) string {
	out, err := r.Run(ctx, root, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(out)
}
