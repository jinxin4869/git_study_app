import React, { useState, useMemo } from 'react';
import { Folder, FileText, AlertCircle, HelpCircle } from 'lucide-react';
import { GitState } from '@/types/git';

interface FileTreeProps {
  state: GitState;
  onFileClick: (path: string, content: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: Record<string, TreeNode>;
  status?: 'modified' | 'staged' | 'untracked' | 'conflict' | 'clean';
  content?: string;
}

export function FileTree({ state, onFileClick }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const tree = useMemo(() => {
    const root: TreeNode = { name: 'root', path: '', type: 'folder', children: {} };

    // ノードを追加するヘルパー関数
    const addNode = (filePath: string, content: string, status: TreeNode['status']) => {
      const parts = filePath.split('/');
      let current = root;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // ファイル
          if (!current.children) current.children = {};
          current.children[part] = {
            name: part,
            path: filePath,
            type: 'file',
            content,
            status
          };
        } else {
          // フォルダ
          if (!current.children) current.children = {};
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              path: parts.slice(0, index + 1).join('/'),
              type: 'folder',
              children: {}
            };
          }
          current = current.children[part];
        }
      });
    };

    // 1. WDとIndexから全てのファイルを特定
    const allFiles = new Set([
      ...Object.keys(state.workingDirectory),
      ...Object.keys(state.index)
    ]);

    allFiles.forEach(file => {
      const wdContent = state.workingDirectory[file];
      const indexEntry = state.index[file];
      
      // ステータスの決定
      let status: TreeNode['status'] = 'clean';
      
      if (wdContent?.includes('<<<<<<<')) {
        status = 'conflict';
      } else if (indexEntry && !wdContent) {
        // WDで削除されたがIndexにある場合
        if (indexEntry.content !== wdContent) {
            status = 'modified';
        } else {
            status = 'staged';
        }
      } else if (!indexEntry && wdContent) {
        // WDにあるがIndexにない -> Untracked (またはHEADで追跡されているが変更あり)
        
        // HEADにあるか確認
        const headCommitId = state.HEAD.type === 'branch' ? state.branches[state.HEAD.value] : state.HEAD.value;
        const headCommit = state.commits[headCommitId];
        const inHead = headCommit?.tree[file] !== undefined;

        if (inHead) {
           status = 'modified'; // 追跡されているが変更あり
        } else {
           status = 'untracked';
        }
      } else if (indexEntry && wdContent) {
         // 両方にある
         if (indexEntry.content !== wdContent) {
            status = 'modified';
         } else {
            status = 'staged';
         }
      }

      // ステータスロジックの洗練:
      // 1. HEADのコンテンツを取得
      const headCommitId = state.HEAD.type === 'branch' ? state.branches[state.HEAD.value] : state.HEAD.value;
      const headCommit = state.commits[headCommitId];
      const headContent = headCommit?.tree[file];

      const indexContent = state.index[file]?.content;
      const workContent = state.workingDirectory[file];

      if (workContent?.includes('<<<<<<<')) {
        status = 'conflict';
      } else if (workContent === undefined) {
        // WDで削除
        status = 'modified';
      } else if (indexContent === undefined && headContent === undefined) {
        status = 'untracked';
      } else if (workContent !== indexContent && indexContent !== undefined) {
        status = 'modified';
      } else if (workContent !== headContent && headContent !== undefined && indexContent === undefined) {
         // HEADで追跡されているがIndexにない（このシミュレーターでは稀だが、addしていない変更）
         status = 'modified';
      } else if (indexContent !== headContent && indexContent !== undefined) {
         if (workContent === indexContent) {
             status = 'staged';
         } else {
             status = 'modified'; // ステージされた後にさらに変更
         }
      } else {
        status = 'clean';
      }

      if (workContent !== undefined) {
          addNode(file, workContent, status);
      }
    });

    return root;
  }, [state]);

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path || 'root');
    const paddingLeft = `${depth * 12}px`;

    if (node.type === 'folder') {
      if (node.name === 'root') {
        return (
           <div key="root">
             {Object.values(node.children || {}).map(child => renderNode(child, depth))}
           </div>
        );
      }
      return (
        <div key={node.path}>
          <div 
            className="flex items-center gap-1 py-1 px-2 hover:bg-gray-800 cursor-pointer text-gray-400 select-none"
            style={{ paddingLeft }}
            onClick={() => toggleFolder(node.path)}
          >
            <Folder size={14} className={isExpanded ? 'text-blue-400' : 'text-gray-500'} />
            <span className="text-sm">{node.name}</span>
          </div>
          {isExpanded && (
            <div>
              {Object.values(node.children || {}).map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      // ファイル
      let Icon = FileText;
      let colorClass = 'text-gray-400';
      let statusIcon = null;

      switch (node.status) {
        case 'modified':
          colorClass = 'text-yellow-400';
          statusIcon = <div className="w-2 h-2 rounded-full bg-yellow-500 ml-auto" title="Modified" />;
          break;
        case 'staged':
          colorClass = 'text-green-400';
          statusIcon = <div className="w-2 h-2 rounded-full bg-green-500 ml-auto" title="Staged" />;
          break;
        case 'untracked':
          colorClass = 'text-gray-500';
          statusIcon = <HelpCircle size={12} className="text-gray-600 ml-auto" />; // Removed title prop from Icon
          break;
        case 'conflict':
          colorClass = 'text-red-400';
          Icon = AlertCircle;
          statusIcon = <div className="w-2 h-2 rounded-full bg-red-500 ml-auto" title="Conflict" />;
          break;
      }

      return (
        <div 
          key={node.path}
          className="flex items-center gap-2 py-1 px-2 hover:bg-gray-800 cursor-pointer select-none"
          style={{ paddingLeft }}
          onClick={() => node.content && onFileClick(node.path, node.content)}
        >
          <Icon size={14} className={colorClass} />
          <span className={`text-sm ${colorClass}`}>{node.name}</span>
          {statusIcon}
        </div>
      );
    }
  };

  return (
    <div className="font-mono text-sm">
      {renderNode(tree)}
    </div>
  );
}
