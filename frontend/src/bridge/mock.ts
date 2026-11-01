import type {
  Branch,
  BranchCompare,
  BisectState,
  BlameLine,
  CommandPreview,
  CommandRequest,
  Commit,
  CommitDetail,
  ConflictFile,
  ConflictVersions,
  DiffDocument,
  FileChange,
  HunkSelection,
  OperationResult,
  RecentRepo,
  ReflogEntry,
  Repository,
  RebaseTodo,
  Settings,
  StashEntry,
  Status,
  Submodule,
  Tag,
  UndoRecord,
  Worktree,
  WorkspaceRepository,
} from "../types";

const now = () => new Date().toISOString();

const repo: Repository = {
  id: "C:\\Demo\\PuffGittt",
  name: "PuffGittt",
  rootPath: "C:\\Demo\\PuffGittt",
  gitDir: "C:\\Demo\\PuffGittt\\.git",
  headOid: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
  branch: "main",
  upstream: "origin/main",
  detached: false,
  unborn: false,
  operation: "normal",
  revision: Date.now(),
};

let files: FileChange[] = [
  {
    id: "src/auth/login.ts",
    path: "src/auth/login.ts",
    indexStatus: "M",
    worktreeStatus: ".",
    kind: "tracked",
  },
  {
    id: "src/app.ts",
    path: "src/app.ts",
    indexStatus: ".",
    worktreeStatus: "M",
    kind: "tracked",
  },
  {
    id: "notes.txt",
    path: "notes.txt",
    indexStatus: "?",
    worktreeStatus: "?",
    kind: "untracked",
  },
];

const commits: Commit[] = [
  {
    oid: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    parents: ["b2c3d4e5f60718293a4b5c6d7e8f90123456789"],
    author: "You",
    authorEmail: "you@example.com",
    authorTime: now(),
    committer: "You",
    committerEmail: "you@example.com",
    committerTime: now(),
    subject: "Fix login validation and add settings page",
    message: "Fix login validation and add settings page\n\n- validate timeout\n- add settings",
    refs: ["HEAD -> main", "origin/main"],
  },
  {
    oid: "b2c3d4e5f60718293a4b5c6d7e8f90123456789",
    parents: ["c3d4e5f60718293a4b5c6d7e8f901234567890"],
    author: "Alice",
    authorEmail: "alice@example.com",
    authorTime: now(),
    committer: "Alice",
    committerEmail: "alice@example.com",
    committerTime: now(),
    subject: "Add settings page",
    message: "Add settings page",
    refs: ["develop"],
  },
  {
    oid: "c3d4e5f60718293a4b5c6d7e8f901234567890",
    parents: ["d4e5f60718293a4b5c6d7e8f90123456789012"],
    author: "You",
    authorEmail: "you@example.com",
    authorTime: now(),
    committer: "You",
    committerEmail: "you@example.com",
    committerTime: now(),
    subject: "Add input checks",
    message: "Add input checks",
    refs: ["feature/login"],
  },
  {
    oid: "d4e5f60718293a4b5c6d7e8f90123456789012",
    parents: [],
    author: "Bob",
    authorEmail: "bob@example.com",
    authorTime: now(),
    committer: "Bob",
    committerEmail: "bob@example.com",
    committerTime: now(),
    subject: "Initial commit",
    message: "Initial commit",
    refs: [],
  },
];

const branches: Branch[] = [
  {
    name: "main",
    fullName: "refs/heads/main",
    kind: "local",
    oid: commits[0].oid,
    upstream: "origin/main",
    committerDate: now(),
    current: true,
    merged: false,
    ahead: 2,
    behind: 1,
  },
  {
    name: "develop",
    fullName: "refs/heads/develop",
    kind: "local",
    oid: commits[1].oid,
    upstream: "origin/develop",
    committerDate: now(),
    current: false,
    merged: false,
    ahead: 0,
    behind: 0,
  },
  {
    name: "feature/login",
    fullName: "refs/heads/feature/login",
    kind: "local",
    oid: commits[2].oid,
    committerDate: now(),
    current: false,
    merged: false,
    ahead: 3,
    behind: 0,
  },
  {
    name: "origin/main",
    fullName: "refs/remotes/origin/main",
    kind: "remote",
    oid: commits[0].oid,
    committerDate: now(),
    current: false,
    merged: false,
    ahead: 0,
    behind: 0,
  },
];

const settings: Settings = {
  theme: "system",
  language: "zh-TW",
  fontFamily: "",
  baseFontSize: 14,
  gitPath: "",
  projectsRoot: "C:\\Demo",
  authorName: "",
  authorEmail: "",
  recent: [{ path: repo.rootPath, name: repo.name, lastOpened: now() }],
};

