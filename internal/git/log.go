package git

import (
	"context"
	"regexp"
	"strconv"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) Log(ctx context.Context, root, branch string, all bool, limit int, search string) ([]model.Commit, error) {
	return r.LogSearch(ctx, root, branch, all, limit, search, "message")
}

func (r *Runner) LogSearch(ctx context.Context, root, branch string, all bool, limit int, search, mode string) ([]model.Commit, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	query := strings.TrimSpace(search)
	if mode == "sha" && query != "" {
		lower := strings.ToLower(query)
		if len(lower) < 4 || !isHex(lower) {
			return []model.Commit{}, nil
		}
		out, _, err := r.RunBytes(ctx, repo.RootPath, nil, "rev-parse", "--verify", "--quiet", query+"^{commit}")
		if err != nil {
			return []model.Commit{}, nil
		}
		return r.LogSearch(ctx, root, strings.TrimSpace(out), false, 1, "", "message")
	}

	args := []string{
		"--literal-pathspecs", "log", "--topo-order", "--date=iso-strict",
		"--pretty=format:%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s%x1f%D%x1e",
		"--max-count=" + strconv.Itoa(limit),
	}
	pathFilter := ""
	if query != "" {
		switch mode {
		case "author":
			args = append(args, "--regexp-ignore-case", "--author="+regexp.QuoteMeta(query))
		case "path":
			pathFilter = strings.ReplaceAll(query, "\\", "/")
		default:
			args = append(args, "--regexp-ignore-case", "--fixed-strings", "--grep="+query)
		}
	}
	if all {
		args = append(args, "--all")
	} else if strings.TrimSpace(branch) != "" {
		args = append(args, branch)
	}
	if pathFilter != "" {
		args = append(args, "--", pathFilter)
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}

	commits := []model.Commit{}
	for _, record := range strings.Split(out, "\x1e") {
		record = strings.Trim(record, "\n")
		if record == "" {
			continue
		}
		fields := strings.Split(record, "\x1f")
		if len(fields) < 10 {
			continue
		}
		parents := []string{}
		if strings.TrimSpace(fields[1]) != "" {
			parents = strings.Fields(fields[1])
		}
		refs := []string{}
		if strings.TrimSpace(fields[9]) != "" {
			for _, ref := range strings.Split(fields[9], ",") {
				ref = strings.TrimSpace(ref)
				if ref != "" {
					refs = append(refs, ref)
				}
			}
		}
		commits = append(commits, model.Commit{
			Oid:            fields[0],
			Parents:        parents,
			Author:         fields[2],
			AuthorEmail:    fields[3],
			AuthorTime:     fields[4],
			Committer:      fields[5],
			CommitterEmail: fields[6],
			CommitterTime:  fields[7],
			Subject:        fields[8],
			Refs:           refs,
		})
	}
	return commits, nil
}

func (r *Runner) CommitFiles(ctx context.Context, root, oid string) ([]model.CommitFile, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil,
		"show", "--pretty=format:", "--name-status", "--find-renames", oid)
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}
	files := []model.CommitFile{}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) < 2 {
			continue
		}
		files = append(files, model.CommitFile{Status: parts[0], Path: parts[len(parts)-1]})
	}
	return files, nil
}

func (r *Runner) CommitDetail(ctx context.Context, root, oid string) (model.CommitDetail, error) {
	commits, err := r.Log(ctx, root, oid, false, 1, "")
	if err != nil {
		return model.CommitDetail{}, err
	}
	if len(commits) == 0 {
		return model.CommitDetail{}, nil
	}
	if out, _, err := r.RunBytes(ctx, root, nil, "show", "-s", "--format=%B", oid); err == nil {
		commits[0].Message = strings.TrimSpace(out)
	}
	files, err := r.CommitFiles(ctx, root, oid)
	if err != nil {
		return model.CommitDetail{}, err
	}
	return model.CommitDetail{Commit: commits[0], Files: files}, nil
}
