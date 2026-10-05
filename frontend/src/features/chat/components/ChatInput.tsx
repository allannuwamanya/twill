import React, { useState, useRef } from 'react';
import { ArrowUp, ShieldCheck, Zap, Square, ChevronDown, Plus } from 'lucide-react';
import { useSessionStore } from '../../../stores/useSessionStore';
import { useProjectStore } from '../../../stores/useProjectStore';
import { useAgentStore } from '../../../stores/useAgentStore';
import { TwillLogo, TwillLogoState } from '../../../components/ui/TwillLogo';

interface ChatInputProps {
  mode?: 'docked' | 'centered';
  initialPrompt?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ mode = 'docked' }) => {
  const [prompt, setPrompt] = useState('');
  const [askBeforeEdits, setAskBeforeEdits] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendPrompt, isStreaming, stopTask } = useSessionStore();
  const { projectDir, selectProject } = useProjectStore();
  const { status, statusMessage, activeAdapter } = useAgentStore();

  const isBusy = isStreaming || status === 'working' || status === 'thinking';

  const logoState: TwillLogoState = isStreaming
    ? 'streaming'
    : status === 'working'
    ? 'working'
    : status === 'thinking'
    ? 'thinking'
    : status === 'waiting_for_user'
    ? 'waiting'
    : status === 'failed'
    ? 'failed'
    : status === 'done'
    ? 'done'
    : 'idle';

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

  const handleTriggerSlash = () => {
    setPrompt((prev) => (prev.endsWith('/') ? prev : prev ? `${prev} /` : '/'));
    textareaRef.current?.focus();
  };

  return (
    <div className={mode === 'centered' ? 'w-full' : 'px-4 pb-4 pt-1 shrink-0 bg-transparent'}>
      <div className={mode === 'centered' ? 'w-full' : 'max-w-3xl mx-auto'}>
        {/* Warm Elevated Card with tactile border & depth */}
        <div className="rounded-2xl bg-[#282724] border border-[#383631] hover:border-[#423f39] focus-within:border-[#4d4a43] focus-within:ring-1 focus-within:ring-[#4d4a43]/20 shadow-xl transition-all p-3.5">
          {/* Active task running status strip */}
          {isBusy && (
            <div className="bg-[#201f1d] rounded-xl px-3 py-1.5 mb-2.5 border border-[#33312c] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <TwillLogo state={logoState} size={15} onDark={true} />
                <span className="text-[#eeeae4] text-[11px] font-medium shrink-0">Working</span>
                <span className="text-[#96928a] font-mono text-[10px] truncate max-w-md">
                  {statusMessage || 'Processing agent step...'}
                </span>
              </div>
              <button
                onClick={stopTask}
                title="Stop task"
                className="flex items-center gap-1 text-[11px] text-[#96928a] hover:text-[#e5484d] transition-colors cursor-pointer ml-2 shrink-0"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}

          {/* Prompt textarea */}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Ask Twill"
            placeholder="Type / for commands, or ask Twill anything..."
            rows={mode === 'centered' ? 3 : 2}
            className="w-full bg-transparent resize-none outline-none text-xs sm:text-sm text-[#eeeae4] placeholder:text-[#827f78] select-text leading-relaxed font-sans px-1"
          />

          {/* Bottom toolbar inside chat box */}
          <div className="pt-2.5 flex items-center justify-between border-t border-[#33312c] select-none">
            {/* Left: + Attachment & Approval mode pill */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTriggerSlash}
                title="Add attachment or command (/)"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#96928a] hover:text-[#eeeae4] hover:bg-[#33312c] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2]" />
              </button>

              <button
                type="button"
                onClick={() => setAskBeforeEdits(!askBeforeEdits)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#201f1d] hover:bg-[#2c2a27] border border-[#33312c] text-[11px] text-[#d8d5ce] font-normal transition-colors cursor-pointer"
                title="Toggle execution approval mode"
              >
                {askBeforeEdits ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-[#c66b4d]" />
                    <span>Ask before changes</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3 text-[#d9b98a]" />
                    <span>Auto-approve</span>
                  </>
                )}
              </button>
            </div>

            {/* Right: Model Selector & Terracotta Send Button */}
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[#201f1d] text-xs text-[#96928a] hover:text-[#eeeae4] transition-colors cursor-pointer select-none"
                title="Active Agent Adapter"
              >
                <span className="font-sans font-medium text-[11px]">
                  {activeAdapter ? `Claude CLI` : 'Sonnet 3.7'}
                </span>
                <ChevronDown className="w-3 h-3 text-[#7d7972]" />
              </div>

              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!prompt.trim() || isBusy}
                title="Send message"
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  prompt.trim() && !isBusy
                    ? 'bg-[#c66b4d] hover:bg-[#d47859] text-white'
                    : 'bg-[#33312c] text-[#716e68]'
                }`}
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