let workspaceRepos: WorkspaceRepository[] = [
  { name: repo.name, path: repo.rootPath, branch: repo.branch || "main", changes: 3, kind: "project" },
  { name: "OldProject", path: "C:\\Demo\\OldProject", branch: "develop", changes: 0, kind: "recent" },
];

const workspacePathKey = (value: string) => value.replace(/\\/g, "/").toLowerCase();

function diffFor(path: string, side: string): DiffDocument {
  const oldText =
    path === "src/auth/login.ts"
      ? "export function login(input: string) {\n  return input.length > 8;\n}\n"
      : path === "src/app.ts"
        ? "const app = createApp();\napp.mount('#root');\n"
        : "";
  const newText =
    path === "src/auth/login.ts"
      ? "export function login(input: string) {\n  if (!input.includes('@')) {\n    throw new Error('Invalid email');\n  }\n  return input.length > 8;\n}\n"
      : path === "src/app.ts"
        ? "const app = createApp();\napp.use(router);\napp.mount('#root');\n"
        : "A new note from the working tree.\n";
  return {
    path,
    side,
    oldText,
    newText,
    language: path.endsWith(".ts") ? "typescript" : "plaintext",
    binary: false,
    truncated: false,
    hunks: [],
    patchHash: "mock",
  };
}

function ok(message: string): OperationResult {
  return { success: true, message };
}

