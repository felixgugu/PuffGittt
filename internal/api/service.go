package api

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	goruntime "runtime"
	"sort"
	"strings"
	"sync"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/felixgugu/puffgittt/internal/config"
	"github.com/felixgugu/puffgittt/internal/git"
	"github.com/felixgugu/puffgittt/internal/model"
	"github.com/felixgugu/puffgittt/internal/platform"
)

type Service struct {
	cfg    *config.Config
	runner *git.Runner
	ctx    context.Context
	mu     sync.RWMutex
	locks  sync.Map
}

func New(cfg *config.Config) *Service {
	return &Service{cfg: cfg, runner: git.NewRunner()}
}

func (s *Service) SetContext(ctx context.Context) { s.ctx = ctx }

func (s *Service) context() context.Context {
	if s.ctx != nil {
		return s.ctx
	}
	return context.Background()
}

func (s *Service) repoLock(root string) *sync.Mutex {
	key := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(root), "\\", "/"))
	value, _ := s.locks.LoadOrStore(key, &sync.Mutex{})
	return value.(*sync.Mutex)
}

func (s *Service) runnerWithSettings() *git.Runner {
	settings := s.cfg.LoadSettings()
	return s.runner.WithPath(settings.GitPath)
}

type AppAPI struct{ s *Service }
type RepoAPI struct{ s *Service }
type ChangeAPI struct{ s *Service }
type CommitAPI struct{ s *Service }
type HistoryAPI struct{ s *Service }
type BranchAPI struct{ s *Service }
type SyncAPI struct{ s *Service }
type ConflictAPI struct{ s *Service }
type StashAPI struct{ s *Service }
type TagAPI struct{ s *Service }

func NewAppAPI(s *Service) *AppAPI           { return &AppAPI{s: s} }
func NewRepoAPI(s *Service) *RepoAPI         { return &RepoAPI{s: s} }
func NewChangeAPI(s *Service) *ChangeAPI     { return &ChangeAPI{s: s} }
func NewCommitAPI(s *Service) *CommitAPI     { return &CommitAPI{s: s} }
func NewHistoryAPI(s *Service) *HistoryAPI   { return &HistoryAPI{s: s} }
func NewBranchAPI(s *Service) *BranchAPI     { return &BranchAPI{s: s} }
func NewSyncAPI(s *Service) *SyncAPI         { return &SyncAPI{s: s} }
func NewConflictAPI(s *Service) *ConflictAPI { return &ConflictAPI{s: s} }
func NewStashAPI(s *Service) *StashAPI       { return &StashAPI{s: s} }
func NewTagAPI(s *Service) *TagAPI           { return &TagAPI{s: s} }

func (a *AppAPI) GetEnvironment() model.Environment {
	env := model.Environment{GitFound: false, GoVersion: goruntime.Version(), Wails: "v2.17.0"}
	version, err := a.s.runnerWithSettings().Version(a.s.context())
	if err == nil {
		env.GitFound = true
		env.GitVersion = version
	}
	return env
}

func (a *AppAPI) GetSettings() model.Settings {
	return a.s.cfg.LoadSettings()
}

func (a *AppAPI) SaveSettings(settings model.Settings) (model.Settings, error) {
	if err := a.s.cfg.SaveSettings(settings); err != nil {
		return model.Settings{}, err
	}
	return a.s.cfg.LoadSettings(), nil
}

func (a *AppAPI) ListRecent() []model.RecentRepo {
	return a.s.cfg.LoadSettings().Recent
}

func (a *AppAPI) RemoveRecent(path string) error {
	return a.s.cfg.RemoveRecent(path)
}

func (a *AppAPI) ListWorkspaceRepositories() []model.WorkspaceRepository {
	settings := a.s.cfg.LoadSettings()
	runner := a.s.runnerWithSettings()
	seen := map[string]bool{}
	result := []model.WorkspaceRepository{}

	add := func(path, kind string) {
		if strings.TrimSpace(path) == "" {
			return
		}
		repo, err := runner.Open(a.s.context(), path)
		if err != nil {
			return
		}
		key := strings.ToLower(filepath.Clean(repo.RootPath))
		if seen[key] {
			return
		}
		seen[key] = true
		changes := 0
		if status, err := runner.Status(a.s.context(), repo.RootPath); err == nil {
			changes = len(status.Files)
		}
		result = append(result, model.WorkspaceRepository{
			Name:    repo.Name,
			Path:    repo.RootPath,
			Branch:  repo.Branch,
			Changes: changes,
			Kind:    kind,
		})
	}

	if strings.TrimSpace(settings.ProjectsRoot) != "" {
		add(settings.ProjectsRoot, "project")
		if entries, err := os.ReadDir(settings.ProjectsRoot); err == nil {
			for _, entry := range entries {
				if !entry.IsDir() {
					continue
				}
				name := entry.Name()
				if strings.HasPrefix(name, ".") || name == "node_modules" {
					continue
				}
				add(filepath.Join(settings.ProjectsRoot, name), "project")
			}
		}
	}
	for _, recent := range settings.Recent {
		add(recent.Path, "recent")
	}

	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Kind != result[j].Kind {
			return result[i].Kind == "project"
		}
		return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name)
	})
	return result
}

func (a *AppAPI) PickFolder(title string) (string, error) {
	if strings.TrimSpace(title) == "" {
		title = "Open Git repository"
	}
	return wailsruntime.OpenDirectoryDialog(a.s.context(), wailsruntime.OpenDialogOptions{Title: title})
}

func (a *AppAPI) OpenRepository(path string) (model.Repository, error) {
	repo, err := a.s.runnerWithSettings().Open(a.s.context(), path)
	if err != nil {
		return model.Repository{}, err
	}
	a.s.cfg.TouchRecent(repo.RootPath, repo.Name)
	return repo, nil
}

