import React, { useState } from 'react';
import { DiffPayload } from '../../../types/events';
import { FileChangeList } from './FileChangeList';
import { DiffViewer } from './DiffViewer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Columns, AlignJustify, GitPullRequest, Check, X, Send } from 'lucide-react';
import { useSessionStore } from '../../../stores/useSessionStore';

interface DiffReviewCardProps {
  diff: DiffPayload;
  fileDecisions?: Record<string, boolean>;
  submitted?: boolean;
}

export const DiffReviewCard: React.FC<DiffReviewCardProps> = ({
  diff,
  fileDecisions: initialDecisions = {},
  submitted = false,
}) => {
  const [activeFilePath, setActiveFilePath] = useState(diff.files[0]?.filePath || '');
  const [viewMode, setViewMode] = useState<'split' | 'inline'>('split');
  const [decisions, setDecisions] = useState<Record<string, boolean>>(() => {
    // Default all files to accepted if not yet decided
    const init: Record<string, boolean> = { ...initialDecisions };
    for (const f of diff.files) {
      if (init[f.filePath] === undefined) {
        init[f.filePath] = true;
      }
    }
    return init;
  });

  const { submitDiffReview } = useSessionStore();

  const activeFile = diff.files.find((f) => f.filePath === activeFilePath) || diff.files[0];

  const totalAdditions = diff.files.reduce((acc, f) => acc + (f.additions || 0), 0);
  const totalDeletions = diff.files.reduce((acc, f) => acc + (f.deletions || 0), 0);

  const handleFileDecision = (path: string, accepted: boolean) => {
    if (submitted) return;
    setDecisions((prev) => ({ ...prev, [path]: accepted }));
  };

  const handleAcceptAll = () => {
    if (submitted) return;
    const next: Record<string, boolean> = {};
    diff.files.forEach((f) => {
      next[f.filePath] = true;
    });
    setDecisions(next);
  };

  const handleRejectAll = () => {
    if (submitted) return;
    const next: Record<string, boolean> = {};
    diff.files.forEach((f) => {
      next[f.filePath] = false;
    });
    setDecisions(next);
  };

  const handleSubmit = () => {
    if (submitted) return;
    submitDiffReview(diff.diffId, decisions);
  };

  return (
    <div className="my-3 max-w-4xl mx-auto rounded-2xl border border-border/80 bg-card text-card-foreground shadow-md overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/70 bg-muted/30 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
            <GitPullRequest className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Code Changes</span>
              <span className="text-[11px] font-mono text-emerald-400">+{totalAdditions}</span>
              <span className="text-[11px] font-mono text-rose-400">-{totalDeletions}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Review and accept or reject changes per file
            </p>
          </div>
        </div>

        {/* View Mode Switcher & Global Actions */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-card border border-border/80 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'split' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'
              }`}
              title="Side-by-side view"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Split</span>
            </button>
            <button
              onClick={() => setViewMode('inline')}
              className={`p-1.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'inline' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'
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
                className="text-xs px-2.5 py-1 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
              >
                Reject All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcceptAll}
                className="text-xs px-2.5 py-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                Accept All
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                className="gap-1.5 text-xs px-3 py-1 shadow-sm"
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
    </div>
  );
};