export async function mockInvoke<T>(group: string, method: string, args: any[]): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  const key = `${group}.${method}`;
  switch (key) {
    case "AppAPI.GetEnvironment":
      return {
        gitFound: true,
        gitVersion: "git version 2.52.0.windows.1",
        goVersion: "go1.27.0",
        wails: "v2.17.0",
      } as T;
    case "AppAPI.GetSettings":
      return structuredClone(settings) as T;
    case "AppAPI.SaveSettings":
      Object.assign(settings, args[0]);
      return structuredClone(settings) as T;
    case "AppAPI.ListRecent":
      return settings.recent as T;
    case "AppAPI.ListWorkspaceRepositories":
      return workspaceRepos.map((entry) => ({ ...entry })) as T;
    case "RepoAPI.GetWorkspaceStatus":
      return {
        name: repo.name,
        path: repo.rootPath,
        branch: repo.branch || "main",
        changes: files.length,
        kind: "project",
      } as WorkspaceRepository as T;
    case "AppAPI.PickFolder":
      return repo.rootPath as T;
    case "AppAPI.OpenRepository":
      return repo as T;
    case "AppAPI.InitializeRepository":
      return repo as T;
    case "AppAPI.CloneRepository":
      return repo as T;
    case "AppAPI.RemoveRecent":
      return undefined as T;
    case "RepoAPI.GetStatus":
      return { repo, files: files.map((f) => ({ ...f })), ahead: 2, behind: 1 } as Status as T;
    case "RepoAPI.GetBranches":
    case "BranchAPI.List":
      return branches.map((b) => ({ ...b })) as T;
    case "RepoAPI.GetRemotes":
    case "SyncAPI.ListRemotes":
      return [{ name: "origin", fetchUrl: "https://github.com/example/puffgittt.git", pushUrl: "https://github.com/example/puffgittt.git" }] as T;
    case "RepoAPI.GetSubmodules":
      return [
        { path: "vendor/demo", oid: "1234567890abcdef1234567890abcdef12345678", describe: "v1.0.0", status: "clean" },
      ] as Submodule[] as T;
    case "RepoAPI.UpdateSubmodule":
    case "RepoAPI.SyncSubmodules":
      return ok("Submodules updated") as T;
    case "ChangeAPI.GetDiff":
      return diffFor(args[1], args[2]) as T;
    case "ChangeAPI.Stage":
      files = files.map((f) =>
        (args[1] as string[]).includes(f.path) ? { ...f, indexStatus: "M", worktreeStatus: "." } : f,
      );
      return ok("Staged") as T;
    case "ChangeAPI.Unstage":
      files = files.map((f) =>
        (args[1] as string[]).includes(f.path) ? { ...f, indexStatus: ".", worktreeStatus: "M" } : f,
      );
      return ok("Unstaged") as T;
    case "ChangeAPI.Discard":
      files = files.filter((f) => !(args[1] as string[]).includes(f.path));
      return ok("Discarded") as T;
    case "ChangeAPI.ApplyHunks": {
      const selections = args[4] as HunkSelection[];
      return ok(selections.some((selection) => selection.lines.length > 0) ? "Staged selected lines" : "Staged hunk") as T;
    }
    case "CommitAPI.Commit":
      files = files.filter((f) => f.indexStatus === ".");
      return ok("Committed") as T;
    case "HistoryAPI.List":
      return commits.filter((c) => c.subject.toLowerCase().includes(String(args[4] || "").toLowerCase())) as T;
    case "HistoryAPI.GetCommit": {
      const commit = commits.find((c) => c.oid === args[1]) || commits[0];
      return { commit, files: [{ path: "src/auth/login.ts", status: "M" }] } as CommitDetail as T;
    }
    case "HistoryAPI.Preview": {
      const request = args[1] as CommandRequest;
      const target = request.target || "";
      const commands: Record<string, string> = {
        reset: `git reset --${request.strategy || "mixed"} ${target}`,
        revert: `git revert --no-edit ${target}`,
        drop: target === repo.headOid ? "git reset --hard HEAD^" : `git rebase --onto ${target}^ ${target}`,
        "cherry-pick": request.strategy ? `git cherry-pick -m ${request.strategy} ${target}` : `git cherry-pick ${target}`,
      };
      return {
        command: commands[request.action] || "git",
        destructive: request.action === "drop" || (request.action === "reset" && request.strategy === "hard"),
      } as CommandPreview as T;
    }
    case "HistoryAPI.Reset":
      return ok("Reset complete") as T;
    case "HistoryAPI.Revert":
      return ok("Reverted") as T;
    case "HistoryAPI.Drop":
      return ok("Commit dropped") as T;
    case "HistoryAPI.CherryPick":
      return ok("Cherry-picked") as T;
    case "HistoryAPI.FileHistory":
      return commits.slice(0, 4).map((commit) => ({
        oid: commit.oid,
        subject: commit.subject,
        author: commit.author,
        date: commit.authorTime,
      })) as T;
    case "HistoryAPI.Blame":
      return Array.from({ length: 32 }, (_, index) => ({
        line: index + 1,
        oid: commits[index % commits.length]?.oid || repo.headOid,
        author: commits[index % commits.length]?.author || "Demo User",
        date: commits[index % commits.length]?.authorTime || now(),
        summary: commits[index % commits.length]?.subject || "demo",
        text: `demo line ${index + 1}`,
      })) as BlameLine[] as T;
    case "HistoryAPI.RebasePlan":
      return commits.slice(0, 5).map((commit) => ({
        oid: commit.oid,
        action: "pick",
        subject: commit.subject,
      })) as RebaseTodo[] as T;
    case "HistoryAPI.InteractiveRebase":
      return ok("Interactive rebase complete") as T;
    case "HistoryAPI.BisectState":
      return { active: false, current: repo.headOid } as BisectState as T;
    case "HistoryAPI.BisectStart":
    case "HistoryAPI.BisectMark":
    case "HistoryAPI.BisectReset":
      return ok("Bisect updated") as T;
    case "HistoryAPI.Reflog":
      return commits.slice(0, 6).map((commit, index) => ({
        selector: `HEAD@{${index}}`,
        oid: commit.oid,
        previousOid: commits[index + 1]?.oid,
        action: index === 0 ? "commit" : index === 2 ? "reset" : "merge",
        message: commit.subject,
        date: commit.committerTime,
      })) as ReflogEntry[] as T;
    case "HistoryAPI.UndoInfo":
      return {
        operation: "Reset (mixed)",
        beforeOid: commits[1]?.oid || repo.headOid,
        afterOid: repo.headOid,
        time: now(),
      } as UndoRecord as T;
    case "HistoryAPI.Undo":
      return ok("Undo complete") as T;
    case "BranchAPI.Create":
      return ok("Branch created") as T;
    case "BranchAPI.Switch":
      return ok("Switched") as T;
    case "BranchAPI.Delete":
      return ok("Branch deleted") as T;
    case "BranchAPI.Merge":
      return ok("Merged") as T;
    case "BranchAPI.Rebase":
      return ok("Rebased") as T;
    case "BranchAPI.Rename":
      return ok("Branch renamed") as T;
    case "BranchAPI.SetUpstream":
      return ok("Upstream updated") as T;
    case "BranchAPI.CheckoutRemote":
      return ok("Checked out remote branch") as T;
    case "BranchAPI.Compare":
      return {
        base: args[1],
        compare: args[2],
        ahead: 2,
        behind: 1,
        aheadCommits: commits.slice(0, 2).map((commit) => ({
          oid: commit.oid,
          subject: commit.subject,
          author: commit.author,
          date: commit.authorTime,
        })),
        behindCommits: commits.slice(2, 3).map((commit) => ({
          oid: commit.oid,
          subject: commit.subject,
          author: commit.author,
          date: commit.authorTime,
        })),
        files: [],
      } as BranchCompare as T;
    case "BranchAPI.Worktrees":
      return [
        { path: repo.rootPath, head: repo.headOid, branch: repo.branch },
        { path: `${repo.rootPath}-worktree`, head: repo.headOid, branch: "feature/demo" },
      ] as Worktree[] as T;
    case "BranchAPI.AddWorktree":
    case "BranchAPI.RemoveWorktree":
    case "BranchAPI.PruneWorktrees":
      return ok("Worktree updated") as T;
    case "BranchAPI.Preview": {
      const request = args[1] as CommandRequest;
      const commands: Record<string, string> = {
        merge: `git merge ${request.source || ""}`.trim(),
        rebase: `git rebase ${request.target || ""}`.trim(),
        switch: `git switch ${request.name || ""}`.trim(),
        delete: `git branch ${request.force ? "-D" : "-d"} ${request.name || ""}`.trim(),
        create: `git branch ${request.name || ""}${request.startPoint ? ` ${request.startPoint}` : ""}`.trim(),
        rename: `git branch -m ${request.source || ""} ${request.name || ""}`.trim(),
        "set-upstream": `git branch --set-upstream-to=${request.target || ""} ${request.name || ""}`.trim(),
        "checkout-remote": `git switch -c ${request.name || ""} --track ${request.source || ""}`.trim(),
      };
      return { command: commands[request.action] || "git", destructive: request.action === "delete" || request.action === "rebase" } as CommandPreview as T;
    }
    case "SyncAPI.Fetch":
    case "SyncAPI.Pull":
    case "SyncAPI.Push":
    case "SyncAPI.Publish":
    case "SyncAPI.DeleteRemoteBranch":
    case "SyncAPI.AddRemote":
    case "SyncAPI.SetRemoteURL":
    case "SyncAPI.RemoveRemote":
      return ok("Synchronized") as T;
    case "SyncAPI.Preview": {
      const request = args[1] as CommandRequest;
      const commands: Record<string, string> = {
        fetch: `git fetch --progress${request.remote ? ` ${request.remote}` : ""}`,
        pull: `git pull --no-rebase${request.remote ? ` ${request.remote}` : ""}${request.branch ? ` ${request.branch}` : ""}`,
        push: `git push --progress${request.force ? " --force-with-lease" : ""}${request.remote ? ` ${request.remote}` : ""}${request.branch ? ` ${request.branch}` : ""}`,
        publish: `git push --progress -u${request.remote ? ` ${request.remote}` : ""}${request.branch ? ` ${request.branch}` : ""}`,
        "delete-remote": `git push ${request.remote || ""} --delete ${request.branch || ""}`.trim(),
      };
      return { command: commands[request.action] || "git", destructive: request.action === "delete-remote" } as CommandPreview as T;
    }
    case "ConflictAPI.List":
      return [] as ConflictFile[] as T;
    case "ConflictAPI.GetVersions":
      return {
        path: args[1],
        base: "",
        ours: "",
        theirs: "",
        result: "",
        oursLabel: "Ours",
        theirsLabel: "Theirs",
        binary: false,
        operation: "normal",
      } as ConflictVersions as T;
    case "ConflictAPI.SaveResult":
      return undefined as T;
    case "ConflictAPI.Resolve":
    case "ConflictAPI.Continue":
    case "ConflictAPI.Abort":
      return ok("Resolved") as T;
    case "StashAPI.List":
      return [] as StashEntry[] as T;
    case "StashAPI.Create":
    case "StashAPI.Apply":
    case "StashAPI.Drop":
      return ok("Stash updated") as T;
    case "StashAPI.Diff":
      return "diff --git a/demo.txt b/demo.txt\n--- a/demo.txt\n+++ b/demo.txt\n@@ -1 +1 @@\n-old\n+new\n" as T;
    case "TagAPI.List":
      return [] as Tag[] as T;
    case "TagAPI.Create":
    case "TagAPI.Delete":
      return ok("Tag updated") as T;
    case "TagAPI.Push":
    case "TagAPI.PushAll":
      return ok("Tag pushed") as T;
    case "AppAPI.OpenInExplorer":
    case "AppAPI.OpenExternal":
    case "AppAPI.WatchRepository":
    case "AppAPI.UnwatchRepository":
    case "AppAPI.RemoveWorkspaceRepository":
      workspaceRepos = workspaceRepos.filter(
        (entry) => workspacePathKey(entry.path) !== workspacePathKey(args[0] as string),
      );
      return workspaceRepos.map((entry) => ({ ...entry })) as T;
    case "AppAPI.AddWorkspaceFolder": {
      const existing = workspaceRepos.find((entry) => workspacePathKey(entry.path) === workspacePathKey(repo.rootPath));
      if (!existing) {
        workspaceRepos = [
          ...workspaceRepos,
          { name: repo.name, path: repo.rootPath, branch: repo.branch || "main", changes: 0, kind: "workspace" },
        ];
      }
      return repo as Repository as T;
    }
    case "App.SetTheme":
    case "App.MinimizeWindow":
    case "App.ToggleMaximizeWindow":
    case "App.CloseWindow":
      return undefined as T;
    case "App.IsWindowMaximized":
      return false as T;
    default:
      throw new Error(`No mock for ${key}`);
  }
}

export const isMock = true;
