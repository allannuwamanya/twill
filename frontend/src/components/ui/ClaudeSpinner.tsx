import React, { useState, useEffect, useRef } from 'react';
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

const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#~0123456789';
const DOT_FRAMES = ['.', '..', '...'];

interface ScrambleItem {
  from: string;
  to: string;
  start: number;
  end: number;
}

export const ScrambleText: React.FC<{
  text: string;
  className?: string;
}> = ({ text, className = '' }) => {
  const [items, setItems] = useState<Array<{ char: string; locked: boolean }>>(() =>
    text.split('').map((c) => ({ char: c, locked: true }))
  );
  const prevTextRef = useRef(text);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const oldText = prevTextRef.current;
    prevTextRef.current = text;

    if (oldText === text) {
      setItems(text.split('').map((c) => ({ char: c, locked: true })));
      return;
    }

    const length = Math.max(oldText.length, text.length);
    const queue: ScrambleItem[] = [];

    for (let i = 0; i < length; i++) {
      const from = oldText[i] || '';
      const to = text[i] || '';
      // Rapid scramble start with slight random stagger (0..2 frames)
      const start = Math.floor(Math.random() * 3);
      // Sequential left-to-right locking
      const lockOffset = Math.floor((i / Math.max(1, length - 1)) * 9);
      const end = start + 3 + lockOffset;

      queue.push({ from, to, start, end });
    }

    if (timerRef.current) clearInterval(timerRef.current);

    let frame = 0;
    // 35ms per frame => total transition completes in ~350-450ms
    timerRef.current = setInterval(() => {
      let completeCount = 0;
      const nextItems: Array<{ char: string; locked: boolean }> = [];

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (frame >= item.end) {
          completeCount++;
          if (item.to) {
            nextItems.push({ char: item.to, locked: true });
          }
        } else if (frame >= item.start) {
          if (item.to === ' ') {
            nextItems.push({ char: ' ', locked: false });
          } else {
            const randomChar = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
            nextItems.push({ char: randomChar, locked: false });
          }
        } else {
          if (item.from) {
            nextItems.push({ char: item.from, locked: false });
          }
        }
      }

      setItems(nextItems);

      if (completeCount === queue.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setItems(text.split('').map((c) => ({ char: c, locked: true })));
      } else {
        frame++;
      }
    }, 35);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text]);

  return (
    <span className={`inline-flex items-center font-medium ${className}`}>
      {items.map((item, index) => (
        <span
          key={index}
          className={
            item.locked
              ? 'text-[#c66b4d] transition-colors duration-150'
              : 'text-[#d9b98a] font-mono select-none opacity-90'
          }
        >
          {item.char}
        </span>
      ))}
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
  const [elapsedSec, setElapsedSec] = useState(0);
  const [dotIndex, setDotIndex] = useState(0);

  // Timer for elapsed seconds
  useEffect(() => {
    setElapsedSec(0);
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cycling dots (. -> .. -> ...) every 320ms
  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % DOT_FRAMES.length);
    }, 320);
    return () => clearInterval(dotsTimer);
  }, []);

  // Word cycler every 2.8s
  useEffect(() => {
    const cycle = setInterval(() => {
      setVerbIndex((prev) => (prev + 1) % verbs.length);
    }, 2800);

    return () => clearInterval(cycle);
  }, [verbs.length]);

  const currentVerb = verbs[verbIndex % verbs.length];
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
          <div className="text-[13px] tracking-wide flex items-center gap-1">
            <ScrambleText text={currentVerb} />
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
        <span className="text-xs inline-flex items-center gap-1">
          <ScrambleText text={currentVerb} />
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
          <div className="flex items-center gap-1.5">
            <ScrambleText text={currentVerb} className="text-[14px]" />
            <span className="text-[#c66b4d] font-mono text-sm w-4 inline-block text-left select-none">
              {currentDots}
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
