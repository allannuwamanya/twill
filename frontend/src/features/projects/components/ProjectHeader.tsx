import React, { useEffect } from 'react';
import { MoreVertical, PanelRight, SplitSquareVertical } from 'lucide-react';
import { useProjectStore } from '../../../stores/useProjectStore';
import { useAgentStore } from '../../../stores/useAgentStore';
import { useSessionStore } from '../../../stores/useSessionStore';
import { wailsBridge } from '../../../api/wailsBridge';

export const ProjectHeader: React.FC = () => {
  const { projectDir, projectName, selectProject, setProjectDir } = useProjectStore();
  const { status } = useAgentStore();
  const { timeline } = useSessionStore();
  const isBusy = status === 'working' || status === 'thinking';

  // Extract a brief session title from the first user prompt
  const firstUserMessage = timeline.find(
    (e) => e.type === 'message' && e.role === 'user'
  );
  const sessionTitle =
    (firstUserMessage && 'content' in firstUserMessage ? firstUserMessage.content.slice(0, 55) : '') ||
    'New Conversation';

  useEffect(() => {
    wailsBridge.getProjectDirectory().then((dir) => {
      if (dir) setProjectDir(dir);
    });
    wailsBridge.getActiveAdapter().then((adapter) => {
      if (adapter) useAgentStore.setState({ activeAdapter: adapter });
    });
  }, [setProjectDir]);

  return (
    <header className="h-11 border-b border-[#282623] bg-[#1f1e1b] px-5 flex items-center justify-between gap-4 shrink-0 select-none text-sm font-sans">
      {/* Breadcrumb: project / conversation (Exact Antigravity style) */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={selectProject}
          disabled={isBusy}
          title={projectDir || 'Select project directory'}
          className="text-[#d8d5ce] hover:text-[#eeeae4] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
        >
          {projectName || 'twill'}
        </button>

        <span className="text-[#66635c] font-light">/</span>

        <span className="text-[#96928a] truncate max-w-lg font-normal text-sm" title={sessionTitle}>
          {sessionTitle}
        </span>
      </div>

      {/* Right Controls (Matches Antigravity split, more, panel toggles) */}
      <div className="flex items-center gap-1.5 text-[#88847d]">
        <button
          onClick={() => {}}
          title="Split view"
          className="p-1.5 rounded-md hover:bg-[#282724] hover:text-[#eeeae4] transition-colors cursor-pointer"
        >
          <SplitSquareVertical className="w-4 h-4" />
        </button>

        <button
          onClick={() => {}}
          title="More options"
          className="p-1.5 rounded-md hover:bg-[#282724] hover:text-[#eeeae4] transition-colors cursor-pointer"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        <button
          onClick={() => {}}
          title="Toggle panel"
          className="p-1.5 rounded-md hover:bg-[#282724] hover:text-[#eeeae4] transition-colors cursor-pointer"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
