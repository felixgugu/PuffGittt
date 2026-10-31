import { useState } from "react";
import { Badge, Button, Field, Input, Spinner } from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowSync24Regular,
  Branch24Regular,
  Checkmark24Regular,
  Delete24Regular,
  Dismiss24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../bridge/api";
import { useAppStore, type RepoTab } from "../store";
import type { Branch } from "../types";
import { formatDate, shortOid } from "../lib/format";

interface BranchesViewProps {
  tab: RepoTab;
}

export function BranchesView({ tab }: BranchesViewProps) {
  const { t } = useTranslation();
  const root = tab.repo.rootPath;
  const queryClient = useQueryClient();
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [startOid, setStartOid] = useState(tab.repo.headOid || "");

  const branches = useQuery({ queryKey: ["branches", root], queryFn: () => api.repo.getBranches(root) });
  const local = (branches.data || []).filter((branch) => branch.kind === "local");
  const remote = (branches.data || []).filter((branch) => branch.kind === "remote");
  const current = branches.data?.find((branch) => branch.current)?.name || tab.repo.branch || "";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["branches", root] });
    void queryClient.invalidateQueries({ queryKey: ["status", root] });
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
  };

  const run = async (key: string, action: () => Promise<{ message: string }>) => {
    setBusy(key);
    try {
      const result = await action();
      setStatusMessage(result.message);
      invalidate();
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    void run("create", () => api.branch.create(root, newName.trim(), startOid.trim())).then(() => {
      setCreateOpen(false);
      setNewName("");
    });
  };

  const renderBranch = (branch: Branch) => (
    <div key={branch.fullName} className={`branch-row${branch.current ? " current" : ""}`}>
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
      <div className="branch-actions">
        <Button
          size="small"
          appearance="subtle"
          icon={<Checkmark24Regular />}
          title={t("branches.switch")}
          disabled={branch.current || !!busy}
          onClick={() => void run("switch", () => api.branch.switch(root, branch.name))}
        />
        <Button
          size="small"
          appearance="subtle"
          icon={<ArrowSync24Regular />}
          title={t("branches.merge")}
          disabled={branch.current || !!busy}
          onClick={() => void run("merge", () => api.branch.merge(root, branch.name, "merge"))}
        />
        <Button
          size="small"
          appearance="subtle"
          icon={<Delete24Regular />}
          title={t("branches.delete")}
          disabled={branch.current || !!busy}
          onClick={() => {
            if (window.confirm(t("branches.deleteConfirm", { name: branch.name }))) {
              void run("delete", () => api.branch.delete(root, branch.name, false));
            }
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="branches-view">
      <div className="view-header">
        <div>
          <h1>{t("branches.title")}</h1>
          <p>{root}</p>
        </div>
        <div className="view-header-actions">
          <Button appearance="primary" icon={<Add24Regular />} onClick={() => setCreateOpen(true)}>
            {t("branches.create")}
          </Button>
        </div>
      </div>

      <div className="branch-columns">
        <div className="panel-card branch-section">
          <div className="panel-heading"><span>{t("branches.local")}</span><span className="muted">{local.length}</span></div>
          {branches.isLoading ? <div className="center-state"><Spinner label={t("common.loading")} /></div> : null}
          {local.map(renderBranch)}
        </div>
        <div className="panel-card branch-section">
          <div className="panel-heading"><span>{t("branches.remote")}</span><span className="muted">{remote.length}</span></div>
          {remote.map(renderBranch)}
          {remote.length === 0 ? <div className="empty-state">{t("branches.noBranches")}</div> : null}
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
                <Input value={newName} onChange={(_, data) => setNewName(data.value)} placeholder="feature/my-change" />
              </Field>
              <Field label={t("branches.startPoint")}>
                <Input value={startOid} onChange={(_, data) => setStartOid(data.value)} placeholder={tab.repo.headOid || "HEAD"} />
              </Field>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
              <Button appearance="primary" onClick={handleCreate} disabled={!newName.trim() || busy === "create"}>
                {t("common.create")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
