export interface SessionSummary {
  id: string;
  projectDir: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface SavedSession {
  id: string;
  projectDir: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** JSON-serialized TimelineEntry[] */
  timeline?: string;
  adapterId?: string;
  agentSessionId?: string;
}
