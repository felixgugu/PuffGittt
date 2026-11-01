import { useState } from "react";
import { Button, Checkbox, Field, Spinner } from "@fluentui/react-components";
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
import type { RemoteTag, Tag } from "../types";
import { shortOid } from "../lib/format";

interface TagsViewProps {
  tab: RepoTab;
}

type TagTab = "local" | "remote";

export function TagsView({ tab }: TagsViewProps) {
  const root = tab.repo.rootPath;
  const queryClient = useQueryClient();
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TagTab>("local");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("HEAD");
  const [message, setMessage] = useState("");
  const [signed, setSigned] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);
  const [pendingPush, setPendingPush] = useState<Tag | null>(null);
  const [pendingRemoteDelete, setPendingRemoteDelete] = useState<RemoteTag | null>(null);
  const [pushAllOpen, setPushAllOpen] = useState(false);

  const tags = useQuery({ queryKey: ["tags", root], queryFn: () => api.tags.list(root) });
  const remotes = useQuery({ queryKey: ["remotes", root], queryFn: () => api.sync.listRemotes(root) });
  const remoteName = remotes.data?.[0]?.name || "";
  const remoteTags = useQuery({
    queryKey: ["remote-tags", root, remoteName],
    queryFn: () => api.tags.listRemote(root, remoteName),
    enabled: !!remoteName && activeTab === "remote",
  });

  const localTags = tags.data || [];
  const localByName = new Map(localTags.map((tag) => [tag.name, tag]));
  const remoteList = remoteTags.data || [];
  const remoteNames = new Set(remoteList.map((tag) => tag.name));
  const localOnly = localTags.filter((tag) => !remoteNames.has(tag.name));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["tags", root] });
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
    void queryClient.invalidateQueries({ queryKey: ["remote-tags", root] });
  };

  const command = (() => {
    const tagName = name.trim() || "<tag-name>";
    const revision = target.trim() || "HEAD";
    if (signed) {
      return `git tag -s ${tagName} -m "${message.trim() || "<message>"}" ${revision}`;
    }
    if (message.trim()) {
      return `git tag -a ${tagName} -m "${message.trim()}" ${revision}`;
    }
    return `git tag ${tagName} ${revision}`;
  })();

  const handleCreate = async () => {
    if (!name.trim()) return;
    if (signed && !message.trim()) return;
    setBusy("create");
    try {
      const result = signed
        ? await api.tags.createSigned(root, name.trim(), target.trim(), message.trim())
        : await api.tags.create(root, name.trim(), target.trim(), message.trim());
      setStatusMessage(result.message);
      invalidate();
      setCreateOpen(false);
      setName("");
      setTarget("HEAD");
      setMessage("");
      setSigned(false);
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

  const handleDeleteRemote = async () => {
    if (!pendingRemoteDelete || !remoteName) return;
    setBusy("delete-remote");
    try {
      const result = await api.tags.deleteRemote(root, remoteName, pendingRemoteDelete.name);
      setStatusMessage(result.message);
      invalidate();
      setPendingRemoteDelete(null);
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
      invalidate();
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
      invalidate();
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
          <div className="file-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "local"}
              className={`file-tab${activeTab === "local" ? " active" : ""}`}
              onClick={() => setActiveTab("local")}
            >
              本機
              <span className="file-tab-count">{localTags.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "remote"}
              className={`file-tab${activeTab === "remote" ? " active" : ""}`}
              onClick={() => setActiveTab("remote")}
            >
              遠端
              <span className="file-tab-count">{remoteList.length}</span>
            </button>
          </div>
          <div className="panel-heading-actions">
            <Button
              size="small"
              appearance="subtle"
              icon={<ArrowClockwise24Regular />}
              title="重新整理"
              onClick={() => {
                invalidate();
                if (activeTab === "remote") void remoteTags.refetch();
              }}
              disabled={tags.isFetching || remoteTags.isFetching || !!busy}
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

        {activeTab === "local" ? (
          <>
            {tags.isLoading ? <div className="center-state"><Spinner label="載入中…" /></div> : null}
            {!tags.isLoading && localTags.length === 0 ? <div className="empty-state">目前沒有 Tag。</div> : null}
            {localTags.map((tag) => (
              <div key={tag.name} className="tag-row">
                <Tag24Regular />
                <div className="tag-copy">
                  <strong>{tag.name}</strong>
                  <span title={tag.tagger ? `${tag.tagger} · ${tag.taggerDate || ""}` : undefined}>
                    {tag.message || "Lightweight"}
                    {tag.tagger ? ` · ${tag.tagger}` : ""}
                  </span>
                </div>
                <span className="tag-oid">{shortOid(tag.targetOid || tag.oid)}</span>
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
          </>
        ) : (
          <>
            {!remoteName ? (
              <div className="empty-state">尚未設定 Remote。</div>
            ) : remoteTags.isLoading ? (
              <div className="center-state"><Spinner label="載入遠端 Tags…" /></div>
            ) : remoteTags.isError ? (
              <div className="empty-state">無法讀取遠端 Tags。</div>
            ) : (
              <>
                {remoteList.length === 0 ? <div className="empty-state">遠端沒有 Tag。</div> : null}
                {remoteList.map((tag) => {
                  const local = localByName.get(tag.name);
                  const state = !local ? "僅遠端" : local.oid === tag.oid ? "同步" : "不同步";
                  return (
                    <div key={tag.name} className="tag-row">
                      <Tag24Regular />
                      <div className="tag-copy">
                        <strong>{tag.name}</strong>
                        <span>{remoteName} · {shortOid(tag.oid)}</span>
                      </div>
                      <span className={`tag-state ${state === "同步" ? "synced" : state === "不同步" ? "diverged" : "remote-only"}`}>
                        {state}
                      </span>
                      <div className="tag-actions">
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<Delete24Regular />}
                          title="刪除遠端 Tag"
                          disabled={!!busy}
                          onClick={() => setPendingRemoteDelete(tag)}
                        />
                      </div>
                    </div>
                  );
                })}
                {localOnly.length > 0 ? (
                  <div className="tag-local-only">
                    <div className="tag-local-only-title">僅本機</div>
                    {localOnly.map((tag) => (
                      <div key={tag.name} className="tag-local-only-row">
                        <span>{tag.name}</span>
                        <span className="tag-state local-only">僅本機</span>
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<ArrowUpload24Regular />}
                          title={`Push ${tag.name} 到 ${remoteName}`}
                          disabled={!!busy}
                          onClick={() => setPendingPush(tag)}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
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
              <Field label={signed ? "Message（signed tag 必填）" : "Message（選填）"}>
                <UnderlineTextarea
                  value={message}
                  onChange={(_, data) => setMessage(data.value)}
                  placeholder={signed ? "signed tag 需要訊息" : "留空則建立 lightweight tag"}
                  resize="vertical"
                />
              </Field>
              <Checkbox
                checked={signed}
                onChange={(_, data) => setSigned(!!data.checked)}
                label="建立 signed tag（需要 GPG / SSH signing 設定）"
              />
              <pre className="git-command-preview"><code>{command}</code></pre>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setCreateOpen(false)} disabled={!!busy}>取消</Button>
              <Button
                appearance="primary"
                onClick={() => void handleCreate()}
                disabled={!name.trim() || (signed && !message.trim()) || !!busy}
              >
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

      {pendingRemoteDelete ? (
        <GitCommandDialog
          title={`刪除遠端 Tag ${pendingRemoteDelete.name}`}
          description={`從 ${remoteName} 刪除 Tag ${pendingRemoteDelete.name}。`}
          command={`git push ${remoteName} --delete refs/tags/${pendingRemoteDelete.name}`}
          warning="會影響其他協作者，且無法復原。"
          destructive
          busy={busy === "delete-remote"}
          onCancel={() => setPendingRemoteDelete(null)}
          onConfirm={() => void handleDeleteRemote()}
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
