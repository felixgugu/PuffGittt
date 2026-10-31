import { useEffect, useState } from "react";
import { Badge, Button, Checkbox, Field, Spinner } from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowClockwise24Regular,
  ArrowDownload24Regular,
  ArrowSync24Regular,
  ArrowUpload24Regular,
  Branch24Regular,
  Dismiss24Regular,
  FolderAdd24Regular,
  History24Regular,
  Settings24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../bridge/api";
import { ContextMenu } from "../components/ContextMenu";
import { GitCommandDialog } from "../components/GitCommandDialog";
import { UnderlineInput, UnderlineSelect } from "../components/FormControls";
import { useAppStore, type RepoTab } from "../store";
import type { Branch, CommandPreview, CommandRequest, OperationResult } from "../types";
import { formatDate, shortOid } from "../lib/format";

interface BranchesViewProps {
  tab: RepoTab;
}

interface PendingCommand {
  title: string;
  description?: string;
  warning?: string;
  destructive?: boolean;
  preview: CommandPreview;
  execute: () => Promise<OperationResult>;
  onSuccess?: () => void;
}

export function BranchesView({ tab }: BranchesViewProps) {
  const { t } = useTranslation();
  const root = tab.repo.rootPath;
  const queryClient = useQueryClient();
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const setView = useAppStore((state) => state.setView);
  const setHistoryBranch = useAppStore((state) => state.setHistoryBranch);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [startOid, setStartOid] = useState(tab.repo.headOid || "");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null);
  const [branchMenu, setBranchMenu] = useState<{ x: number; y: number; branch: Branch } | null>(null);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [upstreamOpen, setUpstreamOpen] = useState(false);
  const [upstreamValue, setUpstreamValue] = useState("");
  const [remotesOpen, setRemotesOpen] = useState(false);
  const [editingRemote, setEditingRemote] = useState<string | null>(null);
  const [remoteFormName, setRemoteFormName] = useState("");
  const [remoteFormUrl, setRemoteFormUrl] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBase, setCompareBase] = useState("");
  const [compareBranch, setCompareBranch] = useState("");
  const [worktreesOpen, setWorktreesOpen] = useState(false);
  const [worktreePath, setWorktreePath] = useState("");
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [worktreeCreateBranch, setWorktreeCreateBranch] = useState(false);

  const branches = useQuery({ queryKey: ["branches", root], queryFn: () => api.repo.getBranches(root) });
  const remotes = useQuery({ queryKey: ["remotes", root], queryFn: () => api.sync.listRemotes(root) });
  const local = (branches.data || []).filter((branch) => branch.kind === "local");
  const remote = (branches.data || []).filter((branch) => branch.kind === "remote");
  const selected = local.find((branch) => branch.name === selectedName) || local.find((branch) => branch.current) || local[0];
  const remoteName = selected?.upstream?.split("/")[0] || remotes.data?.[0]?.name || "";
  const currentBranch = local.find((branch) => branch.current);
  const compareQuery = useQuery({
    queryKey: ["compare", root, compareBase, compareBranch],
    queryFn: () => api.branch.compare(root, compareBase, compareBranch),
    enabled: compareOpen && !!compareBase && !!compareBranch,
  });
  const worktrees = useQuery({
    queryKey: ["worktrees", root],
    queryFn: () => api.branch.worktrees(root),
    enabled: worktreesOpen,
  });

  useEffect(() => {
    setSelectedName("");
  }, [root]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["branches", root] });
    void queryClient.invalidateQueries({ queryKey: ["status", root] });
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
    void queryClient.invalidateQueries({ queryKey: ["remotes", root] });
    void queryClient.invalidateQueries({ queryKey: ["worktrees", root] });
  };

  const run = async (key: string, action: () => Promise<{ message: string }>) => {
    setBusy(key);
    try {
      const result = await action();
      setStatusMessage(result.message);
      invalidate();
      return true;
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const openCreate = () => {
    setStartOid(selected?.oid || tab.repo.headOid || "");
    setCreateOpen(true);
  };

  const currentName = local.find((branch) => branch.current)?.name || tab.repo.branch || "目前分支";

  const executeCommand = (kind: "branch" | "sync", req: CommandRequest): Promise<OperationResult> => {
    if (kind === "branch") {
      switch (req.action) {
        case "merge":
          return api.branch.merge(root, req.source || "", req.strategy || "merge");
        case "rebase":
          return api.branch.rebase(root, req.target || "");
        case "switch":
          return api.branch.switch(root, req.name || "");
        case "delete":
          return api.branch.delete(root, req.name || "", !!req.force);
        case "create":
          return api.branch.create(root, req.name || "", req.startPoint || "");
        case "rename":
          return api.branch.rename(root, req.source || "", req.name || "");
        case "set-upstream":
          return api.branch.setUpstream(root, req.name || "", req.target || "");
        case "checkout-remote":
          return api.branch.checkoutRemote(root, req.name || "", req.source || "");
        default:
          return Promise.reject(new Error(`不支援的分支操作：${req.action}`));
      }
    }
    switch (req.action) {
      case "fetch":
        return api.sync.fetch(root, req.remote || "");
      case "pull":
        return api.sync.pull(root, req.remote || "", req.branch || "", req.strategy || "merge");
      case "push":
        return api.sync.push(root, req.remote || "", req.branch || "", !!req.force);
      case "publish":
        return api.sync.publish(root, req.remote || "", req.branch || "");
      case "delete-remote":
        return api.sync.deleteRemoteBranch(root, req.remote || "", req.branch || "");
      default:
        return Promise.reject(new Error(`不支援的同步操作：${req.action}`));
    }
  };

  const previewCommand = async (
    kind: "branch" | "sync",
    req: CommandRequest,
    meta: Omit<PendingCommand, "preview" | "execute">,
  ) => {
    if (busy) return;
    setBusy("preview");
    try {
      const preview = kind === "branch" ? await api.branch.preview(root, req) : await api.sync.preview(root, req);
      setPendingCommand({
        ...meta,
        preview,
        execute: () => executeCommand(kind, req),
      });
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(null);
    }
  };

  const confirmPending = async () => {
    if (!pendingCommand) return;
    const pending = pendingCommand;
    const ok = await run("command", pending.execute);
    if (!ok) return;
    pending.onSuccess?.();
    setPendingCommand(null);
  };

  const requestSwitch = (branch: Branch) => {
    if (branch.current || busy) return;
    void previewCommand(
      "branch",
      { action: "switch", name: branch.name },
      {
        title: `切換到 ${branch.name}`,
        description: `將目前分支 ${currentName} 切換為 ${branch.name}。`,
        onSuccess: () => setSelectedName(branch.name),
      },
    );
  };

  const requestMerge = (branch: Branch) => {
    if (branch.current || busy) return;
    void previewCommand(
      "branch",
      { action: "merge", source: branch.name, strategy: "merge" },
      {
        title: `Merge ${branch.name} into ${currentName}`,
        description: `將 ${branch.name} 合併到目前分支 ${currentName}。`,
        warning: "Merge 可能產生衝突，衝突後需到 Conflicts 頁面處理。",
      },
    );
  };

  const requestRebase = (branch: Branch) => {
    if (branch.current || busy) return;
    void previewCommand(
      "branch",
      { action: "rebase", target: branch.name },
      {
        title: `Rebase 目前分支 ${currentName} 到 ${branch.name}`,
        description: `以 ${branch.name} 為新基底，重新套用目前分支 ${currentName} 的提交。`,
        warning: "Rebase 會改寫目前分支歷史，若已 push 過可能需要 force push。",
        destructive: true,
      },
    );
  };

  const requestDelete = (branch: Branch) => {
    if (branch.current || busy) return;
    void previewCommand(
      "branch",
      { action: "delete", name: branch.name },
      {
        title: `刪除分支 ${branch.name}`,
        description: `刪除本機分支 ${branch.name}。`,
        warning: "此操作無法復原。",
        destructive: true,
      },
    );
  };

  const openRename = (branch: Branch) => {
    setEditBranch(branch);
    setRenameValue(branch.name);
    setRenameOpen(true);
  };

  const submitRename = () => {
    const branch = editBranch;
    const name = renameValue.trim();
    if (!branch || !name || name === branch.name) {
      setRenameOpen(false);
      return;
    }
    setRenameOpen(false);
    void previewCommand(
      "branch",
      { action: "rename", source: branch.name, name },
      {
        title: `重新命名分支 ${branch.name}`,
        description: `將本機分支 ${branch.name} 重新命名為 ${name}。`,
        onSuccess: () => setSelectedName(name),
      },
    );
  };

  const openUpstream = (branch: Branch) => {
    setEditBranch(branch);
    setUpstreamValue(branch.upstream || remote[0]?.name || "");
    setUpstreamOpen(true);
  };

  const submitUpstream = () => {
    const branch = editBranch;
    if (!branch || !upstreamValue.trim()) {
      setUpstreamOpen(false);
      return;
    }
    setUpstreamOpen(false);
    void previewCommand(
      "branch",
      { action: "set-upstream", name: branch.name, target: upstreamValue.trim() },
      {
        title: `設定 ${branch.name} 的 upstream`,
        description: `將 ${branch.name} 的上游設定為 ${upstreamValue.trim()}。`,
      },
    );
  };

  const requestPublish = (branch: Branch) => {
    if (!remoteName || busy) return;
    void previewCommand(
      "sync",
      { action: "publish", remote: remoteName, branch: branch.name },
      {
        title: `Publish ${branch.name} 到 ${remoteName}`,
        description: `推送 ${branch.name} 並建立 upstream 追蹤關係。`,
        warning: "會在遠端建立同名分支。",
      },
    );
  };

  const requestForcePush = (branch: Branch) => {
    if (!remoteName || busy) return;
    void previewCommand(
      "sync",
      { action: "push", remote: remoteName, branch: branch.name, force: true },
      {
        title: `Force push ${branch.name} 到 ${remoteName}`,
        description: `使用 --force-with-lease 覆寫遠端 ${remoteName}/${branch.name}。`,
        warning: "會改寫遠端歷史；若遠端在你 fetch 後已有更新，操作會被拒絕。",
        destructive: true,
      },
    );
  };

  const requestCheckoutRemote = (branch: Branch) => {
    const localName = branch.name.split("/").slice(1).join("/");
    if (!localName || busy) return;
    void previewCommand(
      "branch",
      { action: "checkout-remote", source: branch.name, name: localName },
      {
        title: `Checkout ${branch.name}`,
        description: `建立本機分支 ${localName} 並追蹤 ${branch.name}。`,
        onSuccess: () => setSelectedName(localName),
      },
    );
  };

  const requestDeleteRemote = (branch: Branch) => {
    const parts = branch.name.split("/");
    const remotePart = parts[0];
    const branchPart = parts.slice(1).join("/");
    if (!remotePart || !branchPart || busy) return;
    void previewCommand(
      "sync",
      { action: "delete-remote", remote: remotePart, branch: branchPart },
      {
        title: `刪除遠端分支 ${branch.name}`,
        description: `從遠端 ${remotePart} 刪除分支 ${branchPart}。`,
        warning: "此操作會影響其他協作者，且無法復原。",
        destructive: true,
      },
    );
  };

  const openRemotes = () => {
    setEditingRemote(null);
    setRemoteFormName("");
    setRemoteFormUrl("");
    setRemotesOpen(true);
  };

  const startEditRemote = (entry: { name: string; fetchUrl: string; pushUrl: string }) => {
    setEditingRemote(entry.name);
    setRemoteFormName(entry.name);
    setRemoteFormUrl(entry.pushUrl || entry.fetchUrl);
  };

  const resetRemoteForm = () => {
    setEditingRemote(null);
    setRemoteFormName("");
    setRemoteFormUrl("");
  };

  const saveRemote = async () => {
    const name = remoteFormName.trim();
    const url = remoteFormUrl.trim();
    if (!url || (!editingRemote && !name)) return;
    const ok = await run("remote", () =>
      editingRemote
        ? api.sync.setRemoteUrl(root, editingRemote, url)
        : api.sync.addRemote(root, name, url),
    );
    if (ok) resetRemoteForm();
  };

  const removeRemote = async (name: string) => {
    if (!window.confirm(`確定要移除 Remote ${name}？`)) return;
    const ok = await run("remote", () => api.sync.removeRemote(root, name));
    if (ok && editingRemote === name) resetRemoteForm();
  };

  const openWorktrees = () => {
    setWorktreePath("");
    setWorktreeBranch("");
    setWorktreeCreateBranch(false);
    setWorktreesOpen(true);
  };

  const pickWorktreePath = async () => {
    try {
      const path = await api.app.pickFolder("選擇 Worktree 資料夾");
      if (path) setWorktreePath(path);
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    }
  };

  const addWorktree = async () => {
    if (!worktreePath.trim() || !worktreeBranch.trim()) return;
    const ok = await run("worktree", () =>
      api.branch.addWorktree(root, worktreePath.trim(), worktreeBranch.trim(), worktreeCreateBranch),
    );
    if (ok) {
      setWorktreePath("");
      setWorktreeBranch("");
      setWorktreeCreateBranch(false);
    }
  };

  const removeWorktree = async (path: string) => {
    if (!window.confirm(`確定要移除 Worktree ${path}？`)) return;
    await run("worktree", () => api.branch.removeWorktree(root, path, true));
  };

  const pruneWorktrees = async () => {
    await run("worktree", () => api.branch.pruneWorktrees(root));
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await previewCommand(
      "branch",
      { action: "create", name, startPoint: startOid.trim() },
      {
        title: `建立分支 ${name}`,
        description: startOid.trim() ? `以 ${startOid.trim()} 為起始點建立分支。` : "以目前 HEAD 建立分支。",
        onSuccess: () => {
          setCreateOpen(false);
          setNewName("");
          setSelectedName(name);
        },
      },
    );
  };

  const handleFetch = () => {
    if (!remoteName) return;
    void previewCommand(
      "sync",
      { action: "fetch", remote: remoteName },
      {
        title: `Fetch ${remoteName}`,
        description: `從遠端 ${remoteName} 抓取最新資訊。`,
      },
    );
  };

  const handlePull = () => {
    if (!selected || !selected.current || !remoteName) return;
    void previewCommand(
      "sync",
      { action: "pull", remote: remoteName, branch: selected.name, strategy: "merge" },
      {
        title: `Pull ${remoteName}/${selected.name}`,
        description: `將遠端 ${remoteName}/${selected.name} 拉取並合併到目前分支。`,
        warning: "Pull 可能產生衝突，衝突後需到 Conflicts 頁面處理。",
      },
    );
  };

  const handlePush = () => {
    if (!selected || !remoteName) return;
    void previewCommand(
      "sync",
      { action: "push", remote: remoteName, branch: selected.name },
      {
        title: `Push ${selected.name} 到 ${remoteName}`,
        description: `將本機 ${selected.name} 推送到遠端 ${remoteName}。`,
        warning: "這會更新遠端分支。",
      },
    );
  };

  const openHistory = () => {
    setHistoryBranch(root, selected?.name || tab.repo.branch || undefined);
    setView(root, "history");
  };

  const openCompare = (branch: Branch) => {
    if (!currentBranch) return;
    setCompareBase(currentBranch.name);
    setCompareBranch(branch.name);
    setCompareOpen(true);
  };

  const fetchTooltip = remoteName ? t("branches.fetchHint", { remote: remoteName }) : t("branches.noRemote");
  const pullTooltip = selected && !selected.current ? t("branches.pullCurrentOnly") : t("toolbar.pull");

  const renderBranch = (branch: Branch, selectable: boolean) => {
    const isSelected = selectable && selected?.name === branch.name;
    return (
      <div
        key={branch.fullName}
        className={`branch-row${selectable ? " selectable" : ""}${branch.current ? " current" : ""}${isSelected ? " selected" : ""}`}
        role={selectable ? "button" : undefined}
        tabIndex={selectable ? 0 : undefined}
        aria-pressed={selectable ? isSelected : undefined}
        onClick={selectable ? () => setSelectedName(branch.name) : undefined}
        onContextMenu={(event) => {
          event.preventDefault();
          if (selectable) setSelectedName(branch.name);
          setBranchMenu({ x: event.clientX, y: event.clientY, branch });
        }}
        onKeyDown={
          selectable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedName(branch.name);
                }
              }
            : undefined
        }
      >
        <div className="branch-main">
          <Branch24Regular />
          <div className="branch-copy">
            <div className="branch-name">
              {branch.name}
              {branch.current ? <Badge size="small" appearance="tint" color="success">HEAD</Badge> : null}
              {branch.merged ? <Badge size="small" appearance="tint" color="informative">{t("branches.merged")}</Badge> : null}
            </div>
            <div className="branch-meta">
              <span>{shortOid(branch.oid)}</span>
              <span>{formatDate(branch.committerDate)}</span>
              {branch.upstream ? <span>{branch.upstream}</span> : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="branches-view">
      <div className="branch-columns">
        <div className="panel-card branch-section">
          <div className="panel-heading">
            <span>{t("branches.local")}</span>
            <div className="panel-heading-actions">
              <span className="branch-icon-button" data-tooltip={fetchTooltip}>
                <Button
                  size="small"
                  appearance="subtle"
                  aria-label={t("toolbar.fetch")}
                  icon={busy === "fetch" ? <Spinner size="tiny" /> : <ArrowDownload24Regular />}
                  onClick={handleFetch}
                  disabled={!remoteName || !!busy}
                />
              </span>
              <span className="branch-icon-button" data-tooltip={pullTooltip}>
                <Button
                  size="small"
                  appearance="subtle"
                  aria-label={t("toolbar.pull")}
                  icon={busy === "pull" ? <Spinner size="tiny" /> : <ArrowSync24Regular />}
                  onClick={handlePull}
                  disabled={!selected || !selected.current || !remoteName || !!busy}
                />
              </span>
              <span className="branch-icon-button" data-tooltip={t("toolbar.push")}>
                <Button
                  size="small"
                  appearance="subtle"
                  aria-label={t("toolbar.push")}
                  icon={busy === "push" ? <Spinner size="tiny" /> : <ArrowUpload24Regular />}
                  onClick={handlePush}
                  disabled={!selected || !remoteName || !!busy}
                />
              </span>
              <span className="branch-icon-button" data-tooltip="Worktrees">
                <Button
                  size="small"
                  appearance="subtle"
                  aria-label="Worktrees"
                  icon={<FolderAdd24Regular />}
                  onClick={openWorktrees}
                  disabled={!!busy}
                />
              </span>
              <span className="branch-icon-button" data-tooltip={t("branches.create")}>
                <Button
                  size="small"
                  appearance="primary"
                  aria-label={t("branches.new")}
                  icon={<Add24Regular />}
                  onClick={openCreate}
                  disabled={!!busy}
                />
              </span>
              <span className="branch-icon-button" data-tooltip="查看 History">
                <Button
                  size="small"
                  appearance="subtle"
                  aria-label="History"
                  icon={<History24Regular />}
                  onClick={openHistory}
                />
              </span>
              <span className="branch-icon-button" data-tooltip={t("common.refresh")}>
                <Button
                  size="small"
                  appearance="subtle"
                  aria-label={t("common.refresh")}
                  icon={<ArrowClockwise24Regular />}
                  onClick={invalidate}
                  disabled={branches.isFetching || remotes.isFetching}
                />
              </span>
              <span className="muted branch-count">{local.length}</span>
            </div>
          </div>
          {branches.isLoading ? <div className="center-state"><Spinner label={t("common.loading")} /></div> : null}
          <div className="branch-list">
            {local.map((branch) => renderBranch(branch, true))}
            {!branches.isLoading && local.length === 0 ? <div className="empty-state">{t("branches.noBranches")}</div> : null}
          </div>
        </div>
        <div className="panel-card branch-section">
          <div className="panel-heading">
            <span>{t("branches.remote")}</span>
            <div className="panel-heading-actions">
              <span className="branch-icon-button" data-tooltip="管理 Remotes">
                <Button
                  size="small"
                  appearance="subtle"
                  aria-label="管理 Remotes"
                  icon={<Settings24Regular />}
                  onClick={openRemotes}
                  disabled={!!busy}
                />
              </span>
              <span className="muted">{remote.length}</span>
            </div>
          </div>
          <div className="branch-list">
            {remote.map((branch) => renderBranch(branch, false))}
            {remote.length === 0 ? <div className="empty-state">{t("branches.noBranches")}</div> : null}
          </div>
        </div>
      </div>

      {createOpen ? (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCreateOpen(false)}>
          <div className="modal small">
            <div className="modal-header">
              <h2>{t("branches.createTitle")}</h2>
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setCreateOpen(false)} />
            </div>
            <div className="modal-body form-stack">
              <Field label={t("branches.name")}>
                <UnderlineInput value={newName} onChange={(_, data) => setNewName(data.value)} placeholder="feature/my-change" />
              </Field>
              <Field label={t("branches.startPoint")}>
                <UnderlineInput value={startOid} onChange={(_, data) => setStartOid(data.value)} placeholder={tab.repo.headOid || "HEAD"} />
              </Field>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
              <Button appearance="primary" onClick={handleCreate} disabled={!newName.trim() || !!busy}>
                {busy ? <Spinner size="tiny" /> : t("common.create")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {branchMenu ? (
        <ContextMenu
          x={branchMenu.x}
          y={branchMenu.y}
          onClose={() => setBranchMenu(null)}
          items={
            branchMenu.branch.kind === "remote"
              ? [
                  {
                    key: "checkout-remote",
                    label: `Checkout ${branchMenu.branch.name}…`,
                    disabled: !!busy,
                    onSelect: () => requestCheckoutRemote(branchMenu.branch),
                  },
                  { divider: true },
                  {
                    key: "delete-remote",
                    label: `刪除遠端分支 ${branchMenu.branch.name}…`,
                    disabled: !!busy,
                    destructive: true,
                    onSelect: () => requestDeleteRemote(branchMenu.branch),
                  },
                ]
              : [
                  {
                    key: "switch",
                    label: `切換到 ${branchMenu.branch.name}`,
                    disabled: branchMenu.branch.current || !!busy,
                    onSelect: () => requestSwitch(branchMenu.branch),
                  },
                  {
                    key: "merge",
                    label: `Merge ${branchMenu.branch.name} into ${currentName}…`,
                    disabled: branchMenu.branch.current || !!busy,
                    onSelect: () => requestMerge(branchMenu.branch),
                  },
                  {
                    key: "rebase",
                    label: `Rebase 目前分支 ${currentName} 到 ${branchMenu.branch.name}…`,
                    disabled: branchMenu.branch.current || !!busy,
                    onSelect: () => requestRebase(branchMenu.branch),
                  },
                  {
                    key: "compare",
                    label: `比較 ${currentName} 與 ${branchMenu.branch.name}…`,
                    disabled: branchMenu.branch.current || !currentBranch || !!busy,
                    onSelect: () => openCompare(branchMenu.branch),
                  },
                  { divider: true },
                  {
                    key: "rename",
                    label: "重新命名…",
                    disabled: !!busy,
                    onSelect: () => openRename(branchMenu.branch),
                  },
                  {
                    key: "upstream",
                    label: "設定 upstream…",
                    disabled: !!busy,
                    onSelect: () => openUpstream(branchMenu.branch),
                  },
                  ...(branchMenu.branch.upstream
                    ? []
                    : [
                        {
                          key: "publish",
                          label: `Publish 到 ${remoteName || "遠端"}…`,
                          disabled: !remoteName || !!busy,
                          onSelect: () => requestPublish(branchMenu.branch),
                        },
                      ]),
                  {
                    key: "force-push",
                    label: "Force push（with lease）…",
                    disabled: !remoteName || !!busy,
                    destructive: true,
                    onSelect: () => requestForcePush(branchMenu.branch),
                  },
                  { divider: true },
                  {
                    key: "delete",
                    label: `刪除分支 ${branchMenu.branch.name}…`,
                    disabled: branchMenu.branch.current || !!busy,
                    destructive: true,
                    onSelect: () => requestDelete(branchMenu.branch),
                  },
                ]
          }
        />
      ) : null}
      {renameOpen && editBranch ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && !busy && setRenameOpen(false)}
        >
          <div className="modal small" role="dialog" aria-modal="true" aria-label="重新命名分支">
            <div className="modal-header">
              <h2>重新命名分支</h2>
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setRenameOpen(false)} disabled={!!busy} />
            </div>
            <div className="modal-body form-stack">
              <div className="branch-source">
                <strong>{editBranch.name}</strong>
                <span>{shortOid(editBranch.oid)}</span>
              </div>
              <Field label="新分支名稱">
                <UnderlineInput
                  value={renameValue}
                  onChange={(_, data) => setRenameValue(data.value)}
                  placeholder="feature/new-name"
                />
              </Field>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setRenameOpen(false)} disabled={!!busy}>
                取消
              </Button>
              <Button
                appearance="primary"
                onClick={submitRename}
                disabled={!!busy || !renameValue.trim() || renameValue.trim() === editBranch.name}
              >
                重新命名
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {upstreamOpen && editBranch ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && !busy && setUpstreamOpen(false)}
        >
          <div className="modal small" role="dialog" aria-modal="true" aria-label="設定 upstream">
            <div className="modal-header">
              <h2>設定 upstream</h2>
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setUpstreamOpen(false)} disabled={!!busy} />
            </div>
            <div className="modal-body form-stack">
              <div className="branch-source">
                <strong>{editBranch.name}</strong>
                <span>{editBranch.upstream || "尚未設定 upstream"}</span>
              </div>
              <Field label="Upstream 分支">
                <UnderlineSelect value={upstreamValue} onChange={(_, data) => setUpstreamValue(data.value)}>
                  {remote.map((entry) => (
                    <option key={entry.fullName} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </UnderlineSelect>
              </Field>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setUpstreamOpen(false)} disabled={!!busy}>
                取消
              </Button>
              <Button appearance="primary" onClick={submitUpstream} disabled={!!busy || !upstreamValue.trim()}>
                設定
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {remotesOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && !busy && setRemotesOpen(false)}
        >
          <div className="modal small" role="dialog" aria-modal="true" aria-label="Remotes">
            <div className="modal-header">
              <h2>Remotes</h2>
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setRemotesOpen(false)} disabled={!!busy} />
            </div>
            <div className="modal-body form-stack">
              <div className="remote-list">
                {(remotes.data || []).map((entry) => (
                  <div className="remote-row" key={entry.name}>
                    <div className="remote-copy">
                      <strong>{entry.name}</strong>
                      <span title={entry.pushUrl || entry.fetchUrl}>{entry.fetchUrl}</span>
                    </div>
                    <Button size="small" appearance="subtle" onClick={() => startEditRemote(entry)} disabled={!!busy}>
                      編輯
                    </Button>
                    <Button size="small" appearance="subtle" onClick={() => void removeRemote(entry.name)} disabled={!!busy}>
                      刪除
                    </Button>
                  </div>
                ))}
                {(remotes.data || []).length === 0 ? <div className="empty-state">尚未設定 Remote</div> : null}
              </div>
              <Field label={editingRemote ? `編輯 Remote ${editingRemote}` : "新增 Remote"}>
                <UnderlineInput
                  value={remoteFormName}
                  onChange={(_, data) => setRemoteFormName(data.value)}
                  placeholder="origin"
                  disabled={!!editingRemote}
                />
              </Field>
              <Field label="URL">
                <UnderlineInput
                  value={remoteFormUrl}
                  onChange={(_, data) => setRemoteFormUrl(data.value)}
                  placeholder="https://github.com/owner/repo.git"
                />
              </Field>
            </div>
            <div className="modal-footer">
              <Button
                appearance="secondary"
                onClick={() => (editingRemote ? resetRemoteForm() : setRemotesOpen(false))}
                disabled={!!busy}
              >
                {editingRemote ? "取消編輯" : "關閉"}
              </Button>
              <Button
                appearance="primary"
                onClick={() => void saveRemote()}
                disabled={!!busy || !remoteFormUrl.trim() || (!editingRemote && !remoteFormName.trim())}
              >
                {busy === "remote" ? <Spinner size="tiny" /> : editingRemote ? "儲存 URL" : "新增 Remote"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {worktreesOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && !busy && setWorktreesOpen(false)}
        >
          <div className="modal small" role="dialog" aria-modal="true" aria-label="Worktrees">
            <div className="modal-header">
              <h2>Worktrees</h2>
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setWorktreesOpen(false)} disabled={!!busy} />
            </div>
            <div className="modal-body form-stack">
              <div className="remote-list">
                {(worktrees.data || []).map((entry) => (
                  <div className="remote-row" key={entry.path}>
                    <div className="remote-copy">
                      <strong>{entry.branch || (entry.detached ? "(detached)" : entry.head)}</strong>
                      <span title={entry.path}>{entry.path}</span>
                    </div>
                    <Button
                      size="small"
                      appearance="subtle"
                      disabled={!!busy}
                      onClick={() => void removeWorktree(entry.path)}
                    >
                      移除
                    </Button>
                  </div>
                ))}
                {(worktrees.data || []).length === 0 ? <div className="empty-state">沒有 Worktree</div> : null}
              </div>
              <Field label="新 Worktree 路徑">
                <div className="inline-field">
                  <UnderlineInput
                    value={worktreePath}
                    onChange={(_, data) => setWorktreePath(data.value)}
                    placeholder="C:\\projects\\repo-feature"
                  />
                  <Button size="small" appearance="subtle" onClick={() => void pickWorktreePath()} disabled={!!busy}>
                    瀏覽…
                  </Button>
                </div>
              </Field>
              <Field label="分支">
                <UnderlineInput
                  value={worktreeBranch}
                  onChange={(_, data) => setWorktreeBranch(data.value)}
                  placeholder="feature/my-work"
                />
              </Field>
              <Checkbox
                checked={worktreeCreateBranch}
                onChange={(_, data) => setWorktreeCreateBranch(!!data.checked)}
                label="建立新分支"
              />
            </div>
            <div className="modal-footer">
              <Button appearance="subtle" onClick={() => void pruneWorktrees()} disabled={!!busy}>
                清理失效 Worktree
              </Button>
              <Button appearance="secondary" onClick={() => setWorktreesOpen(false)} disabled={!!busy}>
                關閉
              </Button>
              <Button
                appearance="primary"
                onClick={() => void addWorktree()}
                disabled={!!busy || !worktreePath.trim() || !worktreeBranch.trim()}
              >
                {busy === "worktree" ? <Spinner size="tiny" /> : "新增 Worktree"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {compareOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setCompareOpen(false)}
        >
          <div className="modal compare-modal" role="dialog" aria-modal="true" aria-label="比較分支">
            <div className="modal-header">
              <h2>比較分支</h2>
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setCompareOpen(false)} />
            </div>
            <div className="modal-body form-stack">
              <div className="compare-controls">
                <Field label="Base">
                  <UnderlineSelect value={compareBase} onChange={(_, data) => setCompareBase(data.value)}>
                    {local.map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {entry.name}
                      </option>
                    ))}
                  </UnderlineSelect>
                </Field>
                <span className="compare-arrow">↔</span>
                <Field label="Compare">
                  <UnderlineSelect value={compareBranch} onChange={(_, data) => setCompareBranch(data.value)}>
                    {local.map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {entry.name}
                      </option>
                    ))}
                  </UnderlineSelect>
                </Field>
              </div>
              {compareQuery.isLoading ? (
                <div className="center-state"><Spinner label={t("common.loading")} /></div>
              ) : compareQuery.data ? (
                <>
                  <div className="compare-summary">
                    <span><strong>{compareQuery.data.compare}</strong> 領先 {compareQuery.data.ahead} commits</span>
                    <span><strong>{compareQuery.data.base}</strong> 領先 {compareQuery.data.behind} commits</span>
                    <span>{compareQuery.data.files.length} 個檔案不同</span>
                  </div>
                  <div className="compare-columns">
                    <div className="compare-column">
                      <h3>只在 {compareQuery.data.compare}</h3>
                      {compareQuery.data.aheadCommits.length === 0 ? <div className="empty-state">沒有 Commit</div> : null}
                      {compareQuery.data.aheadCommits.map((commit) => (
                        <div className="compare-commit" key={commit.oid}>
                          <code>{shortOid(commit.oid)}</code>
                          <span title={commit.subject}>{commit.subject}</span>
                          <span className="muted">{commit.author}</span>
                        </div>
                      ))}
                    </div>
                    <div className="compare-column">
                      <h3>只在 {compareQuery.data.base}</h3>
                      {compareQuery.data.behindCommits.length === 0 ? <div className="empty-state">沒有 Commit</div> : null}
                      {compareQuery.data.behindCommits.map((commit) => (
                        <div className="compare-commit" key={commit.oid}>
                          <code>{shortOid(commit.oid)}</code>
                          <span title={commit.subject}>{commit.subject}</span>
                          <span className="muted">{commit.author}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setCompareOpen(false)}>關閉</Button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingCommand ? (
        <GitCommandDialog
          title={pendingCommand.title}
          description={pendingCommand.description}
          command={pendingCommand.preview.command}
          warning={pendingCommand.warning}
          destructive={pendingCommand.destructive || pendingCommand.preview.destructive}
          busy={!!busy}
          onCancel={() => setPendingCommand(null)}
          onConfirm={() => void confirmPending()}
        />
      ) : null}
    </div>
  );
}
