import React, { useEffect, useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  Trash2,
  History,
  ChevronsUpDown,
  Search,
  Pencil,
  Check,
  X,
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
  const { sessions, loaded, error: historyError, refresh, remove, rename } = useHistoryStore();
  const { sessionId, isStreaming, initSession, loadSession, persist, stopTask } = useSessionStore();
  const { status } = useAgentStore();
  const { projectDir, knownProjects, selectProject, setProjectDir, removeProject } = useProjectStore();
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

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

  const busy = isStreaming || status === 'thinking' || status === 'working' || status === 'waiting_for_user';
  const statusLabel = status === 'waiting_for_user' ? 'Waiting' : status[0].toUpperCase() + status.slice(1);
  const normalizedQuery = query.trim().toLowerCase();

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
    return Array.from(map.entries())
      .map(([dir, name]) => ({ dir, name }))
      .filter((project) => !normalizedQuery || `${project.name} ${project.dir}`.toLowerCase().includes(normalizedQuery));
  }, [knownProjects, sessions, projectDir, normalizedQuery]);

  // Group sessions by projectDir
  const sessionsByProject = useMemo(() => {
    const groups = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const dir = s.projectDir || '';
      if (normalizedQuery && !`${s.title} ${s.projectDir}`.toLowerCase().includes(normalizedQuery)) continue;
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(s);
    }
    return groups;
  }, [sessions, normalizedQuery]);

  const confirmInterrupt = () => {
    if (!busy) return true;
    return window.confirm('A CLI task is still active. Stop it and switch sessions?');
  };

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
    if (id === sessionId || !confirmInterrupt()) return;
    try {
      if (busy) await stopTask();
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
    if (!confirmInterrupt()) return;
    try {
      if (busy) await stopTask();
      await persist();
    } catch (err) {
      console.error('Failed to save current session:', err);
    }
    initSession();
    refresh();
  };

  const onNewSessionInProject = async (e: React.MouseEvent, dir: string) => {
    e.stopPropagation();
    if (!confirmInterrupt()) return;
    try {
      if (busy) await stopTask();
      await persist();
    } catch (err) {
      console.error('Failed to save current session:', err);
    }
    if (dir && dir !== projectDir) {
      setProjectDir(dir);
    }
    setExpandedFolders((prev) => ({ ...prev, [dir]: true }));
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

  const beginRename = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setRenameError(null);
    setRenamingId(id);
    setRenameValue(title || 'Untitled session');
  };

  const submitRename = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const title = renameValue.trim();
    if (!title) return;
    try {
      await rename(id, title);
      setRenamingId(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : String(err));
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
    <aside className="w-[285px] shrink-0 flex flex-col h-full bg-[#181715] border-r border-[#282623] text-[#eeeae4] select-none font-sans text-sm wails-no-drag">
      {/* Top Row: Brand Logo + Sidebar Toggle + History Arrows (Matches Antigravity) */}
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#201f1c] border border-[#302e2a] flex items-center justify-center shadow-xs select-none p-1">
            <TwillLogo state={logoState} size={20} onDark={true} />
          </div>
        </div>

      </div>

      {/* New Conversation Button (Full width rounded pill matching Antigravity) */}
      <div className="px-3.5 py-2">
        <button
          onClick={onNewSession}
          disabled={busy}
          className="w-full h-10 flex items-center justify-start gap-2.5 rounded-xl border border-[#33312c] bg-[#22201d] hover:bg-[#2a2825] active:bg-[#2f2d29] disabled:opacity-50 disabled:cursor-not-allowed px-3.5 text-sm font-medium text-[#eeeae4] transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#d9b98a]" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Navigation Link: Conversation History */}
      <div className="px-3 py-1 space-y-0.5 border-b border-[#282623] pb-2.5">
        <button
          onClick={() => refresh()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#96928a] hover:text-[#eeeae4] hover:bg-[#22201d] transition-colors cursor-pointer text-left text-sm"
        >
          <History className="w-4 h-4 text-[#7d7972]" />
          <span className="font-normal">Conversation History</span>
        </button>
      </div>

      {/* Projects Section Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between text-[#88847d]">
        <span className="font-medium text-xs text-[#88847d]">
          Projects
        </span>
        <div className="flex items-center gap-1 text-[#7d7972]">
          <label className="flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 focus-within:border-[#383631] focus-within:bg-[#252320]">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search projects and sessions"
              className="w-20 bg-transparent text-[11px] text-[#eeeae4] outline-none placeholder:text-[#7d7972]"
            />
          </label>
          <button
            onClick={toggleAllFolders}
            title="Toggle all folders"
            className="p-1 rounded hover:bg-[#252320] hover:text-[#eeeae4] transition-colors cursor-pointer"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleOpenFolder}
            title="Add / Open project folder"
            className="p-1 rounded hover:bg-[#252320] hover:text-[#c66b4d] transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Folder & Session Tree */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-0.5">
        {!loaded && sessions.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-[#7d7972]" role="status">
            Loading session history...
          </div>
        )}
        {historyError && (
          <div className="mx-1 mb-2 rounded-lg border border-[#e5484d]/30 bg-[#28201f] p-2.5 text-xs text-[#ff657a]" role="alert">
            <p>{historyError}</p>
            <button type="button" onClick={() => refresh()} className="mt-2 font-semibold text-[#ffc799] hover:underline">Retry</button>
          </div>
        )}
        {projectList.length === 0 && (
          <div className="px-3 py-6 text-center text-[#7d7972]">
            <Folder className="w-5 h-5 mx-auto mb-2 opacity-40 text-[#96928a]" />
            <p className="text-xs">No projects yet.</p>
            <button
              onClick={handleOpenFolder}
              className="mt-1.5 text-xs text-[#c66b4d] hover:underline cursor-pointer"
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
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  isCurrentProject
                    ? 'text-[#eeeae4] bg-[#22201d]'
                    : 'text-[#96928a] hover:text-[#eeeae4] hover:bg-[#1e1d1a]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isExpanded ? (
                    <FolderOpen className={`w-4 h-4 shrink-0 ${isCurrentProject ? 'text-[#d9b98a]' : 'text-[#7d7972]'}`} />
                  ) : (
                    <Folder className={`w-4 h-4 shrink-0 ${isCurrentProject ? 'text-[#d9b98a]' : 'text-[#7d7972]'}`} />
                  )}
                  <span className="truncate font-normal text-sm text-[#d8d5ce]" title={project.dir}>
                    {project.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {/* Antigravity Plus button to create another conversation in this project */}
                  <button
                    type="button"
                    onClick={(e) => onNewSessionInProject(e, project.dir)}
                    title={`New conversation in ${project.name}`}
                    className={`p-1 rounded-md hover:bg-[#33312c] text-[#96928a] hover:text-[#eeeae4] transition-all cursor-pointer ${
                      isCurrentProject ? 'opacity-80 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2] pointer-events-none" />
                  </button>

                  {!isCurrentProject && projectSessions.length === 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProject(project.dir);
                      }}
                      title="Remove folder"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:text-[#e5484d] hover:bg-[#33312c] text-[#7d7972] transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                    </button>
                  )}
                </div>

              </div>

              {/* Sessions Under This Folder */}
              {isExpanded && (
                <div className="pl-4 space-y-0.5 py-0.5">
                  {projectSessions.length === 0 ? (
                    <div className="py-1 px-2 text-xs text-[#7d7972] italic">
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
                          className={`group relative flex items-center justify-between gap-2 rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                            active
                              ? 'bg-[#2b2926] text-[#eeeae4] border border-[#383631] font-medium shadow-xs'
                              : 'text-[#96928a] hover:text-[#eeeae4] hover:bg-[#201f1c] border border-transparent font-normal'
                          } ${busy && !active ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {renamingId === s.id ? (
                            <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={(e) => submitRename(e, s.id)} onClick={(e) => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                aria-label="Session title"
                                className="min-w-0 flex-1 rounded border border-[#c66b4d]/50 bg-[#181715] px-1.5 py-1 text-xs text-[#eeeae4] outline-none"
                              />
                              <button type="submit" title="Save session title" aria-label="Save session title" className="p-1 text-[#99ffe4] hover:bg-[#33312c]"><Check className="h-3.5 w-3.5" /></button>
                              <button type="button" title="Cancel rename" aria-label="Cancel rename" onClick={() => setRenamingId(null)} className="p-1 text-[#96928a] hover:bg-[#33312c]"><X className="h-3.5 w-3.5" /></button>
                            </form>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="truncate text-sm">{s.title || 'Untitled session'}</span>
                              <span className={`shrink-0 text-[10px] ${active && busy ? 'text-[#ffc799]' : 'text-[#7d7972]'}`}>
                                {active ? statusLabel : 'Saved'}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-[#7d7972] font-mono group-hover:hidden">
                              {compactRelativeTime(s.updatedAt, now)}
                            </span>
                            {renamingId !== s.id && (
                              <button
                                onClick={(e) => beginRename(e, s.id, s.title)}
                                title="Rename session"
                                aria-label={`Rename ${s.title || 'session'}`}
                                className="hidden group-hover:flex p-0.5 rounded text-[#7d7972] hover:text-[#eeeae4] transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => onDeleteSession(e, s.id)}
                              title="Delete session"
                              className="hidden group-hover:flex p-0.5 rounded hover:text-[#e5484d] text-[#7d7972] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {renameError && <p role="alert" className="border-t border-[#e5484d]/30 bg-[#28201f] px-3 py-2 text-[11px] text-[#ff657a]">{renameError}</p>}

      <div className="h-3 border-t border-[#282623]" />
    </aside>
  );
}
