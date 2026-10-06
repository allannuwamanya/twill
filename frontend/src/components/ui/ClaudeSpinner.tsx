import React, { useState, useEffect } from 'react';
import { TwillLogo, TwillLogoState } from './TwillLogo';

// Verbatim verbs from Claude Code constants/spinnerVerbs.ts
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
  'Mulling',
  'Calculating',
  'Cerebrating',
  'Envisioning',
  'Ideating',
  'Philosophising',
  'Pontificating',
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
  'Actioning',
  'Actualizing',
  'Creating',
  'Tinkering',
  'Transfiguring',
];

// Glyphs from Claude Code components/Spinner/utils.ts
const DEFAULT_GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽'];
const SPINNER_FRAMES = [...DEFAULT_GLYPHS, ...[...DEFAULT_GLYPHS].reverse()];
const DOT_FRAMES = ['.', '..', '...'];

// Claude Code colorSweep constants
const BASE_RGB: [number, number, number] = [198, 107, 77]; // #c66b4d (Claude warm terracotta)
const SHIMMER_RGB: [number, number, number] = [255, 245, 235]; // #fff5eb (luminous white/cream highlight)
const SHIMMER_BAND = 4; // 4-char highlight band
const SHIMMER_TICK_MS = 65; // ~15fps tick rate matching Claude Code

/**
 * ClaudeShimmerWord: Letter-by-letter color sweep with motion to the left.
 * Implements the colorSweep() logic from Claude Code's SpinnerAnimationRow.
 */
export const ClaudeShimmerWord: React.FC<{
  text: string;
  className?: string;
  reverse?: boolean; // true = motion sweeps right-to-left (to the left)
}> = ({ text, className = '', reverse = true }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => prev + 1);
    }, SHIMMER_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const total = text.length + SHIMMER_BAND * 2;
  const rawPos = frame % total;
  // Sweep to the left: right-to-left
  const pos = reverse ? total - 1 - rawPos : rawPos;

  return (
    <span className={`inline-flex items-center font-medium ${className}`}>
      {text.split('').map((char, i) => {
        const dist = Math.abs(i - pos);
        const t = Math.max(0, 1 - dist / SHIMMER_BAND);
        // Soft cosine curve for smooth liquid-light pulse across characters
        const smoothT = t > 0 ? 0.5 - 0.5 * Math.cos(t * Math.PI) : 0;

        const r = Math.round(BASE_RGB[0] + (SHIMMER_RGB[0] - BASE_RGB[0]) * smoothT);
        const g = Math.round(BASE_RGB[1] + (SHIMMER_RGB[1] - BASE_RGB[1]) * smoothT);
        const b = Math.round(BASE_RGB[2] + (SHIMMER_RGB[2] - BASE_RGB[2]) * smoothT);

        return (
          <span
            key={i}
            style={{
              color: `rgb(${r}, ${g}, ${b})`,
              transition: 'color 40ms linear',
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
};

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
  const [glyphIndex, setGlyphIndex] = useState(0);
  const [dotIndex, setDotIndex] = useState(0);

  // Timer for elapsed seconds
  useEffect(() => {
    setElapsedSec(0);
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ping-pong spinner glyph cycling (every 110ms)
  useEffect(() => {
    const glyphTimer = setInterval(() => {
      setGlyphIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 110);
    return () => clearInterval(glyphTimer);
  }, []);

  // Cycling dots (. -> .. -> ...) every 320ms
  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % DOT_FRAMES.length);
    }, 320);
    return () => clearInterval(dotsTimer);
  }, []);

  // Verb rotator every 2.8s with smooth subtle transition
  useEffect(() => {
    const cycle = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setVerbIndex((prev) => (prev + 1) % verbs.length);
        setFade(true);
      }, 150);
    }, 2800);

    return () => clearInterval(cycle);
  }, [verbs.length]);

  const currentVerb = verbs[verbIndex % verbs.length];
  const currentGlyph = SPINNER_FRAMES[glyphIndex];
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
          <div
            className={`text-[13px] tracking-wide flex items-center gap-1 transition-opacity duration-150 ${
              fade ? 'opacity-100' : 'opacity-20'
            }`}
          >
            <ClaudeShimmerWord text={currentVerb} reverse={true} />
            <span className="text-[#c66b4d] font-mono text-xs w-4 inline-block text-left select-none">
              {currentDots}
            </span>
          </div>
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
          className={`text-xs inline-flex items-center gap-1 transition-opacity duration-150 ${
            fade ? 'opacity-100' : 'opacity-20'
          }`}
        >
          <ClaudeShimmerWord text={currentVerb} reverse={true} />
          <span className="text-[#c66b4d] font-mono text-[10px] w-3.5 inline-block text-left select-none">
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
            className={`flex items-center gap-1.5 transition-opacity duration-150 ${
              fade ? 'opacity-100' : 'opacity-20'
            }`}
          >
            <ClaudeShimmerWord text={currentVerb} className="text-[14px]" reverse={true} />
            <span className="text-[#c66b4d] font-mono text-sm w-4 inline-block text-left select-none">
              {currentDots}
            </span>
            <span className="text-[#d9b98a] text-xs font-mono ml-0.5 opacity-80 inline-block animate-pulse">
              {currentGlyph}
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
