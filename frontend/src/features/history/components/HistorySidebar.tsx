import React, { useEffect } from 'react';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useHistoryStore } from '../../../stores/useHistoryStore';
import { useSessionStore } from '../../../stores/useSessionStore';
import { useProjectStore } from '../../../stores/useProjectStore';

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t || Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function HistorySidebar() {
  const { sessions, loaded, refresh, remove } = useHistoryStore();
  const { sessionId, isStreaming, initSession, loadSession, persist } = useSessionStore();
  const { projectDir, setProjectDir } = useProjectStore();

  // Reload the list on mount and whenever the project changes.
  useEffect(() => {
    refresh();
  }, [refresh, projectDir]);

  const busy = isStreaming;

  const open = async (id: string, dir: string) => {
    if (busy || id === sessionId) return;
    try {
      await persist(); // flush unsaved changes of the current session first
      await loadSession(id);
      if (dir && dir !== projectDir) setProjectDir(dir);
    } catch (err) {
      console.error('Failed to open session:', err);
      refresh();
    }
  };

  const onNew = async () => {
    if (busy) return;
    await persist();
    initSession();
    refresh();
  };

  const onDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (busy) return;
    await remove(id);
    if (id === sessionId) initSession();
  };

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-border/80 bg-card/30 select-none">
      <div className="p-3 border-b border-border/80">
        <button
          onClick={onNew}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-card/60 hover:bg-primary/10 hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loaded && sessions.length === 0 && (
          <p className="px-3 py-6 text-xs text-center text-muted-foreground">
            No saved sessions yet. Your conversations are saved locally as you work.
          </p>
        )}

        {sessions.map((s) => {
          const active = s.id === sessionId;
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => open(s.id, s.projectDir)}
              onKeyDown={(e) => e.key === 'Enter' && open(s.id, s.projectDir)}
              className={`group flex items-start gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                active ? 'bg-primary/10 border border-primary/20' : 'border border-transparent hover:bg-card/80'
              } ${busy && !active ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{s.title || 'Untitled session'}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {relativeTime(s.updatedAt)}
                  {!projectDir && s.projectDir ? ` · ${s.projectDir.split('/').filter(Boolean).pop()}` : ''}
                </div>
              </div>
              <button
                onClick={(e) => onDelete(e, s.id)}
                title="Delete session"
                aria-label="Delete session"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
