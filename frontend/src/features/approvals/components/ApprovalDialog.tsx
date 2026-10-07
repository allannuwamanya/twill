import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldAlert, Check, X, Copy, CheckCheck } from 'lucide-react';
import { useAgentStore } from '../../../stores/useAgentStore';
import { useSessionStore } from '../../../stores/useSessionStore';
import { wailsBridge } from '../../../api/wailsBridge';
import { Button } from '../../../components/ui/Button';
import { useProjectStore } from '../../../stores/useProjectStore';

export const ApprovalDialog: React.FC = () => {
  const { pendingApproval, setPendingApproval } = useAgentStore();
  const { resolveApproval } = useSessionStore();
  const projectDir = useProjectStore((state) => state.projectDir);
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestId = pendingApproval?.requestId;

  const handleDecision = useCallback(
    async (approved: boolean) => {
      if (!requestId || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        await resolveApproval(requestId, approved, alwaysAllow);
        setPendingApproval(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      setSubmitting(false);
    },
    [requestId, submitting, alwaysAllow, resolveApproval, setPendingApproval]
  );

  // Seed the checkbox from the grant already on disk for this request's action,
  // so an action the user previously allowed for the project is visibly remembered.
  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    setAlwaysAllow(false);
    setError(null);
    setCopied(false);

    wailsBridge.isActionAllowed(requestId).then((allowed) => {
      if (!cancelled && allowed) setAlwaysAllow(true);
    });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') {
        handleDecision(false);
      } else if (e.key === 'y' || e.key === 'Y') {
        handleDecision(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestId, handleDecision]);

  if (!pendingApproval) return null;

  const copyDetails = () => {
    if (!pendingApproval.details) return;
    const text =
      typeof pendingApproval.details.command === 'string'
        ? pendingApproval.details.command
        : JSON.stringify(pendingApproval.details, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200" role="presentation">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-[#ff9940]/40 bg-[#141414] p-5 text-xs shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="approval-title">
        {/* Header */}
        <div className="flex items-center gap-3 text-[#ff9940]">
          <div className="p-2.5 rounded-xl bg-[#ff9940]/10 border border-[#ff9940]/25">
            <ShieldAlert className="w-5 h-5 text-[#ff9940]" />
          </div>
          <div>
            <h3 id="approval-title" className="text-sm font-semibold text-zinc-100">Action Requires Approval</h3>
            <p className="text-[11px] text-zinc-500">The CLI agent is waiting for your decision before it continues.</p>
          </div>
        </div>

        {/* Details Card */}
        <div className="p-3.5 rounded-xl bg-[#181818] border border-[#242424] space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-200">{pendingApproval.action}</span>
            {pendingApproval.details && (
              <button
                onClick={copyDetails}
                className="text-[11px] text-zinc-500 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                title="Copy parameters"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>

          <p className="text-zinc-400 text-xs whitespace-pre-wrap select-text">
            {pendingApproval.description}
          </p>

          <div className="grid gap-1 border-t border-[#242424] pt-2 text-[11px]">
            <div className="flex gap-2"><span className="w-20 shrink-0 text-zinc-600">Project</span><span className="truncate font-mono text-zinc-300" title={projectDir}>{projectDir || 'Unavailable'}</span></div>
            {typeof pendingApproval.details?.command === 'string' && (
              <div className="flex gap-2"><span className="w-20 shrink-0 text-zinc-600">Command</span><code className="break-all text-[#ffc799]">{pendingApproval.details.command}</code></div>
            )}
            {typeof pendingApproval.details?.file_path === 'string' && (
              <div className="flex gap-2"><span className="w-20 shrink-0 text-zinc-600">File</span><code className="break-all text-[#ffc799]">{pendingApproval.details.file_path}</code></div>
            )}
          </div>

          {pendingApproval.details && (
            <pre className="p-2.5 rounded-lg bg-[#0c0c0c] text-zinc-300 font-mono text-[11px] overflow-x-auto select-text border border-[#202020]">
              {JSON.stringify(pendingApproval.details, null, 2)}
            </pre>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-[#ff657a]">
            Could not send the decision: {error}
          </p>
        )}

        {/* Footer Controls */}
        <div className="space-y-3 border-t border-[#242424] pt-3">
          <label className="flex cursor-pointer select-none items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={alwaysAllow}
              disabled={submitting}
              onChange={(e) => setAlwaysAllow(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary/30"
            />
            <span><strong className="text-zinc-300">Always allow this exact action</strong><span className="block text-[11px] text-zinc-600">Only this normalized command or file action in this project.</span></span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={submitting}
              onClick={() => handleDecision(false)}
              className="gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject (N)</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={submitting}
              onClick={() => handleDecision(true)}
              className="gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve (Y)</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
