package git

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) BisectState(ctx context.Context, root string) (model.BisectState, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.BisectState{}, err
	}
	state := model.BisectState{Current: repo.HeadOid}
	if data, err := os.ReadFile(filepath.Join(repo.GitDir, "BISECT_START")); err == nil {
		state.Active = true
		state.Branch = strings.TrimSpace(string(data))
	}
	if data, err := os.ReadFile(filepath.Join(repo.GitDir, "BISECT_LOG")); err == nil {
		state.Log = string(data)
	}
	return state, nil
}

func (r *Runner) BisectStart(ctx context.Context, root, bad, good string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	if err := r.verifyRevision(ctx, repo.RootPath, bad); err != nil {
		return model.OperationResult{}, err
	}
	if err := r.verifyRevision(ctx, repo.RootPath, good); err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "bisect", "start", bad, good)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Bisect start failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Bisect started", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) BisectMark(ctx context.Context, root string, good bool) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	action := "bad"
	if good {
		action = "good"
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "bisect", action)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Bisect mark failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Bisect " + action + " recorded", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) BisectReset(ctx context.Context, root string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "bisect", "reset")
	if err != nil {
		return model.OperationResult{Success: false, Message: "Bisect reset failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Bisect reset", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}
