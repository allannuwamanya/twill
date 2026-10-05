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
    <div className="my-3 max-w-4xl mx-auto rounded-2xl border border-[#ff9940]/30 bg-[#141414] shadow-sm overflow-hidden p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#ff9940]/10 border border-[#ff9940]/25 flex items-center justify-center shrink-0 text-[#ff9940] mt-0.5">
          <HelpCircle className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#ff9940] block mb-1">
            Agent Question
          </span>
          <p className="text-xs font-medium text-zinc-100 select-text">{question.question}</p>
        </div>
      </div>

      {answered ? (
        <div className="ml-10 p-2.5 rounded-xl bg-[#181818] border border-[#242424] text-xs flex items-center gap-2 text-zinc-200">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-zinc-500">Your answer:</span>
          <span className="font-semibold text-[#ffc799]">{selectedAnswer}</span>
        </div>
      ) : (
        <div className="ml-10 space-y-3">
          {/* Suggested Option Pills */}
          {question.options && question.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {question.options.map((opt) => (
                <button
                  key={opt.id}
                  disabled={submitting}
                  onClick={() => handleSelect(opt.label)}
                  className="px-3 py-1.5 rounded-lg border border-[#282828] bg-[#181818] hover:bg-[#222222] hover:border-[#ff9940]/40 text-xs text-zinc-200 font-medium transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                className="flex-1 bg-[#181818] border border-[#282828] rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#ff9940]/50"
              />
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={submitting || !customText.trim()}
                className="gap-1 text-xs"
              >
                <Send className="w-3 h-3" />
                Reply
              </Button>
            </form>
          )}

          {error && (
            <p role="alert" className="text-xs text-[#ff657a]">
              Could not send your answer: {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
