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
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/felixgugu/puffgittt/internal/config"
	"github.com/felixgugu/puffgittt/internal/git"
	"github.com/felixgugu/puffgittt/internal/model"
	"github.com/felixgugu/puffgittt/internal/platform"
)

type Service struct {
	cfg      *config.Config
	runner   *git.Runner
	ctx      context.Context
	mu       sync.RWMutex
	locks    sync.Map
	undoMu   sync.Mutex
	undo     map[string]model.UndoRecord
	watchMu  sync.Mutex
	watchers map[string]*repoMonitor
	emitMu   sync.Mutex
	emit     func(name string, data interface{})
}

func New(cfg *config.Config) *Service {
	return &Service{
		cfg:      cfg,
		runner:   git.NewRunner(),
		undo:     map[string]model.UndoRecord{},
		watchers: map[string]*repoMonitor{},
	}
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

func undoKey(root string) string {
	return strings.ToLower(strings.ReplaceAll(strings.TrimSpace(root), "\\", "/"))
}

func (s *Service) headOid(root string) string {
	head, err := s.runnerWithSettings().HeadOid(s.context(), root)
	if err != nil {
		return ""
	}
	return head
}

func (s *Service) recordUndo(root, operation, beforeOid string) {
	if strings.TrimSpace(beforeOid) == "" {
		return
	}
	afterOid := s.headOid(root)
	if afterOid == "" || afterOid == beforeOid {
		return
	}
	s.undoMu.Lock()
	defer s.undoMu.Unlock()
	s.undo[undoKey(root)] = model.UndoRecord{
		Operation: operation,
		BeforeOid: beforeOid,
		AfterOid:  afterOid,
		Time:      time.Now().Format(time.RFC3339),
	}
}

func (s *Service) UndoInfo(root string) model.UndoRecord {
	s.undoMu.Lock()
	defer s.undoMu.Unlock()
	return s.undo[undoKey(root)]
}

func (s *Service) Undo(root string) (model.OperationResult, error) {
	record := s.UndoInfo(root)
	if strings.TrimSpace(record.BeforeOid) == "" {
		return model.OperationResult{}, fmt.Errorf("沒有可復原的操作")
	}
	runner := s.runnerWithSettings()
	status, err := runner.Status(s.context(), root)
	if err != nil {
		return model.OperationResult{}, err
	}
	if status.Repo.Operation != "normal" {
		return model.OperationResult{}, fmt.Errorf("有進行中的 Git 操作，無法復原")
	}
	if head := s.headOid(root); head == "" || head != record.AfterOid {
		return model.OperationResult{}, fmt.Errorf("目前 HEAD 已改變，無法復原上一次操作")
	}
	for _, file := range status.Files {
		if file.IndexStatus == "?" {
			continue
		}
		if file.IndexStatus != "." || file.WorktreeStatus != "." {
			return model.OperationResult{}, fmt.Errorf("工作區必須乾淨才能復原")
		}
	}
	result, err := runner.ResetCommit(s.context(), root, record.BeforeOid, "hard")
	if err != nil {
		return model.OperationResult{}, err
	}
	s.undoMu.Lock()
	delete(s.undo, undoKey(root))
	s.undoMu.Unlock()
	result.Message = "已復原上一次操作"
	return result, nil
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
	hidden := map[string]bool{}
	for _, path := range settings.HiddenProjects {
		hidden[workspacePathKey(path)] = true
	}

	type candidate struct {
		path string
		kind string
	}
	candidates := []candidate{}
	seen := map[string]bool{}
	addCandidate := func(path, kind string) {
		if !looksLikeRepository(path) {
			return
		}
		clean := filepath.Clean(path)
		key := workspacePathKey(clean)
		if seen[key] || hidden[key] {
			return
		}
		seen[key] = true
		candidates = append(candidates, candidate{path: clean, kind: kind})
	}

	if strings.TrimSpace(settings.ProjectsRoot) != "" {
		addCandidate(settings.ProjectsRoot, "project")
		if entries, err := os.ReadDir(settings.ProjectsRoot); err == nil {
			for _, entry := range entries {
				if !entry.IsDir() {
					continue
				}
				name := entry.Name()
				if strings.HasPrefix(name, ".") || name == "node_modules" {
					continue
				}
				addCandidate(filepath.Join(settings.ProjectsRoot, name), "project")
			}
		}
	}
	for _, path := range settings.WorkspaceFolders {
		addCandidate(path, "workspace")
	}
	for _, recent := range settings.Recent {
		addCandidate(recent.Path, "recent")
	}

	result := make([]model.WorkspaceRepository, 0, len(candidates))
	for _, entry := range candidates {
		result = append(result, model.WorkspaceRepository{
			Name: filepath.Base(entry.path),
			Path: filepath.ToSlash(entry.path),
			Kind: entry.kind,
		})
	}
	rank := func(kind string) int {
		switch kind {
		case "project":
			return 0
		case "workspace":
			return 1
		default:
			return 2
		}
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Kind != result[j].Kind {
			return rank(result[i].Kind) < rank(result[j].Kind)
		}
		return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name)
	})
	return result
}

