import React, { useState, useEffect } from 'react';
import { TwillLogo, TwillLogoState } from './TwillLogo';

// Authentic Claude Code spinner verbs (standard, non-personalized)
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
  'Coalescing',
  'Inferring',
  'Clauding',
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
  'Orchestrating',
  'Generating',
];

// Claude Code organic terminal sparkle frames & cycling dots
const SPARKLE_FRAMES = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const DOT_FRAMES = ['.', '..', '...'];

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
  const [sparkleIndex, setSparkleIndex] = useState(0);
  const [dotIndex, setDotIndex] = useState(0);

  // Timer for elapsed seconds
  useEffect(() => {
    setElapsedSec(0);
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Rapid sparkle frame rotation (120ms) matching terminal ANSI refresh
  useEffect(() => {
    const frameTimer = setInterval(() => {
      setSparkleIndex((prev) => (prev + 1) % SPARKLE_FRAMES.length);
    }, 120);
    return () => clearInterval(frameTimer);
  }, []);

  // Cycling dots (. -> .. -> ...) every 320ms
  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % DOT_FRAMES.length);
    }, 320);
    return () => clearInterval(dotsTimer);
  }, []);

  // Word cycler every 2.4s with smooth fade
  useEffect(() => {
    const cycle = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setVerbIndex((prev) => (prev + 1) % verbs.length);
        setFade(true);
      }, 180);
    }, 2400);

    return () => clearInterval(cycle);
  }, [verbs.length]);

  const currentVerb = verbs[verbIndex % verbs.length];
  const currentSparkle = SPARKLE_FRAMES[sparkleIndex];
  const currentDots = DOT_FRAMES[dotIndex];

  const logoState: TwillLogoState =
    state === 'thinking' ? 'thinking' : state === 'streaming' ? 'streaming' : 'working';

  if (mode === 'strip') {
    return (
      <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
        <div className="w-5 h-5 shrink-0 flex items-center justify-center">
          <TwillLogo state={logoState} size={20} onDark={true} />
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <span
            className={`font-medium text-[13px] transition-all duration-200 tracking-wide flex items-center gap-1 ${
              fade ? 'opacity-100 scale-100' : 'opacity-20 scale-[0.98]'
            }`}
          >
            <span className="claude-verb-shimmer">{currentVerb}</span>
            <span className="text-[#c66b4d] font-mono text-xs w-4 inline-block text-left select-none">
              {currentDots}
            </span>
          </span>
          {elapsedSec > 0 && (
            <span className="text-[#7d7972] font-mono text-[11px] ml-0.5">({elapsedSec}s)</span>
          )}
          {detail && (
            <span className="text-[#96928a] font-mono text-xs truncate max-w-sm ml-1.5">
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
        <span className="w-4 h-4 inline-flex items-center justify-center">
          <TwillLogo state={logoState} size={16} onDark={true} />
        </span>
        <span
          className={`text-xs font-medium transition-all duration-200 inline-flex items-center gap-1 ${
            fade ? 'opacity-100' : 'opacity-30'
          }`}
        >
          <span className="claude-verb-shimmer">{currentVerb}</span>
          <span className="text-[#c66b4d] font-mono text-[10px] w-3.5 inline-block text-left">
            {currentDots}
          </span>
        </span>
      </span>
    );
  }

  // Default: timeline row matching Antigravity
  return (
    <div
      className={`my-2 py-2 px-2.5 rounded-lg flex items-center justify-between text-xs max-w-4xl select-none font-sans ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-6 h-6 shrink-0 flex items-center justify-center">
          <TwillLogo state={logoState} size={24} onDark={true} />
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 transition-all duration-200 ${
              fade ? 'opacity-100 translate-y-0' : 'opacity-20 translate-y-0.5'
            }`}
          >
            <span className="text-[14px] font-medium tracking-wide claude-verb-shimmer">
              {currentVerb}
            </span>
            <span className="text-[#c66b4d] font-mono text-sm w-4 inline-block text-left select-none">
              {currentDots}
            </span>
            <span className="text-[#d9b98a] text-xs font-mono ml-0.5 opacity-80 inline-block animate-pulse">
              {currentSparkle}
            </span>
          </div>

          <span className="text-[#96928a] font-mono text-xs ml-1">
            {elapsedSec}s
          </span>

          {detail && (
            <span className="text-[#96928a] font-mono text-xs truncate max-w-md ml-1">
              · {detail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
