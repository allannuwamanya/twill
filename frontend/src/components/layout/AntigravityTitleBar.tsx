import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { wailsBridge } from '../../api/wailsBridge';

export const AntigravityTitleBar: React.FC = () => {
  return (
    <div
      style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      className="h-[34px] w-full bg-[#181715] border-b border-[#282623] flex items-center justify-between pl-3 pr-0 select-none text-xs shrink-0 z-50 font-sans wails-no-drag"
    >
      {/* Left: App Title + Menubar (Matches Antigravity) */}
      <div
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-2 h-full wails-no-drag"
      >
        <span className="font-semibold text-[#eeeae4] text-xs pr-1 tracking-tight select-none">
          Twill
        </span>

        <div className="flex items-center gap-0.5 text-[#88847d]">
          <span className="px-2 py-1 rounded hover:text-[#eeeae4] hover:bg-[#252320] transition-colors cursor-pointer text-xs select-none">
            File
          </span>
          <span className="px-2 py-1 rounded hover:text-[#eeeae4] hover:bg-[#252320] transition-colors cursor-pointer text-xs select-none">
            View
          </span>
          <span className="px-2 py-1 rounded hover:text-[#eeeae4] hover:bg-[#252320] transition-colors cursor-pointer text-xs select-none">
            Window
          </span>
        </div>
      </div>

      {/* Center: Draggable Space */}
      <div
        style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
        onDoubleClick={() => wailsBridge.windowToggleMaximise()}
        className="flex-1 h-full cursor-default select-none wails-drag"
      />

      {/* Right: Antigravity Desktop Window Controls (- □ ✕) */}
      <div
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
        className="flex items-center h-full wails-no-drag"
      >
        {/* Minimize (-) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            wailsBridge.windowMinimise();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title="Minimize"
          style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
          className="w-11 h-full flex items-center justify-center text-[#88847d] hover:text-[#eeeae4] hover:bg-[#282623] active:bg-[#33312c] transition-colors cursor-pointer select-none wails-no-drag pointer-events-auto"
        >
          <Minus className="w-3.5 h-3.5 stroke-[1.75] pointer-events-none" />
        </button>

        {/* Maximize (□ square matching Antigravity) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            wailsBridge.windowToggleMaximise();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title="Maximize"
          style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
          className="w-11 h-full flex items-center justify-center text-[#88847d] hover:text-[#eeeae4] hover:bg-[#282623] active:bg-[#33312c] transition-colors cursor-pointer select-none wails-no-drag pointer-events-auto"
        >
          <Square className="w-3 h-3 stroke-[1.5] pointer-events-none" />
        </button>

        {/* Close (✕) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            wailsBridge.quit();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title="Close"
          style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
          className="w-11 h-full flex items-center justify-center text-[#88847d] hover:text-white hover:bg-[#e5484d] active:bg-[#d03b40] transition-colors cursor-pointer select-none wails-no-drag pointer-events-auto"
        >
          <X className="w-3.5 h-3.5 stroke-[1.75] pointer-events-none" />
        </button>
      </div>
    </div>
  );
};