func looksLikeRepository(path string) bool {
	if strings.TrimSpace(path) == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(path, ".git"))
	return err == nil
}

func (a *AppAPI) AddWorkspaceFolder(path string) (model.Repository, error) {
	repo, err := a.s.runnerWithSettings().Open(a.s.context(), path)
	if err != nil {
		return model.Repository{}, err
	}
	settings := a.s.cfg.LoadSettings()
	settings.HiddenProjects = withoutWorkspacePath(settings.HiddenProjects, repo.RootPath)
	if !hasWorkspacePath(settings.WorkspaceFolders, repo.RootPath) {
		settings.WorkspaceFolders = append(settings.WorkspaceFolders, repo.RootPath)
	}
	if err := a.s.cfg.SaveSettings(settings); err != nil {
		return model.Repository{}, err
	}
	return repo, nil
}

func (a *AppAPI) RemoveWorkspaceRepository(path string) ([]model.WorkspaceRepository, error) {
	settings := a.s.cfg.LoadSettings()
	settings.WorkspaceFolders = withoutWorkspacePath(settings.WorkspaceFolders, path)
	filtered := settings.Recent[:0]
	for _, entry := range settings.Recent {
		if workspacePathKey(entry.Path) != workspacePathKey(path) {
			filtered = append(filtered, entry)
		}
	}
	settings.Recent = filtered
	if !hasWorkspacePath(settings.HiddenProjects, path) {
		settings.HiddenProjects = append(settings.HiddenProjects, path)
	}
	if err := a.s.cfg.SaveSettings(settings); err != nil {
		return nil, err
	}
	return a.ListWorkspaceRepositories(), nil
}

func workspacePathKey(path string) string {
	return strings.ToLower(filepath.Clean(strings.TrimSpace(path)))
}

func hasWorkspacePath(paths []string, path string) bool {
	key := workspacePathKey(path)
	for _, entry := range paths {
		if workspacePathKey(entry) == key {
			return true
		}
	}
	return false
}

func withoutWorkspacePath(paths []string, path string) []string {
	key := workspacePathKey(path)
	out := paths[:0]
	for _, entry := range paths {
		if workspacePathKey(entry) != key {
			out = append(out, entry)
		}
	}
	return out
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
	settings := a.s.cfg.LoadSettings()
	if hasWorkspacePath(settings.HiddenProjects, repo.RootPath) {
		settings.HiddenProjects = withoutWorkspacePath(settings.HiddenProjects, repo.RootPath)
		_ = a.s.cfg.SaveSettings(settings)
	}
	a.s.cfg.TouchRecent(repo.RootPath, repo.Name)
	return repo, nil
}

func (a *AppAPI) WatchRepository(root string) {
	a.s.WatchRepository(root)
}

