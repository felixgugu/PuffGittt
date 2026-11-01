export interface Repository {
  id: string;
  name: string;
  rootPath: string;
  gitDir: string;
  headOid?: string;
  branch?: string;
  upstream?: string;
  detached: boolean;
  unborn: boolean;
  operation: string;
  revision: number;
}

export interface FileChange {
  id: string;
  path: string;
  originalPath?: string;
  indexStatus: string;
  worktreeStatus: string;
  kind: "tracked" | "untracked" | "conflicted" | string;
  binary?: boolean;
}

export interface Status {
  repo: Repository;
  files: FileChange[];
  ahead: number;
  behind: number;
}

export interface DiffLine {
  kind: "context" | "add" | "delete";
  text: string;
  oldLine: number;
  newLine: number;
  noNewline?: boolean;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface HunkSelection {
  hunk: number;
  lines: number[];
}

export interface DiffDocument {
  path: string;
  side: string;
  oldText: string;
  newText: string;
  language: string;
  binary: boolean;
  truncated: boolean;
  hunks?: DiffHunk[];
  patchHash?: string;
  image?: boolean;
  imageMime?: string;
  oldImage?: string;
  newImage?: string;
}

export interface Commit {
  oid: string;
  parents: string[];
  author: string;
  authorEmail: string;
  authorTime: string;
  committer: string;
  committerEmail: string;
  committerTime: string;
  subject: string;
  message: string;
  refs: string[];
}

export interface CommitFile {
  path: string;
  status: string;
}

export interface CompareCommit {
  oid: string;
  subject: string;
  author: string;
  date: string;
}

export interface BranchCompare {
  base: string;
  compare: string;
  ahead: number;
  behind: number;
  aheadCommits: CompareCommit[];
  behindCommits: CompareCommit[];
  files: CommitFile[];
}

export interface BlameLine {
  line: number;
  oid: string;
  author: string;
  date: string;
  summary: string;
  text: string;
}

export interface RebaseTodo {
  oid: string;
  action: string;
  subject: string;
  message?: string;
}

export interface BisectState {
  active: boolean;
  branch?: string;
  current?: string;
  log?: string;
}

export interface Worktree {
  path: string;
  head: string;
  branch: string;
  bare?: boolean;
  detached?: boolean;
  locked?: boolean;
  lockReason?: string;
  prunable?: boolean;
  pruneReason?: string;
}

export interface Submodule {
  path: string;
  oid: string;
  describe?: string;
  status: string;
}

export interface CommitDetail {
  commit: Commit;
  files: CommitFile[];
}

export interface Branch {
  name: string;
  fullName: string;
  kind: "local" | "remote" | string;
  oid: string;
  upstream?: string;
  committerDate: string;
  current: boolean;
  merged: boolean;
  ahead: number;
  behind: number;
}

export interface Remote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface ConflictStage {
  stage: number;
  oid?: string;
  exists: boolean;
  content?: string;
  binary?: boolean;
}

export interface ConflictFile {
  path: string;
  stages: ConflictStage[];
  binary: boolean;
  present: boolean;
}

export interface ConflictVersions {
  path: string;
  base: string;
  ours: string;
  theirs: string;
  result: string;
  oursLabel: string;
  theirsLabel: string;
  binary: boolean;
  operation: string;
}

export interface StashEntry {
  ref: string;
  oid: string;
  message: string;
  date: string;
}

export interface Tag {
  name: string;
  oid: string;
  targetOid?: string;
  tagger?: string;
  taggerDate?: string;
  message?: string;
  annotated?: boolean;
}

export interface RemoteTag {
  name: string;
  oid: string;
}

export interface RecentRepo {
  path: string;
  name: string;
  lastOpened: string;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  language: "zh-TW" | "en";
  fontFamily: string;
  baseFontSize: number;
  gitPath: string;
  projectsRoot: string;
  workspaceFolders?: string[];
  hiddenProjects?: string[];
  authorName: string;
  authorEmail: string;
  recent: RecentRepo[];
}

export interface WorkspaceRepository {
  name: string;
  path: string;
  branch: string;
  changes: number;
  kind: "project" | "recent" | string;
}

export interface Environment {
  gitFound: boolean;
  gitVersion: string;
  goVersion: string;
  wails: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
  output?: string;
}

export interface CommandRequest {
  action: string;
  source?: string;
  target?: string;
  strategy?: string;
  name?: string;
  startPoint?: string;
  remote?: string;
  branch?: string;
  force?: boolean;
}

export interface CommandPreview {
  command: string;
  destructive: boolean;
}

export interface ReflogEntry {
  selector: string;
  oid: string;
  previousOid?: string;
  action: string;
  message: string;
  date: string;
}

export interface UndoRecord {
  id: string;
  operation: string;
  beforeOid: string;
  afterOid?: string;
  backupRef?: string;
  time: string;
}

export type TaskState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface TaskInfo {
  id: string;
  root: string;
  operation: string;
  state: TaskState;
  cancellable: boolean;
  message?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}
