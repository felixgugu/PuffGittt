import { mockInvoke } from "./mock";
import type {
  Branch,
  BranchCompare,
  BlameLine,
  CommandPreview,
  CommandRequest,
  Commit,
  CommitDetail,
  CompareCommit,
  ConflictFile,
  ConflictVersions,
  DiffDocument,
  Environment,
  HunkSelection,
  OperationResult,
  RecentRepo,
  ReflogEntry,
  Remote,
  Repository,
  Settings,
  StashEntry,
  Status,
  Tag,
  UndoRecord,
  WorkspaceRepository,
} from "../types";

const goApi = () => (window as any).go?.api;
const goMain = () => (window as any).go?.main;

function invoke<T>(group: string, method: string, ...args: any[]): Promise<T> {
  const fn = goApi()?.[group]?.[method];
  if (typeof fn === "function") {
    return Promise.resolve(fn(...args)).catch((error: any) => {
      throw new Error(error?.message || String(error));
    });
  }
  return mockInvoke<T>(group, method, args);
}

export const isMockBridge = () => !goApi();

export function setNativeTheme(mode: string): void {
  const fn = goMain()?.App?.SetTheme;
  if (typeof fn === "function") {
    void fn(mode);
  }
}

function invokeMain<T>(method: string, ...args: any[]): Promise<T> {
  const fn = goMain()?.App?.[method];
  if (typeof fn === "function") {
    return Promise.resolve(fn(...args)).catch((error: any) => {
      throw new Error(error?.message || String(error));
    });
  }
  return Promise.resolve(undefined as T);
}

