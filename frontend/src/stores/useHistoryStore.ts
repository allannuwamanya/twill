import { create } from 'zustand';
import { wailsBridge } from '../api/wailsBridge';
import { SessionSummary } from '../types/session';
import { useProjectStore } from './useProjectStore';

interface HistoryState {
  sessions: SessionSummary[];
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  sessions: [],
  loaded: false,
  error: null,

  refresh: async () => {
    try {
      const sessions = await wailsBridge.listSessions();
      set({ sessions, loaded: true, error: null });
      // Register project directories discovered from saved sessions
      const { addProject } = useProjectStore.getState();
      sessions.forEach((s) => {
        if (s.projectDir) {
          addProject(s.projectDir);
        }
      });
    } catch (err) {
      set({ loaded: true, error: err instanceof Error ? err.message : 'Could not load session history.' });
    }
  },

  remove: async (id: string) => {
    await wailsBridge.deleteSession(id);
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
  },

  rename: async (id: string, title: string) => {
    await wailsBridge.renameSession(id, title);
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, title: title.trim(), updatedAt: new Date().toISOString() } : session
      ),
    }));
  },
}));

