import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { wailsBridge } from '../../api/wailsBridge';
import { TwillLogo, TwillLogoState } from '../ui/TwillLogo';
import { useAgentStore } from '../../stores/useAgentStore';
import { useSessionStore } from '../../stores/useSessionStore';

export const AntigravityTitleBar: React.FC = () => {
  const { status } = useAgentStore();
  const { isStreaming } = useSessionStore();

  const logoState: TwillLogoState = isStreaming
    ? 'streaming'
    : status === 'working'
    ? 'working'
    : status === 'thinking'
    ? 'thinking'
    : status === 'waiting_for_user'
    ? 'waiting'
    : status === 'failed'
    ? 'failed'
    : status === 'done'
    ? 'done'
    : 'idle';

  return (
    <div
      style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
      onDoubleClick={() => wailsBridge.windowToggleMaximise()}
      className="h-9 w-full bg-[#181715] border-b border-[#282623] flex items-center justify-between px-3 select-none text-xs shrink-0 z-50"
    >
      {/* Left: App Monogram + Menu Bar (Matches Antigravity File View Window) */}
      <div
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-1.5 h-full"
      >
        <div className="flex items-center gap-1.5 pr-2">
          <TwillLogo state={logoState} size={18} onDark={true} />
          <span className="font-semibold text-[#eeeae4] tracking-tight">Twill</span>
        </div>

        <div className="flex items-center gap-0.5 text-[#96928a]">
          <span className="px-2 py-0.5 rounded-md hover:bg-[#252320] hover:text-[#eeeae4] transition-colors cursor-pointer text-[11px]">
            File
          </span>
          <span className="px-2 py-0.5 rounded-md hover:bg-[#252320] hover:text-[#eeeae4] transition-colors cursor-pointer text-[11px]">
            View
          </span>
          <span className="px-2 py-0.5 rounded-md hover:bg-[#252320] hover:text-[#eeeae4] transition-colors cursor-pointer text-[11px]">
            Window
          </span>
        </div>
      </div>

      {/* Center: Draggable Space */}
      <div className="flex-1 h-full" />

      {/* Right: The Antigravity Circular Window Controls (- □ ✕) */}
      <div
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-1.5"
      >
        {/* Minimize */}
        <button
          type="button"
          onClick={() => wailsBridge.windowMinimise()}
          title="Minimize"
          className="w-5.5 h-5.5 rounded-full bg-[#242220] hover:bg-[#302e2a] border border-[#33312c] flex items-center justify-center text-[#96928a] hover:text-[#eeeae4] transition-all cursor-pointer shadow-2xs"
        >
          <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
        </button>

        {/* Maximize / Restore */}
        <button
          type="button"
          onClick={() => wailsBridge.windowToggleMaximise()}
          title="Maximize"
          className="w-5.5 h-5.5 rounded-full bg-[#242220] hover:bg-[#302e2a] border border-[#33312c] flex items-center justify-center text-[#96928a] hover:text-[#eeeae4] transition-all cursor-pointer shadow-2xs"
        >
          <Square className="w-2 h-2 stroke-[2]" />
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={() => wailsBridge.quit()}
          title="Close"
          className="w-5.5 h-5.5 rounded-full bg-[#242220] hover:bg-[#e5484d] hover:border-[#e5484d] border border-[#33312c] flex items-center justify-center text-[#96928a] hover:text-white transition-all cursor-pointer shadow-2xs"
        >
          <X className="w-2.5 h-2.5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
