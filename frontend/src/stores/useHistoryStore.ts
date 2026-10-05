import { create } from 'zustand';
import { wailsBridge } from '../api/wailsBridge';
import { SessionSummary } from '../types/session';
import { useProjectStore } from './useProjectStore';

interface HistoryState {
  sessions: SessionSummary[];
  loaded: boolean;
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  sessions: [],
  loaded: false,

  refresh: async () => {
    const sessions = await wailsBridge.listSessions();
    set({ sessions, loaded: true });
    // Register project directories discovered from saved sessions
    const { addProject } = useProjectStore.getState();
    sessions.forEach((s) => {
      if (s.projectDir) {
        addProject(s.projectDir);
      }
    });
  },

  remove: async (id: string) => {
    await wailsBridge.deleteSession(id);
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
  },
}));

