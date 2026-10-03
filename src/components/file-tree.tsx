import React, { useState, useMemo, useId } from 'react';
import { Folder, FileText, AlertCircle } from 'lucide-react';
import { GitState } from '@/types/git';
import { fileStates, fileStateLabels, type FileState } from '@/engine/file-states';

interface FileTreeProps {
  state: GitState;
  onFileClick: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: Map<string, TreeNode>;
  file?: FileState;
}

export function FileTree({ state, onFileClick }: FileTreeProps) {
  const treeId = useId();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['']));

  const toggleFolder = (path: string) => {
    setExpandedFolders(previous => {
      const expanded = new Set(previous);
      if (expanded.has(path)) expanded.delete(path);
      else expanded.add(path);
      return expanded;
    });
  };

  const tree = useMemo(() => {
    const root: TreeNode = { name: 'root', path: '', type: 'folder', children: new Map() };
    for (const file of fileStates(state)) {
      const parts = file.path.split('/');
      let current = root;
      parts.forEach((part, index) => {
        const type = index === parts.length - 1 ? 'file' : 'folder';
        // A deleted file and a new folder may share the same name.
        const key = `${type}:${part}`;
        let node = current.children.get(key);
        if (!node) {
          node = { name: part, path: parts.slice(0, index + 1).join('/'), type, children: new Map() };
          current.children.set(key, node);
        }
        if (type === 'file') node.file = file;
        current = node;
      });
    }
    return root;
  }, [state]);

  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const paddingLeft = `${depth * 12}px`;
    if (node.type === 'folder') {
      if (node.path === '') return <div key="root">{[...node.children.values()].map(child => renderNode(child, depth))}</div>;
      return (
        <div key={`folder:${node.path}`}>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={`${node.path}フォルダ`}
            className="flex min-h-11 w-full items-center gap-1 py-1 px-2 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer text-gray-400 select-none text-left"
            style={{ paddingLeft }}
            onClick={() => toggleFolder(node.path)}
          >
            <Folder size={14} className={`shrink-0 ${isExpanded ? 'text-blue-400' : 'text-gray-500'}`} />
            <span className="min-w-0 break-all text-sm">{node.name}</span>
          </button>
          {isExpanded && <div>{[...node.children.values()].map(child => renderNode(child, depth + 1))}</div>}
        </div>
      );
    }
    const file = node.file!;
    const labels = fileStateLabels(file);
    const color = file.conflict ? 'text-red-400' : file.unstaged ? 'text-yellow-400' : file.staged ? 'text-green-400' : 'text-gray-400';
    const Icon = file.conflict ? AlertCircle : FileText;
    const statusId = `${treeId}-${encodeURIComponent(node.path)}`;
    return (
      <button
        type="button"
        aria-label={`${node.path}を開く`}
        aria-describedby={labels.length ? statusId : undefined}
        key={`file:${node.path}`}
        className="flex min-h-11 w-full flex-wrap items-center gap-2 py-1 px-2 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer select-none text-left"
        style={{ paddingLeft }}
        onClick={() => onFileClick(node.path)}
      >
        <Icon size={14} className={`shrink-0 ${color}`} />
        <span className={`min-w-0 break-all text-sm ${color}`}>{node.name}</span>
        {labels.length > 0 && (
          <span id={statusId} className="ml-auto flex flex-wrap gap-1 text-xs text-gray-300">
            {labels.map(label => <span key={label}>{label}</span>)}
          </span>
        )}
      </button>
    );
  };

  return <div className="font-mono text-sm">{renderNode(tree)}</div>;
}
