package git

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

var hunkHeaderPattern = regexp.MustCompile(`^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$`)

type patchFile struct {
	header []string
	hunks  []patchHunk
	hash   string
}

type patchHunk struct {
	headerLine string
	oldStart   int
	oldCount   int
	newStart   int
	newCount   int
	lines      []patchLine
}

type patchLine struct {
	kind      byte
	text      string
	noNewline bool
}

// diffPatch returns the unified diff that describes the requested side:
// "unstaged" is index -> worktree, "staged" is HEAD -> index.
func (r *Runner) diffPatch(ctx context.Context, root, path, side string) (patchFile, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return patchFile{}, err
	}
	path = filepath.ToSlash(path)
	args := []string{
		"--literal-pathspecs", "diff", "--no-color", "--no-ext-diff",
		"--no-renames", "--unified=3",
	}
	if side == "staged" {
		args = append(args, "--cached")
	}
	args = append(args, "--", path)
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, nil, args...)
	if err != nil {
		return patchFile{}, r.OutputError(out, errOut, err)
	}
	return parsePatch(out)
}

func parsePatch(raw string) (patchFile, error) {
	sum := sha256.Sum256([]byte(raw))
	file := patchFile{hash: hex.EncodeToString(sum[:])}
	trimmed := strings.TrimSuffix(raw, "\n")
	if strings.TrimSpace(trimmed) == "" {
		return file, nil
	}
	lines := strings.Split(trimmed, "\n")
	for index := 0; index < len(lines); {
		line := lines[index]
		if strings.HasPrefix(line, "diff --git ") && len(file.hunks) > 0 {
			break
		}
		if !strings.HasPrefix(line, "@@ ") {
			if len(file.hunks) == 0 {
				file.header = append(file.header, line)
			}
			index++
			continue
		}
		hunk, err := parseHunkHeader(line)
		if err != nil {
			return patchFile{}, err
		}
		index++
		for index < len(lines) {
			body := lines[index]
			if strings.HasPrefix(body, "@@ ") || strings.HasPrefix(body, "diff --git ") {
				break
			}
			if strings.HasPrefix(body, "\\") {
				if len(hunk.lines) == 0 {
					return patchFile{}, errors.New("無效的 diff：no-newline 標記沒有對應的行")
				}
				hunk.lines[len(hunk.lines)-1].noNewline = true
				index++
				continue
			}
			if body == "" {
				break
			}
			kind := body[0]
			if kind != ' ' && kind != '+' && kind != '-' {
				return patchFile{}, fmt.Errorf("無效的 diff 行：%q", body)
			}
			hunk.lines = append(hunk.lines, patchLine{kind: kind, text: body[1:]})
			index++
		}
		file.hunks = append(file.hunks, hunk)
	}
	return file, nil
}

func parseHunkHeader(line string) (patchHunk, error) {
	matches := hunkHeaderPattern.FindStringSubmatch(line)
	if matches == nil {
		return patchHunk{}, fmt.Errorf("無效的 hunk header：%q", line)
	}
	oldStart, err := strconv.Atoi(matches[1])
	if err != nil {
		return patchHunk{}, err
	}
	oldCount := 1
	if matches[2] != "" {
		if oldCount, err = strconv.Atoi(matches[2]); err != nil {
			return patchHunk{}, err
		}
	}
	newStart, err := strconv.Atoi(matches[3])
	if err != nil {
		return patchHunk{}, err
	}
	newCount := 1
	if matches[4] != "" {
		if newCount, err = strconv.Atoi(matches[4]); err != nil {
			return patchHunk{}, err
		}
	}
	return patchHunk{
		headerLine: line,
		oldStart:   oldStart,
		oldCount:   oldCount,
		newStart:   newStart,
		newCount:   newCount,
	}, nil
}

func hunkToModel(hunk patchHunk) model.DiffHunk {
	result := model.DiffHunk{
		Header:   hunk.headerLine,
		OldStart: hunk.oldStart,
		OldCount: hunk.oldCount,
		NewStart: hunk.newStart,
		NewCount: hunk.newCount,
		Lines:    make([]model.DiffLine, 0, len(hunk.lines)),
	}
	oldLine := hunk.oldStart
	newLine := hunk.newStart
	for _, line := range hunk.lines {
		entry := model.DiffLine{Text: line.text, NoNewline: line.noNewline}
		switch line.kind {
		case ' ':
			entry.Kind = "context"
			entry.OldLine = oldLine
			entry.NewLine = newLine
			oldLine++
			newLine++
		case '-':
			entry.Kind = "delete"
			entry.OldLine = oldLine
			oldLine++
		case '+':
			entry.Kind = "add"
			entry.NewLine = newLine
			newLine++
		}
		result.Lines = append(result.Lines, entry)
	}
	return result
}

