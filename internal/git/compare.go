package git

import (
	"context"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) CompareBranches(ctx context.Context, root, base, compare string) (model.BranchCompare, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.BranchCompare{}, err
	}
	if err := r.verifyRevision(ctx, repo.RootPath, base); err != nil {
		return model.BranchCompare{}, err
	}
	if err := r.verifyRevision(ctx, repo.RootPath, compare); err != nil {
		return model.BranchCompare{}, err
	}

	result := model.BranchCompare{
		Base:          base,
		Compare:       compare,
		AheadCommits:  []model.CompareCommit{},
		BehindCommits: []model.CompareCommit{},
		Files:         []model.CommitFile{},
	}

	if out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "rev-list", "--left-right", "--count", base+"..."+compare); err == nil {
		fields := strings.Fields(out)
		if len(fields) >= 2 {
			result.Behind = atoiSafe(fields[0])
			result.Ahead = atoiSafe(fields[1])
		}
	} else {
		return model.BranchCompare{}, r.OutputError(out, errOut, err)
	}

	readCommits := func(revision, exclude string) []model.CompareCommit {
		out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil,
			"log", "-n", "200", "--format=%H%x1f%s%x1f%an%x1f%aI", revision, "^"+exclude)
		if err != nil {
			_ = errOut
			return []model.CompareCommit{}
		}
		commits := []model.CompareCommit{}
		for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
			fields := strings.Split(line, "\x1f")
			if len(fields) < 4 {
				continue
			}
			commits = append(commits, model.CompareCommit{
				Oid:     fields[0],
				Subject: fields[1],
				Author:  fields[2],
				Date:    fields[3],
			})
		}
		return commits
	}
	result.AheadCommits = readCommits(compare, base)
	result.BehindCommits = readCommits(base, compare)

	if out, _, err := r.RunBytes(ctx, repo.RootPath, nil, "diff", "--name-status", base+"..."+compare); err == nil {
		for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
			fields := strings.Split(line, "\t")
			if len(fields) < 2 {
				continue
			}
			status := strings.TrimSpace(fields[0])
			if status == "" {
				continue
			}
			path := fields[len(fields)-1]
			result.Files = append(result.Files, model.CommitFile{Path: path, Status: string(status[0])})
		}
	}
	return result, nil
}

func atoiSafe(value string) int {
	result := 0
	for _, char := range strings.TrimSpace(value) {
		if char < '0' || char > '9' {
			return result
		}
		result = result*10 + int(char-'0')
	}
	return result
}
