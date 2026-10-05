import React, { useState, useEffect } from 'react';
import { DiffPayload } from '../../../types/events';
import { FileChangeList } from './FileChangeList';
import { DiffViewer } from './DiffViewer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Columns, AlignJustify, GitPullRequest, Send } from 'lucide-react';
import { useSessionStore } from '../../../stores/useSessionStore';

interface DiffReviewCardProps {
  diff: DiffPayload;
  fileDecisions?: Record<string, boolean>;
  submitted?: boolean;
}

// A file with no recorded decision counts as accepted, matching the review UI.
function decisionsFor(
  files: DiffPayload['files'],
  initial: Record<string, boolean>
): Record<string, boolean> {
  const next: Record<string, boolean> = { ...initial };
  for (const f of files) {
    if (next[f.filePath] === undefined) next[f.filePath] = true;
  }
  return next;
}

export const DiffReviewCard: React.FC<DiffReviewCardProps> = ({
  diff,
  fileDecisions: initialDecisions = {},
  submitted = false,
}) => {
  const [activeFilePath, setActiveFilePath] = useState(diff.files[0]?.filePath || '');
  const [viewMode, setViewMode] = useState<'split' | 'inline'>('split');
  const [decisions, setDecisions] = useState<Record<string, boolean>>(() =>
    decisionsFor(diff.files, initialDecisions)
  );
  const [error, setError] = useState<string | null>(null);

  const { submitDiffReview } = useSessionStore();

  // A useState initializer runs once. Without this, a file added to a diff after
  // mount would have no decision and be submitted as undefined — silently
  // dropped from the review rather than accepted or rejected.
  useEffect(() => {
    setDecisions((prev) => decisionsFor(diff.files, { ...prev, ...initialDecisions }));
  }, [diff.files, initialDecisions]);

  // If the selected file is gone (diff replaced), fall back to the first one.
  useEffect(() => {
    if (!diff.files.some((f) => f.filePath === activeFilePath)) {
      setActiveFilePath(diff.files[0]?.filePath || '');
    }
  }, [diff.files, activeFilePath]);

  const activeFile = diff.files.find((f) => f.filePath === activeFilePath) || diff.files[0];

  const totalAdditions = diff.files.reduce((acc, f) => acc + (f.additions || 0), 0);
  const totalDeletions = diff.files.reduce((acc, f) => acc + (f.deletions || 0), 0);

  const handleFileDecision = (path: string, accepted: boolean) => {
    if (submitted) return;
    setDecisions((prev) => ({ ...prev, [path]: accepted }));
  };

  const handleAcceptAll = () => {
    if (submitted) return;
    setDecisions(decisionsFor(diff.files, {}));
  };

  const handleRejectAll = () => {
    if (submitted) return;
    const next: Record<string, boolean> = {};
    diff.files.forEach((f) => {
      next[f.filePath] = false;
    });
    setDecisions(next);
  };

  const handleSubmit = async () => {
    if (submitted) return;
    try {
      // Send a decision for every file; an absent key would be ignored by the
      // backend and read as "no decision made" rather than "accepted".
      await submitDiffReview(diff.diffId, decisionsFor(diff.files, decisions));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="my-3 max-w-4xl mx-auto rounded-2xl border border-[#242424] bg-[#141414] text-zinc-200 shadow-md overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-[#1f1f1f] bg-[#161616] select-none">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-400">
            <GitPullRequest className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-100">Code Changes</span>
              <span className="text-[11px] font-mono text-emerald-400">+{totalAdditions}</span>
              <span className="text-[11px] font-mono text-[#ff657a]">-{totalDeletions}</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Review and accept or reject changes per file
            </p>
          </div>
        </div>

        {/* View Mode Switcher & Global Actions */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#121212] border border-[#242424] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={`p-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'split' ? 'bg-[#222222] text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Side-by-side view"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Split</span>
            </button>
            <button
              onClick={() => setViewMode('inline')}
              className={`p-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'inline' ? 'bg-[#222222] text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Inline unified view"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Inline</span>
            </button>
          </div>

          {!submitted ? (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRejectAll}
                className="text-xs px-2.5 py-1 text-[#ff657a] border-red-500/25 hover:bg-red-500/10"
              >
                Reject All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcceptAll}
                className="text-xs px-2.5 py-1 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/10"
              >
                Accept All
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                className="gap-1.5 text-xs px-3 py-1 shadow-xs"
              >
                <Send className="w-3 h-3" />
                Submit Review
              </Button>
            </div>
          ) : (
            <Badge variant="success">Review Submitted</Badge>
          )}
        </div>
      </div>

      {/* Main Diff Area: Left File List + Right Diff Viewer */}
      <div className="flex min-h-[300px] max-h-[500px]">
        <FileChangeList
          files={diff.files}
          activeFile={activeFilePath}
          onSelectFile={setActiveFilePath}
          fileDecisions={decisions}
          onFileDecision={handleFileDecision}
          disabled={submitted}
        />

        <div className="flex-1 overflow-auto bg-zinc-950/70">
          {activeFile ? (
            <DiffViewer diffText={activeFile.diffText} viewMode={viewMode} />
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Select a file to view changes.
            </div>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="px-3.5 py-2 text-xs text-destructive border-t border-border/70">
          Could not submit the review: {error}
        </p>
      )}
    </div>
  );
};
