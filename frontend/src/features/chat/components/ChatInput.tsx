import React, { useState } from 'react';
import { Send, Square } from 'lucide-react';
import { useSessionStore } from '../../../stores/useSessionStore';
import { useProjectStore } from '../../../stores/useProjectStore';
import { useAgentStore } from '../../../stores/useAgentStore';
import { Button } from '../../../components/ui/Button';

export const ChatInput: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const { sendPrompt, isStreaming, stopTask } = useSessionStore();
  const { projectDir, selectProject } = useProjectStore();
  const { status } = useAgentStore();

  const isBusy = isStreaming || status === 'working' || status === 'thinking';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isBusy) return;

    const text = prompt.trim();

    // No project yet: ask for one first, then send only if the user picked one.
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

  return (
    <div className="p-4 border-t border-border/60 bg-card/40 backdrop-blur-sm shrink-0">
      <div className="max-w-4xl mx-auto relative rounded-2xl border border-border/80 bg-card/90 shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all p-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Task for the coding agent"
          placeholder={
            !projectDir
              ? 'Select a project folder above or type a task to start...'
              : 'Describe the task for the coding agent (Enter to send, Shift+Enter for newline)...'
          }
          rows={2}
          className="w-full bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground/70 px-2 py-1 select-text"
        />

        <div className="flex items-center justify-between pt-2 px-2 border-t border-border/40">
          <span className="text-xs text-muted-foreground">
            {!projectDir ? '⚠️ No project selected' : '⚡ Local & Private'}
          </span>

          <div className="flex items-center gap-2">
            {isBusy ? (
              <Button
                variant="danger"
                size="sm"
                onClick={stopTask}
                className="gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSubmit()}
                disabled={!prompt.trim()}
                className="gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
