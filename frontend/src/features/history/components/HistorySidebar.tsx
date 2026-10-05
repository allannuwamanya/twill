import React, { useEffect, useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  Trash2,
  History,
  Clock,
  Settings,
  SlidersHorizontal,
  ChevronsUpDown,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { useHistoryStore } from '../../../stores/useHistoryStore';
import { useSessionStore } from '../../../stores/useSessionStore';
import { useAgentStore } from '../../../stores/useAgentStore';
import { useProjectStore, ProjectEntry } from '../../../stores/useProjectStore';
import { TwillLogo, TwillLogoState } from '../../../components/ui/TwillLogo';

function compactRelativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!t || Number.isNaN(t)) return '';
  const diffSec = Math.floor((now - t) / 1000);
  if (diffSec < 60) return 'now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export function HistorySidebar() {
  const { sessions, refresh, remove } = useHistoryStore();
  const { sessionId, isStreaming, initSession, loadSession, persist } = useSessionStore();
  const { status } = useAgentStore();
  const { projectDir, projectName, knownProjects, selectProject, setProjectDir, removeProject } = useProjectStore();
  const [now, setNow] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks'>('chat');

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

  // Expand active project folder by default
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    return projectDir ? { [projectDir]: true } : {};
  });

  useEffect(() => {
    if (projectDir) {
      setExpandedFolders((prev) => ({ ...prev, [projectDir]: true }));
    }
  }, [projectDir]);

  useEffect(() => {
    refresh();
  }, [refresh, projectDir]);

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(handle);
  }, []);

  const busy = isStreaming;

  // Build merged project list from knownProjects + any projectDir in sessions
  const projectList: ProjectEntry[] = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of knownProjects) {
      if (p.dir) map.set(p.dir, p.name);
    }
    for (const s of sessions) {
      if (s.projectDir && !map.has(s.projectDir)) {
        const name = s.projectDir.split(/[\\/]/).filter(Boolean).pop() || s.projectDir;
        map.set(s.projectDir, name);
      }
    }
    if (projectDir && !map.has(projectDir)) {
      const name = projectDir.split(/[\\/]/).filter(Boolean).pop() || projectDir;
      map.set(projectDir, name);
    }
    return Array.from(map.entries()).map(([dir, name]) => ({ dir, name }));
  }, [knownProjects, sessions, projectDir]);

  // Group sessions by projectDir
  const sessionsByProject = useMemo(() => {
    const groups = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const dir = s.projectDir || '';
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(s);
    }
    return groups;
  }, [sessions]);

  const toggleFolder = (dir: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [dir]: !prev[dir],
    }));
  };

  const toggleAllFolders = () => {
    const allExpanded = projectList.every((p) => expandedFolders[p.dir]);
    const next: Record<string, boolean> = {};
    projectList.forEach((p) => {
      next[p.dir] = !allExpanded;
    });
    setExpandedFolders(next);
  };

  const openSession = async (id: string, dir: string) => {
    if (busy || id === sessionId) return;
    try {
      await persist();
      await loadSession(id);
      if (dir && dir !== projectDir) {
        setProjectDir(dir);
      }
    } catch (err) {
      console.error('Failed to open session:', err);
      refresh();
    }
  };

  const onNewSession = async () => {
    if (busy) return;
    try {
      await persist();
    } catch (err) {
      console.error('Failed to save current session:', err);
    }
    initSession();
    refresh();
  };

  const onDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (busy) return;
    try {
      await remove(id);
      if (id === sessionId) initSession();
      refresh();
    } catch (err) {
      console.error('Failed to delete session:', err);
      refresh();
    }
  };

  const handleOpenFolder = async () => {
    if (busy) return;
    try {
      await selectProject();
    } catch (err) {
      console.error('Failed to select project:', err);
    }
  };

  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-[#181715] border-r border-[#282623] text-[#eeeae4] select-none font-sans text-xs">
      {/* Top Brand Logo & Browser Navigation */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Twill brand knot with reactive state */}
          <div className="w-7 h-7 rounded-lg bg-[#201f1c] border border-[#302e2a] flex items-center justify-center shadow-xs select-none p-1">
            <TwillLogo state={logoState} size={20} onDark={true} />
          </div>
          <span className="font-semibold text-[#eeeae4] tracking-tight text-xs">Twill</span>
        </div>

        {/* Browser Nav: Sidebar, Back, Forward */}
        <div className="flex items-center gap-1 text-[#827f78]">
          <button
            onClick={() => {}}
            title="Toggle sidebar"
            className="p-1 rounded-md hover:bg-[#252320] hover:text-[#eeeae4] transition-colors cursor-pointer"
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {}}
            title="Back"
            className="p-1 rounded-md hover:bg-[#252320] hover:text-[#eeeae4] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {}}
            title="Forward"
            className="p-1 rounded-md hover:bg-[#252320] hover:text-[#eeeae4] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Segmented Mode Switcher (Matches Claude Desktop Chat vs Cowork) */}
      <div className="px-3 py-1">
        <div className="grid grid-cols-2 p-0.5 rounded-lg bg-[#22201d] border border-[#2f2d29] text-[11px]">
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-[#2d2b27] text-[#eeeae4] shadow-xs'
                : 'text-[#827f78] hover:text-[#d8d5ce]'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`py-1 rounded-md font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'tasks'
                ? 'bg-[#2d2b27] text-[#eeeae4] shadow-xs'
                : 'text-[#827f78] hover:text-[#d8d5ce]'
            }`}
          >
            <span>Cowork</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-[#383530] text-[#d9b98a]">CLI</span>
          </button>
        </div>
      </div>

      {/* New Chat Action Button */}
      <div className="px-3 py-1.5">
        <button
          onClick={onNewSession}
          disabled={busy}
          className="w-full flex items-center justify-start gap-2 rounded-xl border border-[#33312c] bg-[#22201d] hover:bg-[#282623] active:bg-[#2d2b27] disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-xs font-medium text-[#eeeae4] transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 text-[#96928a]" />
          <span>New chat</span>
        </button>
      </div>

      {/* Navigation Quick Links */}
      <div className="px-2 py-1 space-y-0.5 border-b border-[#282623] pb-2">
        <button
          onClick={() => refresh()}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#96928a] hover:text-[#eeeae4] hover:bg-[#22201d] transition-colors cursor-pointer text-left"
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#7d7972]" />
          <span className="font-normal text-xs">Chats</span>
        </button>
        <button
          onClick={handleOpenFolder}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#96928a] hover:text-[#eeeae4] hover:bg-[#22201d] transition-colors cursor-pointer text-left"
        >
          <Folder className="w-3.5 h-3.5 text-[#7d7972]" />
          <span className="font-normal text-xs">Projects</span>
        </button>
        <button
          onClick={() => {}}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#96928a] hover:text-[#eeeae4] hover:bg-[#22201d] transition-colors cursor-pointer text-left"
        >
          <Clock className="w-3.5 h-3.5 text-[#7d7972]" />
          <span className="font-normal text-xs">Scheduled Tasks</span>
        </button>
      </div>

      {/* Projects Section Header */}
      <div className="px-3 pt-3 pb-1.5 flex items-center justify-between text-[#827f78]">
        <span className="font-medium text-[11px] uppercase tracking-wider text-[#7d7972]">
          Recents & Projects
        </span>
        <div className="flex items-center gap-1 text-[#7d7972]">
          <button
            onClick={() => {}}
            title="Filter projects"
            className="p-1 rounded hover:bg-[#252320] hover:text-[#eeeae4] transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3" />
          </button>
          <button
            onClick={toggleAllFolders}
            title="Toggle all folders"
            className="p-1 rounded hover:bg-[#252320] hover:text-[#eeeae4] transition-colors cursor-pointer"
          >
            <ChevronsUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={handleOpenFolder}
            title="Add / Open project folder"
            className="p-1 rounded hover:bg-[#252320] hover:text-[#c66b4d] transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Folder & Session Tree (Indented, Warm, Claude Desktop Style) */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {projectList.length === 0 && (
          <div className="px-3 py-6 text-center text-[#7d7972]">
            <Folder className="w-5 h-5 mx-auto mb-2 opacity-40 text-[#96928a]" />
            <p className="text-[11px]">No projects yet.</p>
            <button
              onClick={handleOpenFolder}
              className="mt-1 text-[11px] text-[#c66b4d] hover:underline cursor-pointer"
            >
              Open folder
            </button>
          </div>
        )}

        {projectList.map((project) => {
          const isExpanded = !!expandedFolders[project.dir];
          const isCurrentProject = project.dir === projectDir;
          const projectSessions = sessionsByProject.get(project.dir) || [];

          return (
            <div key={project.dir} className="space-y-0.5">
              {/* Folder Row */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleFolder(project.dir)}
                onKeyDown={(e) => e.key === 'Enter' && toggleFolder(project.dir)}
                className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  isCurrentProject
                    ? 'text-[#eeeae4] bg-[#22201d]'
                    : 'text-[#96928a] hover:text-[#eeeae4] hover:bg-[#1e1d1a]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isExpanded ? (
                    <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isCurrentProject ? 'text-[#d9b98a]' : 'text-[#7d7972]'}`} />
                  ) : (
                    <Folder className={`w-3.5 h-3.5 shrink-0 ${isCurrentProject ? 'text-[#d9b98a]' : 'text-[#7d7972]'}`} />
                  )}
                  <span className="truncate font-normal text-xs text-[#d8d5ce]" title={project.dir}>
                    {project.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  {!isCurrentProject && projectSessions.length === 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProject(project.dir);
                      }}
                      title="Remove folder"
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-[#e5484d] text-[#7d7972] transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sessions Under This Folder */}
              {isExpanded && (
                <div className="pl-4 space-y-0.5 py-0.5">
                  {projectSessions.length === 0 ? (
                    <div className="py-1 px-2 text-[11px] text-[#7d7972] italic">
                      No sessions yet
                    </div>
                  ) : (
                    projectSessions.map((s) => {
                      const active = s.id === sessionId;
                      return (
                        <div
                          key={s.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openSession(s.id, s.projectDir)}
                          onKeyDown={(e) => e.key === 'Enter' && openSession(s.id, s.projectDir)}
                          className={`group relative flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 cursor-pointer transition-colors ${
                            active
                              ? 'bg-[#2b2926] text-[#eeeae4] border border-[#383631] font-medium shadow-xs'
                              : 'text-[#96928a] hover:text-[#eeeae4] hover:bg-[#201f1c] border border-transparent font-normal'
                          } ${busy && !active ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="truncate text-xs">
                              {s.title || 'Untitled session'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-[#7d7972] font-mono group-hover:hidden">
                              {compactRelativeTime(s.updatedAt, now)}
                            </span>
                            <button
                              onClick={(e) => onDeleteSession(e, s.id)}
                              title="Delete session"
                              className="hidden group-hover:flex p-0.5 rounded hover:text-[#e5484d] text-[#7d7972] transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Footer: User/Project Badge & Settings (Matches Claude Desktop Image 2) */}
      <div className="p-3 border-t border-[#282623] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[#2b2926] border border-[#3a3833] flex items-center justify-center text-[11px] font-semibold text-[#d9b98a] shrink-0">
            {(projectName || 'T')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-[#eeeae4] truncate leading-tight">
              {projectName || 'twill'}
            </div>
            <div className="text-[10px] text-[#7d7972] leading-tight">
              Local Engine
            </div>
          </div>
        </div>

        <button
          onClick={() => {}}
          title="Settings"
          className="p-1 rounded-md hover:bg-[#252320] text-[#827f78] hover:text-[#eeeae4] transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
