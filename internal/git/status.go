package git

import (
	"context"
	"strconv"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

func (r *Runner) Status(ctx context.Context, root string) (model.Status, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.Status{}, err
	}
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil,
		"--no-optional-locks", "status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all")
	if err != nil {
		return model.Status{}, r.OutputError(out, errOut, err)
	}

	status := model.Status{Repo: repo, Files: []model.FileChange{}}
	tokens := strings.Split(out, "\x00")
	for i := 0; i < len(tokens); i++ {
		token := tokens[i]
		if token == "" {
			continue
		}
		switch {
		case strings.HasPrefix(token, "# branch.oid "):
			oid := strings.TrimSpace(strings.TrimPrefix(token, "# branch.oid "))
			if oid == "(initial)" {
				status.Repo.Unborn = true
				status.Repo.HeadOid = ""
			} else {
				status.Repo.HeadOid = oid
			}
		case strings.HasPrefix(token, "# branch.head "):
			head := strings.TrimSpace(strings.TrimPrefix(token, "# branch.head "))
			if head == "(detached)" {
				status.Repo.Detached = true
				status.Repo.Branch = ""
			} else {
				status.Repo.Branch = head
			}
		case strings.HasPrefix(token, "# branch.upstream "):
			status.Repo.Upstream = strings.TrimSpace(strings.TrimPrefix(token, "# branch.upstream "))
		case strings.HasPrefix(token, "# branch.ab "):
			parts := strings.Fields(strings.TrimPrefix(token, "# branch.ab "))
			for _, part := range parts {
				if strings.HasPrefix(part, "+") {
					status.Ahead, _ = strconv.Atoi(strings.TrimPrefix(part, "+"))
				} else if strings.HasPrefix(part, "-") {
					status.Behind, _ = strconv.Atoi(strings.TrimPrefix(part, "-"))
				}
			}
		case strings.HasPrefix(token, "1 "):
			fields := strings.SplitN(token, " ", 9)
			if len(fields) < 9 {
				continue
			}
			status.Files = append(status.Files, model.FileChange{
				ID:             fields[8],
				Path:           fields[8],
				IndexStatus:    fields[1][:1],
				WorktreeStatus: fields[1][1:2],
				Kind:           "tracked",
			})
		case strings.HasPrefix(token, "2 "):
			fields := strings.SplitN(token, " ", 10)
			if len(fields) < 10 {
				continue
			}
			file := model.FileChange{
				ID:             fields[9],
				Path:           fields[9],
				IndexStatus:    fields[1][:1],
				WorktreeStatus: fields[1][1:2],
				Kind:           "tracked",
			}
			if i+1 < len(tokens) {
				file.OriginalPath = tokens[i+1]
				i++
			}
			status.Files = append(status.Files, file)
		case strings.HasPrefix(token, "u "):
			fields := strings.SplitN(token, " ", 11)
			if len(fields) < 11 {
				continue
			}
			status.Files = append(status.Files, model.FileChange{
				ID:             fields[10],
				Path:           fields[10],
				IndexStatus:    fields[1][:1],
				WorktreeStatus: fields[1][1:2],
				Kind:           "conflicted",
			})
		case strings.HasPrefix(token, "? "):
			path := strings.TrimPrefix(token, "? ")
			status.Files = append(status.Files, model.FileChange{
				ID:             path,
				Path:           path,
				IndexStatus:    "?",
				WorktreeStatus: "?",
				Kind:           "untracked",
			})
		}
	}
	return status, nil
}
