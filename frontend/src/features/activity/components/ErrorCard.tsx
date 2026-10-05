import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ErrorPayload } from '../../../types/events';

interface ErrorCardProps {
  error: ErrorPayload;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ error }) => {
  return (
    <div
      role="alert"
      className="my-3 max-w-3xl mx-auto rounded-2xl border border-[#e5484d]/30 bg-[#28201f] p-3.5 flex items-start gap-3 text-xs text-[#e5484d] shadow-sm"
    >
      <AlertTriangle className="w-4 h-4 text-[#e5484d] shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        {error.code && (
          <span className="font-mono font-semibold uppercase tracking-wider mr-2 text-[#e5484d]">
            {error.code}
          </span>
        )}
        <span className="break-words whitespace-pre-wrap select-text text-[#eeeae4]">
          {error.message}
        </span>
        {error.details && (
          <pre className="mt-2 p-2.5 rounded-xl bg-[#181715] text-[#d8d5ce] font-mono text-[11px] overflow-x-auto select-text border border-[#33312c]">
            {error.details}
          </pre>
        )}
      </div>
    </div>
  );
};