export const api = {
  app: {
    getEnvironment: () => invoke<Environment>("AppAPI", "GetEnvironment"),
    getSettings: () => invoke<Settings>("AppAPI", "GetSettings"),
    saveSettings: (settings: Settings) => invoke<Settings>("AppAPI", "SaveSettings", settings),
    listRecent: () => invoke<RecentRepo[]>("AppAPI", "ListRecent"),
    listWorkspaceRepositories: () => invoke<WorkspaceRepository[]>("AppAPI", "ListWorkspaceRepositories"),
    removeRecent: (path: string) => invoke<void>("AppAPI", "RemoveRecent", path),
    pickFolder: (title: string) => invoke<string>("AppAPI", "PickFolder", title),
    openRepository: (path: string) => invoke<Repository>("AppAPI", "OpenRepository", path),
    initializeRepository: (path: string, branch: string) =>
      invoke<Repository>("AppAPI", "InitializeRepository", path, branch),
    cloneRepository: (url: string, parentPath: string, name: string) =>
      invoke<Repository>("AppAPI", "CloneRepository", url, parentPath, name),
    openInExplorer: (path: string) => invoke<void>("AppAPI", "OpenInExplorer", path),
    openExternal: (url: string) => invoke<void>("AppAPI", "OpenExternal", url),
    watchRepository: (root: string) => invoke<void>("AppAPI", "WatchRepository", root),
    unwatchRepository: (root: string) => invoke<void>("AppAPI", "UnwatchRepository", root),
  },
  window: {
    minimize: () => invokeMain<void>("MinimizeWindow"),
    toggleMaximize: () => invokeMain<void>("ToggleMaximizeWindow"),
    close: () => invokeMain<void>("CloseWindow"),
    isMaximized: () => invokeMain<boolean>("IsWindowMaximized"),
  },
  repo: {
    getStatus: (root: string) => invoke<Status>("RepoAPI", "GetStatus", root),
    getBranches: (root: string) => invoke<Branch[]>("RepoAPI", "GetBranches", root),
    getRemotes: (root: string) => invoke<Remote[]>("RepoAPI", "GetRemotes", root),
  },
  change: {
    getDiff: (root: string, path: string, side: string, revision: string) =>
      invoke<DiffDocument>("ChangeAPI", "GetDiff", root, path, side, revision),
    stage: (root: string, paths: string[]) => invoke<OperationResult>("ChangeAPI", "Stage", root, paths),
    unstage: (root: string, paths: string[]) => invoke<OperationResult>("ChangeAPI", "Unstage", root, paths),
    applyHunks: (root: string, path: string, side: string, patchHash: string, selections: HunkSelection[]) =>
      invoke<OperationResult>("ChangeAPI", "ApplyHunks", root, path, side, patchHash, selections),
    discard: (root: string, paths: string[]) => invoke<OperationResult>("ChangeAPI", "Discard", root, paths),
  },
  commit: {
    commit: (root: string, message: string, amend: boolean) =>
      invoke<OperationResult>("CommitAPI", "Commit", root, message, amend),
  },
  history: {
    list: (root: string, branch: string, all: boolean, limit: number, search: string) =>
      invoke<Commit[]>("HistoryAPI", "List", root, branch, all, limit, search),
    getCommit: (root: string, oid: string) => invoke<CommitDetail>("HistoryAPI", "GetCommit", root, oid),
    preview: (root: string, request: CommandRequest) =>
      invoke<CommandPreview>("HistoryAPI", "Preview", root, request),
    reset: (root: string, oid: string, mode: string) =>
      invoke<OperationResult>("HistoryAPI", "Reset", root, oid, mode),
    revert: (root: string, oid: string) =>
      invoke<OperationResult>("HistoryAPI", "Revert", root, oid),
    drop: (root: string, oid: string) =>
      invoke<OperationResult>("HistoryAPI", "Drop", root, oid),
    cherryPick: (root: string, oid: string, mainline: string) =>
      invoke<OperationResult>("HistoryAPI", "CherryPick", root, oid, mainline),
    fileHistory: (root: string, path: string, limit: number) =>
      invoke<CompareCommit[]>("HistoryAPI", "FileHistory", root, path, limit),
    blame: (root: string, path: string) => invoke<BlameLine[]>("HistoryAPI", "Blame", root, path),
    reflog: (root: string, limit: number) =>
      invoke<ReflogEntry[]>("HistoryAPI", "Reflog", root, limit),
    undoInfo: (root: string) => invoke<UndoRecord>("HistoryAPI", "UndoInfo", root),
    undo: (root: string) => invoke<OperationResult>("HistoryAPI", "Undo", root),
  },
  branch: {
    list: (root: string) => invoke<Branch[]>("BranchAPI", "List", root),
    create: (root: string, name: string, startOid: string) =>
      invoke<OperationResult>("BranchAPI", "Create", root, name, startOid),
    switch: (root: string, name: string) => invoke<OperationResult>("BranchAPI", "Switch", root, name),
    delete: (root: string, name: string, force: boolean) =>
      invoke<OperationResult>("BranchAPI", "Delete", root, name, force),
    rename: (root: string, oldName: string, newName: string) =>
      invoke<OperationResult>("BranchAPI", "Rename", root, oldName, newName),
    setUpstream: (root: string, branch: string, upstream: string) =>
      invoke<OperationResult>("BranchAPI", "SetUpstream", root, branch, upstream),
    checkoutRemote: (root: string, localName: string, remoteBranch: string) =>
      invoke<OperationResult>("BranchAPI", "CheckoutRemote", root, localName, remoteBranch),
    merge: (root: string, source: string, strategy: string) =>
      invoke<OperationResult>("BranchAPI", "Merge", root, source, strategy),
    rebase: (root: string, onto: string) => invoke<OperationResult>("BranchAPI", "Rebase", root, onto),
    preview: (root: string, request: CommandRequest) =>
      invoke<CommandPreview>("BranchAPI", "Preview", root, request),
    compare: (root: string, base: string, compare: string) =>
      invoke<BranchCompare>("BranchAPI", "Compare", root, base, compare),
  },
  sync: {
    listRemotes: (root: string) => invoke<Remote[]>("SyncAPI", "ListRemotes", root),
    fetch: (root: string, remote: string) => invoke<OperationResult>("SyncAPI", "Fetch", root, remote),
    pull: (root: string, remote: string, branch: string, strategy: string) =>
      invoke<OperationResult>("SyncAPI", "Pull", root, remote, branch, strategy),
    push: (root: string, remote: string, branch: string, forceWithLease = false) =>
      invoke<OperationResult>("SyncAPI", "Push", root, remote, branch, forceWithLease),
    publish: (root: string, remote: string, branch: string) =>
      invoke<OperationResult>("SyncAPI", "Publish", root, remote, branch),
    deleteRemoteBranch: (root: string, remote: string, branch: string) =>
      invoke<OperationResult>("SyncAPI", "DeleteRemoteBranch", root, remote, branch),
    addRemote: (root: string, name: string, url: string) =>
      invoke<OperationResult>("SyncAPI", "AddRemote", root, name, url),
    setRemoteUrl: (root: string, name: string, url: string) =>
      invoke<OperationResult>("SyncAPI", "SetRemoteURL", root, name, url),
    removeRemote: (root: string, name: string) =>
      invoke<OperationResult>("SyncAPI", "RemoveRemote", root, name),
    preview: (root: string, request: CommandRequest) =>
      invoke<CommandPreview>("SyncAPI", "Preview", root, request),
  },
  conflict: {
    list: (root: string) => invoke<ConflictFile[]>("ConflictAPI", "List", root),
    getVersions: (root: string, path: string) => invoke<ConflictVersions>("ConflictAPI", "GetVersions", root, path),
    saveResult: (root: string, path: string, content: string) =>
      invoke<void>("ConflictAPI", "SaveResult", root, path, content),
    resolve: (root: string, path: string) => invoke<OperationResult>("ConflictAPI", "Resolve", root, path),
    continue: (root: string, operation: string) =>
      invoke<OperationResult>("ConflictAPI", "Continue", root, operation),
    abort: (root: string, operation: string) => invoke<OperationResult>("ConflictAPI", "Abort", root, operation),
  },
  stash: {
    list: (root: string) => invoke<StashEntry[]>("StashAPI", "List", root),
    create: (root: string, message: string, includeUntracked: boolean) =>
      invoke<OperationResult>("StashAPI", "Create", root, message, includeUntracked),
    apply: (root: string, ref: string, drop: boolean) =>
      invoke<OperationResult>("StashAPI", "Apply", root, ref, drop),
    drop: (root: string, ref: string) => invoke<OperationResult>("StashAPI", "Drop", root, ref),
  },
  tags: {
    list: (root: string) => invoke<Tag[]>("TagAPI", "List", root),
    create: (root: string, name: string, oid: string, message: string) =>
      invoke<OperationResult>("TagAPI", "Create", root, name, oid, message),
    delete: (root: string, name: string) => invoke<OperationResult>("TagAPI", "Delete", root, name),
    push: (root: string, remote: string, name: string) =>
      invoke<OperationResult>("TagAPI", "Push", root, remote, name),
    pushAll: (root: string, remote: string) => invoke<OperationResult>("TagAPI", "PushAll", root, remote),
  },
};
