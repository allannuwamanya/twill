import React, { useEffect, useRef } from 'react';
import { ProjectHeader } from './features/projects/components/ProjectHeader';
import { ChatBubble } from './features/chat/components/ChatBubble';
import { ChatInput } from './features/chat/components/ChatInput';
import { ActivityCard } from './features/activity/components/ActivityCard';
import { ApprovalDialog } from './features/approvals/components/ApprovalDialog';
import { useSessionStore } from './stores/useSessionStore';
import { useAgentStore } from './stores/useAgentStore';
import { useProjectStore } from './stores/useProjectStore';
import { wailsBridge } from './api/wailsBridge';
import { Sparkles, Terminal, Code2 } from 'lucide-react';

export function App() {
  const { messages, streamingContent, isStreaming, handleEvent: handleSessionEvent } = useSessionStore();
  const { toolCalls, handleEvent: handleAgentEvent } = useAgentStore();
  const { projectDir } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to all backend agent events
  useEffect(() => {
    const unsubscribe = wailsBridge.onAgentEvent((event) => {
      handleSessionEvent(event);
      handleAgentEvent(event);
    });

    return () => {
      unsubscribe();
    };
  }, [handleSessionEvent, handleAgentEvent]);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, toolCalls]);

  return (
    <div className="dark flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* Top Header */}
      <ProjectHeader />

      {/* Main Conversation & Activity Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !streamingContent && toolCalls.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto select-none opacity-80">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 text-primary shadow-lg shadow-primary/5">
              <Code2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-2">Welcome to Twill</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Same coding CLI agents. Better interface. Select a local folder and start a coding task without the terminal clutter.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full text-xs">
              <div className="p-3 rounded-xl border border-border/80 bg-card/50 text-left">
                <span className="font-semibold block text-foreground mb-1">⚡ Fast & Local</span>
                <span className="text-muted-foreground">Runs locally on your machine with direct streaming.</span>
              </div>
              <div className="p-3 rounded-xl border border-border/80 bg-card/50 text-left">
                <span className="font-semibold block text-foreground mb-1">🛡️ Safer Approvals</span>
                <span className="text-muted-foreground">Clear permission prompts and diff reviews.</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Past Messages */}
            {messages.map((msg) => (
              <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
            ))}

            {/* Live Tool Activity Cards */}
            {toolCalls.length > 0 && (
              <div className="py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                  Agent Actions
                </div>
                {toolCalls.map((tool) => (
                  <ActivityCard key={tool.toolId} tool={tool} />
                ))}
              </div>
            )}

            {/* Active Streaming Response */}
            {isStreaming && streamingContent && (
              <ChatBubble role="assistant" content={streamingContent} isStreaming />
            )}
          </div>
        )}
      </main>

      {/* Human-in-the-loop Approvals Modal */}
      <ApprovalDialog />

      {/* Bottom Chat Prompt Input */}
      <ChatInput />
    </div>
  );
}

export default App;
