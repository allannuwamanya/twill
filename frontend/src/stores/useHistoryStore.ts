import { create } from 'zustand';
import { wailsBridge } from '../api/wailsBridge';
import { SessionSummary } from '../types/session';

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
  },

  remove: async (id: string) => {
    await wailsBridge.deleteSession(id);
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
  },
}));
