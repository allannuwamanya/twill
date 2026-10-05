import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ErrorPayload } from '../../../types/events';

interface ErrorCardProps {
  error: ErrorPayload;
}

// Agent failures are emitted as events; without this they were dropped on the
// floor and the run looked like it simply produced no output.
export const ErrorCard: React.FC<ErrorCardProps> = ({ error }) => {
  return (
    <div
      role="alert"
      className="my-2 max-w-4xl mx-auto rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 flex items-start gap-2.5 text-xs"
    >
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      <div className="min-w-0">
        {error.code && (
          <span className="font-mono font-semibold text-destructive uppercase tracking-wider mr-1.5">
            {error.code}
          </span>
        )}
        <span className="text-destructive break-words whitespace-pre-wrap select-text">
          {error.message}
        </span>
        {error.details && (
          <pre className="mt-1.5 p-2 rounded-lg bg-zinc-950 text-zinc-300 font-mono text-[11px] overflow-x-auto select-text border border-zinc-800">
            {error.details}
          </pre>
        )}
      </div>
    </div>
  );
};