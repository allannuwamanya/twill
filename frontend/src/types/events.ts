export type EventType =
  | 'status_change'
  | 'message_chunk'
  | 'message_complete'
  | 'tool_start'
  | 'tool_progress'
  | 'tool_end'
  | 'permission_request'
  | 'question'
  | 'plan'
  | 'diff'
  | 'error';

export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'waiting_for_user'
  | 'done'
  | 'failed'
  | 'terminated';

export interface Event<T = unknown> {
  id: string;
  sessionId: string;
  type: EventType;
  timestamp: string;
  payload: T;
}

export interface StatusPayload {
  status: AgentStatus;
  message?: string;
}

export interface MessageChunkPayload {
  content: string;
}

export interface MessageCompletePayload {
  content: string;
}

export interface ToolCallPayload {
  toolId: string;
  toolName: string;
  input?: Record<string, unknown>;
  output?: string;
  status: 'running' | 'completed' | 'failed';
}

export interface PermissionRequestPayload {
  requestId: string;
  action: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface QuestionOption {
  id: string;
  label: string;
}

export interface QuestionPayload {
  questionId: string;
  question: string;
  options?: QuestionOption[];
  allowCustom?: boolean;
}

export interface PlanStep {
  index: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface PlanPayload {
  planId: string;
  title: string;
  steps: PlanStep[];
}

export interface FileDiff {
  filePath: string;
  oldPath?: string;
  newPath?: string;
  status: 'modified' | 'added' | 'deleted';
  diffText: string;
}

export interface DiffPayload {
  diffId: string;
  files: FileDiff[];
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: string;
}
