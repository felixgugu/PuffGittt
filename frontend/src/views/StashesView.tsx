import { useState } from "react";
import { Button, Field, Spinner } from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowDownload24Regular,
  ArrowSync24Regular,
  Delete24Regular,
  Dismiss24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../bridge/api";
import { UnderlineInput } from "../components/FormControls";
import { useAppStore, type RepoTab } from "../store";
import { formatDate, shortOid } from "../lib/format";

interface StashesViewProps {
  tab: RepoTab;
}

export function StashesView({ tab }: StashesViewProps) {
  const { t } = useTranslation();
  const root = tab.repo.rootPath;
  const queryClient = useQueryClient();
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);

  const stashes = useQuery({ queryKey: ["stashes", root], queryFn: () => api.stash.list(root) });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["stashes", root] });
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
    void run("create", () => api.stash.create(root, message, includeUntracked)).then(() => {
      setCreateOpen(false);
      setMessage("");
      setIncludeUntracked(false);
    });
  };

  return (
    <div className="stashes-view">
      <div className="panel-card stashes-card">
        <div className="panel-heading">
          <span>{t("stashes.title")}</span>
          <div className="panel-heading-actions">
            <span className="muted">{stashes.data?.length || 0}</span>
            <Button size="small" appearance="primary" icon={<Add24Regular />} onClick={() => setCreateOpen(true)}>
              {t("stashes.create")}
            </Button>
          </div>
        </div>
        {stashes.isLoading ? <div className="center-state"><Spinner label={t("common.loading")} /></div> : null}
        {stashes.data?.length === 0 ? <div className="empty-state">{t("stashes.empty")}</div> : null}
        {stashes.data?.map((entry) => (
          <div key={entry.ref} className="stash-row">
            <div className="stash-copy">
              <strong>{entry.message || entry.ref}</strong>
              <span>{entry.ref} · {shortOid(entry.oid)} · {formatDate(entry.date)}</span>
            </div>
            <div className="stash-actions">
              <Button
                size="small"
                appearance="subtle"
                icon={<ArrowDownload24Regular />}
                title={t("stashes.apply")}
                disabled={!!busy}
                onClick={() => void run(`apply-${entry.ref}`, () => api.stash.apply(root, entry.ref, false))}
              />
              <Button
                size="small"
                appearance="subtle"
                icon={<ArrowSync24Regular />}
                title={t("stashes.pop")}
                disabled={!!busy}
                onClick={() => void run(`pop-${entry.ref}`, () => api.stash.apply(root, entry.ref, true))}
              />
              <Button
                size="small"
                appearance="subtle"
                icon={<Delete24Regular />}
                title={t("stashes.drop")}
                disabled={!!busy}
                onClick={() => void run(`drop-${entry.ref}`, () => api.stash.drop(root, entry.ref))}
              />
            </div>
          </div>
        ))}
      </div>

      {createOpen ? (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCreateOpen(false)}>
          <div className="modal small">
            <div className="modal-header">
              <h2>{t("stashes.createTitle")}</h2>
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setCreateOpen(false)} />
            </div>
            <div className="modal-body form-stack">
              <Field label={t("stashes.message")}>
                <UnderlineInput value={message} onChange={(_, data) => setMessage(data.value)} />
              </Field>
              <label className="checkbox-line">
                <input type="checkbox" checked={includeUntracked} onChange={(event) => setIncludeUntracked(event.target.checked)} />
                {t("stashes.includeUntracked")}
              </label>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
              <Button appearance="primary" onClick={handleCreate} disabled={busy === "create"}>
                {t("stashes.create")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
