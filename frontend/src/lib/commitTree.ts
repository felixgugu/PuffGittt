import type { CommitFile } from "../types";

export interface CommitTreeRow {
  type: "dir" | "file";
  name: string;
  path: string;
  depth: number;
  file?: CommitFile;
  count?: number;
  status?: string;
}

interface TreeNode {
  type: "dir" | "file";
  name: string;
  path: string;
  file?: CommitFile;
  children: Map<string, TreeNode>;
}

function makeRoot(): TreeNode {
  return { type: "dir", name: "", path: "", children: new Map() };
}

function joinPath(prefix: string, name: string): string {
  return prefix ? `${prefix}/${name}` : name;
}

function addFile(root: TreeNode, file: CommitFile) {
  const segments = file.path.split(/[\\/]+/).filter(Boolean);
  if (!segments.length) return;
  let current = root;
  segments.forEach((segment, index) => {
    const isFile = index === segments.length - 1;
    const path = joinPath(current.path, segment);
    let node = current.children.get(segment);
    if (!node) {
      node = {
        type: isFile ? "file" : "dir",
        name: segment,
        path,
        file: isFile ? file : undefined,
        children: new Map(),
      };
      current.children.set(segment, node);
    }
    if (isFile) {
      node.file = file;
      node.type = "file";
    }
    current = node;
  });
}

function dirStatus(node: TreeNode): string {
  const codes = new Set<string>();
  const visit = (entry: TreeNode) => {
    if (entry.type === "file" && entry.file) {
      codes.add(entry.file.status);
      return;
    }
    entry.children.forEach(visit);
  };
  visit(node);
  if (codes.has("U")) return "U";
  if (codes.has("D")) return "D";
  if (codes.has("A")) return "A";
  return codes.size > 0 ? "M" : "";
}

function dirCount(node: TreeNode): number {
  let count = 0;
  const visit = (entry: TreeNode) => {
    if (entry.type === "file") {
      count += 1;
      return;
    }
    entry.children.forEach(visit);
  };
  visit(node);
  return count;
}

export function flattenCommitFiles(files: CommitFile[], expanded: Set<string>): CommitTreeRow[] {
  const root = makeRoot();
  files.forEach((file) => addFile(root, file));
  const rows: CommitTreeRow[] = [];

  const walk = (node: TreeNode, depth: number) => {
    const children = Array.from(node.children.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-Hant", { sensitivity: "base" });
    });
    children.forEach((child) => {
      if (child.type === "dir") {
        rows.push({
          type: "dir",
          name: child.name,
          path: child.path,
          depth,
          count: dirCount(child),
          status: dirStatus(child),
        });
        if (expanded.has(child.path)) walk(child, depth + 1);
      } else {
        rows.push({
          type: "file",
          name: child.name,
          path: child.path,
          depth,
          file: child.file,
          status: child.file?.status,
        });
      }
    });
  };

  walk(root, 0);
  return rows;
}

export function flattenCommitFilesFlat(files: CommitFile[]): CommitTreeRow[] {
  return [...files]
    .sort((a, b) => a.path.localeCompare(b.path, "zh-Hant", { sensitivity: "base" }))
    .map((file) => ({
      type: "file",
      name: file.path,
      path: file.path,
      depth: 0,
      file,
      status: file.status,
    }));
}

export function allCommitDirectoryPaths(files: CommitFile[]): string[] {
  const root = makeRoot();
  files.forEach((file) => addFile(root, file));
  const paths: string[] = [];
  const walk = (node: TreeNode) => {
    node.children.forEach((child) => {
      if (child.type === "dir") {
        paths.push(child.path);
        walk(child);
      }
    });
  };
  walk(root);
  return paths;
}
