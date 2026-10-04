import React, { useEffect } from 'react';
import { Folder, Play, Square, Sparkles, Terminal } from 'lucide-react';
import { useProjectStore } from '../../../stores/useProjectStore';
import { useAgentStore } from '../../../stores/useAgentStore';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { wailsBridge } from '../../../api/wailsBridge';

export const ProjectHeader: React.FC = () => {
  const { projectDir, projectName, selectProject, setProjectDir } = useProjectStore();
  const { status, statusMessage, activeAdapter, setActiveAdapter } = useAgentStore();

  useEffect(() => {
    // Check initial project directory and active adapter
    wailsBridge.getProjectDirectory().then((dir) => {
      if (dir) setProjectDir(dir);
    });
    wailsBridge.getActiveAdapter().then((adapter) => {
      if (adapter) useAgentStore.setState({ activeAdapter: adapter });
    });
  }, [setProjectDir]);

  const getStatusBadge = () => {
    switch (status) {
      case 'working':
        return (
          <Badge variant="info" className="animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mr-1.5 animate-ping" />
            Working
          </Badge>
        );
      case 'thinking':
        return (
          <Badge variant="warning">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
            Thinking
          </Badge>
        );
      case 'waiting_for_user':
        return (
          <Badge variant="warning">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
            Action Required
          </Badge>
        );
      case 'done':
        return (
          <Badge variant="success">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
            Done
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="danger">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="default">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5" />
            Idle
          </Badge>
        );
    }
  };

  return (
    <header className="h-14 border-b border-border/60 bg-card/60 backdrop-blur-md px-4 flex items-center justify-between gap-4 shrink-0 select-none">
      {/* Project Selector */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="outline"
          size="sm"
          onClick={selectProject}
          className="gap-2 shrink-0 border-border/80 bg-muted/40 hover:bg-muted"
        >
          <Folder className="w-4 h-4 text-primary" />
          <span className="font-semibold">{projectName || 'Select Project'}</span>
        </Button>

        {projectDir && (
          <span className="text-xs text-muted-foreground truncate font-mono hidden md:inline-block max-w-sm" title={projectDir}>
            {projectDir}
          </span>
        )}
      </div>

      {/* Center Status */}
      <div className="flex items-center gap-2">
        {getStatusBadge()}
        {statusMessage && (
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            {statusMessage}
          </span>
        )}
      </div>

      {/* Right Controls: Adapter switcher */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/60 text-xs">
          <button
            onClick={() => setActiveAdapter('mock')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeAdapter === 'mock'
                ? 'bg-card text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Mock
          </button>
          <button
            onClick={() => setActiveAdapter('claude')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeAdapter === 'claude'
                ? 'bg-card text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-primary" />
            Claude CLI
          </button>
        </div>
      </div>
    </header>
  );
};
