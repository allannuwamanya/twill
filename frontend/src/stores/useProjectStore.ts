import { create } from 'zustand';
import { wailsBridge } from '../api/wailsBridge';

interface ProjectState {
  projectDir: string;
  projectName: string;
  setProjectDir: (dir: string) => void;
  selectProject: () => Promise<string>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectDir: '',
  projectName: '',

  setProjectDir: (dir: string) => {
    const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
    set({ projectDir: dir, projectName: name });
    wailsBridge.setProjectDirectory(dir);
  },

  selectProject: async () => {
    const dir = await wailsBridge.selectProjectDirectory();
    if (dir) {
      const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
      set({ projectDir: dir, projectName: name });
    }
    return dir;
  },
}));
