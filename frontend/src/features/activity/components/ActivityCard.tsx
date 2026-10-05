import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  FileText,
  FileSearch,
  Globe,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ToolCallPayload } from '../../../types/events';

interface ActivityCardProps {
  tool: ToolCallPayload;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ tool }) => {
  const [expanded, setExpanded] = useState(false);

  const getToolIcon = () => {
    switch (tool.toolName) {
      case 'Read':
      case 'NotebookRead':
        return <FileSearch className="w-3.5 h-3.5 text-[#d9b98a]" />;
      case 'Write':
      case 'Edit':
      case 'MultiEdit':
      case 'NotebookEdit':
        return <FileText className="w-3.5 h-3.5 text-[#c66b4d]" />;
      case 'Bash':
      case 'BashOutput':
        return <Terminal className="w-3.5 h-3.5 text-[#7fa3e8]" />;
      case 'WebFetch':
      case 'WebSearch':
        return <Globe className="w-3.5 h-3.5 text-[#6e8fe8]" />;
      case 'TodoWrite':
      case 'ExitPlanMode':
        return <ListTodo className="w-3.5 h-3.5 text-[#d9b98a]" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-[#d9b98a]" />;
    }
  };

  const getStatusIcon = () => {
    switch (tool.status) {
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 text-[#c66b4d] animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#2fb67c]" />;
      case 'failed':
        return <AlertCircle className="w-3.5 h-3.5 text-[#e5484d]" />;
      default:
        return null;
    }
  };

  return (
    <div className="my-2 max-w-3xl mx-auto rounded-xl border border-[#383631] bg-[#242320] overflow-hidden text-xs shadow-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2.5 hover:bg-[#2b2a26] transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {getToolIcon()}
          <span className="font-mono font-medium text-[#eeeae4]">{tool.toolName}</span>
          {tool.input && (
            <span className="text-[#96928a] truncate font-mono max-w-sm text-[11px]">
              {JSON.stringify(tool.input)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {getStatusIcon()}
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#7d7972]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#7d7972]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-3 border-t border-[#33312c] bg-[#181715] text-[#d8d5ce] font-mono text-[11px] overflow-x-auto select-text">
          {tool.input && (
            <div className="mb-2">
              <span className="text-[#7d7972] font-semibold uppercase tracking-wider block text-[10px] mb-1">
                Input
              </span>
              <pre className="text-[#d8d5ce]">{JSON.stringify(tool.input, null, 2)}</pre>
            </div>
          )}
          {tool.output && (
            <div>
              <span className="text-[#7d7972] font-semibold uppercase tracking-wider block text-[10px] mb-1">
                Output
              </span>
              <pre className="whitespace-pre-wrap text-[#d8d5ce]">{tool.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
