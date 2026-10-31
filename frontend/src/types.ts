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

export interface DiffDocument {
  path: string;
  side: string;
  oldText: string;
  newText: string;
  language: string;
  binary: boolean;
  truncated: boolean;
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
  message?: string;
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
  gitPath: string;
  authorName: string;
  authorEmail: string;
  recent: RecentRepo[];
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
