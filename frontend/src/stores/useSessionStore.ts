import { create } from 'zustand';
import { wailsBridge } from '../api/wailsBridge';
import { useProjectStore } from './useProjectStore';
import {
  Event,
  ErrorPayload,
  MessageChunkPayload,
  ToolCallPayload,
  StatusPayload,
  QuestionPayload,
  PlanPayload,
  PermissionRequestPayload,
  DiffPayload,
} from '../types/events';

export type TimelineEntry =
  | { id: string; type: 'message'; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }
  | { id: string; type: 'tool'; tool: ToolCallPayload; timestamp: string }
  | { id: string; type: 'question'; question: QuestionPayload; answered?: boolean; selectedAnswer?: string; timestamp: string }
  | { id: string; type: 'plan'; plan: PlanPayload; approved?: boolean; timestamp: string }
  | { id: string; type: 'approval'; request: PermissionRequestPayload; resolved?: boolean; approved?: boolean; timestamp: string }
  | { id: string; type: 'diff'; diff: DiffPayload; fileDecisions?: Record<string, boolean>; submitted?: boolean; timestamp: string }
  | { id: string; type: 'error'; error: ErrorPayload; timestamp: string };

// Last timeline reference written to disk (or loaded from it); avoids redundant saves.
let lastPersisted: TimelineEntry[] | null = null;

let idCounter = 0;

// Date.now() alone collides when two sessions are created within the same
// millisecond, which overwrites the first on disk. randomUUID is unavailable
// outside secure contexts, so fall back to a monotonic counter.
function newId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
  return `${prefix}_${uuid}`;
}

interface SessionState {
  sessionId: string;
  title: string;
  /** Project directory this session belongs to ('' until the first prompt). */
  sessionProjectDir: string;
  timeline: TimelineEntry[];
  streamingMessageId: string | null;
  streamingContent: string;
  isStreaming: boolean;

  // Actions
  persist: () => Promise<void>;
  loadSession: (id: string) => Promise<void>;
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
  addDiff: (diff: DiffPayload) => void;
  submitDiffReview: (diffId: string, decisions: Record<string, boolean>) => Promise<void>;
  addError: (error: ErrorPayload) => void;
  handleEvent: (event: Event) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: newId('sess'),
  title: '',
  sessionProjectDir: '',
  timeline: [],
  streamingMessageId: null,
  streamingContent: '',
  isStreaming: false,

  initSession: (id) => {
    lastPersisted = null;
    set({
      sessionId: id || newId('sess'),
      title: '',
      sessionProjectDir: '',
      timeline: [],
      streamingMessageId: null,
      streamingContent: '',
      isStreaming: false,
    });
  },

  sendPrompt: async (prompt: string) => {
    if (!prompt.trim()) return;

    const userEntry: TimelineEntry = {
      id: newId('msg'),
      type: 'message',
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date().toISOString(),
    };

    const streamId = newId('agent');

    set((state) => ({
      timeline: [...state.timeline, userEntry],
      streamingMessageId: streamId,
      streamingContent: '',
      isStreaming: true,
      sessionProjectDir: state.sessionProjectDir || useProjectStore.getState().projectDir,
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

  addDiff: (diff) => {
    set((state) => ({
      timeline: [
        ...state.timeline,
        {
          id: diff.diffId,
          type: 'diff',
          diff,
          fileDecisions: {},
          submitted: false,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  },

  submitDiffReview: async (diffId, decisions) => {
    await wailsBridge.sendDiffDecision(diffId, decisions);
    set((state) => ({
      timeline: state.timeline.map((entry) => {
        if (entry.type === 'diff' && entry.diff.diffId === diffId) {
          return {
            ...entry,
            fileDecisions: decisions,
            submitted: true,
          };
        }
        return entry;
      }),
    }));
  },

  addError: (error) => {
    // stderr can repeat the same line; one entry per unique message keeps a
    // chatty failure from burying the conversation.
    const last = get().timeline[get().timeline.length - 1];
    if (last && last.type === 'error' && last.error.message === error.message) {
      return;
    }
    set((state) => ({
      timeline: [
        ...state.timeline,
        {
          id: newId('err'),
          type: 'error',
          error,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  },

  persist: async () => {
    const { sessionId, timeline, title } = get();
    // Skip empty sessions and unchanged (e.g. just-loaded) timelines.
    if (!timeline.length || timeline === lastPersisted) return;

    let nextTitle = title;
    if (!nextTitle) {
      const first = timeline.find((e) => e.type === 'message' && e.role === 'user');
      if (first && first.type === 'message') {
        nextTitle = first.content.replace(/\s+/g, ' ').trim().slice(0, 60);
        set({ title: nextTitle });
      }
    }

    const messageCount = timeline.filter((e) => e.type === 'message').length;
    try {
      await wailsBridge.saveSession(sessionId, nextTitle, messageCount, JSON.stringify(timeline));
      lastPersisted = timeline;
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  },

  loadSession: async (id: string) => {
    const saved = await wailsBridge.loadSession(id);

    let restored: TimelineEntry[] = [];
    try {
      restored = saved.timeline ? (JSON.parse(saved.timeline) as TimelineEntry[]) : [];
    } catch (err) {
      console.error('Corrupt timeline in session', id, err);
    }

    // The agent process that owned these prompts is gone; make them inert.
    restored = restored.map((entry) => {
      if (entry.type === 'approval' && !entry.resolved) return { ...entry, resolved: true, approved: false };
      if (entry.type === 'question' && !entry.answered) return { ...entry, answered: true };
      if (entry.type === 'tool' && entry.tool.status === 'running') {
        return { ...entry, tool: { ...entry.tool, status: 'failed' } };
      }
      return entry;
    });

    lastPersisted = restored;
    set({
      sessionId: saved.id,
      title: saved.title || '',
      sessionProjectDir: saved.projectDir || '',
      timeline: restored,
      streamingMessageId: null,
      streamingContent: '',
      isStreaming: false,
    });
  },

  handleEvent: (event: Event) => {
    switch (event.type) {
      case 'diff': {
        const payload = event.payload as DiffPayload;
        get().addDiff(payload);
        break;
      }
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
      case 'tool_progress': {
        // Partial output for an in-flight tool; merge it without changing status.
        const payload = event.payload as ToolCallPayload;
        get().updateToolCall({ ...payload, status: 'running' });
        break;
      }
      case 'tool_end': {
        const payload = event.payload as ToolCallPayload;
        get().updateToolCall(payload);
        break;
      }
      case 'error': {
        get().addError(event.payload as ErrorPayload);
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
