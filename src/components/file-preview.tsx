import React from 'react';
import { X, FileText } from 'lucide-react';

interface FilePreviewProps {
  file: { path: string; content: string } | null;
  onClose: () => void;
}

export function FilePreview({ file, onClose }: FilePreviewProps) {
  if (!file) return null;

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-800/50">
        <div className="flex items-center gap-2 text-gray-200">
          <FileText className="w-4 h-4 text-blue-400" />
          <span className="font-medium text-sm">{file.path}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded-md text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Close preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap break-all">
          {file.content}
        </pre>
      </div>
    </div>
  );
}
