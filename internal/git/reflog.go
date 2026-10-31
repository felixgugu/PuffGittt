package git

import (
	"context"
	"strconv"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

// Reflog returns the HEAD reflog, newest first. The selector is derived from the
// index because Git's %gd output is either HEAD@{n} or HEAD@{date} depending on
// --date, and the index form is what the UI exposes.
func (r *Runner) Reflog(ctx context.Context, root string, limit int) ([]model.ReflogEntry, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil,
		"reflog", "show", "--date=iso-strict",
		"--format=%H%x1f%gs%x1f%gd",
		"-n", strconv.Itoa(limit))
	if err != nil {
		return nil, r.OutputError(out, errOut, err)
	}

	entries := []model.ReflogEntry{}
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Split(line, "\x1f")
		if len(fields) < 3 {
			continue
		}
		action := fields[1]
		message := ""
		if index := strings.Index(action, ": "); index >= 0 {
			message = action[index+2:]
			action = action[:index]
		}
		date := ""
		if start := strings.Index(fields[2], "{"); start >= 0 {
			if end := strings.Index(fields[2], "}"); end > start {
				date = fields[2][start+1 : end]
			}
		}
		entries = append(entries, model.ReflogEntry{
			Selector: "HEAD@{" + strconv.Itoa(len(entries)) + "}",
			Oid:      fields[0],
			Action:   strings.TrimSpace(action),
			Message:  strings.TrimSpace(message),
			Date:     date,
		})
	}
	for index := 0; index < len(entries)-1; index++ {
		entries[index].PreviousOid = entries[index+1].Oid
	}
	return entries, nil
}

func (r *Runner) HeadOid(ctx context.Context, root string) (string, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return "", err
	}
	return currentHead(ctx, r, repo.RootPath)
}