func (a *AppAPI) UnwatchRepository(root string) {
	a.s.UnwatchRepository(root)
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

func (a *RepoAPI) GetWorkspaceStatus(root string) (model.WorkspaceRepository, bool) {
	return a.s.runnerWithSettings().WorkspaceStatus(a.s.context(), root)
}

func (a *RepoAPI) GetBranches(root string) ([]model.Branch, error) {
	return a.s.runnerWithSettings().Branches(a.s.context(), root)
}

func (a *RepoAPI) GetRemotes(root string) ([]model.Remote, error) {
	return a.s.runnerWithSettings().Remotes(a.s.context(), root)
}

func (a *RepoAPI) GetSubmodules(root string) ([]model.Submodule, error) {
	return a.s.runnerWithSettings().Submodules(a.s.context(), root)
}

func (a *RepoAPI) UpdateSubmodule(root, path string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().UpdateSubmodule(a.s.context(), root, path)
}

func (a *RepoAPI) SyncSubmodules(root string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().SyncSubmodules(a.s.context(), root)
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

func (a *ChangeAPI) ApplyHunks(root, path, side, patchHash string, selections []model.HunkSelection) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().ApplyHunks(a.s.context(), root, path, side, patchHash, selections)
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

func (a *HistoryAPI) List(root, branch string, all bool, limit int, search, mode string) ([]model.Commit, error) {
	return a.s.runnerWithSettings().LogSearch(a.s.context(), root, branch, all, limit, search, mode)
}

func (a *HistoryAPI) GetCommit(root, oid string) (model.CommitDetail, error) {
	return a.s.runnerWithSettings().CommitDetail(a.s.context(), root, oid)
}

func (a *HistoryAPI) Preview(root string, req model.CommandRequest) (model.CommandPreview, error) {
	return a.s.runnerWithSettings().PreviewHistoryCommand(a.s.context(), root, req)
}

func (a *HistoryAPI) Reset(root, oid, mode string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	before := a.s.headOid(root)
	result, err := a.s.runnerWithSettings().ResetCommit(a.s.context(), root, oid, mode)
	if err == nil {
		a.s.recordUndo(root, "Reset ("+mode+")", before)
	}
	return result, err
}

func (a *HistoryAPI) Revert(root, oid string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	before := a.s.headOid(root)
	result, err := a.s.runnerWithSettings().RevertCommit(a.s.context(), root, oid)
	if err == nil {
		a.s.recordUndo(root, "Revert", before)
	}
	return result, err
}

func (a *HistoryAPI) Drop(root, oid string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	before := a.s.headOid(root)
	result, err := a.s.runnerWithSettings().DropCommit(a.s.context(), root, oid)
	if err == nil {
		a.s.recordUndo(root, "Drop", before)
	}
	return result, err
}

func (a *HistoryAPI) FileHistory(root, path string, limit int) ([]model.CompareCommit, error) {
	return a.s.runnerWithSettings().FileHistory(a.s.context(), root, path, limit)
}

func (a *HistoryAPI) Blame(root, path string) ([]model.BlameLine, error) {
	return a.s.runnerWithSettings().Blame(a.s.context(), root, path)
}

func (a *HistoryAPI) RebasePlan(root, base string) ([]model.RebaseTodo, error) {
	return a.s.runnerWithSettings().RebasePlan(a.s.context(), root, base)
}

func (a *HistoryAPI) InteractiveRebase(root, base string, todos []model.RebaseTodo) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	before := a.s.headOid(root)
	result, err := a.s.runnerWithSettings().InteractiveRebase(a.s.context(), root, base, todos)
	if err == nil {
		a.s.recordUndo(root, "Interactive rebase", before)
	}
	return result, err
}

func (a *HistoryAPI) BisectState(root string) (model.BisectState, error) {
	return a.s.runnerWithSettings().BisectState(a.s.context(), root)
}

func (a *HistoryAPI) BisectStart(root, bad, good string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().BisectStart(a.s.context(), root, bad, good)
}

func (a *HistoryAPI) BisectMark(root string, good bool) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().BisectMark(a.s.context(), root, good)
}

func (a *HistoryAPI) BisectReset(root string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().BisectReset(a.s.context(), root)
}

func (a *HistoryAPI) CherryPick(root, oid, mainline string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	before := a.s.headOid(root)
	result, err := a.s.runnerWithSettings().CherryPickCommit(a.s.context(), root, oid, mainline)
	if err == nil {
		a.s.recordUndo(root, "Cherry-pick", before)
	}
	return result, err
}

