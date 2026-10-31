export function shortOid(oid?: string): string {
  return (oid || "").slice(0, 7);
}

export function baseName(path: string): string {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "剛剛";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} 週前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 個月前`;
  return `${Math.floor(days / 365)} 年前`;
}

export function fileStatusLabel(code: string): string {
  switch (code) {
    case "A":
      return "新增";
    case "M":
      return "修改";
    case "D":
      return "刪除";
    case "R":
      return "重新命名";
    case "C":
      return "複製";
    case "U":
      return "衝突";
    case "?":
      return "未追蹤";
    case ".":
      return "";
    default:
      return code;
  }
}

export function fileStatusClass(code: string): string {
  switch (code) {
    case "A":
    case "?":
      return "status-added";
    case "M":
      return "status-modified";
    case "D":
      return "status-deleted";
    case "R":
    case "C":
      return "status-renamed";
    case "U":
      return "status-conflict";
    default:
      return "status-neutral";
  }
}

export function changeCode(file: { indexStatus: string; worktreeStatus: string }): string {
  const code = file.indexStatus !== "." ? file.indexStatus : file.worktreeStatus;
  return code || "M";
}

export function clampText(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
