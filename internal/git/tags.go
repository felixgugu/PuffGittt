package git

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

type Tag struct {
	Name       string `json:"name"`
	Oid        string `json:"oid"`
	TargetOid  string `json:"targetOid,omitempty"`
	Tagger     string `json:"tagger,omitempty"`
	TaggerDate string `json:"taggerDate,omitempty"`
	Message    string `json:"message,omitempty"`
	Annotated  bool   `json:"annotated,omitempty"`
}

type RemoteTag struct {
	Name string `json:"name"`
	Oid  string `json:"oid"`
}

func (r *Runner) Tags(ctx context.Context, root string) ([]Tag, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil,
		"for-each-ref",
		"--format=%(refname:short)%1f%(objectname)%1f%(*objectname)%1f%(taggername)%1f%(taggerdate:iso-strict)%1f%(contents:subject)",
		"refs/tags")
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	tags := []Tag{}
	for _, line := range strings.Split(out, "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Split(line, "\x1f")
		if len(fields) < 6 {
			continue
		}
		tag := Tag{
			Name:       fields[0],
			Oid:        fields[1],
			TargetOid:  fields[2],
			Tagger:     fields[3],
			TaggerDate: fields[4],
			Message:    fields[5],
			Annotated:  strings.TrimSpace(fields[3]) != "" || strings.TrimSpace(fields[2]) != "",
		}
		if tag.TargetOid == "" {
			tag.TargetOid = tag.Oid
		}
		tags = append(tags, tag)
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

func (r *Runner) PushTag(ctx context.Context, root, remote, name string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	if strings.TrimSpace(remote) == "" || strings.TrimSpace(name) == "" {
		return model.OperationResult{}, fmt.Errorf("remote and tag name are required")
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "push", remote, "refs/tags/"+name)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Tag push failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Tag pushed", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) PushAllTags(ctx context.Context, root, remote string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	if strings.TrimSpace(remote) == "" {
		return model.OperationResult{}, fmt.Errorf("remote is required")
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "push", remote, "--tags")
	if err != nil {
		return model.OperationResult{Success: false, Message: "Tag push failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Tags pushed", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) RemoteTags(ctx context.Context, root, remote string) ([]RemoteTag, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(remote) == "" {
		return []RemoteTag{}, nil
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "ls-remote", "--tags", remote)
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	tags := []RemoteTag{}
	seen := map[string]bool{}
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		ref := fields[1]
		if !strings.HasPrefix(ref, "refs/tags/") || strings.HasSuffix(ref, "^{}") {
			continue
		}
		name := strings.TrimPrefix(ref, "refs/tags/")
		if seen[name] {
			continue
		}
		seen[name] = true
		tags = append(tags, RemoteTag{Name: name, Oid: fields[0]})
	}
	sort.SliceStable(tags, func(i, j int) bool { return tags[i].Name < tags[j].Name })
	return tags, nil
}

func (r *Runner) DeleteRemoteTag(ctx context.Context, root, remote, name string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	if strings.TrimSpace(remote) == "" || strings.TrimSpace(name) == "" {
		return model.OperationResult{}, fmt.Errorf("remote and tag name are required")
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "push", remote, "--delete", "refs/tags/"+name)
	if err != nil {
		return model.OperationResult{Success: false, Message: "Remote tag delete failed", Output: strings.TrimSpace(out + "\n" + errOut)}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Remote tag deleted", Output: strings.TrimSpace(out + "\n" + errOut)}, nil
}

func (r *Runner) CreateSignedTag(ctx context.Context, root, name, oid, message string) (model.OperationResult, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	name = strings.TrimSpace(name)
	message = strings.TrimSpace(message)
	if name == "" || message == "" {
		return model.OperationResult{}, fmt.Errorf("signed tags require a name and message")
	}
	args := []string{"tag", "-s", name, "-m", message}
	if strings.TrimSpace(oid) != "" {
		args = append(args, oid)
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	return model.OperationResult{Success: true, Message: "Signed tag created", Output: strings.TrimSpace(out)}, nil
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
