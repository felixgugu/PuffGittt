package api

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/felixgugu/puffgittt/internal/config"
)

func initWorkspaceRepo(t *testing.T, dir string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	runGit(t, dir, "init", "--initial-branch", "main")
	runGit(t, dir, "config", "user.email", "test@example.com")
	runGit(t, dir, "config", "user.name", "Test User")
	if err := os.WriteFile(filepath.Join(dir, "README.md"), []byte("workspace\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, dir, "add", "README.md")
	runGit(t, dir, "commit", "-m", "initial")
}

func TestWorkspaceFolderAddRemove(t *testing.T) {
	projects := t.TempDir()
	alpha := filepath.Join(projects, "alpha")
	beta := filepath.Join(projects, "beta")
	initWorkspaceRepo(t, alpha)
	initWorkspaceRepo(t, beta)
	external := filepath.Join(t.TempDir(), "gamma")
	initWorkspaceRepo(t, external)

	cfg := &config.Config{
		AppDir:      t.TempDir(),
		SettingsDir: t.TempDir(),
		CacheDir:    t.TempDir(),
		LogDir:      t.TempDir(),
		BackupDir:   t.TempDir(),
	}
	settings := cfg.LoadSettings()
	settings.ProjectsRoot = projects
	if err := cfg.SaveSettings(settings); err != nil {
		t.Fatal(err)
	}
	service := New(cfg)
	service.SetContext(context.Background())
	appAPI := NewAppAPI(service)

	list := appAPI.ListWorkspaceRepositories()
	if len(list) != 2 {
		t.Fatalf("initial workspace = %#v", list)
	}

	if err := appAPI.RemoveWorkspaceRepository(alpha); err != nil {
		t.Fatal(err)
	}
	list = appAPI.ListWorkspaceRepositories()
	if len(list) != 1 || list[0].Name != "beta" {
		t.Fatalf("after remove = %#v", list)
	}
	saved := cfg.LoadSettings()
	foundHidden := false
	for _, path := range saved.HiddenProjects {
		if path == alpha {
			foundHidden = true
		}
	}
	if !foundHidden {
		t.Fatalf("alpha should be hidden: %#v", saved.HiddenProjects)
	}

	if _, err := appAPI.AddWorkspaceFolder(alpha); err != nil {
		t.Fatal(err)
	}
	list = appAPI.ListWorkspaceRepositories()
	if len(list) != 2 {
		t.Fatalf("after add = %#v", list)
	}

	if _, err := appAPI.AddWorkspaceFolder(external); err != nil {
		t.Fatal(err)
	}
	list = appAPI.ListWorkspaceRepositories()
	foundWorkspace := false
	for _, entry := range list {
		if workspacePathKey(entry.Path) == workspacePathKey(external) && entry.Kind == "workspace" {
			foundWorkspace = true
		}
	}
	if !foundWorkspace {
		t.Fatalf("external workspace not listed: %#v", list)
	}
}
