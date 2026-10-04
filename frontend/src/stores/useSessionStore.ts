import { create } from 'zustand';
import { wailsBridge } from '../api/wailsBridge';
import { Event, MessageChunkPayload, MessageCompletePayload } from '../types/events';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface SessionState {
  sessionId: string;
  messages: ChatMessage[];
  streamingMessageId: string | null;
  streamingContent: string;
  isStreaming: boolean;

  // Actions
  initSession: (sessionId?: string) => void;
  sendPrompt: (prompt: string) => Promise<void>;
  stopTask: () => Promise<void>;
  appendStreamChunk: (chunk: string) => void;
  finalizeStreaming: () => void;
  handleEvent: (event: Event) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: `sess_${Date.now()}`,
  messages: [],
  streamingMessageId: null,
  streamingContent: '',
  isStreaming: false,

  initSession: (id) => {
    set({
      sessionId: id || `sess_${Date.now()}`,
      messages: [],
      streamingMessageId: null,
      streamingContent: '',
      isStreaming: false,
    });
  },

  sendPrompt: async (prompt: string) => {
    if (!prompt.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date().toISOString(),
    };

    const streamId = `agent_${Date.now()}`;

    set((state) => ({
      messages: [...state.messages, userMessage],
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
    await wailsBridge.stopTask();
    get().finalizeStreaming();
  },

  appendStreamChunk: (chunk: string) => {
    set((state) => ({
      streamingContent: state.streamingContent + chunk,
    }));
  },

  finalizeStreaming: () => {
    const { streamingContent, streamingMessageId, messages } = get();
    if (streamingMessageId && streamingContent) {
      const assistantMessage: ChatMessage = {
        id: streamingMessageId,
        role: 'assistant',
        content: streamingContent,
        timestamp: new Date().toISOString(),
      };
      set({
        messages: [...messages, assistantMessage],
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
      case 'status_change': {
        const payload = event.payload as { status: string };
        if (payload.status === 'done' || payload.status === 'failed' || payload.status === 'terminated') {
          get().finalizeStreaming();
        }
        break;
      }
      default:
        break;
    }
  },
}));
