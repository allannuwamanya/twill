import React, { useState, useRef } from 'react';
import { ArrowRight, Square, ChevronUp, Plus, Loader2 } from 'lucide-react';
import { useSessionStore } from '../../../stores/useSessionStore';
import { useProjectStore } from '../../../stores/useProjectStore';
import { useAgentStore } from '../../../stores/useAgentStore';

interface ChatInputProps {
  mode?: 'docked' | 'centered';
  initialPrompt?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ mode = 'docked' }) => {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendPrompt, isStreaming, stopTask } = useSessionStore();
  const { projectDir, selectProject } = useProjectStore();
  const { status, statusMessage, activeAdapter } = useAgentStore();

  const isBusy = isStreaming || status === 'working' || status === 'thinking';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isBusy) return;

    const text = prompt.trim();

    if (!projectDir) {
      try {
        const dir = await selectProject();
        if (!dir) return;
      } catch (err) {
        console.error('Failed to select project directory:', err);
        return;
      }
    }

    setPrompt('');
    await sendPrompt(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTriggerPlus = () => {
    setPrompt((prev) => (prev.endsWith('@') ? prev : prev ? `${prev} @` : '@'));
    textareaRef.current?.focus();
  };

  return (
    <div className={mode === 'centered' ? 'w-full' : 'px-5 pb-5 pt-1 shrink-0 bg-transparent'}>
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Antigravity Running Task Strip */}
        {isBusy && (
          <div className="bg-[#242320] rounded-xl px-4 py-2 border border-[#383631] flex items-center justify-between text-xs shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <Loader2 className="w-3.5 h-3.5 text-[#c66b4d] animate-spin shrink-0" />
              <div className="flex items-center gap-2 truncate">
                <span className="text-[#96928a] text-[11px]">1 task running</span>
                <span className="text-[#eeeae4] font-mono text-xs truncate max-w-lg">
                  {statusMessage || './build/bin/twill'}
                </span>
              </div>
            </div>
            <button
              onClick={stopTask}
              title="Stop task"
              className="w-5 h-5 rounded flex items-center justify-center bg-[#e5484d]/15 hover:bg-[#e5484d] text-[#e5484d] hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
            </button>
          </div>
        )}

        {/* Elevated Chat Card with Antigravity layout & warm palette */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            textareaRef.current?.focus();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            textareaRef.current?.focus();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded-2xl bg-[#282724] border border-[#383631] hover:border-[#423f39] focus-within:border-[#4d4a43] focus-within:ring-1 focus-within:ring-[#4d4a43]/20 shadow-xl transition-all p-3.5 cursor-text pointer-events-auto"
        >
          {/* Prompt textarea */}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Ask Twill"
            placeholder="Ask anything, @ to mention, / for actions"
            rows={mode === 'centered' ? 3 : 2}
            className="w-full bg-transparent resize-none outline-none text-[14px] text-[#eeeae4] placeholder:text-[#7d7972] select-text leading-relaxed font-sans px-1 cursor-text pointer-events-auto"
          />

          {/* Bottom toolbar inside chat box */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="pt-2 flex items-center justify-between border-t border-[#33312c] select-none cursor-default"
          >
            {/* Left: + and Model Selector (Matches Antigravity) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerPlus}
                title="Add context (@)"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#96928a] hover:text-[#eeeae4] hover:bg-[#33312c] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2]" />
              </button>

              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#201f1d] text-xs text-[#96928a] hover:text-[#eeeae4] transition-colors cursor-pointer select-none"
                title="Active Engine Model"
              >
                <span className="font-sans font-medium text-xs">
                  {activeAdapter === 'claude' ? 'Claude 3.7 Sonnet' : 'Twill Engine High'}
                </span>
                <ChevronUp className="w-3 h-3 text-[#7d7972]" />
              </div>
            </div>

            {/* Right: Circular Send Button with Right Arrow (→) */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!prompt.trim() || isBusy}
              title="Send message"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-xs ${
                prompt.trim() && !isBusy
                  ? 'bg-[#c66b4d] hover:bg-[#d47859] active:bg-[#b85f42] text-white cursor-pointer'
                  : 'bg-[#33312c] text-[#716e68] cursor-not-allowed opacity-60'
              }`}
            >
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
