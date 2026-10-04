import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, Copy, CheckCheck } from 'lucide-react';
import { useAgentStore } from '../../../stores/useAgentStore';
import { useSessionStore } from '../../../stores/useSessionStore';
import { Button } from '../../../components/ui/Button';

export const ApprovalDialog: React.FC = () => {
  const { pendingApproval, setPendingApproval } = useAgentStore();
  const { resolveApproval } = useSessionStore();
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pendingApproval) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') {
        handleDecision(false);
      } else if (e.key === 'y' || e.key === 'Y') {
        handleDecision(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingApproval, alwaysAllow]);

  if (!pendingApproval) return null;

  const handleDecision = async (approved: boolean) => {
    await resolveApproval(pendingApproval.requestId, approved, alwaysAllow);
    setPendingApproval(null);
  };

  const copyDetails = () => {
    if (!pendingApproval.details) return;
    const text =
      typeof pendingApproval.details.command === 'string'
        ? pendingApproval.details.command
        : JSON.stringify(pendingApproval.details, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border/90 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 text-amber-400">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">Action Requires Approval</h3>
            <p className="text-xs text-muted-foreground">The agent requested permission to run an operation</p>
          </div>
        </div>

        {/* Details Card */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{pendingApproval.action}</span>
            {pendingApproval.details && (
              <button
                onClick={copyDetails}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                title="Copy parameters"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground whitespace-pre-wrap select-text">
            {pendingApproval.description}
          </p>

          {pendingApproval.details && (
            <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-300 font-mono text-xs overflow-x-auto select-text border border-zinc-800">
              {JSON.stringify(pendingApproval.details, null, 2)}
            </pre>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alwaysAllow}
              onChange={(e) => setAlwaysAllow(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary/30"
            />
            <span>Always allow for this project</span>
          </label>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDecision(false)}
              className="gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject (N)</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
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
