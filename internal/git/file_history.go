package git

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) FileHistory(ctx context.Context, root, path string, limit int) ([]model.CompareCommit, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	path = strings.ReplaceAll(path, "\\", "/")
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil,
		"log", "--follow", "-n", strconv.Itoa(limit),
		"--format=%H%x1f%s%x1f%an%x1f%aI", "--", path)
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
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
	return commits, nil
}

func (r *Runner) Blame(ctx context.Context, root, path string) ([]model.BlameLine, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	path = strings.ReplaceAll(path, "\\", "/")
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, "blame", "--line-porcelain", "--", path)
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}

	lines := []model.BlameLine{}
	oid, author, date, summary := "", "", "", ""
	for _, line := range strings.Split(out, "\n") {
		if strings.HasPrefix(line, "\t") {
			lines = append(lines, model.BlameLine{
				Line:    len(lines) + 1,
				Oid:     oid,
				Author:  author,
				Date:    date,
				Summary: summary,
				Text:    line[1:],
			})
			continue
		}
		switch {
		case strings.HasPrefix(line, "author "):
			author = strings.TrimPrefix(line, "author ")
		case strings.HasPrefix(line, "author-time "):
			seconds, err := strconv.ParseInt(strings.TrimPrefix(line, "author-time "), 10, 64)
			if err == nil {
				date = time.Unix(seconds, 0).Format(time.RFC3339)
			}
		case strings.HasPrefix(line, "summary "):
			summary = strings.TrimPrefix(line, "summary ")
		default:
			fields := strings.Fields(line)
			if len(fields) >= 3 && len(fields[0]) >= 7 && isHex(fields[0]) {
				oid = fields[0]
			}
		}
	}
	return lines, nil
}

func isHex(value string) bool {
	for _, char := range value {
		if (char < '0' || char > '9') && (char < 'a' || char > 'f') {
			return false
		}
	}
	return true
}
