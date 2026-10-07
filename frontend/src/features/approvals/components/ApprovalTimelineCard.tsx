import React from 'react';
import { Check, Clock3, ShieldAlert, X } from 'lucide-react';
import { PermissionRequestPayload } from '../../../types/events';

interface ApprovalTimelineCardProps {
  request: PermissionRequestPayload;
  resolved?: boolean;
  approved?: boolean;
}

export const ApprovalTimelineCard: React.FC<ApprovalTimelineCardProps> = ({ request, resolved, approved }) => {
  const stateLabel = !resolved ? 'Waiting for your decision' : approved ? 'Approved' : 'Rejected';
  const stateClass = !resolved
    ? 'border-[#ff9940]/35 bg-[#2b241d] text-[#ffc799]'
    : approved
    ? 'border-[#2fb67c]/30 bg-[#202923] text-[#99ffe4]'
    : 'border-[#e5484d]/30 bg-[#28201f] text-[#ff657a]';

  return (
    <article className={`my-3 max-w-4xl rounded-xl border p-3.5 ${stateClass}`} aria-label={`Approval ${stateLabel}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {!resolved ? <ShieldAlert className="h-4 w-4" /> : approved ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">{stateLabel}</span>
            {!resolved && <Clock3 className="h-3.5 w-3.5" />}
          </div>
          <p className="mt-1 text-sm font-medium text-[#eeeae4]">{request.action}</p>
          <p className="mt-1 text-xs text-[#d8d5ce]">{request.description}</p>
          {typeof request.details?.command === 'string' && (
            <code className="mt-2 block break-all rounded-md border border-[#383631] bg-[#181715] px-2 py-1.5 text-[11px] text-[#ffc799]">{request.details.command}</code>
          )}
          {typeof request.details?.file_path === 'string' && (
            <code className="mt-2 block break-all rounded-md border border-[#383631] bg-[#181715] px-2 py-1.5 text-[11px] text-[#ffc799]">{request.details.file_path}</code>
          )}
        </div>
      </div>
    </article>
  );
};
