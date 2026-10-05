import React, { useState, useEffect } from 'react';
import { TwillLogo, TwillLogoState } from './TwillLogo';

// Authentic Claude Code spinner verbs
const THINKING_VERBS = [
  'Pondering',
  'Cogitating',
  'Contemplating',
  'Deliberating',
  'Ruminating',
  'Musing',
  'Deciphering',
  'Synthesizing',
  'Connecting the dots',
  'Reasoning',
  'Consulting the oracle',
  'Untangling threads',
  'Percolating',
  'Distilling',
  'Reflecting',
  'Inferring',
];

const WORKING_VERBS = [
  'Sculpting code',
  'Synthesizing',
  'Fabricating',
  'Constructing',
  'Composing',
  'Crafting',
  'Weaving',
  'Twilling',
  'Refining',
  'Architecting',
  'Brewing ideas',
  'Simmering',
  'Caramelizing',
  'Forging',
  'Harmonizing',
  'Polishing',
  'Assembling',
  'Marinating',
];

interface ClaudeSpinnerProps {
  state?: 'thinking' | 'working' | 'streaming' | 'idle';
  mode?: 'timeline' | 'strip' | 'inline';
  detail?: string;
  className?: string;
}

export const ClaudeSpinner: React.FC<ClaudeSpinnerProps> = ({
  state = 'working',
  mode = 'timeline',
  detail,
  className = '',
}) => {
  const isThinking = state === 'thinking';
  const verbs = isThinking ? THINKING_VERBS : WORKING_VERBS;

  const [verbIndex, setVerbIndex] = useState(() => Math.floor(Math.random() * verbs.length));
  const [fade, setFade] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Timer for elapsed seconds
  useEffect(() => {
    setElapsedSec(0);
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Word cycler every 2.4s with smooth fade
  useEffect(() => {
    const cycle = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setVerbIndex((prev) => (prev + 1) % verbs.length);
        setFade(true);
      }, 200);
    }, 2400);

    return () => clearInterval(cycle);
  }, [verbs.length]);

  const currentVerb = verbs[verbIndex % verbs.length];
  const logoState: TwillLogoState =
    state === 'thinking' ? 'thinking' : state === 'streaming' ? 'streaming' : 'working';

  if (mode === 'strip') {
    return (
      <div className={`flex items-center gap-2 min-w-0 ${className}`}>
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          <TwillLogo state={logoState} size={16} onDark={true} />
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <span
            className={`font-medium text-[#c66b4d] text-xs transition-opacity duration-200 tracking-wide ${
              fade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-0.5'
            }`}
          >
            {currentVerb}...
          </span>
          {elapsedSec > 0 && (
            <span className="text-[#7d7972] font-mono text-[11px]">({elapsedSec}s)</span>
          )}
          {detail && (
            <span className="text-[#96928a] font-mono text-xs truncate max-w-sm ml-1">
              · {detail}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="w-3.5 h-3.5 inline-flex items-center justify-center">
          <TwillLogo state={logoState} size={14} onDark={true} />
        </span>
        <span
          className={`text-xs text-[#c66b4d] font-medium transition-all duration-200 ${
            fade ? 'opacity-100' : 'opacity-30'
          }`}
        >
          {currentVerb}...
        </span>
      </span>
    );
  }

  // Default: timeline row matching Antigravity
  return (
    <div
      className={`my-2 py-1.5 px-2 rounded-lg flex items-center justify-between text-xs max-w-4xl select-none font-sans ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          <TwillLogo state={logoState} size={16} onDark={true} />
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[13px] font-medium text-[#c66b4d] transition-all duration-200 tracking-wide ${
              fade ? 'opacity-100' : 'opacity-40'
            }`}
          >
            {currentVerb}...
          </span>
          <span className="text-[#7d7972] font-mono text-xs">
            {elapsedSec}s
          </span>
          {detail && (
            <span className="text-[#96928a] font-mono text-xs truncate max-w-md">
              {detail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
