import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { ToolCallPayload } from '../../../types/events';

interface ActivityCardProps {
  tool: ToolCallPayload;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ tool }) => {
  const [expanded, setExpanded] = useState(false);

  // Helper to extract a friendly summary line matching Antigravity
  const getStepLabel = () => {
    const rawName = (tool.toolName || '').toLowerCase();
    const input = tool.input || {};

    // 1. Terminal / Shell command
    if (
      rawName === 'bash' ||
      rawName === 'bashoutput' ||
      rawName === 'run_command' ||
      rawName === 'execute_command' ||
      rawName === 'exec' ||
      rawName === 'shell'
    ) {
      const cmd =
        typeof input === 'string'
          ? input
          : (input as any).command || (input as any).CommandLine || '';

      const trimmed = cmd.trim();
      if (
        trimmed.startsWith('ls') ||
        trimmed.startsWith('find') ||
        trimmed.startsWith('grep') ||
        trimmed.startsWith('locate')
      ) {
        const parts = trimmed.split(/\s+/);
        const target = parts.slice(1).filter((p: string) => !p.startsWith('-')).pop() || 'files';
        return `Explored ${target}`;
      }
      if (trimmed.startsWith('git ')) {
        return `Git: ${trimmed.slice(4, 40)}`;
      }
      if (trimmed) {
        return `Ran ${trimmed.slice(0, 45)}${trimmed.length > 45 ? '...' : ''}`;
      }
      return 'Ran terminal command';
    }

    // 2. File read / inspect
    if (
      rawName === 'read' ||
      rawName === 'view_file' ||
      rawName === 'read_file' ||
      rawName === 'fileread' ||
      rawName === 'notebookread'
    ) {
      const file =
        (input as any).file_path ||
        (input as any).path ||
        (input as any).TargetFile ||
        (input as any).AbsolutePath ||
        '';
      const base = file.split(/[\\/]/).pop() || 'file';
      return `Read ${base}`;
    }

    // 3. File edit / write
    if (
      rawName === 'write' ||
      rawName === 'edit' ||
      rawName === 'multiedit' ||
      rawName === 'notebookedit' ||
      rawName === 'write_to_file' ||
      rawName === 'replace_file_content' ||
      rawName === 'apply_diff'
    ) {
      const file =
        (input as any).file_path ||
        (input as any).path ||
        (input as any).TargetFile ||
        (input as any).target_file ||
        '';
      const base = file.split(/[\\/]/).pop() || 'file';
      const rawExt = base.split('.').pop() || '';
      const extMap: Record<string, string> = {
        ts: 'TS',
        tsx: 'TS',
        js: 'JS',
        jsx: 'JS',
        go: 'Go',
        css: 'CSS',
        json: 'JSON',
        md: 'MD',
        py: 'PY',
        html: 'HTML',
        sh: 'SH',
      };
      const ext = extMap[rawExt.toLowerCase()] || rawExt.toUpperCase();

      let added: number | undefined;
      let deleted: number | undefined;
      if ((input as any).ReplacementContent) {
        added = ((input as any).ReplacementContent as string).split('\n').length;
      }
      if ((input as any).TargetContent) {
        deleted = ((input as any).TargetContent as string).split('\n').length;
      }

      return {
        isEdit: true,
        ext,
        filename: base,
        added,
        deleted,
      };
    }

    // 4. Web search
    if (rawName === 'search_web' || rawName === 'web_search') {
      const q = (input as any).query || '';
      return q ? `Searched "${q.slice(0, 35)}"` : 'Searched web';
    }

    return tool.toolName || 'Tool execution';
  };

  const stepInfo = getStepLabel();
  const isRunning = tool.status === 'running';
  const isFailed = tool.status === 'failed';

  return (
    <div className="my-1 max-w-4xl select-none">
      {/* Antigravity Sleek Single-Line Step Row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#252320]/70 text-left transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 text-[#c66b4d] animate-spin shrink-0" />
          ) : isFailed ? (
            <AlertCircle className="w-3.5 h-3.5 text-[#e5484d] shrink-0" />
          ) : null}

          {typeof stepInfo === 'object' && stepInfo.isEdit ? (
            <div className="flex items-center gap-2 text-[13px] truncate">
              <span className="text-[#96928a]">Edited</span>
              {stepInfo.ext && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#2a2926] text-[#7fa3e8] border border-[#383631]">
                  {stepInfo.ext}
                </span>
              )}
              <span className="text-[#eeeae4] truncate font-mono text-[13px]">
                {stepInfo.filename}
              </span>
              {stepInfo.added !== undefined && stepInfo.added > 0 && (
                <span className="text-[#68b587] text-xs font-mono font-medium">+{stepInfo.added}</span>
              )}
              {stepInfo.deleted !== undefined && stepInfo.deleted > 0 && (
                <span className="text-[#e5484d] text-xs font-mono font-medium">-{stepInfo.deleted}</span>
              )}
            </div>
          ) : (
            <span className="text-[#96928a] group-hover:text-[#eeeae4] transition-colors truncate text-[13px] font-sans">
              {stepInfo as string}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2 text-[#7d7972] group-hover:text-[#96928a]">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* Expandable Details Frame */}
      {expanded && (
        <div className="my-1.5 p-3 rounded-xl border border-[#33312c] bg-[#181715] text-[#d8d5ce] overflow-x-auto text-[11px] select-text shadow-sm">
          {tool.input && (
            <div className="mb-2">
              <span className="text-[#7d7972] font-semibold uppercase tracking-wider block text-[10px] mb-1">
                Input
              </span>
              <pre className="text-[#eeeae4] whitespace-pre-wrap">
                {typeof tool.input === 'string'
                  ? tool.input
                  : JSON.stringify(tool.input, null, 2)}
              </pre>
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
