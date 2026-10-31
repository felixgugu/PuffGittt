package git

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) RebasePlan(ctx context.Context, root, base string) ([]model.RebaseTodo, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	if err := r.verifyRevision(ctx, repo.RootPath, base); err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "log", "--reverse", "--format=%H%x1f%s", base+"..HEAD")
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	todos := []model.RebaseTodo{}
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		fields := strings.SplitN(line, "\x1f", 2)
		if len(fields) < 2 {
			continue
		}
		todos = append(todos, model.RebaseTodo{Oid: fields[0], Action: "pick", Subject: fields[1]})
	}
	return todos, nil
}

func (r *Runner) InteractiveRebase(ctx context.Context, root, base string, todos []model.RebaseTodo) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	if err := r.verifyRevision(ctx, repo.RootPath, base); err != nil {
		return model.OperationResult{}, err
	}
	actual, err := r.RebasePlan(ctx, repo.RootPath, base)
	if err != nil {
		return model.OperationResult{}, err
	}
	if len(actual) == 0 {
		return model.OperationResult{}, fmt.Errorf("沒有可 rebase 的 Commit")
	}
	if len(todos) != len(actual) {
		return model.OperationResult{}, fmt.Errorf("Rebase 計畫已失效，請重新載入")
	}
	for index := range actual {
		if actual[index].Oid != todos[index].Oid {
			return model.OperationResult{}, fmt.Errorf("Rebase 計畫已失效，請重新載入")
		}
	}
	firstKept := false
	for _, todo := range todos {
		switch todo.Action {
		case "pick", "squash", "fixup", "drop":
		default:
			return model.OperationResult{}, fmt.Errorf("不支援的 rebase 動作 %q", todo.Action)
		}
		if todo.Action == "drop" {
			continue
		}
		if !firstKept {
			if todo.Action != "pick" {
				return model.OperationResult{}, fmt.Errorf("第一個保留的 Commit 必須是 pick")
			}
			firstKept = true
		}
	}
	if !firstKept {
		return model.OperationResult{}, fmt.Errorf("至少要保留一個 Commit")
	}

	tempDir, err := os.MkdirTemp("", "puffgittt-rebase-*")
	if err != nil {
		return model.OperationResult{}, err
	}
	defer os.RemoveAll(tempDir)

	todoPath := filepath.Join(tempDir, "todo.txt")

	var todoBuilder strings.Builder
	for _, todo := range todos {
		if todo.Action == "drop" {
			continue
		}
		subject := strings.ReplaceAll(strings.ReplaceAll(todo.Subject, "\r", " "), "\n", " ")
		todoBuilder.WriteString(todo.Action)
		todoBuilder.WriteByte(' ')
		todoBuilder.WriteString(todo.Oid)
		todoBuilder.WriteByte(' ')
		todoBuilder.WriteString(subject)
		todoBuilder.WriteByte('\n')
	}
	if err := os.WriteFile(todoPath, []byte(todoBuilder.String()), 0o644); err != nil {
		return model.OperationResult{}, err
	}

	env := []string{
		"GIT_SEQUENCE_EDITOR=cp '" + filepath.ToSlash(todoPath) + "'",
		"GIT_EDITOR=true",
	}
	out, errOut, err := r.RunBytesEnv(ctx, repo.RootPath, nil, env, "rebase", "-i", base)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Interactive rebase requires attention", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Interactive rebase complete", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}
