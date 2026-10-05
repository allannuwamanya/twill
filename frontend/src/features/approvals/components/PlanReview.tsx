import React, { useState } from 'react';
import { ListTodo, CheckCircle2, Circle, Clock, AlertCircle, Check, X, MessageSquare } from 'lucide-react';
import { PlanPayload } from '../../../types/events';
import { useSessionStore } from '../../../stores/useSessionStore';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';

interface PlanReviewProps {
  plan: PlanPayload;
  approved?: boolean;
}

export const PlanReview: React.FC<PlanReviewProps> = ({ plan, approved }) => {
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { submitPlanDecision } = useSessionStore();

  // Only a real boolean is a decision. `undefined` means the plan has not been
  // answered yet and must still show its action buttons.
  const isDecided = typeof approved === 'boolean';

  const handleDecision = async (decision: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPlanDecision(plan.planId, decision, feedback.trim());
      setShowFeedback(false);
    } catch (err) {
      // Leaving the buttons usable lets the user retry instead of being stuck.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-sky-400 shrink-0 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground/60 shrink-0" />;
    }
  };

  const getStepBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Done</Badge>;
      case 'in_progress':
        return <Badge variant="info">In Progress</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="default">Pending</Badge>;
    }
  };

  return (
    <div className="my-3 max-w-4xl mx-auto rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden p-4">
      {/* Plan Header */}
      <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <ListTodo className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary block">
              Proposed Execution Plan
            </span>
            <h4 className="text-sm font-semibold text-foreground">{plan.title}</h4>
          </div>
        </div>

        {isDecided && (
          <div>
            {approved ? (
              <Badge variant="success">Approved</Badge>
            ) : (
              <Badge variant="danger">Rejected</Badge>
            )}
          </div>
        )}
      </div>

      {/* Plan Steps List */}
      <div className="space-y-2 mb-4">
        {plan.steps.map((step) => (
          <div
            key={step.index}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
              step.status === 'in_progress'
                ? 'bg-sky-500/10 border-sky-500/30 text-foreground'
                : step.status === 'completed'
                ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground'
                : 'bg-muted/30 border-border/60 text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {getStepIcon(step.status)}
              <span className="font-mono text-muted-foreground font-medium">#{step.index}</span>
              <span className="truncate text-foreground font-medium select-text">{step.description}</span>
            </div>
            <div className="shrink-0">{getStepBadge(step.status)}</div>
          </div>
        ))}
      </div>

      {/* Decision Controls */}
      {!isDecided && (
        <div className="pt-2 border-t border-border/60 space-y-3">
          {showFeedback && (
            <div className="space-y-2">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Enter feedback or changes requested for this plan..."
                rows={2}
                className="w-full bg-muted/40 border border-border rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setShowFeedback(!showFeedback)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{showFeedback ? 'Hide feedback' : 'Request changes / feedback'}</span>
            </button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => handleDecision(false)}
                className="gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Reject Plan
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submitting}
                onClick={() => handleDecision(true)}
                className="gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Approve & Execute
              </Button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              Could not send the decision: {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
