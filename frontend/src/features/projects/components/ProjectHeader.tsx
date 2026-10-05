import React, { useEffect } from 'react';
import { MoreVertical, PanelRight, Folder } from 'lucide-react';
import { useProjectStore } from '../../../stores/useProjectStore';
import { useAgentStore } from '../../../stores/useAgentStore';
import { useSessionStore } from '../../../stores/useSessionStore';
import { wailsBridge } from '../../../api/wailsBridge';

export const ProjectHeader: React.FC = () => {
  const { projectDir, projectName, selectProject, setProjectDir } = useProjectStore();
  const { status, activeAdapter } = useAgentStore();
  const { timeline } = useSessionStore();
  const isBusy = status === 'working' || status === 'thinking';

  // Extract a brief session title from the first user prompt
  const firstUserMessage = timeline.find(
    (e) => e.type === 'message' && e.role === 'user'
  );
  const sessionTitle =
    (firstUserMessage && 'content' in firstUserMessage ? firstUserMessage.content.slice(0, 45) : '') ||
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
    <header className="h-11 border-b border-[#2b2926] bg-[#1f1e1b] px-4 flex items-center justify-between gap-4 shrink-0 select-none text-xs">
      {/* Breadcrumb: project / conversation */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={selectProject}
          disabled={isBusy}
          title={projectDir || 'Select project directory'}
          className="flex items-center gap-1.5 text-[#96928a] hover:text-[#eeeae4] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <Folder className="w-3.5 h-3.5 text-[#d9b98a]" />
          <span>{projectName || 'Select Project'}</span>
        </button>

        <span className="text-[#55524c]">/</span>

        <span className="text-[#eeeae4] truncate max-w-md font-normal" title={sessionTitle}>
          {sessionTitle}
        </span>
      </div>

      {/* Right Controls: Plan/Adapter pill and panel toggles */}
      <div className="flex items-center gap-2 text-[#96928a]">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#282724] border border-[#383631] text-[11px] text-[#96928a]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2fb67c]" />
          <span>{activeAdapter ? 'Claude CLI' : 'Ready'}</span>
        </div>

        <button
          onClick={() => {}}
          title="More options"
          className="p-1 rounded hover:bg-[#282724] hover:text-[#eeeae4] transition-colors cursor-pointer"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {}}
          title="Toggle side panel"
          className="p-1 rounded hover:bg-[#282724] hover:text-[#eeeae4] transition-colors cursor-pointer"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