// ApplyHunks stages (side "unstaged") or unstages (side "staged") the selected
// hunks and lines. An empty Lines slice selects the whole hunk.
func (r *Runner) ApplyHunks(ctx context.Context, root, path, side, patchHash string, selections []model.HunkSelection) (model.OperationResult, error) {
	if side != "staged" && side != "unstaged" {
		return model.OperationResult{}, fmt.Errorf("不支援的 diff side：%s", side)
	}
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.OperationResult{}, err
	}
	patch, err := r.diffPatch(ctx, root, path, side)
	if err != nil {
		return model.OperationResult{}, err
	}
	if strings.TrimSpace(patchHash) != "" && patchHash != patch.hash {
		return model.OperationResult{}, errors.New("檔案內容已變更，請重新整理後再試")
	}
	if len(patch.hunks) == 0 {
		return model.OperationResult{}, errors.New("沒有可套用的差異")
	}
	reverse := side == "staged"
	partial, err := buildPartialPatch(patch, selections, reverse, filepath.ToSlash(path))
	if err != nil {
		return model.OperationResult{}, err
	}
	args := []string{"apply", "--cached", "--whitespace=nowarn"}
	if reverse {
		args = append(args, "-R")
	}
	args = append(args, "-")
	out, errOut, err := r.RunBytes(ctx, repo.RootPath, []byte(partial), args...)
	if err != nil {
		return model.OperationResult{}, r.OutputError(out, errOut, err)
	}
	message := "已暫存選取的變更"
	if reverse {
		message = "已取消暫存選取的變更"
	}
	return model.OperationResult{Success: true, Message: message, Output: strings.TrimSpace(out)}, nil
}

func buildPartialPatch(patch patchFile, selections []model.HunkSelection, reverse bool, path string) (string, error) {
	if len(selections) == 0 {
		return "", errors.New("未選取任何 Hunk")
	}
	selected := map[int]map[int]bool{}
	order := make([]int, 0, len(selections))
	lineSelection := false
	for _, selection := range selections {
		if selection.Hunk < 0 || selection.Hunk >= len(patch.hunks) {
			return "", errors.New("Hunk 索引已失效，請重新整理後再試")
		}
		if _, exists := selected[selection.Hunk]; exists {
			return "", errors.New("重複選取同一個 Hunk")
		}
		lines := map[int]bool{}
		for _, line := range selection.Lines {
			if line < 0 || line >= len(patch.hunks[selection.Hunk].lines) {
				return "", errors.New("選取的行已失效，請重新整理後再試")
			}
			if patch.hunks[selection.Hunk].lines[line].kind == ' ' {
				return "", errors.New("只能選取新增或刪除的行")
			}
			lines[line] = true
		}
		selected[selection.Hunk] = lines
		if len(lines) > 0 {
			lineSelection = true
		}
		order = append(order, selection.Hunk)
	}
	sort.Ints(order)

	header := patch.header
	if lineSelection {
		header = normalizePartialHeader(header, path)
	}
	var builder strings.Builder
	for _, line := range header {
		builder.WriteString(line)
		builder.WriteByte('\n')
	}
	for _, index := range order {
		hunk := patch.hunks[index]
		lines, oldCount, newCount, changed, err := transformHunk(hunk, selected[index], reverse)
		if err != nil {
			return "", err
		}
		if changed == 0 {
			return "", errors.New("選取的 Hunk 沒有可套用的變更行")
		}
		fmt.Fprintf(&builder, "@@ -%d,%d +%d,%d @@\n", hunk.oldStart, oldCount, hunk.newStart, newCount)
		for _, line := range lines {
			builder.WriteByte(line.kind)
			builder.WriteString(line.text)
			builder.WriteByte('\n')
			if line.noNewline {
				builder.WriteString("\\ No newline at end of file\n")
			}
		}
	}
	return builder.String(), nil
}

// normalizePartialHeader turns a new-file or deleted-file patch into a normal
// modification patch. Partial staging of those diffs cannot keep the file
// creation/deletion directive because only some lines are transferred.
func normalizePartialHeader(header []string, path string) []string {
	result := make([]string, 0, len(header))
	for _, line := range header {
		switch {
		case strings.HasPrefix(line, "new file mode "):
			continue
		case strings.HasPrefix(line, "deleted file mode "):
			continue
		case strings.HasPrefix(line, "--- /dev/null"):
			result = append(result, "--- a/"+path)
		case strings.HasPrefix(line, "+++ /dev/null"):
			result = append(result, "+++ b/"+path)
		default:
			result = append(result, line)
		}
	}
	return result
}

func transformHunk(hunk patchHunk, lines map[int]bool, reverse bool) ([]patchLine, int, int, int, error) {
	if len(lines) == 0 {
		changed := 0
		for _, line := range hunk.lines {
			if line.kind != ' ' {
				changed++
			}
		}
		return hunk.lines, hunk.oldCount, hunk.newCount, changed, nil
	}
	result := make([]patchLine, 0, len(hunk.lines))
	oldCount, newCount, changed := 0, 0, 0
	for index, line := range hunk.lines {
		switch line.kind {
		case ' ':
			result = append(result, line)
			oldCount++
			newCount++
		case '+':
			switch {
			case lines[index]:
				result = append(result, line)
				newCount++
				changed++
			case reverse:
				// Keep the staged addition in the index when it is not selected.
				line.kind = ' '
				result = append(result, line)
				oldCount++
				newCount++
			}
		case '-':
			switch {
			case lines[index]:
				result = append(result, line)
				oldCount++
				changed++
			case !reverse:
				// Keep the unstaged deletion in the index when it is not selected.
				line.kind = ' '
				result = append(result, line)
				oldCount++
				newCount++
			}
		}
	}
	return result, oldCount, newCount, changed, nil
}
