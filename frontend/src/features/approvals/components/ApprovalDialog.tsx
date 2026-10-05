import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldAlert, Check, X, Copy, CheckCheck } from 'lucide-react';
import { useAgentStore } from '../../../stores/useAgentStore';
import { useSessionStore } from '../../../stores/useSessionStore';
import { wailsBridge } from '../../../api/wailsBridge';
import { Button } from '../../../components/ui/Button';

export const ApprovalDialog: React.FC = () => {
  const { pendingApproval, setPendingApproval } = useAgentStore();
  const { resolveApproval } = useSessionStore();
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
      } catch (err) {
        // Never leave the modal up on failure: it blocks the whole session and
        // the user has no way out except a restart.
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
        setPendingApproval(null);
      }
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-[#242424] rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-xs">
        {/* Header */}
        <div className="flex items-center gap-3 text-[#ff9940]">
          <div className="p-2.5 rounded-xl bg-[#ff9940]/10 border border-[#ff9940]/25">
            <ShieldAlert className="w-5 h-5 text-[#ff9940]" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-100">Action Requires Approval</h3>
            <p className="text-zinc-500 text-[11px]">The agent requested permission to run an operation</p>
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
        <div className="flex items-center justify-between gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alwaysAllow}
              disabled={submitting}
              onChange={(e) => setAlwaysAllow(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary/30"
            />
            <span>Always allow this exact action for this project</span>
          </label>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
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
