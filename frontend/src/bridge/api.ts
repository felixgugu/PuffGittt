import { mockInvoke } from "./mock";
import type {
  Branch,
  Commit,
  CommitDetail,
  ConflictFile,
  ConflictVersions,
  DiffDocument,
  Environment,
  OperationResult,
  RecentRepo,
  Remote,
  Repository,
  Settings,
  StashEntry,
  Status,
  Tag,
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

export const api = {
  app: {
    getEnvironment: () => invoke<Environment>("AppAPI", "GetEnvironment"),
    getSettings: () => invoke<Settings>("AppAPI", "GetSettings"),
    saveSettings: (settings: Settings) => invoke<Settings>("AppAPI", "SaveSettings", settings),
    listRecent: () => invoke<RecentRepo[]>("AppAPI", "ListRecent"),
    removeRecent: (path: string) => invoke<void>("AppAPI", "RemoveRecent", path),
    pickFolder: (title: string) => invoke<string>("AppAPI", "PickFolder", title),
    openRepository: (path: string) => invoke<Repository>("AppAPI", "OpenRepository", path),
    initializeRepository: (path: string, branch: string) =>
      invoke<Repository>("AppAPI", "InitializeRepository", path, branch),
    cloneRepository: (url: string, parentPath: string, name: string) =>
      invoke<Repository>("AppAPI", "CloneRepository", url, parentPath, name),
    openInExplorer: (path: string) => invoke<void>("AppAPI", "OpenInExplorer", path),
    openExternal: (url: string) => invoke<void>("AppAPI", "OpenExternal", url),
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
  },
  branch: {
    list: (root: string) => invoke<Branch[]>("BranchAPI", "List", root),
    create: (root: string, name: string, startOid: string) =>
      invoke<OperationResult>("BranchAPI", "Create", root, name, startOid),
    switch: (root: string, name: string) => invoke<OperationResult>("BranchAPI", "Switch", root, name),
    delete: (root: string, name: string, force: boolean) =>
      invoke<OperationResult>("BranchAPI", "Delete", root, name, force),
    merge: (root: string, source: string, strategy: string) =>
      invoke<OperationResult>("BranchAPI", "Merge", root, source, strategy),
    rebase: (root: string, onto: string) => invoke<OperationResult>("BranchAPI", "Rebase", root, onto),
  },
  sync: {
    listRemotes: (root: string) => invoke<Remote[]>("SyncAPI", "ListRemotes", root),
    fetch: (root: string, remote: string) => invoke<OperationResult>("SyncAPI", "Fetch", root, remote),
    pull: (root: string, remote: string, branch: string, strategy: string) =>
      invoke<OperationResult>("SyncAPI", "Pull", root, remote, branch, strategy),
    push: (root: string, remote: string, branch: string) =>
      invoke<OperationResult>("SyncAPI", "Push", root, remote, branch),
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
  },
};
