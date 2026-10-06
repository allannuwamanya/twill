import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSessionStore, TimelineEntry } from './useSessionStore';
import { useAgentStore } from './useAgentStore';
import { wailsBridge } from '../api/wailsBridge';

vi.mock('../api/wailsBridge', () => ({
  wailsBridge: {
    startTask: vi.fn().mockResolvedValue(undefined),
    stopTask: vi.fn().mockResolvedValue(undefined),
    sendApproval: vi.fn().mockResolvedValue(undefined),
    sendAnswer: vi.fn().mockResolvedValue(undefined),
    sendPlanDecision: vi.fn().mockResolvedValue(undefined),
    sendDiffDecision: vi.fn().mockResolvedValue(undefined),
    saveSession: vi.fn().mockResolvedValue(undefined),
    loadSession: vi.fn(),
    isActionAllowed: vi.fn().mockResolvedValue(false),
  },
}));

const mockBridge = vi.mocked(wailsBridge);

const state = () => useSessionStore.getState();
const timeline = () => state().timeline;

function event(type: string, payload: unknown, sessionId = state().sessionId) {
  return { id: 'e1', sessionId, type, timestamp: new Date().toISOString(), payload } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  state().initSession();
  useAgentStore.getState().reset();
});

describe('handleEvent routing', () => {
  it('ignores events from another session', () => {
    state().handleEvent(event('error', { code: 'STDERR', message: 'stale' }, 'old-session'));

    expect(timeline()).toHaveLength(0);
  });

  it('keeps agent status unchanged for another session event', () => {
    useAgentStore.getState().handleEvent(
      event('status_change', { status: 'failed', message: 'stale' }, 'old-session')
    );

    expect(useAgentStore.getState().status).toBe('idle');
    expect(useAgentStore.getState().statusMessage).toBe('Ready');
  });

  it('appends an error entry, which used to be dropped entirely', () => {
    state().handleEvent(event('error', { code: 'STDERR', message: 'boom' }));

    expect(timeline()).toHaveLength(1);
    const entry = timeline()[0];
    expect(entry.type).toBe('error');
    if (entry.type === 'error') expect(entry.error.message).toBe('boom');
  });

  it('collapses a repeated identical stderr line', () => {
    const payload = { code: 'STDERR', message: 'same line' };
    state().handleEvent(event('error', payload));
    state().handleEvent(event('error', payload));

    expect(timeline()).toHaveLength(1);
  });

  it('accumulates message chunks and finalizes them into one assistant entry', async () => {
    // Chunks only arrive for a task that sendPrompt started.
    await state().sendPrompt('hi');
    state().handleEvent(event('message_chunk', { content: 'Hel' }));
    state().handleEvent(event('message_chunk', { content: 'lo' }));
    expect(state().streamingContent).toBe('Hello');
    expect(timeline()).toHaveLength(1); // just the user message so far

    state().handleEvent(event('message_complete', { content: 'Hello' }));
    expect(timeline()).toHaveLength(2);
    const entry = timeline()[1];
    expect(entry.type).toBe('message');
    if (entry.type === 'message') expect(entry.content).toBe('Hello');
    expect(state().isStreaming).toBe(false);
  });

  it('updates a running tool to completed', () => {
    state().handleEvent(
      event('tool_start', { toolId: 't1', toolName: 'Read', status: 'running' })
    );
    state().handleEvent(
      event('tool_end', { toolId: 't1', output: 'contents', status: 'completed' })
    );

    const entry = timeline()[0];
    expect(entry.type).toBe('tool');
    if (entry.type === 'tool') {
      expect(entry.tool.status).toBe('completed');
      expect(entry.tool.output).toBe('contents');
    }
  });

  it('keeps a tool running on tool_progress', () => {
    state().handleEvent(
      event('tool_start', { toolId: 't1', toolName: 'Bash', status: 'running' })
    );
    state().handleEvent(
      event('tool_progress', { toolId: 't1', output: 'partial', status: 'running' })
    );

    const entry = timeline()[0];
    if (entry.type === 'tool') {
      expect(entry.tool.status).toBe('running');
      expect(entry.tool.output).toBe('partial');
    }
  });

  it('adds each interactive entry type', () => {
    state().handleEvent(event('question', { questionId: 'q1', question: 'Which?' }));
    state().handleEvent(
      event('plan', { planId: 'p1', title: 'T', steps: [] })
    );
    state().handleEvent(
      event('permission_request', { requestId: 'r1', action: 'Bash', description: 'run' })
    );
    state().handleEvent(
      event('diff', { diffId: 'd1', files: [{ filePath: 'a.go', status: 'modified', diffText: '' }] })
    );

    expect(timeline().map((e) => e.type)).toEqual([
      'question',
      'plan',
      'approval',
      'diff',
    ]);
  });

  it('replaces rather than duplicates an existing plan', () => {
    state().handleEvent(event('plan', { planId: 'p1', title: 'First', steps: [] }));
    state().handleEvent(event('plan', { planId: 'p1', title: 'Second', steps: [] }));

    expect(timeline()).toHaveLength(1);
    const entry = timeline()[0];
    if (entry.type === 'plan') expect(entry.plan.title).toBe('Second');
  });

  it.each(['done', 'failed', 'terminated'] as const)(
    'finalizes streaming on the %s status',
    (status) => {
      state().sendPrompt('hi');
      state().appendStreamChunk('partial output');

      state().handleEvent(event('status_change', { status }));

      expect(state().isStreaming).toBe(false);
      expect(timeline().some((e) => e.type === 'message' && e.role === 'assistant')).toBe(true);
    }
  );

  it('leaves streaming alone on a non-terminal status', () => {
    state().sendPrompt('hi');
    state().handleEvent(event('status_change', { status: 'thinking' }));
    expect(state().isStreaming).toBe(true);
  });
});

