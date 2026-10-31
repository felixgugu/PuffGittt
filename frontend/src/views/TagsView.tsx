import { useState } from "react";
import { Button, Field, Spinner } from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowClockwise24Regular,
  ArrowUpload24Regular,
  Delete24Regular,
  Dismiss24Regular,
  Tag24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../bridge/api";
import { GitCommandDialog } from "../components/GitCommandDialog";
import { UnderlineInput, UnderlineTextarea } from "../components/FormControls";
import { useAppStore, type RepoTab } from "../store";
import type { Tag } from "../types";
import { shortOid } from "../lib/format";

interface TagsViewProps {
  tab: RepoTab;
}

export function TagsView({ tab }: TagsViewProps) {
  const root = tab.repo.rootPath;
  const queryClient = useQueryClient();
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("HEAD");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);
  const [pendingPush, setPendingPush] = useState<Tag | null>(null);
  const [pushAllOpen, setPushAllOpen] = useState(false);

  const tags = useQuery({ queryKey: ["tags", root], queryFn: () => api.tags.list(root) });
  const remotes = useQuery({ queryKey: ["remotes", root], queryFn: () => api.sync.listRemotes(root) });
  const remoteName = remotes.data?.[0]?.name || "";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["tags", root] });
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
  };

  const command = (() => {
    const tagName = name.trim() || "<tag-name>";
    const revision = target.trim() || "HEAD";
    if (message.trim()) {
      return `git tag -a ${tagName} -m "${message.trim()}" ${revision}`;
    }
    return `git tag ${tagName} ${revision}`;
  })();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy("create");
    try {
      const result = await api.tags.create(root, name.trim(), target.trim(), message.trim());
      setStatusMessage(result.message);
      invalidate();
      setCreateOpen(false);
      setName("");
      setTarget("HEAD");
      setMessage("");
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusy("delete");
    try {
      const result = await api.tags.delete(root, pendingDelete.name);
      setStatusMessage(result.message);
      invalidate();
      setPendingDelete(null);
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(null);
    }
  };

  const handlePush = async () => {
    if (!pendingPush || !remoteName) return;
    setBusy("push");
    try {
      const result = await api.tags.push(root, remoteName, pendingPush.name);
      setStatusMessage(result.message);
      setPendingPush(null);
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(null);
    }
  };

  const handlePushAll = async () => {
    if (!remoteName) return;
    setBusy("push");
    try {
      const result = await api.tags.pushAll(root, remoteName);
      setStatusMessage(result.message);
      setPushAllOpen(false);
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="tags-view">
      <div className="panel-card tags-card">
        <div className="panel-heading">
          <span>Tags</span>
          <div className="panel-heading-actions">
            <span className="muted">{tags.data?.length || 0}</span>
            <Button
              size="small"
              appearance="subtle"
              icon={<ArrowClockwise24Regular />}
              title="重新整理"
              onClick={invalidate}
              disabled={tags.isFetching || !!busy}
            />
            <Button
              size="small"
              appearance="subtle"
              icon={<ArrowUpload24Regular />}
              title={remoteName ? `Push 所有 Tags 到 ${remoteName}` : "尚未設定 Remote"}
              onClick={() => setPushAllOpen(true)}
              disabled={!remoteName || !!busy}
            />
            <Button size="small" appearance="primary" icon={<Add24Regular />} onClick={() => setCreateOpen(true)}>
              New Tag
            </Button>
          </div>
        </div>
        {tags.isLoading ? <div className="center-state"><Spinner label="載入中…" /></div> : null}
        {tags.data?.length === 0 ? <div className="empty-state">目前沒有 Tag。</div> : null}
        {tags.data?.map((tag) => (
          <div key={tag.name} className="tag-row">
            <Tag24Regular />
            <div className="tag-copy">
              <strong>{tag.name}</strong>
              <span>{tag.message || "Lightweight"}</span>
            </div>
            <span className="tag-oid">{shortOid(tag.oid)}</span>
            <div className="tag-actions">
              <Button
                size="small"
                appearance="subtle"
                icon={<ArrowUpload24Regular />}
                title={remoteName ? `Push 到 ${remoteName}` : "尚未設定 Remote"}
                disabled={!remoteName || !!busy}
                onClick={() => setPendingPush(tag)}
              />
              <Button
                size="small"
                appearance="subtle"
                icon={<Delete24Regular />}
                title="刪除 Tag"
                disabled={!!busy}
                onClick={() => setPendingDelete(tag)}
              />
            </div>
          </div>
        ))}
      </div>

      {createOpen ? (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setCreateOpen(false)}>
          <div className="modal small" role="dialog" aria-modal="true" aria-label="New Tag">
            <div className="modal-header">
              <h2>New Tag</h2>
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setCreateOpen(false)} disabled={!!busy} />
            </div>
            <div className="modal-body form-stack">
              <Field label="Tag 名稱">
                <UnderlineInput value={name} onChange={(_, data) => setName(data.value)} placeholder="v1.0.0" />
              </Field>
              <Field label="目標 Commit">
                <UnderlineInput value={target} onChange={(_, data) => setTarget(data.value)} placeholder="HEAD" />
              </Field>
              <Field label="Message（選填）">
                <UnderlineTextarea
                  value={message}
                  onChange={(_, data) => setMessage(data.value)}
                  placeholder="留空則建立 lightweight tag"
                  resize="vertical"
                />
              </Field>
              <pre className="git-command-preview"><code>{command}</code></pre>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setCreateOpen(false)} disabled={!!busy}>取消</Button>
              <Button appearance="primary" onClick={() => void handleCreate()} disabled={!name.trim() || !!busy}>
                {busy === "create" ? <Spinner size="tiny" /> : "建立 Tag"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <GitCommandDialog
          title={`刪除 Tag ${pendingDelete.name}`}
          description={`刪除本機 Tag ${pendingDelete.name}。`}
          command={`git tag -d ${pendingDelete.name}`}
          warning="此操作無法復原。"
          destructive
          busy={busy === "delete"}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {pendingPush ? (
        <GitCommandDialog
          title={`Push Tag ${pendingPush.name}`}
          description={`將 Tag ${pendingPush.name} 推送到 ${remoteName}。`}
          command={`git push ${remoteName} refs/tags/${pendingPush.name}`}
          busy={busy === "push"}
          onCancel={() => setPendingPush(null)}
          onConfirm={() => void handlePush()}
        />
      ) : null}

      {pushAllOpen ? (
        <GitCommandDialog
          title="Push 所有 Tags"
          description={`將所有本機 Tags 推送到 ${remoteName}。`}
          command={`git push ${remoteName} --tags`}
          warning="會更新遠端同名 Tags。"
          busy={busy === "push"}
          onCancel={() => setPushAllOpen(false)}
          onConfirm={() => void handlePushAll()}
        />
      ) : null}
    </div>
  );
}
