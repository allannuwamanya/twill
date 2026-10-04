import React, { useState } from 'react';
import { ShieldAlert, Check, X, ShieldCheck } from 'lucide-react';
import { useAgentStore } from '../../../stores/useAgentStore';
import { Button } from '../../../components/ui/Button';
import { wailsBridge } from '../../../api/wailsBridge';

export const ApprovalDialog: React.FC = () => {
  const { pendingApproval, setPendingApproval } = useAgentStore();
  const [alwaysAllow, setAlwaysAllow] = useState(false);

  if (!pendingApproval) return null;

  const handleDecision = async (approved: boolean) => {
    await wailsBridge.sendApproval(pendingApproval.requestId, approved, alwaysAllow);
    setPendingApproval(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 shadow-2xl">
        <div className="flex items-center gap-3 mb-4 text-amber-400">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">Action Requires Approval</h3>
            <p className="text-xs text-muted-foreground">The agent wants permission to perform an action</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/50 border border-border/80 text-sm mb-4">
          <div className="font-medium text-foreground mb-1">{pendingApproval.action}</div>
          <div className="text-xs text-muted-foreground whitespace-pre-wrap">{pendingApproval.description}</div>
          {pendingApproval.details && (
            <pre className="mt-2 p-2 rounded-lg bg-zinc-950 text-zinc-300 font-mono text-xs overflow-x-auto">
              {JSON.stringify(pendingApproval.details, null, 2)}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
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
              Reject
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDecision(true)}
              className="gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
