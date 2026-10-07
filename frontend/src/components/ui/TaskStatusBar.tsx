import React, { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, CircleStop, Clock3, Loader2, ShieldQuestion } from 'lucide-react';
import { useAgentStore } from '../../stores/useAgentStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { AgentStatus } from '../../types/events';

const statusLabels: Record<AgentStatus, string> = {
  idle: 'Ready',
  thinking: 'Thinking',
  working: 'Working',
  waiting_for_user: 'Waiting for your decision',
  done: 'Done',
  failed: 'Failed',
  terminated: 'Stopped',
};

function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function StatusIcon({ status }: { status: AgentStatus }) {
  if (status === 'thinking' || status === 'working') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }
  if (status === 'waiting_for_user') return <ShieldQuestion className="h-3.5 w-3.5" />;
  if (status === 'done') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'failed') return <CircleAlert className="h-3.5 w-3.5" />;
  if (status === 'terminated') return <CircleStop className="h-3.5 w-3.5" />;
  return <Clock3 className="h-3.5 w-3.5" />;
}

export const TaskStatusBar: React.FC = () => {
  const { status, statusMessage, taskStartedAt, taskFinishedAt } = useAgentStore();
  const stopTask = useSessionStore((state) => state.stopTask);
  const [now, setNow] = useState(() => Date.now());
  const isActive = status === 'thinking' || status === 'working' || status === 'waiting_for_user';
  const isTerminal = status === 'done' || status === 'failed' || status === 'terminated';
  const elapsed = taskStartedAt ? (taskFinishedAt ?? now) - taskStartedAt : 0;

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const tone = status === 'failed'
    ? 'border-[#e5484d]/40 bg-[#28201f] text-[#ff657a]'
    : status === 'terminated'
    ? 'border-[#8c8c8c]/30 bg-[#242320] text-[#d8d5ce]'
    : status === 'waiting_for_user'
    ? 'border-[#ff9940]/40 bg-[#2b241d] text-[#ffc799]'
    : status === 'done'
    ? 'border-[#2fb67c]/35 bg-[#202923] text-[#99ffe4]'
    : 'border-[#383631] bg-[#242320] text-[#d8d5ce]';

  return (
    <div className={`flex min-h-9 items-center justify-between gap-3 border-b px-5 py-1.5 text-xs ${tone}`} role="status" aria-live="polite">
      <div className="flex min-w-0 items-center gap-2">
        <StatusIcon status={status} />
        <span className="shrink-0 font-semibold">{statusLabels[status]}</span>
        {statusMessage && statusMessage !== 'Ready' && (
          <span className="truncate text-[11px] opacity-75" title={statusMessage}>{statusMessage}</span>
        )}
        {(isActive || isTerminal) && taskStartedAt && (
          <span className="shrink-0 font-mono text-[11px] opacity-70">{formatElapsed(elapsed)}</span>
        )}
      </div>
      {isActive && (
        <button
          type="button"
          onClick={stopTask}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#e5484d]/40 px-2 py-1 text-[11px] font-semibold text-[#ff657a] transition-colors hover:bg-[#e5484d] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e5484d]/40"
          title="Stop the active CLI task"
        >
          <CircleStop className="h-3.5 w-3.5" />
          Stop
        </button>
      )}
    </div>
  );
};
