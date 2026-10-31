interface ImageDiffProps {
  mime?: string;
  oldData?: string;
  newData?: string;
}

export function ImageDiff({ mime, oldData, newData }: ImageDiffProps) {
  const source = (data?: string) =>
    data ? `data:${mime || "application/octet-stream"};base64,${data}` : "";

  return (
    <div className="image-diff">
      <div className="image-diff-pane">
        <div className="image-diff-label">舊版本</div>
        {oldData ? (
          <div className="image-diff-canvas">
            <img src={source(oldData)} alt="舊版本" />
          </div>
        ) : (
          <div className="empty-state">沒有舊版本</div>
        )}
      </div>
      <div className="image-diff-pane">
        <div className="image-diff-label">新版本</div>
        {newData ? (
          <div className="image-diff-canvas">
            <img src={source(newData)} alt="新版本" />
          </div>
        ) : (
          <div className="empty-state">檔案已刪除</div>
        )}
      </div>
    </div>
  );
}
