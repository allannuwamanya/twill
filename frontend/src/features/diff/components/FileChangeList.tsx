import React from 'react';
import { FileDiff } from '../../../types/events';
import { FileCode, FilePlus, FileMinus, FileEdit, Check, X } from 'lucide-react';

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
        return <FileMinus className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      default:
        return <FileEdit className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
  };

  return (
    <div className="w-64 border-r border-border/70 flex flex-col shrink-0 select-none bg-muted/20">
      <div className="p-2.5 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
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
              onClick={() => onSelectFile(file.filePath)}
              className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                isActive
                  ? 'bg-card border border-border shadow-xs text-foreground font-medium'
                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                {getStatusIcon(file.status)}
                <div className="truncate">
                  <span className="text-foreground font-mono text-[11px]">{basename}</span>
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
                    <span className="text-rose-400">-{file.deletions}</span>
                  )}
                </div>

                {!disabled && (
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onFileDecision(file.filePath, false)}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        decision === false
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'text-zinc-500 hover:text-rose-400'
                      }`}
                      title="Reject file change"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onFileDecision(file.filePath, true)}
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
