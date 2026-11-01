package git

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

type LFSStatus struct {
	Installed bool     `json:"installed"`
	Version   string   `json:"version,omitempty"`
	Files     []string `json:"files"`
	Patterns  []string `json:"patterns"`
}

func (r *Runner) LFSStatus(ctx context.Context, root string) (LFSStatus, error) {
	status := LFSStatus{Files: []string{}, Patterns: []string{}}
	out, _, err := r.RunBytes(ctx, root, nil, "lfs", "version")
	if err != nil {
		return status, nil
	}
	status.Installed = true
	status.Version = strings.TrimSpace(strings.Split(out, "\n")[0])

	if files, _, err := r.RunBytes(ctx, root, nil, "lfs", "ls-files", "-n"); err == nil {
		for _, line := range strings.Split(strings.TrimSpace(files), "\n") {
			line = strings.TrimSpace(line)
			if line != "" {
				status.Files = append(status.Files, line)
			}
		}
	}
	status.Patterns = lfsPatterns(root)
	return status, nil
}

func lfsPatterns(root string) []string {
	data, err := os.ReadFile(filepath.Join(root, ".gitattributes"))
	if err != nil {
		return []string{}
	}
	patterns := []string{}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "filter=lfs") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) > 0 {
			patterns = append(patterns, fields[0])
		}
	}
	return patterns
}

func (r *Runner) TrackLFS(ctx context.Context, root, pattern string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	pattern = strings.TrimSpace(pattern)
	if pattern == "" {
		return model.OperationResult{}, fmt.Errorf("LFS pattern is required")
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "lfs", "track", pattern)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "LFS pattern tracked", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) UntrackLFS(ctx context.Context, root, pattern string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	pattern = strings.TrimSpace(pattern)
	if pattern == "" {
		return model.OperationResult{}, fmt.Errorf("LFS pattern is required")
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "lfs", "untrack", pattern)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "LFS pattern untracked", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) PullLFS(ctx context.Context, root string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunTask(ctx, repo.RootPath, nil, "lfs", "pull")
	if err != nil {
		return model.OperationResult{Success: false, Message: "LFS pull failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "LFS pull complete", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) PushLFS(ctx context.Context, root, remote string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	if strings.TrimSpace(remote) == "" {
		return model.OperationResult{}, fmt.Errorf("remote is required")
	}
	out, errOut, err := r.RunTask(ctx, repo.RootPath, nil, "lfs", "push", "--all", remote)
	if err != nil {
		return model.OperationResult{Success: false, Message: "LFS push failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "LFS push complete", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}
