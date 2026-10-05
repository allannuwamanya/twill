import * as AppGo from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { Event } from '../types/events';
import { SessionSummary, SavedSession } from '../types/session';

// wailsBridge isolates Wails runtime interaction from the rest of the UI.
export const wailsBridge = {
  // Directory & Project
  selectProjectDirectory: async (): Promise<string> => {
    try {
      return await AppGo.SelectProjectDirectory();
    } catch (err) {
      console.error('Failed to select directory:', err);
      return '';
    }
  },

  getProjectDirectory: async (): Promise<string> => {
    try {
      return await AppGo.GetProjectDirectory();
    } catch {
      return '';
    }
  },

  setProjectDirectory: async (dir: string): Promise<void> => {
    return AppGo.SetProjectDirectory(dir);
  },

  // Task Control
  startTask: async (sessionId: string, prompt: string): Promise<void> => {
    return AppGo.StartTask(sessionId, prompt);
  },

  stopTask: async (): Promise<void> => {
    return AppGo.StopTask();
  },

  // Approvals & Answers
  sendApproval: async (requestId: string, approved: boolean, alwaysAllow: boolean = false): Promise<void> => {
    return AppGo.SendApproval(requestId, approved, alwaysAllow);
  },

  sendAnswer: async (questionId: string, answer: string): Promise<void> => {
    return AppGo.SendAnswer(questionId, answer);
  },

  sendPlanDecision: async (planId: string, approved: boolean, feedback: string = ''): Promise<void> => {
    return AppGo.SendPlanDecision(planId, approved, feedback);
  },

  sendDiffDecision: async (diffId: string, decisions: Record<string, boolean>): Promise<void> => {
    return AppGo.SendDiffDecision(diffId, decisions);
  },

  getAllowedActions: async (projectDir: string): Promise<string[]> => {
    try {
      return await AppGo.GetAllowedActions(projectDir);
    } catch {
      return [];
    }
  },

  isActionAllowed: async (requestId: string): Promise<boolean> => {
    try {
      return await AppGo.IsActionAllowed(requestId);
    } catch {
      return false;
    }
  },

  // Session history & persistence
  saveSession: async (id: string, title: string, messageCount: number, timelineJson: string): Promise<void> => {
    return AppGo.SaveSession(id, title, messageCount, timelineJson);
  },

  listSessions: async (): Promise<SessionSummary[]> => {
    try {
      return ((await AppGo.ListSessions()) || []) as unknown as SessionSummary[];
    } catch (err) {
      console.error('Failed to list sessions:', err);
      return [];
    }
  },

  loadSession: async (id: string): Promise<SavedSession> => {
    return (await AppGo.LoadSession(id)) as unknown as SavedSession;
  },

  deleteSession: async (id: string): Promise<void> => {
    return AppGo.DeleteSession(id);
  },

  // Adapters
  listAdapters: async (): Promise<Array<Record<string, string>>> => {
    try {
      return await AppGo.ListAdapters();
    } catch {
      return [];
    }
  },

  setActiveAdapter: async (id: string): Promise<void> => {
    return AppGo.SetActiveAdapter(id);
  },

  getActiveAdapter: async (): Promise<string> => {
    try {
      return await AppGo.GetActiveAdapter();
    } catch {
      return 'mock';
    }
  },

  // Event Subscription
  onAgentEvent: (callback: (event: Event) => void): (() => void) => {
    try {
      EventsOn('agent:event', callback);
      return () => {
        EventsOff('agent:event');
      };
    } catch {
      return () => {};
    }
  },
};
