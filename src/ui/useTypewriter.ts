import { useCallback, useEffect, useRef, useState } from 'react';
import { blip, type VoiceId } from '../game/audio';

/** 문장부호에서 잠깐 쉰다 — 읽는 리듬이 생긴다. */
const PAUSE: Record<string, number> = {
  ',': 5, '·': 3, '—': 5, ':': 4, ';': 4,
  '.': 9, '?': 9, '!': 9, '…': 12, '\n': 10,
};

interface Opts {
  /** 글자당 밀리초 (작을수록 빠름) */
  speed?: number;
  /** 목소리 — 블립 음색 */
  voice?: VoiceId;
  /** 소리 재생 여부 */
  sound?: boolean;
  /** false면 즉시 전체 표시 (연출 끄기) */
  animate?: boolean;
}

/**
 * 한 글자씩 찍히는 대사 + 글자마다 스퀘어파 블립.
 * done=false일 때 다시 호출하면 skip()으로 즉시 전체 표시한다.
 */
export function useTypewriter(text: string, { speed = 28, voice = 'narrator', sound = true, animate = true }: Opts = {}) {
  const [n, setN] = useState(animate ? 0 : text.length);
  const timer = useRef<number | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!animate || speed <= 0) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const step = () => {
      i += 1;
      setN(i);
      const ch = text[i - 1] ?? '';
      // 공백·문장부호에서는 블립을 내지 않는다. 두 글자에 한 번씩만 울려 덜 시끄럽게.
      if (soundRef.current && i % 2 === 1 && !/[\s.,!?·—:;…"'()「」《》]/.test(ch)) blip(voice, i);
      if (i >= text.length) { timer.current = null; return; }
      const extra = (PAUSE[ch] ?? 0) * speed * 0.6;
      timer.current = window.setTimeout(step, speed + extra);
    };
    timer.current = window.setTimeout(step, speed);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [text, speed, voice, animate]);

  const skip = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    setN(text.length);
  }, [text]);

  return { shown: text.slice(0, n), done: n >= text.length, skip };
}
