import { create } from 'zustand';
import { wailsBridge } from '../api/wailsBridge';
import {
  Event,
  MessageChunkPayload,
  ToolCallPayload,
  StatusPayload,
  QuestionPayload,
  PlanPayload,
  PermissionRequestPayload,
} from '../types/events';

export type TimelineEntry =
  | { id: string; type: 'message'; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }
  | { id: string; type: 'tool'; tool: ToolCallPayload; timestamp: string }
  | { id: string; type: 'question'; question: QuestionPayload; answered?: boolean; selectedAnswer?: string; timestamp: string }
  | { id: string; type: 'plan'; plan: PlanPayload; approved?: boolean; timestamp: string }
  | { id: string; type: 'approval'; request: PermissionRequestPayload; resolved?: boolean; approved?: boolean; timestamp: string };

interface SessionState {
  sessionId: string;
  timeline: TimelineEntry[];
  streamingMessageId: string | null;
  streamingContent: string;
  isStreaming: boolean;

  // Actions
  initSession: (sessionId?: string) => void;
  sendPrompt: (prompt: string) => Promise<void>;
  stopTask: () => Promise<void>;
  appendStreamChunk: (chunk: string) => void;
  finalizeStreaming: () => void;
  addToolCall: (tool: ToolCallPayload) => void;
  updateToolCall: (tool: ToolCallPayload) => void;
  addQuestion: (question: QuestionPayload) => void;
  answerQuestion: (questionId: string, answer: string) => Promise<void>;
  addOrUpdatePlan: (plan: PlanPayload) => void;
  submitPlanDecision: (planId: string, approved: boolean, feedback?: string) => Promise<void>;
  addApprovalRequest: (request: PermissionRequestPayload) => void;
  resolveApproval: (requestId: string, approved: boolean, alwaysAllow?: boolean) => Promise<void>;
  handleEvent: (event: Event) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: `sess_${Date.now()}`,
  timeline: [],
  streamingMessageId: null,
  streamingContent: '',
  isStreaming: false,

  initSession: (id) => {
    set({
      sessionId: id || `sess_${Date.now()}`,
      timeline: [],
      streamingMessageId: null,
      streamingContent: '',
      isStreaming: false,
    });
  },

  sendPrompt: async (prompt: string) => {
    if (!prompt.trim()) return;

    const userEntry: TimelineEntry = {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date().toISOString(),
    };

    const streamId = `agent_${Date.now()}`;

    set((state) => ({
      timeline: [...state.timeline, userEntry],
      streamingMessageId: streamId,
      streamingContent: '',
      isStreaming: true,
    }));

    try {
      await wailsBridge.startTask(get().sessionId, prompt);
    } catch (err) {
      console.error('Failed to start task:', err);
      set({ isStreaming: false, streamingMessageId: null });
    }
  },

  stopTask: async () => {
    try {
      await wailsBridge.stopTask();
    } catch (err) {
      console.error('Failed to stop task:', err);
    }
    get().finalizeStreaming();
  },

  appendStreamChunk: (chunk: string) => {
    set((state) => ({
      streamingContent: state.streamingContent + chunk,
    }));
  },

  finalizeStreaming: () => {
    const { streamingContent, streamingMessageId, timeline } = get();
    if (streamingMessageId && streamingContent) {
      const assistantEntry: TimelineEntry = {
        id: streamingMessageId,
        type: 'message',
        role: 'assistant',
        content: streamingContent,
        timestamp: new Date().toISOString(),
      };
      set({
        timeline: [...timeline, assistantEntry],
        streamingMessageId: null,
        streamingContent: '',
        isStreaming: false,
      });
    } else {
      set({
        streamingMessageId: null,
        streamingContent: '',
        isStreaming: false,
      });
    }
  },

  addToolCall: (tool) => {
    set((state) => ({
      timeline: [
        ...state.timeline,
        {
          id: tool.toolId,
          type: 'tool',
          tool,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  },

  updateToolCall: (updated) => {
    set((state) => ({
      timeline: state.timeline.map((entry) => {
        if (entry.type === 'tool' && entry.tool.toolId === updated.toolId) {
          return {
            ...entry,
            tool: { ...entry.tool, ...updated },
          };
        }
        return entry;
      }),
    }));
  },

  addQuestion: (question) => {
    set((state) => ({
      timeline: [
        ...state.timeline,
        {
          id: question.questionId,
          type: 'question',
          question,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  },

  answerQuestion: async (questionId, answer) => {
    await wailsBridge.sendAnswer(questionId, answer);
    set((state) => ({
      timeline: state.timeline.map((entry) => {
        if (entry.type === 'question' && entry.question.questionId === questionId) {
          return {
            ...entry,
            answered: true,
            selectedAnswer: answer,
          };
        }
        return entry;
      }),
    }));
  },

  addOrUpdatePlan: (plan) => {
    set((state) => {
      const exists = state.timeline.some(
        (entry) => entry.type === 'plan' && entry.plan.planId === plan.planId
      );
      if (exists) {
        return {
          timeline: state.timeline.map((entry) => {
            if (entry.type === 'plan' && entry.plan.planId === plan.planId) {
              return { ...entry, plan };
            }
            return entry;
          }),
        };
      }
      return {
        timeline: [
          ...state.timeline,
          {
            id: plan.planId,
            type: 'plan',
            plan,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    });
  },

  submitPlanDecision: async (planId, approved, feedback = '') => {
    await wailsBridge.sendPlanDecision(planId, approved, feedback);
    set((state) => ({
      timeline: state.timeline.map((entry) => {
        if (entry.type === 'plan' && entry.plan.planId === planId) {
          return { ...entry, approved };
        }
        return entry;
      }),
    }));
  },

  addApprovalRequest: (request) => {
    set((state) => ({
      timeline: [
        ...state.timeline,
        {
          id: request.requestId,
          type: 'approval',
          request,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  },

  resolveApproval: async (requestId, approved, alwaysAllow = false) => {
    await wailsBridge.sendApproval(requestId, approved, alwaysAllow);
    set((state) => ({
      timeline: state.timeline.map((entry) => {
        if (entry.type === 'approval' && entry.request.requestId === requestId) {
          return {
            ...entry,
            resolved: true,
            approved,
          };
        }
        return entry;
      }),
    }));
  },

  handleEvent: (event: Event) => {
    switch (event.type) {
      case 'message_chunk': {
        const payload = event.payload as MessageChunkPayload;
        get().appendStreamChunk(payload.content);
        break;
      }
      case 'message_complete': {
        get().finalizeStreaming();
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
      case 'question': {
        const payload = event.payload as QuestionPayload;
        get().addQuestion(payload);
        break;
      }
      case 'plan': {
        const payload = event.payload as PlanPayload;
        get().addOrUpdatePlan(payload);
        break;
      }
      case 'permission_request': {
        const payload = event.payload as PermissionRequestPayload;
        get().addApprovalRequest(payload);
        break;
      }
      case 'status_change': {
        const payload = event.payload as StatusPayload;
        if (
          payload.status === 'done' ||
          payload.status === 'failed' ||
          payload.status === 'terminated'
        ) {
          get().finalizeStreaming();
        }
        break;
      }
      default:
        break;
    }
  },
}));