describe('sendPrompt', () => {
  it('records the user message and starts streaming', async () => {
    await state().sendPrompt('  do the thing  ');

    expect(mockBridge.startTask).toHaveBeenCalledOnce();
    const entry = timeline()[0];
    if (entry.type === 'message') {
      expect(entry.role).toBe('user');
      expect(entry.content).toBe('do the thing');
    }
    expect(state().isStreaming).toBe(true);
  });

  it('clears streaming when the backend rejects the task', async () => {
    mockBridge.startTask.mockRejectedValueOnce(new Error('no project'));

    await state().sendPrompt('hi');

    // Leaving isStreaming true would lock the composer for the whole session.
    expect(state().isStreaming).toBe(false);
    expect(state().streamingMessageId).toBeNull();
  });

  it('ignores an empty prompt', async () => {
    await state().sendPrompt('   ');
    expect(mockBridge.startTask).not.toHaveBeenCalled();
  });
});

describe('decisions', () => {
  it('propagates a rejection so the UI can retry instead of hanging', async () => {
    mockBridge.sendPlanDecision.mockRejectedValueOnce(new Error('agent gone'));
    state().handleEvent(event('plan', { planId: 'p1', title: 'T', steps: [] }));

    await expect(state().submitPlanDecision('p1', true)).rejects.toThrow('agent gone');
  });

  it('marks an approval resolved', async () => {
    state().handleEvent(
      event('permission_request', { requestId: 'r1', action: 'Bash', description: 'run' })
    );
    await state().resolveApproval('r1', true, true);

    expect(mockBridge.sendApproval).toHaveBeenCalledWith('r1', true, true);
    const entry = timeline()[0];
    if (entry.type === 'approval') {
      expect(entry.resolved).toBe(true);
      expect(entry.approved).toBe(true);
    }
  });
});

describe('persist', () => {
  it('saves a timeline and derives a title from the first user message', async () => {
    await state().sendPrompt('refactor   the parser');
    await state().persist();

    const [id, title, messageCount, json] = mockBridge.saveSession.mock.calls[0];
    expect(title).toBe('refactor the parser');
    expect(messageCount).toBe(1);
    expect(JSON.parse(json)).toHaveLength(1);
    expect(id).toBe(state().sessionId);
  });

  it('skips an empty timeline', async () => {
    await state().persist();
    expect(mockBridge.saveSession).not.toHaveBeenCalled();
  });

  it('skips an unchanged timeline', async () => {
    await state().sendPrompt('once');
    await state().persist();
    await state().persist();
    expect(mockBridge.saveSession).toHaveBeenCalledOnce();
  });
});

describe('session IDs', () => {
  it('does not collide within the same millisecond', () => {
    const ids = new Set(
      Array.from({ length: 200 }, () => {
        state().initSession();
        return state().sessionId;
      })
    );
    expect(ids.size).toBe(200);
  });

  it('initSession with no argument produces a new id, not the old one', () => {
    const first = state().sessionId;
    state().initSession();
    expect(state().sessionId).not.toBe(first);
  });
});

describe('loadSession', () => {
  const saved = (timeline: TimelineEntry[]) => ({
    id: 's-loaded',
    title: 'Loaded',
    projectDir: '/tmp/proj',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    timeline: JSON.stringify(timeline),
  });

  it('makes stale interactive entries inert so they cannot be answered', async () => {
    mockBridge.loadSession.mockResolvedValueOnce(
      saved([
        { id: 'a', type: 'approval', request: { requestId: 'r1', action: 'Bash', description: '' }, timestamp: '' },
        { id: 'q', type: 'question', question: { questionId: 'q1', question: '' }, timestamp: '' },
        { id: 't', type: 'tool', tool: { toolId: 't1', toolName: 'Bash', status: 'running' }, timestamp: '' },
      ])
    );

    await state().loadSession('s-loaded');

    const [approval, question, tool] = timeline();
    if (approval.type === 'approval') expect(approval.resolved).toBe(true);
    if (question.type === 'question') expect(question.answered).toBe(true);
    if (tool.type === 'tool') expect(tool.tool.status).toBe('failed');
  });

  it('survives a corrupt timeline rather than throwing', async () => {
    mockBridge.loadSession.mockResolvedValueOnce({
      id: 's-bad',
      title: '',
      projectDir: '',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      timeline: '{not json',
    });

    await expect(state().loadSession('s-bad')).resolves.toBeUndefined();
    expect(timeline()).toEqual([]);
  });

  it('adopts the loaded session id and project', async () => {
    mockBridge.loadSession.mockResolvedValueOnce(saved([]));
    await state().loadSession('s-loaded');
    expect(state().sessionId).toBe('s-loaded');
    expect(state().sessionProjectDir).toBe('/tmp/proj');
  });
});