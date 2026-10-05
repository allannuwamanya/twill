import React, { useMemo } from 'react';
import { parseUnifiedDiff, buildSplitRows } from '../utils/diffParser';

interface DiffViewerProps {
  diffText: string;
  viewMode: 'split' | 'inline';
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText, viewMode }) => {
  const parsedLines = useMemo(() => parseUnifiedDiff(diffText), [diffText]);
  const splitRows = useMemo(() => buildSplitRows(parsedLines), [parsedLines]);

  if (!diffText.trim()) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500">
        No diff available for this file.
      </div>
    );
  }

  if (viewMode === 'inline') {
    return (
      <div className="overflow-x-auto font-mono text-xs select-text bg-[#0c0c0c]">
        <table className="w-full border-collapse">
          <tbody>
            {parsedLines.map((line, idx) => {
              if (line.type === 'header') {
                return (
                  <tr key={idx} className="bg-[#141414] text-zinc-500 italic border-y border-[#202020]">
                    <td colSpan={3} className="px-3 py-1 text-[11px]">
                      {line.text}
                    </td>
                  </tr>
                );
              }

              const isAdded = line.type === 'added';
              const isDeleted = line.type === 'deleted';

              return (
                <tr
                  key={idx}
                  className={`leading-relaxed ${
                    isAdded
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : isDeleted
                      ? 'bg-red-500/10 text-[#ff657a]'
                      : 'hover:bg-[#151515] text-zinc-300'
                  }`}
                >
                  {/* Old line number */}
                  <td className="w-12 px-2 py-0.5 text-right text-zinc-600 select-none border-r border-[#1f1f1f] text-[11px]">
                    {line.oldLineNumber || ''}
                  </td>
                  {/* New line number */}
                  <td className="w-12 px-2 py-0.5 text-right text-zinc-600 select-none border-r border-[#1f1f1f] text-[11px]">
                    {line.newLineNumber || ''}
                  </td>
                  {/* Content with prefix */}
                  <td className="px-3 py-0.5 whitespace-pre">
                    <span className="inline-block w-4 text-zinc-500 select-none font-bold">
                      {isAdded ? '+' : isDeleted ? '-' : ' '}
                    </span>
                    {line.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Split / Side-by-Side Mode
  return (
    <div className="overflow-x-auto font-mono text-xs select-text bg-[#0c0c0c]">
      <table className="w-full border-collapse table-fixed">
        <tbody>
          {splitRows.map((row, idx) => {
            const isHeader = row.left?.type === 'header';
            if (isHeader) {
              return (
                <tr key={idx} className="bg-[#141414] text-zinc-500 italic border-y border-[#202020]">
                  <td colSpan={4} className="px-3 py-1 text-[11px]">
                    {row.left?.text}
                  </td>
                </tr>
              );
            }

            const leftDeleted = row.left?.type === 'deleted';
            const rightAdded = row.right?.type === 'added';

            return (
              <tr key={idx} className="leading-relaxed border-b border-[#181818]">
                {/* Left (Old) Side */}
                <td className="w-12 px-2 py-0.5 text-right text-zinc-600 select-none border-r border-[#1f1f1f] text-[11px] bg-[#101010]">
                  {row.left?.oldLineNumber || ''}
                </td>
                <td
                  className={`w-1/2 px-3 py-0.5 whitespace-pre border-r border-[#1f1f1f] ${
                    leftDeleted ? 'bg-red-500/10 text-[#ff657a]' : 'text-zinc-300'
                  }`}
                >
                  {row.left && (
                    <>
                      <span className="inline-block w-4 text-zinc-500 select-none font-bold">
                        {leftDeleted ? '-' : ' '}
                      </span>
                      {row.left.text}
                    </>
                  )}
                </td>

                {/* Right (New) Side */}
                <td className="w-12 px-2 py-0.5 text-right text-zinc-600 select-none border-r border-[#1f1f1f] text-[11px] bg-[#101010]">
                  {row.right?.newLineNumber || ''}
                </td>
                <td
                  className={`w-1/2 px-3 py-0.5 whitespace-pre ${
                    rightAdded ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-300'
                  }`}
                >
                  {row.right && (
                    <>
                      <span className="inline-block w-4 text-zinc-500 select-none font-bold">
                        {rightAdded ? '+' : ' '}
                      </span>
                      {row.right.text}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
