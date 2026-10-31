package git

import (
	"context"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

type Tag struct {
	Name    string `json:"name"`
	Oid     string `json:"oid"`
	Message string `json:"message,omitempty"`
}

func (r *Runner) Tags(ctx context.Context, root string) ([]Tag, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil,
		"for-each-ref", "--format=%(refname:short)%1f%(objectname)%1f%(contents:subject)", "refs/tags")
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	tags := []Tag{}
	for _, line := range strings.Split(out, "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Split(line, "\x1f")
		if len(fields) < 3 {
			continue
		}
		tags = append(tags, Tag{Name: fields[0], Oid: fields[1], Message: fields[2]})
	}
	return tags, nil
}

func (r *Runner) CreateTag(ctx context.Context, root, name, oid, message string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{"tag"}
	if strings.TrimSpace(message) != "" {
		args = append(args, "-a", name, "-m", message)
	} else {
		args = append(args, name)
	}
	if strings.TrimSpace(oid) != "" {
		args = append(args, oid)
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Tag created", Output: strings.TrimSpace(out)}, nil
}

func (r *Runner) DeleteTag(ctx context.Context, root, name string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "tag", "-d", name)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Tag deleted", Output: strings.TrimSpace(out)}, nil
}
