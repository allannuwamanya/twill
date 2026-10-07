import React, { useState } from 'react';
import { ExternalLink, FolderOpen, Trash2 } from 'lucide-react';
import { useProjectStore } from '../../../stores/useProjectStore';

export const ProjectOnboarding: React.FC = () => {
  const { knownProjects, selectProject, setProjectDir, removeProject, revealProject } = useProjectStore();
  const [error, setError] = useState<string | null>(null);

  const openProject = async () => {
    setError(null);
    try {
      await selectProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the project picker.');
    }
  };

  const reveal = async (dir: string) => {
    setError(null);
    try {
      await revealProject(dir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reveal this project.');
    }
  };

  return (
    <section className="w-full max-w-2xl rounded-2xl border border-[#383631] bg-[#282724] p-5 text-left shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c66b4d]/30 bg-[#c66b4d]/10 text-[#d47859]">
          <FolderOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#c66b4d]">Project workspace</p>
          <h1 className="mt-1 text-xl font-medium text-[#eeeae4]">Open a project to begin</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#96928a]">
            Twill runs the installed CLI agent inside the folder you choose. Your files and session data stay on this machine.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={openProject}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#c66b4d] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d47859] focus:outline-none focus:ring-2 focus:ring-[#c66b4d]/50"
      >
        <FolderOpen className="h-4 w-4" />
        Open project folder
      </button>

      {knownProjects.length > 0 && (
        <div className="mt-6 border-t border-[#383631] pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7d7972]">Recent projects</h2>
            <span className="text-[11px] text-[#7d7972]">Stored locally</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {knownProjects.slice(0, 5).map((project) => (
              <div key={project.dir} className="group flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 hover:border-[#383631] hover:bg-[#302e2a]">
                <button
                  type="button"
                  onClick={() => setProjectDir(project.dir)}
                  className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-[#c66b4d]/40"
                  title={project.dir}
                >
                  <span className="block truncate text-sm font-medium text-[#d8d5ce]">{project.name}</span>
                  <span className="block truncate text-[11px] text-[#7d7972]">{project.dir}</span>
                </button>
                <button
                  type="button"
                  onClick={() => reveal(project.dir)}
                  className="rounded-md p-1.5 text-[#7d7972] opacity-0 transition-opacity hover:bg-[#383631] hover:text-[#eeeae4] group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#c66b4d]/40"
                  title="Reveal project in file manager"
                  aria-label={`Reveal ${project.name} in file manager`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeProject(project.dir)}
                  className="rounded-md p-1.5 text-[#7d7972] opacity-0 transition-opacity hover:bg-[#383631] hover:text-[#e5484d] group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#e5484d]/40"
                  title="Remove from recent projects"
                  aria-label={`Remove ${project.name} from recent projects`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-[#e5484d]/30 bg-[#28201f] px-3 py-2 text-xs text-[#ff657a]">
          {error}
        </p>
      )}
    </section>
  );
};
