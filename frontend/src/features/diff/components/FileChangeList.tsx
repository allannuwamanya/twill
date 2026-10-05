import React from 'react';
import { FileDiff } from '../../../types/events';
import { FilePlus, FileMinus, FileEdit, Check, X } from 'lucide-react';

interface FileChangeListProps {
  files: FileDiff[];
  activeFile: string;
  onSelectFile: (path: string) => void;
  fileDecisions: Record<string, boolean>;
  onFileDecision: (path: string, accepted: boolean) => void;
  disabled?: boolean;
}

export const FileChangeList: React.FC<FileChangeListProps> = ({
  files,
  activeFile,
  onSelectFile,
  fileDecisions,
  onFileDecision,
  disabled = false,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <FilePlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'deleted':
        return <FileMinus className="w-3.5 h-3.5 text-[#ff657a] shrink-0" />;
      default:
        return <FileEdit className="w-3.5 h-3.5 text-[#ff9940] shrink-0" />;
    }
  };

  return (
    <div className="w-64 border-r border-[#1f1f1f] flex flex-col shrink-0 select-none bg-[#121212]">
      <div className="p-2.5 border-b border-[#1f1f1f] text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
        <span>Files Changed ({files.length})</span>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {files.map((file) => {
          const isActive = file.filePath === activeFile;
          const decision = fileDecisions[file.filePath];
          const basename = file.filePath.split(/[\\/]/).pop() || file.filePath;
          const dirname = file.filePath.slice(0, file.filePath.length - basename.length);

          return (
            <div
              key={file.filePath}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onClick={() => onSelectFile(file.filePath)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFile(file.filePath);
                }
              }}
              className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors focus:outline-none ${
                isActive
                  ? 'bg-[#1c1c1c] border border-[#2a2a2a] shadow-xs text-zinc-100 font-medium'
                  : 'hover:bg-[#181818] text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                {getStatusIcon(file.status)}
                <div className="truncate">
                  <span className="text-zinc-200 font-mono text-[11px]">{basename}</span>
                  {dirname && (
                    <span className="text-zinc-500 font-mono text-[10px] block truncate">
                      {dirname}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats & Accept/Reject Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="text-[10px] font-mono flex items-center gap-1">
                  {file.additions !== undefined && file.additions > 0 && (
                    <span className="text-emerald-400">+{file.additions}</span>
                  )}
                  {file.deletions !== undefined && file.deletions > 0 && (
                    <span className="text-[#ff657a]">-{file.deletions}</span>
                  )}
                </div>

                {!disabled && (
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onFileDecision(file.filePath, false)}
                      aria-label={`Reject changes to ${basename}`}
                      aria-pressed={decision === false}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        decision === false
                          ? 'bg-red-500/20 text-[#ff657a]'
                          : 'text-zinc-500 hover:text-[#ff657a]'
                      }`}
                      title="Reject file change"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onFileDecision(file.filePath, true)}
                      aria-label={`Accept changes to ${basename}`}
                      aria-pressed={decision === true}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        decision === true
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'text-zinc-500 hover:text-emerald-400'
                      }`}
                      title="Accept file change"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
