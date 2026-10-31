package git

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) Conflicts(ctx context.Context, root string) ([]model.ConflictFile, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "ls-files", "-u", "-z")
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	byPath := map[string]*model.ConflictFile{}
	order := []string{}
	for _, record := range strings.Split(out, "\x00") {
		if record == "" {
			continue
		}
		tab := strings.Index(record, "\t")
		if tab < 0 {
			continue
		}
		meta := strings.Fields(record[:tab])
		if len(meta) < 3 {
			continue
		}
		stage, _ := strconv.Atoi(meta[2])
		path := record[tab+1:]
		entry, ok := byPath[path]
		if !ok {
			entry = &model.ConflictFile{Path: path}
			byPath[path] = entry
			order = append(order, path)
		}
		entry.Stages = append(entry.Stages, model.ConflictStage{Stage: stage, Oid: meta[1], Exists: true})
	}
	files := []model.ConflictFile{}
	for _, path := range order {
		entry := *byPath[path]
		abs := filepath.Join(repo.RootPath, filepath.FromSlash(path))
		_, err := os.Stat(abs)
		entry.Present = err == nil
		files = append(files, entry)
	}
	return files, nil
}

func (r *Runner) ConflictVersions(ctx context.Context, root, path string) (model.ConflictVersions, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.ConflictVersions{}, err
	}
	path = filepath.ToSlash(path)
	versions := model.ConflictVersions{
		Path:        path,
		OursLabel:   "Ours",
		TheirsLabel: "Theirs",
		Operation:   repo.Operation,
	}
	versions.Base = r.showBlob(ctx, repo.RootPath, ":1:"+path)
	versions.Ours = r.showBlob(ctx, repo.RootPath, ":2:"+path)
	versions.Theirs = r.showBlob(ctx, repo.RootPath, ":3:"+path)
	abs := filepath.Join(repo.RootPath, filepath.FromSlash(path))
	if data, err := os.ReadFile(abs); err == nil {
		versions.Result = string(data)
	} else {
		versions.Result = versions.Ours
	}
	versions.Binary = isBinaryText(versions.Base) || isBinaryText(versions.Ours) || isBinaryText(versions.Theirs)
	return versions, nil
}

func (r *Runner) SaveConflictResult(ctx context.Context, root, path, content string) error {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return err
	}
	clean, err := safeWorktreePath(repo.RootPath, path)
	if err != nil {
		return err
	}
	return os.WriteFile(clean, []byte(content), 0o644)
}

func (r *Runner) ResolveConflict(ctx context.Context, root, path string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "--literal-pathspecs", "add", "--", path)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Marked resolved"}, nil
}

func (r *Runner) ContinueOperation(ctx context.Context, root, operation string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{}
	switch operation {
	case "merging":
		args = []string{"merge", "--continue"}
	case "rebasing":
		args = []string{"rebase", "--continue"}
	case "cherryPicking":
		args = []string{"cherry-pick", "--continue"}
	case "reverting":
		args = []string{"revert", "--continue"}
	default:
		return model.OperationResult{}, errors.New("no active operation")
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Operation needs attention", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Operation continued", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) AbortOperation(ctx context.Context, root, operation string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{}
	switch operation {
	case "merging":
		args = []string{"merge", "--abort"}
	case "rebasing":
		args = []string{"rebase", "--abort"}
	case "cherryPicking":
		args = []string{"cherry-pick", "--abort"}
	case "reverting":
		args = []string{"revert", "--abort"}
	default:
		return model.OperationResult{}, errors.New("no active operation")
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Operation aborted", Output: strings.TrimSpace(out)}, nil
}

func safeWorktreePath(root, path string) (string, error) {
	cleanRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	clean, err := filepath.Abs(filepath.Join(cleanRoot, filepath.FromSlash(path)))
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(cleanRoot, clean)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", errors.New("path escapes repository")
	}
	return clean, nil
}
