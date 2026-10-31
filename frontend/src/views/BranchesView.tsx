import { useEffect, useState } from "react";
import { Badge, Button, Field, Spinner } from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowClockwise24Regular,
  ArrowDownload24Regular,
  ArrowSync24Regular,
  ArrowUpload24Regular,
  Branch24Regular,
  Dismiss24Regular,
  History24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../bridge/api";
import { ContextMenu } from "../components/ContextMenu";
import { GitCommandDialog } from "../components/GitCommandDialog";
import { UnderlineInput } from "../components/FormControls";
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

  const branches = useQuery({ queryKey: ["branches", root], queryFn: () => api.repo.getBranches(root) });
  const remotes = useQuery({ queryKey: ["remotes", root], queryFn: () => api.sync.listRemotes(root) });
  const local = (branches.data || []).filter((branch) => branch.kind === "local");
  const remote = (branches.data || []).filter((branch) => branch.kind === "remote");
  const selected = local.find((branch) => branch.name === selectedName) || local.find((branch) => branch.current) || local[0];
  const remoteName = selected?.upstream?.split("/")[0] || remotes.data?.[0]?.name || "";

  useEffect(() => {
    setSelectedName("");
  }, [root]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["branches", root] });
    void queryClient.invalidateQueries({ queryKey: ["status", root] });
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
    void queryClient.invalidateQueries({ queryKey: ["remotes", root] });
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
        return api.sync.push(root, req.remote || "", req.branch || "");
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
        onContextMenu={
          selectable
            ? (event) => {
                event.preventDefault();
                setSelectedName(branch.name);
                setBranchMenu({ x: event.clientX, y: event.clientY, branch });
              }
            : undefined
        }
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
          <div className="panel-heading"><span>{t("branches.remote")}</span><span className="muted">{remote.length}</span></div>
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
          items={[
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
            { divider: true },
            {
              key: "delete",
              label: `刪除分支 ${branchMenu.branch.name}…`,
              disabled: branchMenu.branch.current || !!busy,
              destructive: true,
              onSelect: () => requestDelete(branchMenu.branch),
            },
          ]}
        />
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
