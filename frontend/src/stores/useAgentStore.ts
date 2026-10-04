import { create } from 'zustand';
import {
  AgentStatus,
  ToolCallPayload,
  PermissionRequestPayload,
  QuestionPayload,
  PlanPayload,
  DiffPayload,
  Event,
  StatusPayload,
  MessageChunkPayload,
} from '../types/events';
import { wailsBridge } from '../api/wailsBridge';

interface AgentState {
  status: AgentStatus;
  statusMessage: string;
  activeAdapter: string;
  toolCalls: ToolCallPayload[];
  pendingApproval: PermissionRequestPayload | null;
  pendingQuestion: QuestionPayload | null;
  plan: PlanPayload | null;
  diffs: DiffPayload | null;

  // Actions
  setStatus: (status: AgentStatus, message?: string) => void;
  setActiveAdapter: (adapter: string) => Promise<void>;
  addToolCall: (tool: ToolCallPayload) => void;
  updateToolCall: (tool: ToolCallPayload) => void;
  setPendingApproval: (approval: PermissionRequestPayload | null) => void;
  setPendingQuestion: (question: QuestionPayload | null) => void;
  setPlan: (plan: PlanPayload | null) => void;
  setDiffs: (diffs: DiffPayload | null) => void;
  handleEvent: (event: Event) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  status: 'idle',
  statusMessage: 'Ready',
  activeAdapter: 'mock',
  toolCalls: [],
  pendingApproval: null,
  pendingQuestion: null,
  plan: null,
  diffs: null,

  setStatus: (status, message = '') =>
    set({ status, statusMessage: message }),

  setActiveAdapter: async (adapterId: string) => {
    await wailsBridge.setActiveAdapter(adapterId);
    set({ activeAdapter: adapterId });
  },

  addToolCall: (tool) =>
    set((state) => ({ toolCalls: [...state.toolCalls, tool] })),

  updateToolCall: (updated) =>
    set((state) => ({
      toolCalls: state.toolCalls.map((t) =>
        t.toolId === updated.toolId ? { ...t, ...updated } : t
      ),
    })),

  setPendingApproval: (pendingApproval) => set({ pendingApproval }),
  setPendingQuestion: (pendingQuestion) => set({ pendingQuestion }),
  setPlan: (plan) => set({ plan }),
  setDiffs: (diffs) => set({ diffs }),

  handleEvent: (event: Event) => {
    switch (event.type) {
      case 'status_change': {
        const payload = event.payload as StatusPayload;
        get().setStatus(payload.status, payload.message);
        break;
      }
      case 'tool_start': {
        const payload = event.payload as ToolCallPayload;
        get().addToolCall(payload);
        break;
      }
      case 'tool_end': {
        const payload = event.payload as ToolCallPayload;
        get().updateToolCall(payload);
        break;
      }
      case 'permission_request': {
        const payload = event.payload as PermissionRequestPayload;
        set({ pendingApproval: payload, status: 'waiting_for_user' });
        break;
      }
      case 'question': {
        const payload = event.payload as QuestionPayload;
        set({ pendingQuestion: payload, status: 'waiting_for_user' });
        break;
      }
      case 'plan': {
        const payload = event.payload as PlanPayload;
        set({ plan: payload });
        break;
      }
      case 'diff': {
        const payload = event.payload as DiffPayload;
        set({ diffs: payload });
        break;
      }
      default:
        break;
    }
  },

  reset: () =>
    set({
      status: 'idle',
      statusMessage: 'Ready',
      toolCalls: [],
      pendingApproval: null,
      pendingQuestion: null,
      plan: null,
      diffs: null,
    }),
}));