func (a *AppAPI) InitializeRepository(path, initialBranch string) (model.Repository, error) {
	repo, err := a.s.runnerWithSettings().Init(a.s.context(), path, initialBranch)
	if err != nil {
		return model.Repository{}, err
	}
	a.s.cfg.TouchRecent(repo.RootPath, repo.Name)
	return repo, nil
}

func (a *AppAPI) CloneRepository(url, parentPath, directoryName string) (model.Repository, error) {
	repo, err := a.s.runnerWithSettings().Clone(a.s.context(), url, parentPath, directoryName)
	if err != nil {
		return model.Repository{}, err
	}
	a.s.cfg.TouchRecent(repo.RootPath, repo.Name)
	return repo, nil
}

func (a *AppAPI) OpenInExplorer(path string) error {
	return platform.OpenInExplorer(path)
}

func (a *AppAPI) OpenExternal(url string) error {
	if !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "http://") {
		return fmt.Errorf("unsupported URL")
	}
	return platform.OpenExternal(url)
}

func (a *RepoAPI) GetStatus(root string) (model.Status, error) {
	return a.s.runnerWithSettings().Status(a.s.context(), root)
}

func (a *RepoAPI) GetBranches(root string) ([]model.Branch, error) {
	return a.s.runnerWithSettings().Branches(a.s.context(), root)
}

func (a *RepoAPI) GetRemotes(root string) ([]model.Remote, error) {
	return a.s.runnerWithSettings().Remotes(a.s.context(), root)
}

func (a *ChangeAPI) GetDiff(root, path, side, revision string) (model.DiffDocument, error) {
	return a.s.runnerWithSettings().Diff(a.s.context(), root, path, side, revision)
}

func (a *ChangeAPI) Stage(root string, paths []string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().Stage(a.s.context(), root, paths)
}

func (a *ChangeAPI) Unstage(root string, paths []string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().Unstage(a.s.context(), root, paths)
}

func (a *ChangeAPI) Discard(root string, paths []string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().Discard(a.s.context(), root, paths)
}

func (a *CommitAPI) Commit(root, message string, amend bool) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	settings := a.s.cfg.LoadSettings()
	return a.s.runnerWithSettings().CommitWithIdentity(
		a.s.context(), root, message, amend, settings.AuthorName, settings.AuthorEmail)
}

func (a *HistoryAPI) List(root, branch string, all bool, limit int, search string) ([]model.Commit, error) {
	return a.s.runnerWithSettings().Log(a.s.context(), root, branch, all, limit, search)
}

func (a *HistoryAPI) GetCommit(root, oid string) (model.CommitDetail, error) {
	return a.s.runnerWithSettings().CommitDetail(a.s.context(), root, oid)
}

func (a *BranchAPI) List(root string) ([]model.Branch, error) {
	return a.s.runnerWithSettings().Branches(a.s.context(), root)
}

func (a *BranchAPI) Create(root, name, startOid string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().CreateBranch(a.s.context(), root, name, startOid)
}

func (a *BranchAPI) Switch(root, name string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().SwitchBranch(a.s.context(), root, name)
}

func (a *BranchAPI) Delete(root, name string, force bool) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().DeleteBranch(a.s.context(), root, name, force)
}

func (a *BranchAPI) Merge(root, source, strategy string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().Merge(a.s.context(), root, source, strategy)
}

func (a *BranchAPI) Rebase(root, onto string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().Rebase(a.s.context(), root, onto)
}

func (a *SyncAPI) ListRemotes(root string) ([]model.Remote, error) {
	return a.s.runnerWithSettings().Remotes(a.s.context(), root)
}

func (a *SyncAPI) Fetch(root, remote string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().Fetch(a.s.context(), root, remote)
}

func (a *SyncAPI) Pull(root, remote, branch, strategy string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().Pull(a.s.context(), root, remote, branch, strategy)
}

func (a *SyncAPI) Push(root, remote, branch string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().Push(a.s.context(), root, remote, branch)
}

func (a *ConflictAPI) List(root string) ([]model.ConflictFile, error) {
	return a.s.runnerWithSettings().Conflicts(a.s.context(), root)
}

func (a *ConflictAPI) GetVersions(root, path string) (model.ConflictVersions, error) {
	return a.s.runnerWithSettings().ConflictVersions(a.s.context(), root, path)
}

func (a *ConflictAPI) SaveResult(root, path, content string) error {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().SaveConflictResult(a.s.context(), root, path, content)
}

func (a *ConflictAPI) Resolve(root, path string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().ResolveConflict(a.s.context(), root, path)
}

func (a *ConflictAPI) Continue(root, operation string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().ContinueOperation(a.s.context(), root, operation)
}

func (a *ConflictAPI) Abort(root, operation string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().AbortOperation(a.s.context(), root, operation)
}

func (a *StashAPI) List(root string) ([]model.StashEntry, error) {
	return a.s.runnerWithSettings().StashList(a.s.context(), root)
}

func (a *StashAPI) Create(root, message string, includeUntracked bool) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().StashPush(a.s.context(), root, message, includeUntracked)
}

func (a *StashAPI) Apply(root, ref string, drop bool) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().StashApply(a.s.context(), root, ref, drop)
}

func (a *StashAPI) Drop(root, ref string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().StashDrop(a.s.context(), root, ref)
}

func (a *TagAPI) List(root string) ([]git.Tag, error) {
	return a.s.runnerWithSettings().Tags(a.s.context(), root)
}

func (a *TagAPI) Create(root, name, oid, message string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().CreateTag(a.s.context(), root, name, oid, message)
}

func (a *TagAPI) Delete(root, name string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().DeleteTag(a.s.context(), root, name)
}
