package git

import (
	"bytes"
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"github.com/felixgugu/puffgittt/internal/model"
)

const maxTextBytes = 2 * 1024 * 1024
const maxImageBytes = 8 * 1024 * 1024

func (r *Runner) Diff(ctx context.Context, root, path, side, revision string) (model.DiffDocument, error) {
	repo, err := r.Open(ctx, root)
	if err != nil {
		return model.DiffDocument{}, err
	}
	path = filepath.ToSlash(path)
	doc := model.DiffDocument{
		Path:     path,
		Side:     side,
		Language: languageForPath(path),
	}

	if mime := imageMimeForPath(path); mime != "" {
		oldBytes, newBytes := r.imageBytes(ctx, repo.RootPath, path, side, revision)
		if len(oldBytes) <= maxImageBytes && len(newBytes) <= maxImageBytes {
			doc.Binary = true
			doc.Image = true
			doc.ImageMime = mime
			doc.OldImage = base64.StdEncoding.EncodeToString(oldBytes)
			doc.NewImage = base64.StdEncoding.EncodeToString(newBytes)
			return doc, nil
		}
	}

	var oldText, newText string
	switch side {
	case "staged":
		oldText = r.showBlob(ctx, repo.RootPath, "HEAD:"+path)
		newText = r.showBlob(ctx, repo.RootPath, ":"+path)
	case "commit":
		if strings.TrimSpace(revision) != "" {
			oldText = r.showBlob(ctx, repo.RootPath, revision+"^:"+path)
			newText = r.showBlob(ctx, repo.RootPath, revision+":"+path)
		}
	case "unstaged":
		fallthrough
	default:
		oldText = r.showBlob(ctx, repo.RootPath, ":"+path)
		filePath := filepath.Join(repo.RootPath, filepath.FromSlash(path))
		if data, err := os.ReadFile(filePath); err == nil {
			newText = string(data)
		}
	}

	if isBinaryText(oldText) || isBinaryText(newText) {
		doc.Binary = true
		return doc, nil
	}
	if len(oldText) > maxTextBytes {
		oldText = oldText[:maxTextBytes]
		doc.Truncated = true
	}
	if len(newText) > maxTextBytes {
		newText = newText[:maxTextBytes]
		doc.Truncated = true
	}
	doc.OldText = oldText
	doc.NewText = newText
	if side == "staged" || side == "unstaged" {
		if patch, err := r.diffPatch(ctx, repo.RootPath, path, side); err == nil {
			doc.PatchHash = patch.hash
			doc.Hunks = make([]model.DiffHunk, 0, len(patch.hunks))
			for _, hunk := range patch.hunks {
				doc.Hunks = append(doc.Hunks, hunkToModel(hunk))
			}
		}
	}
	return doc, nil
}

func (r *Runner) showBlob(ctx context.Context, root, spec string) string {
	out, _, err := r.RunBytes(ctx, root, nil, "show", spec)
	if err != nil {
		return ""
	}
	return out
}

func (r *Runner) showBlobBytes(ctx context.Context, root, spec string) []byte {
	out, _, err := r.RunBytes(ctx, root, nil, "show", spec)
	if err != nil {
		return nil
	}
	return []byte(out)
}

func (r *Runner) imageBytes(ctx context.Context, root, path, side, revision string) ([]byte, []byte) {
	switch side {
	case "staged":
		return r.showBlobBytes(ctx, root, "HEAD:"+path), r.showBlobBytes(ctx, root, ":"+path)
	case "commit":
		if strings.TrimSpace(revision) == "" {
			return nil, nil
		}
		return r.showBlobBytes(ctx, root, revision+"^:"+path), r.showBlobBytes(ctx, root, revision+":"+path)
	default:
		oldBytes := r.showBlobBytes(ctx, root, ":"+path)
		newBytes, _ := os.ReadFile(filepath.Join(root, filepath.FromSlash(path)))
		return oldBytes, newBytes
	}
}

func imageMimeForPath(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".bmp":
		return "image/bmp"
	case ".webp":
		return "image/webp"
	case ".ico":
		return "image/x-icon"
	case ".svg":
		return "image/svg+xml"
	default:
		return ""
	}
}

func isBinaryText(data string) bool {
	if data == "" {
		return false
	}
	sample := data
	if len(sample) > 8000 {
		sample = sample[:8000]
	}
	return bytes.IndexByte([]byte(sample), 0) >= 0
}

func languageForPath(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".go":
		return "go"
	case ".js", ".mjs", ".cjs":
		return "javascript"
	case ".jsx":
		return "javascript"
	case ".ts":
		return "typescript"
	case ".tsx":
		return "typescript"
	case ".json":
		return "json"
	case ".css":
		return "css"
	case ".scss":
		return "scss"
	case ".html", ".htm":
		return "html"
	case ".md", ".markdown":
		return "markdown"
	case ".xml":
		return "xml"
	case ".yml", ".yaml":
		return "yaml"
	case ".rs":
		return "rust"
	case ".py":
		return "python"
	case ".sh", ".bash", ".zsh":
		return "shell"
	case ".ps1":
		return "powershell"
	case ".sql":
		return "sql"
	case ".c", ".h":
		return "c"
	case ".cpp", ".hpp", ".cc":
		return "cpp"
	case ".java":
		return "java"
	case ".kt", ".kts":
		return "kotlin"
	case ".swift":
		return "swift"
	case ".toml":
		return "ini"
	case ".ini", ".cfg":
		return "ini"
	case ".diff", ".patch":
		return "diff"
	default:
		return "plaintext"
	}
}
