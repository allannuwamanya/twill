import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ToolCallPayload } from '../../../types/events';

interface ActivityCardProps {
  tool: ToolCallPayload;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ tool }) => {
  const [expanded, setExpanded] = useState(false);

  const getToolIcon = () => {
    switch (tool.toolName.toLowerCase()) {
      case 'read_file':
      case 'edit_file':
      case 'write_file':
        return <FileText className="w-4 h-4 text-sky-400" />;
      case 'bash':
      case 'exec':
        return <Terminal className="w-4 h-4 text-emerald-400" />;
      default:
        return <Terminal className="w-4 h-4 text-primary" />;
    }
  };

  const getStatusIcon = () => {
    switch (tool.status) {
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'failed':
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="my-2 max-w-4xl mx-auto rounded-xl border border-border/70 bg-card/60 overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2.5 hover:bg-muted/40 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {getToolIcon()}
          <span className="font-mono font-medium text-foreground">{tool.toolName}</span>
          {tool.input && (
            <span className="text-muted-foreground truncate font-mono max-w-xs">
              {JSON.stringify(tool.input)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {getStatusIcon()}
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-3 border-t border-border/50 bg-zinc-950 text-zinc-300 font-mono text-[11px] overflow-x-auto select-text">
          {tool.input && (
            <div className="mb-2">
              <span className="text-zinc-500 font-semibold uppercase tracking-wider block text-[10px] mb-1">
                Input
              </span>
              <pre>{JSON.stringify(tool.input, null, 2)}</pre>
            </div>
          )}
          {tool.output && (
            <div>
              <span className="text-zinc-500 font-semibold uppercase tracking-wider block text-[10px] mb-1">
                Output
              </span>
              <pre className="whitespace-pre-wrap">{tool.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
