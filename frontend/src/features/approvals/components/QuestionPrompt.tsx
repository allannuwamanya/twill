import React, { useState } from 'react';
import { HelpCircle, Send, Check } from 'lucide-react';
import { QuestionPayload } from '../../../types/events';
import { useSessionStore } from '../../../stores/useSessionStore';
import { Button } from '../../../components/ui/Button';

interface QuestionPromptProps {
  question: QuestionPayload;
  answered?: boolean;
  selectedAnswer?: string;
}

export const QuestionPrompt: React.FC<QuestionPromptProps> = ({
  question,
  answered,
  selectedAnswer,
}) => {
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { answerQuestion } = useSessionStore();

  // `answered` only flips after the round-trip, so without a local guard a
  // second click sends the same answer twice.
  const answer = async (value: string) => {
    if (answered || submitting || !value) return;
    setSubmitting(true);
    setError(null);
    try {
      await answerQuestion(question.questionId, value);
      setCustomText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelect = (value: string) => answer(value);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    answer(customText.trim());
  };

  return (
    <div className="my-3 max-w-4xl mx-auto rounded-2xl border border-sky-500/30 bg-sky-950/20 text-card-foreground shadow-sm overflow-hidden p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 text-sky-400 mt-0.5">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400 block mb-1">
            Agent Question
          </span>
          <p className="text-sm font-medium text-foreground select-text">{question.question}</p>
        </div>
      </div>

      {answered ? (
        <div className="ml-11 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-muted-foreground">Your answer:</span>
          <span className="font-semibold text-emerald-400">{selectedAnswer}</span>
        </div>
      ) : (
        <div className="ml-11 space-y-3">
          {/* Suggested Option Pills */}
          {question.options && question.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {question.options.map((opt) => (
                <button
                  key={opt.id}
                  disabled={submitting}
                  onClick={() => handleSelect(opt.label)}
                  className="px-3 py-1.5 rounded-lg border border-border/80 bg-card hover:bg-muted/80 hover:border-primary/50 text-xs text-foreground font-medium transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Custom text input */}
          {question.allowCustom !== false && (
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={customText}
                disabled={submitting}
                onChange={(e) => setCustomText(e.target.value)}
                aria-label="Custom reply"
                placeholder="Or type a custom reply..."
                className="flex-1 bg-card border border-border/80 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
              />
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={submitting || !customText.trim()}
                className="gap-1"
              >
                <Send className="w-3 h-3" />
                Reply
              </Button>
            </form>
          )}

          {error && (
            <p role="alert" className="text-xs text-destructive">
              Could not send your answer: {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
