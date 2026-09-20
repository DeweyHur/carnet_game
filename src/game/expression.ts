import type { Speaker } from './types';

// ─── 표정 ───────────────────────────────────────────────────────────────────
// 초상의 눈썹·눈·입 모양을 바꾸는 여덟 가지 표정.
// 화자마다 "기본 표정"이 있고(안내인은 도시 데이터의 mood), 대사의 문장부호에
// 따라 그 위에서 조금씩 흔들린다.

export type Expression = 'neutral' | 'smile' | 'warm' | 'serious' | 'wry' | 'sad' | 'thinking' | 'surprised';

export interface ExprShape {
  browL: string;
  browR: string;
  /** 눈 높이 (기본 4.2) */
  eyeRy: number;
  /** 다문 입 모양 */
  mouth: string;
  /** 놀람처럼 입을 동그랗게 */
  round?: boolean;
}

export const EXPR: Record<Expression, ExprShape> = {
  neutral:   { browL: 'M45 50 q6 -2.5 12 -1',  browR: 'M63 49 q6 -1 12 2.5',    eyeRy: 4.2, mouth: 'M53 78 q7 2 14 0' },
  smile:     { browL: 'M45 49 q6 -4 12 -1.5',  browR: 'M63 47.5 q6 -2.5 12 4',  eyeRy: 3.4, mouth: 'M50 76 q10 7 20 0' },
  warm:      { browL: 'M45 50 q6 -3.5 12 -1',  browR: 'M63 49 q6 -1.5 12 3.5',  eyeRy: 3.9, mouth: 'M52 77 q8 4.5 16 0' },
  serious:   { browL: 'M45 47 q6 1 12 3',      browR: 'M63 50 q6 -3 12 -3',     eyeRy: 4.0, mouth: 'M52 78.5 q8 0.5 16 0' },
  wry:       { browL: 'M45 46 q6 -3 12 0',     browR: 'M63 49 q6 -1 12 2.5',    eyeRy: 3.8, mouth: 'M51 79 q8 2.5 17 -4' },
  sad:       { browL: 'M45 51 q6 -1 12 -3.5',  browR: 'M63 47.5 q6 1 12 3.5',   eyeRy: 4.2, mouth: 'M52 79.5 q8 -4 16 0' },
  thinking:  { browL: 'M45 50 q6 -2 12 -0.5',  browR: 'M63 46.5 q6 -2.5 12 1',  eyeRy: 3.8, mouth: 'M54 78 q6 1.5 12 -2' },
  surprised: { browL: 'M45 45.5 q6 -4 12 -1',  browR: 'M63 44.5 q6 -2.5 12 4',  eyeRy: 5.4, mouth: 'M53 78 q7 2 14 0', round: true },
};

/** 고정 캐스트의 기본 표정 (안내인은 도시 데이터가 정한다) */
export const BASE_EXPRESSION: Record<Speaker, Expression> = {
  margot: 'wry',        // 건조한 편집장
  L: 'neutral',         // 역광 실루엣이라 표정이 보이지 않는다
  theo: 'wry',          // 여유 있는 라이벌
  echo: 'serious',      // 기록에서 재구성한 인물
  guide: 'warm',        // 도시별로 덮어씀
  player: 'neutral',
  narrator: 'neutral',
};

/**
 * 대사 한 줄에서 표정을 읽어낸다. 기본 표정 위에 문장부호만큼만 흔든다 —
 * 감탄사는 놀람, 물음은 생각, 말줄임은 씁쓸함.
 */
export function inferExpression(text: string, base: Expression): Expression {
  const t = text.trim();
  if (!t) return base;
  if (/[!]/.test(t) && t.length < 70) return base === 'serious' ? 'serious' : 'surprised';
  if (/\?\s*[)»」'"]?\s*$/.test(t)) return base === 'smile' || base === 'warm' ? base : 'thinking';
  if (/…|\.\.\./.test(t)) return base === 'smile' ? 'wry' : 'sad';
  return base;
}
