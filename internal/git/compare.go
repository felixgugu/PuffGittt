package git

import (
	"context"
	"encoding/base64"
	"fmt"
	"path/filepath"
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

// CompareDiff returns the file diff introduced by compare relative to the
// merge-base of base and compare, matching `git diff base...compare -- path`.
func (r *Runner) CompareDiff(ctx context.Context, root, base, compare, path string) (model.DiffDocument, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.DiffDocument{}, err
	}
	if err := r.verifyRevision(ctx, repo.RootPath, base); err != nil {
		return model.DiffDocument{}, err
	}
	if err := r.verifyRevision(ctx, repo.RootPath, compare); err != nil {
		return model.DiffDocument{}, err
	}
	path = filepath.ToSlash(path)
	doc := model.DiffDocument{Path: path, Side: "compare", Language: languageForPath(path)}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "merge-base", base, compare)
	if err != nil {
		return model.DiffDocument{}, r.OutputError(out, errOut, err)
	}
	mergeBase := strings.TrimSpace(out)
	if mergeBase == "" {
		return model.DiffDocument{}, fmt.Errorf("branches have no common ancestor")
	}

	if mime := imageMimeForPath(path); mime != "" {
		oldBytes := r.showBlobBytes(ctx, repo.RootPath, mergeBase+":"+path)
		newBytes := r.showBlobBytes(ctx, repo.RootPath, compare+":"+path)
		if len(oldBytes) <= maxImageBytes && len(newBytes) <= maxImageBytes {
			doc.Binary = true
			doc.Image = true
			doc.ImageMime = mime
			doc.OldImage = base64.StdEncoding.EncodeToString(oldBytes)
			doc.NewImage = base64.StdEncoding.EncodeToString(newBytes)
			return doc, nil
		}
	}

	doc.OldText = r.showBlob(ctx, repo.RootPath, mergeBase+":"+path)
	doc.NewText = r.showBlob(ctx, repo.RootPath, compare+":"+path)
	if isBinaryText(doc.OldText) || isBinaryText(doc.NewText) {
		doc.Binary = true
		return doc, nil
	}
	if len(doc.OldText) > maxTextBytes {
		doc.OldText = doc.OldText[:maxTextBytes]
		doc.Truncated = true
	}
	if len(doc.NewText) > maxTextBytes {
		doc.NewText = doc.NewText[:maxTextBytes]
		doc.Truncated = true
	}
	return doc, nil
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
