import { create } from 'zustand';
import {
  AgentStatus,
  PermissionRequestPayload,
  Event,
  StatusPayload,
} from '../types/events';
import { useSessionStore } from './useSessionStore';

// This store holds only what is read outside the timeline. Conversation content
// (messages, tools, plans, diffs, questions) lives in useSessionStore's timeline,
// which is the single source of truth — mirroring it here only invited drift.
interface AgentState {
  status: AgentStatus;
  statusMessage: string;
  activeAdapter: string;
  pendingApproval: PermissionRequestPayload | null;
  taskStartedAt: number | null;
  taskFinishedAt: number | null;

  // Actions
  setStatus: (status: AgentStatus, message?: string) => void;
  setPendingApproval: (approval: PermissionRequestPayload | null) => void;
  handleEvent: (event: Event) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  status: 'idle',
  statusMessage: 'Ready',
  activeAdapter: 'claude',
  pendingApproval: null,
  taskStartedAt: null,
  taskFinishedAt: null,

  setStatus: (status, message = '') =>
    set({ status, statusMessage: message }),

  setPendingApproval: (pendingApproval) => set({ pendingApproval }),

  handleEvent: (event: Event) => {
    if (event.sessionId !== useSessionStore.getState().sessionId) return;

    switch (event.type) {
      case 'status_change': {
        const payload = event.payload as StatusPayload;
        const isActive = payload.status === 'thinking' || payload.status === 'working' || payload.status === 'waiting_for_user';
        const isTerminal = payload.status === 'done' || payload.status === 'failed' || payload.status === 'terminated';
        const now = Date.now();
        set({
          status: payload.status,
          statusMessage: payload.message ?? '',
          taskStartedAt: isActive ? get().taskStartedAt ?? now : get().taskStartedAt,
          taskFinishedAt: isTerminal ? now : null,
          // Any status other than waiting means the agent has moved on (answered,
          // stopped, or failed); leaving the prompt up over a dead request would
          // block the session.
          pendingApproval:
            payload.status === 'waiting_for_user' ? get().pendingApproval : null,
        });
        break;
      }
      case 'permission_request': {
        const payload = event.payload as PermissionRequestPayload;
        set({ pendingApproval: payload, status: 'waiting_for_user' });
        break;
      }
      case 'question':
        // Questions render inline in the timeline; only the status chip cares.
        set({ status: 'waiting_for_user' });
        break;
      default:
        break;
    }
  },

  reset: () =>
    set({
      status: 'idle',
      statusMessage: 'Ready',
      pendingApproval: null,
      taskStartedAt: null,
      taskFinishedAt: null,
    }),
}));
