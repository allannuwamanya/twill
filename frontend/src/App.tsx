import React, { useEffect, useRef } from 'react';
import { ProjectHeader } from './features/projects/components/ProjectHeader';
import { ChatBubble } from './features/chat/components/ChatBubble';
import { ChatInput } from './features/chat/components/ChatInput';
import { ActivityCard } from './features/activity/components/ActivityCard';
import { ApprovalDialog } from './features/approvals/components/ApprovalDialog';
import { QuestionPrompt } from './features/approvals/components/QuestionPrompt';
import { PlanReview } from './features/approvals/components/PlanReview';
import { DiffReviewCard } from './features/diff/components/DiffReviewCard';
import { useSessionStore } from './stores/useSessionStore';
import { useAgentStore } from './stores/useAgentStore';
import { useProjectStore } from './stores/useProjectStore';
import { wailsBridge } from './api/wailsBridge';
import { Code2 } from 'lucide-react';

export function App() {
  const {
    timeline,
    streamingContent,
    isStreaming,
    handleEvent: handleSessionEvent,
  } = useSessionStore();
  const { handleEvent: handleAgentEvent } = useAgentStore();
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
  }, [timeline, streamingContent]);

  return (
    <div className="dark flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* Top Header with Directory Selection & Status */}
      <ProjectHeader />

      {/* Main Conversation & Activity Timeline */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
        {timeline.length === 0 && !streamingContent ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto select-none opacity-80">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 text-primary shadow-lg shadow-primary/5">
              <Code2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-2">Welcome to Twill</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Same coding CLI agents. Better interface. Select a local folder and describe your task to get started.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full text-xs">
              <div className="p-3.5 rounded-xl border border-border/80 bg-card/50 text-left">
                <span className="font-semibold block text-foreground mb-1">⚡ Fast & Local</span>
                <span className="text-muted-foreground">Runs locally on your machine with direct streaming.</span>
              </div>
              <div className="p-3.5 rounded-xl border border-border/80 bg-card/50 text-left">
                <span className="font-semibold block text-foreground mb-1">🛡️ Safer Approvals</span>
                <span className="text-muted-foreground">Clear permission prompts and diff reviews.</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto pb-4">
            {/* Chronological Timeline */}
            {timeline.map((entry) => {
              if (entry.type === 'message') {
                return (
                  <ChatBubble
                    key={entry.id}
                    role={entry.role}
                    content={entry.content}
                  />
                );
              }
              if (entry.type === 'tool') {
                return <ActivityCard key={entry.id} tool={entry.tool} />;
              }
              if (entry.type === 'question') {
                return (
                  <QuestionPrompt
                    key={entry.id}
                    question={entry.question}
                    answered={entry.answered}
                    selectedAnswer={entry.selectedAnswer}
                  />
                );
              }
              if (entry.type === 'plan') {
                return (
                  <PlanReview
                    key={entry.id}
                    plan={entry.plan}
                    approved={entry.approved}
                  />
                );
              }
              if (entry.type === 'diff') {
                return (
                  <DiffReviewCard
                    key={entry.id}
                    diff={entry.diff}
                    fileDecisions={entry.fileDecisions}
                    submitted={entry.submitted}
                  />
                );
              }
              return null;
            })}

            {/* Active Streaming Response */}
            {isStreaming && streamingContent && (
              <ChatBubble
                role="assistant"
                content={streamingContent}
                isStreaming
              />
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
