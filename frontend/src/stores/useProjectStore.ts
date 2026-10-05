import { create } from 'zustand';
import { wailsBridge } from '../api/wailsBridge';

export interface ProjectEntry {
  dir: string;
  name: string;
}

const STORAGE_KEY = 'twill_known_projects';

function getStoredProjects(): ProjectEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveProjects(projects: ProjectEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // ignore
  }
}

interface ProjectState {
  projectDir: string;
  projectName: string;
  knownProjects: ProjectEntry[];
  setProjectDir: (dir: string) => void;
  selectProject: () => Promise<string>;
  addProject: (dir: string) => void;
  removeProject: (dir: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectDir: '',
  projectName: '',
  knownProjects: getStoredProjects(),

  addProject: (dir: string) => {
    if (!dir) return;
    const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
    const current = get().knownProjects;
    if (!current.some((p) => p.dir === dir)) {
      const updated = [...current, { dir, name }];
      saveProjects(updated);
      set({ knownProjects: updated });
    }
  },

  removeProject: (dir: string) => {
    const updated = get().knownProjects.filter((p) => p.dir !== dir);
    saveProjects(updated);
    set({ knownProjects: updated });
  },

  setProjectDir: (dir: string) => {
    const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
    set({ projectDir: dir, projectName: name });
    if (dir) {
      get().addProject(dir);
    }
    wailsBridge.setProjectDirectory(dir);
  },

  selectProject: async () => {
    const dir = await wailsBridge.selectProjectDirectory();
    if (dir) {
      const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
      set({ projectDir: dir, projectName: name });
      get().addProject(dir);
    }
    return dir;
  },
}));

