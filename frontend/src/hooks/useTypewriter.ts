import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface UseTypewriterOptions {
  text: string;
  /** 为 false 时直接展示全文 */
  enabled: boolean;
  /** 变化时重新开始打字 */
  resetKey?: string;
  msPerChar?: number;
  /** 最长播放时长，超时后一次性显示剩余 */
  maxDurationMs?: number;
  onComplete?: (full: string) => void;
}

export function useTypewriter({
  text,
  enabled,
  resetKey = '',
  msPerChar = 38,
  maxDurationMs = 2200,
  onComplete,
}: UseTypewriterOptions) {
  const reducedMotion = usePrefersReducedMotion();
  const [displayText, setDisplayText] = useState(text);
  const [isTyping, setIsTyping] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (reducedMotion || !enabled || !text) {
      setDisplayText(text);
      setIsTyping(false);
      if (enabled && text) onCompleteRef.current?.(text);
      return;
    }

    setDisplayText('');
    setIsTyping(true);
    let index = 0;
    const started = Date.now();

    const tick = () => {
      if (Date.now() - started >= maxDurationMs) {
        setDisplayText(text);
        setIsTyping(false);
        onCompleteRef.current?.(text);
        return;
      }
      index += 1;
      const next = text.slice(0, index);
      setDisplayText(next);
      if (index >= text.length) {
        setIsTyping(false);
        onCompleteRef.current?.(text);
        return;
      }
    };

    tick();
    const id = window.setInterval(tick, msPerChar);
    return () => window.clearInterval(id);
  }, [text, enabled, resetKey, reducedMotion, msPerChar, maxDurationMs]);

  const showFull = reducedMotion || !enabled;
  return {
    displayText: showFull ? text : displayText,
    isTyping: !showFull && isTyping,
    showCursor: !showFull && isTyping,
  };
}
