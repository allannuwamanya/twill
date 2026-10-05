import React, { useEffect, useRef, useState } from 'react';
import { ProjectHeader } from './features/projects/components/ProjectHeader';
import { AntigravityTitleBar } from './components/layout/AntigravityTitleBar';
import { ChatBubble } from './features/chat/components/ChatBubble';
import { ChatInput } from './features/chat/components/ChatInput';
import { ActivityCard } from './features/activity/components/ActivityCard';
import { ErrorCard } from './features/activity/components/ErrorCard';
import { ApprovalDialog } from './features/approvals/components/ApprovalDialog';
import { QuestionPrompt } from './features/approvals/components/QuestionPrompt';
import { PlanReview } from './features/approvals/components/PlanReview';
import { DiffReviewCard } from './features/diff/components/DiffReviewCard';
import { HistorySidebar } from './features/history/components/HistorySidebar';
import { useSessionStore } from './stores/useSessionStore';
import { useHistoryStore } from './stores/useHistoryStore';
import { useAgentStore } from './stores/useAgentStore';
import { useProjectStore } from './stores/useProjectStore';
import { wailsBridge } from './api/wailsBridge';
import { ArrowDown } from 'lucide-react';
import { TwillLogo, TwillLogoState } from './components/ui/TwillLogo';
import { ClaudeSpinner } from './components/ui/ClaudeSpinner';

export function App() {
  const {
    timeline,
    streamingContent,
    isStreaming,
    persist,
    sendPrompt,
    handleEvent: handleSessionEvent,
  } = useSessionStore();
  const refreshHistory = useHistoryStore((s) => s.refresh);
  const { status, handleEvent: handleAgentEvent } = useAgentStore();
  const { projectDir, projectName, selectProject } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Derive Twill logo reactive animation state from agent status
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
    if (scrollRef.current && !showScrollBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timeline, streamingContent, showScrollBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 120;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      setShowScrollBottom(false);
    }
  };

  // Autosave session (debounced)
  useEffect(() => {
    if (isStreaming || timeline.length === 0) return;
    const handle = setTimeout(async () => {
      await persist();
      refreshHistory();
    }, 500);
    return () => clearTimeout(handle);
  }, [timeline, isStreaming, persist, refreshHistory]);

  // Switching project starts fresh session
  useEffect(() => {
    const { sessionProjectDir, timeline: tl, initSession } = useSessionStore.getState();
    if (sessionProjectDir && projectDir && sessionProjectDir !== projectDir && tl.length > 0) {
      initSession();
    }
  }, [projectDir]);

  const handleStarterPrompt = async (promptText: string) => {
    if (!projectDir) {
      try {
        const dir = await selectProject();
        if (!dir) return;
      } catch (err) {
        console.error('Failed to select project:', err);
        return;
      }
    }
    await sendPrompt(promptText);
  };

  const isEmpty = timeline.length === 0 && !streamingContent;

  return (
    <div className="dark flex flex-col h-screen w-screen bg-[#1f1e1b] text-[#eeeae4] overflow-hidden font-sans antialiased">
      {/* Top Application Titlebar with Antigravity window controls */}
      <AntigravityTitleBar />

      {/* Main Workspace Frame */}
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        {/* Hierarchical Folder & Session Sidebar */}
        <HistorySidebar />

        <div className="flex flex-col flex-1 min-w-0 bg-[#1f1e1b] relative">
          {/* Top Workspace Header */}
          <ProjectHeader />

          {/* Main Area: Centered Claude Desktop Empty State vs Timeline */}
          {isEmpty ? (
            <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
              <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center -mt-12">
                {/* Greeting with Twill Knot + Editorial Serif font (Matches Claude Desktop Image 2) */}
                <div className="flex items-center justify-center gap-3.5 mb-6">
                  <div className="w-9 h-9 flex items-center justify-center">
                    <TwillLogo state={logoState} size={32} onDark={true} />
                  </div>
                  <h1 className="font-editorial text-2xl sm:text-3xl text-[#eeeae4] font-normal tracking-normal">
                    Back at it, {projectName || 'Engineer'}
                  </h1>
                </div>

                {/* Centered elevated chat box */}
                <div className="w-full mb-3">
                  <ChatInput mode="centered" />
                </div>

                {/* Subtle suggestion chips matching Claude Desktop warm palette */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl text-left">
                  <button
                    onClick={() =>
                      handleStarterPrompt('Explore this codebase structure and describe key modules and data flows.')
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#282724] hover:bg-[#302e2a] border border-[#383631] text-[11px] text-[#96928a] hover:text-[#eeeae4] transition-colors cursor-pointer"
                  >
                    <span>🔍 Explore architecture</span>
                  </button>

                  <button
                    onClick={() =>
                      handleStarterPrompt('Audit recent changes and git diff for potential bugs or regressions.')
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#282724] hover:bg-[#302e2a] border border-[#383631] text-[11px] text-[#96928a] hover:text-[#eeeae4] transition-colors cursor-pointer"
                  >
                    <span>🐛 Audit & debug</span>
                  </button>

                  <button
                    onClick={() =>
                      handleStarterPrompt('Run the project test suite and verify test coverage.')
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#282724] hover:bg-[#302e2a] border border-[#383631] text-[11px] text-[#96928a] hover:text-[#eeeae4] transition-colors cursor-pointer"
                  >
                    <span>🧪 Run test suite</span>
                  </button>

                  <button
                    onClick={() =>
                      handleStarterPrompt('Review git status, uncommitted changes, and current branch state.')
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#282724] hover:bg-[#302e2a] border border-[#383631] text-[11px] text-[#96928a] hover:text-[#eeeae4] transition-colors cursor-pointer"
                  >
                    <span>📝 Review git diffs</span>
                  </button>
                </div>
              </div>
            </main>
          ) : (
            <>
              {/* Active Conversation Timeline */}
              <main
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-6 py-4 scroll-smooth bg-[#1f1e1b]"
              >
                <div className="space-y-3.5 max-w-4xl mx-auto pb-6 px-2">
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
                    if (entry.type === 'error') {
                      return <ErrorCard key={entry.id} error={entry.error} />;
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

                  {/* Active Claude Generating / Thinking Animated Verb Indicator */}
                  {(isStreaming || status === 'working' || status === 'thinking') && !streamingContent && (
                    <ClaudeSpinner
                      mode="timeline"
                      state={status === 'thinking' ? 'thinking' : isStreaming ? 'streaming' : 'working'}
                    />
                  )}
                </div>

              </main>

              {/* Floating Scroll-to-Bottom Button */}
              {showScrollBottom && (
                <button
                  onClick={scrollToBottom}
                  title="Scroll to bottom"
                  className="absolute bottom-24 right-1/2 translate-x-40 w-7 h-7 rounded-full bg-[#282724] border border-[#383631] text-[#96928a] hover:text-[#eeeae4] flex items-center justify-center shadow-lg transition-all z-20 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Bottom Docked Chat Input */}
              <ChatInput mode="docked" />
            </>
          )}

          {/* Approvals Modal */}
          <ApprovalDialog />
        </div>
      </div>
    </div>
  );
}

export default App;