func (a *HistoryAPI) Reflog(root string, limit int) ([]model.ReflogEntry, error) {
	return a.s.runnerWithSettings().Reflog(a.s.context(), root, limit)
}

func (a *HistoryAPI) UndoInfo(root string) model.UndoRecord {
	return a.s.UndoInfo(root)
}

func (a *HistoryAPI) Undo(root string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.Undo(root)
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

func (a *BranchAPI) Rename(root, oldName, newName string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().RenameBranch(a.s.context(), root, oldName, newName)
}

func (a *BranchAPI) SetUpstream(root, branch, upstream string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().SetUpstream(a.s.context(), root, branch, upstream)
}

func (a *BranchAPI) CheckoutRemote(root, localName, remoteBranch string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().CheckoutRemoteBranch(a.s.context(), root, localName, remoteBranch)
}

func (a *BranchAPI) Merge(root, source, strategy string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	before := a.s.headOid(root)
	result, err := a.s.runnerWithSettings().Merge(a.s.context(), root, source, strategy)
	if err == nil {
		a.s.recordUndo(root, "Merge", before)
	}
	return result, err
}

func (a *BranchAPI) Rebase(root, onto string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	before := a.s.headOid(root)
	result, err := a.s.runnerWithSettings().Rebase(a.s.context(), root, onto)
	if err == nil {
		a.s.recordUndo(root, "Rebase", before)
	}
	return result, err
}

func (a *BranchAPI) Preview(root string, req model.CommandRequest) (model.CommandPreview, error) {
	return a.s.runnerWithSettings().PreviewBranchCommand(a.s.context(), root, req)
}

func (a *BranchAPI) Compare(root, base, compare string) (model.BranchCompare, error) {
	return a.s.runnerWithSettings().CompareBranches(a.s.context(), root, base, compare)
}

func (a *BranchAPI) Worktrees(root string) ([]model.Worktree, error) {
	return a.s.runnerWithSettings().Worktrees(a.s.context(), root)
}

func (a *BranchAPI) AddWorktree(root, path, branch string, createBranch bool) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().AddWorktree(a.s.context(), root, path, branch, createBranch)
}

func (a *BranchAPI) RemoveWorktree(root, path string, force bool) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().RemoveWorktree(a.s.context(), root, path, force)
}

func (a *BranchAPI) PruneWorktrees(root string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().PruneWorktrees(a.s.context(), root)
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

func (a *SyncAPI) Push(root, remote, branch string, forceWithLease bool) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().Push(a.s.context(), root, remote, branch, forceWithLease)
}

func (a *SyncAPI) Publish(root, remote, branch string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().PublishBranch(a.s.context(), root, remote, branch)
}

func (a *SyncAPI) DeleteRemoteBranch(root, remote, branch string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().DeleteRemoteBranch(a.s.context(), root, remote, branch)
}

func (a *SyncAPI) AddRemote(root, name, url string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().AddRemote(a.s.context(), root, name, url)
}

func (a *SyncAPI) SetRemoteURL(root, name, url string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().SetRemoteURL(a.s.context(), root, name, url)
}

func (a *SyncAPI) RemoveRemote(root, name string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().RemoveRemote(a.s.context(), root, name)
}

func (a *SyncAPI) Preview(root string, req model.CommandRequest) (model.CommandPreview, error) {
	return a.s.runnerWithSettings().PreviewSyncCommand(a.s.context(), root, req)
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

func (a *StashAPI) Diff(root, ref string) (string, error) {
	return a.s.runnerWithSettings().StashDiff(a.s.context(), root, ref)
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

func (a *TagAPI) Push(root, remote, name string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().PushTag(a.s.context(), root, remote, name)
}

func (a *TagAPI) PushAll(root, remote string) (model.OperationResult, error) {
	mu := a.s.repoLock(root)
	mu.Lock()
	defer mu.Unlock()
	return a.s.runnerWithSettings().PushAllTags(a.s.context(), root, remote)
}
