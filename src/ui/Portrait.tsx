import { useMemo } from 'react';
import type { GuideLook, HairStyle, Speaker } from '../game/types';
import { EXPR, type Expression } from '../game/expression';

// ─── 캐릭터 초상 ────────────────────────────────────────────────────────────
// 이미지 에셋 없이 코드로 그린 SVG 얼굴. 1900년대 오토크롬 인화 같은 색감.
// 말하는 동안 입이 움직이고(talking), 눈은 주기적으로 깜빡인다(CSS 애니메이션).
// 나중에 실제 일러스트가 생기면 PORTRAIT_IMAGES에 경로만 넣으면 그림이 우선한다.

export const PORTRAIT_IMAGES: Partial<Record<Speaker, string>> = {};

/** 스타일별 앞머리 덩어리 (머리 위를 덮는 두꺼운 캡 모양) */
const HAIR_CAP: Record<string, string> = {
  short: 'M33 58 C33 24 87 24 87 58 L87 50 C78 45 68 43 60 43 C52 43 42 45 33 50 Z',
  bob:   'M32 60 C32 22 88 22 88 60 L88 50 C79 44 69 42 60 42 C51 42 41 44 32 50 Z',
  messy: 'M33 58 C31 22 89 20 87 58 L87 48 C78 42 68 40 60 40 C52 40 42 42 33 48 Z',
  updo:  'M33 58 C33 23 87 23 87 58 L87 49 C78 44 69 42 60 42 C51 42 42 44 33 49 Z',
  veil:  'M31 62 C31 20 89 20 89 62 L89 52 C80 44 70 41 60 41 C50 41 40 44 31 52 Z',
  beret: 'M33 56 C33 26 87 26 87 56 L87 50 C78 46 68 44 60 44 C52 44 42 46 33 50 Z',
  cap:   'M34 58 C34 28 86 28 86 58 L86 50 C78 46 69 44 60 44 C51 44 42 46 34 50 Z',
};

interface FaceSpec {
  skin: string;
  shade: string;
  hair: string;
  hairLight: string;
  style: HairStyle;
  eye: string;
  lip: string;
  cloth: string;
  collar: string;
  bg: [string, string];
  glasses?: boolean;
  scarf?: string;
  camera?: boolean;
  stubble?: boolean;
  silhouette?: boolean;
  /** 모자·베레 색 */
  hat?: string;
}

const FACES: Record<Exclude<Speaker, 'narrator'>, FaceSpec> = {
  // 편집장 마고 뒤랑 — 40대 후반, 단발에 새치, 뿔테, 붉은 립스틱
  margot: {
    skin: '#e9c9a6', shade: '#cfa77f', hair: '#3b2a24', hairLight: '#8a7466', style: 'bob',
    eye: '#3a2c22', lip: '#b5482f', cloth: '#4a3a44', collar: '#7d6470',
    bg: ['#e7d8bb', '#b9a37d'], glasses: true,
  },
  // 실종된 선배 L. — 역광 실루엣, 얼굴이 보이지 않는다
  L: {
    skin: '#2f2a26', shade: '#221e1b', hair: '#1a1714', hairLight: '#3a332c', style: 'short',
    eye: '#c9b995', lip: '#2a2622', cloth: '#1c1916', collar: '#2b2620',
    bg: ['#d8c9a4', '#6d6144'], silhouette: true, camera: true,
  },
  // 라이벌 작가 테오 — 헝클어진 머리, 카메라 스트랩, 자신만만
  theo: {
    skin: '#e3b98f', shade: '#c39468', hair: '#20180f', hairLight: '#4b3a25', style: 'messy',
    eye: '#2b3a4a', lip: '#9a5c46', cloth: '#2f5d8a', collar: '#4a7aa8',
    bg: ['#dfd3b6', '#8e9d8c'], camera: true, stubble: true,
  },
  // 메아리 — 기록에서 재구성한 인물. 얼굴은 반쯤 지워진 사진처럼
  echo: {
    skin: '#d9c8ae', shade: '#bda886', hair: '#5a4a36', hairLight: '#8f7a5c', style: 'veil',
    eye: '#4a3c2a', lip: '#8a6a52', cloth: '#6b5a2a', collar: '#9a8748',
    bg: ['#efe3c6', '#c2ab7a'], scarf: '#cbb891',
  },
  // 도시 안내인 — 도시마다 색이 바뀐다(아래 guideSpec에서 덮어씀)
  guide: {
    skin: '#e6c39c', shade: '#c79f74', hair: '#33261c', hairLight: '#6b5241', style: 'short',
    eye: '#33261c', lip: '#a6604c', cloth: '#4f6d7a', collar: '#7794a0',
    bg: ['#e4d7b9', '#a99a76'],
  },
  // 플레이어 — 수첩을 든 신입 작가
  player: {
    skin: '#ecca9f', shade: '#cda87c', hair: '#241c14', hairLight: '#5b4630', style: 'short',
    eye: '#2a2118', lip: '#a76a52', cloth: '#4f7a4a', collar: '#78a071',
    bg: ['#e8dcbe', '#9fae92'],
  },
};

/**
 * 안내인 생김새. 도시 데이터에 look이 있으면 그대로 쓰고,
 * 없으면 이름을 해시해서 적당히 만들어 낸다(폴백).
 */
function guideSpec(name: string, color: string, look?: GuideLook): FaceSpec {
  if (look) {
    return {
      ...FACES.guide,
      style: look.style,
      hair: look.hair,
      hairLight: mix(look.hair),
      skin: look.skin,
      shade: 'rgba(120,80,45,.45)',
      cloth: color,
      collar: mix(color),
      glasses: look.glasses,
      scarf: look.scarf,
      camera: look.camera,
      stubble: look.stubble,
      hat: look.hat ?? color,
    };
  }
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hairs = ['#33261c', '#5a3a22', '#1c1a18', '#4a3826', '#6b4a2e'];
  const skins = ['#e6c39c', '#d6a878', '#b98456', '#8d5f3c', '#f0d3b0'];
  const styles: HairStyle[] = ['short', 'bob', 'messy', 'updo', 'beret'];
  return {
    ...FACES.guide,
    hair: hairs[h % hairs.length],
    hairLight: hairs[(h + 2) % hairs.length],
    skin: skins[(h >> 3) % skins.length],
    shade: 'rgba(120,80,45,.45)',
    style: styles[(h >> 5) % styles.length],
    cloth: color,
    collar: color,
    glasses: (h >> 7) % 3 === 0,
    scarf: (h >> 9) % 3 === 0 ? '#b5482f' : undefined,
    hat: color,
  };
}

/** 색을 한 단계 밝게 — 머리 하이라이트·옷깃용 */
function mix(hex: string, amt = 0.32): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * amt));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

interface Props {
  who: Speaker;
  /** 안내인·메아리의 이름 */
  name?: string;
  /** 안내인 색 (도시 데이터) */
  color?: string;
  /** 안내인 생김새 (도시 데이터) */
  look?: GuideLook;
  /** 지금 말하고 있는가 — 입이 움직인다 */
  talking?: boolean;
  /** 표정 (눈썹·눈·입) */
  expression?: Expression;
  size?: number;
  /** 액자 테두리 */
  framed?: boolean;
}

export default function Portrait({ who, name, color, look, talking, expression = 'neutral', size = 132, framed = true }: Props) {
  const spec = useMemo<FaceSpec | null>(() => {
    if (who === 'narrator') return null;
    if (who === 'guide') return guideSpec(name ?? '안내인', color ?? '#4f6d7a', look);
    return FACES[who];
  }, [who, name, color, look]);

  const img = PORTRAIT_IMAGES[who];
  if (img) {
    return (
      <div className={`portrait${framed ? ' framed' : ''}${talking ? ' talking' : ''}`} style={{ width: size, height: size * 1.15 }}>
        <img src={img} alt="" />
      </div>
    );
  }
  if (!spec) {
    // 내레이션 — 얼굴 대신 펜촉
    return (
      <div className={`portrait narr${framed ? ' framed' : ''}`} style={{ width: size, height: size * 1.15 }}>
        <svg viewBox="0 0 120 138" width="100%" height="100%">
          <rect width="120" height="138" fill="#ddd0b0" />
          <path d="M60 44 L72 86 L60 98 L48 86 Z" fill="#8a7a62" />
          <path d="M60 44 L60 98" stroke="#5a4d3c" strokeWidth="1.5" />
          <circle cx="60" cy="80" r="3.4" fill="#f4ecd8" />
        </svg>
      </div>
    );
  }

  const id = `${who}-${(name ?? '').replace(/[^a-zA-Z0-9]/g, '') || 'x'}`;
  const s = spec;
  const e = EXPR[expression] ?? EXPR.neutral;

  return (
    <div className={`portrait${framed ? ' framed' : ''}${talking ? ' talking' : ''}${s.silhouette ? ' silhouette' : ''}`} style={{ width: size, height: size * 1.15 }}>
      <svg viewBox="0 0 120 138" width="100%" height="100%" aria-hidden>
        <defs>
          <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.bg[0]} />
            <stop offset="100%" stopColor={s.bg[1]} />
          </linearGradient>
          <radialGradient id={`vig-${id}`} cx="50%" cy="42%" r="72%">
            <stop offset="55%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(58,44,22,.45)" />
          </radialGradient>
          <clipPath id={`clip-${id}`}><rect x="0" y="0" width="120" height="138" rx="3" /></clipPath>
          <pattern id={`grain-${id}`} width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r=".5" fill="rgba(90,70,40,.16)" />
            <circle cx="3" cy="3" r=".4" fill="rgba(255,250,230,.14)" />
          </pattern>
        </defs>

        <g clipPath={`url(#clip-${id})`}>
          <rect width="120" height="138" fill={`url(#bg-${id})`} />
          {/* 배경의 창틀 — 방 안이라는 느낌만 */}
          <rect x="8" y="10" width="34" height="46" rx="2" fill="rgba(255,252,238,.18)" />
          <path d="M25 10 L25 56 M8 33 L42 33" stroke="rgba(80,62,36,.18)" strokeWidth="1.2" />

          {/* 어깨·옷 */}
          <path d="M14 138 C16 112 32 100 60 100 C88 100 104 112 106 138 Z" fill={s.cloth} />
          <path d="M47 100 L60 124 L73 100 L67 98 L60 113 L53 98 Z" fill="#f2e9d6" opacity=".92" />
          <path d="M47 100 L60 124 L73 100" fill="none" stroke="rgba(0,0,0,.2)" strokeWidth="1.6" />
          <path d="M53 98 L60 113 L67 98" fill="none" stroke={s.collar} strokeWidth="1.2" opacity=".7" />
          {s.scarf && <path d="M42 104 C50 114 70 114 78 104 L80 112 C70 122 50 122 40 112 Z" fill={s.scarf} />}

          {/* 목 */}
          <path d="M50 84 h20 v16 c0 6 -20 6 -20 0 z" fill={s.shade} />

          {/* 머리 뒤쪽 머리카락 */}
          {(s.style === 'bob' || s.style === 'veil') && <path d="M28 54 C28 22 92 22 92 54 L92 92 L82 86 L82 46 L38 46 L38 86 L28 92 Z" fill={s.hair} />}
          {s.style === 'updo' && <circle cx="60" cy="22" r="13" fill={s.hair} />}

          {/* 얼굴 */}
          <ellipse cx="60" cy="58" rx="25" ry="30" fill={s.skin} />
          <path d="M60 28 C46 28 38 40 38 56 C38 44 48 40 60 40 C72 40 82 44 82 56 C82 40 74 28 60 28 Z" fill={s.hair} opacity=".0" />
          {/* 볼 그림자 */}
          <ellipse cx="60" cy="62" rx="25" ry="26" fill={s.shade} opacity=".25" />
          <ellipse cx="60" cy="54" rx="22" ry="25" fill={s.skin} />
          {/* 귀 */}
          <ellipse cx="35" cy="58" rx="4" ry="6" fill={s.skin} />
          <ellipse cx="85" cy="58" rx="4" ry="6" fill={s.skin} />

          {/* 앞머리 — 두꺼운 모자 모양 덩어리 + 스타일별 장식 */}
          {s.style !== 'beret' && s.style !== 'cap' && (
            <path d={HAIR_CAP[s.style]} fill={s.hair} />
          )}
          {s.style === 'messy' && (
            <g fill={s.hair}>
              <path d="M42 34 q-9 -6 -7 -12 q7 3 11 9 z" />
              <path d="M58 30 q-4 -8 1 -13 q4 6 4 12 z" />
              <path d="M77 33 q8 -5 7 -12 q-7 3 -11 9 z" />
            </g>
          )}
          {s.style === 'updo' && <circle cx="60" cy="20" r="12" fill={s.hair} />}
          {s.style === 'beret' && (
            <g>
              <path d={HAIR_CAP.beret} fill={s.hair} />
              <path d="M30 44 C30 22 90 22 90 41 C90 48 75 51 60 51 C45 51 30 51 30 44 Z" fill={s.hat ?? s.cloth} />
              <ellipse cx="60" cy="42" rx="31" ry="4" fill="rgba(0,0,0,.18)" />
              <circle cx="60" cy="21" r="3.2" fill="rgba(255,255,255,.35)" />
            </g>
          )}
          {s.style === 'veil' && (
            <g>
              {/* 머릿수건 — 머리를 감싸고 한쪽으로 자락이 내려온다 */}
              <path d="M33 58 C33 22 87 22 87 58 C87 60 80 58 76 53 C70 44 50 44 44 53 C40 58 33 60 33 58 Z" fill={s.scarf ?? s.cloth} />
              <path d="M33 56 C31 72 36 86 44 94 L51 83 C42 75 37 66 36 56 Z" fill={s.scarf ?? s.cloth} />
              <path d="M36 56 C37 66 42 75 51 83" fill="none" stroke="rgba(0,0,0,.16)" strokeWidth="2" />
              <ellipse cx="60" cy="31" rx="26" ry="8" fill="rgba(255,255,255,.14)" />
            </g>
          )}
          {s.style === 'cap' && (
            <g>
              <path d={HAIR_CAP.cap} fill={s.hair} />
              {/* 챙 있는 근무모 — 역무원·기사 */}
              <path d="M33 47 C33 25 87 25 87 47 C87 50 74 51 60 51 C46 51 33 50 33 47 Z" fill={s.hat ?? s.cloth} />
              <rect x="24" y="45.5" width="72" height="6" rx="3" fill={s.hat ?? s.cloth} />
              <rect x="24" y="45.5" width="72" height="6" rx="3" fill="rgba(0,0,0,.3)" />
              <rect x="40" y="35" width="40" height="7" rx="1.5" fill="rgba(0,0,0,.22)" />
              <circle cx="60" cy="38.5" r="3" fill="rgba(255,240,200,.75)" />
            </g>
          )}
          {/* 가르마 하이라이트 */}
          <path d="M42 44 C50 37 60 35 70 38" stroke={s.hairLight} strokeWidth="2.2" fill="none" opacity=".5" strokeLinecap="round" />

          {/* 눈썹 — 표정에 따라 각도가 바뀐다 */}
          <path d={e.browL} stroke={s.hair} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".9" />
          <path d={e.browR} stroke={s.hair} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".9" />

          {/* 눈 (깜빡임: CSS로 scaleY) */}
          <g className="eyes">
            <g className="eye eye-l">
              <ellipse cx="51" cy="59" rx="6" ry={e.eyeRy} fill="#fbf6e6" />
              <circle cx="51.5" cy="59.4" r="2.7" fill={s.eye} />
              <circle cx="52.5" cy="58.3" r=".9" fill="#fff" opacity=".9" />
            </g>
            <g className="eye eye-r">
              <ellipse cx="69" cy="59" rx="6" ry={e.eyeRy} fill="#fbf6e6" />
              <circle cx="68.5" cy="59.4" r="2.7" fill={s.eye} />
              <circle cx="69.5" cy="58.3" r=".9" fill="#fff" opacity=".9" />
            </g>
          </g>

          {/* 코 */}
          <path d="M60 60 q-3 8 1 10" stroke={s.shade} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".8" />

          {s.stubble && <ellipse cx="60" cy="76" rx="15" ry="9" fill={s.hair} opacity=".18" />}

          {/* 입 — 닫힘/열림 두 장을 번갈아 */}
          <g className="mouth">
            {e.round
              ? <ellipse className="m-closed" cx="60" cy="78.5" rx="4.2" ry="4.6" fill="#7a3327" stroke={s.lip} strokeWidth="1.6" />
              : <path className="m-closed" d={e.mouth} stroke={s.lip} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
            <g className="m-open">
              <ellipse cx="60" cy="78.5" rx="7" ry="5" fill="#7a3327" />
              <path d="M53.5 77.5 q6.5 -3 13 0" fill={s.lip} opacity=".85" />
            </g>
          </g>

          {/* 안경 */}
          {s.glasses && (
            <g stroke="#3b3128" strokeWidth="2" fill="none" opacity=".9">
              <rect x="43" y="54" width="16" height="11" rx="3" fill="rgba(255,255,255,.12)" />
              <rect x="61" y="54" width="16" height="11" rx="3" fill="rgba(255,255,255,.12)" />
              <path d="M59 59 h2 M43 58 l-6 2 M77 58 l6 2" />
            </g>
          )}

          {/* 카메라 스트랩 */}
          {s.camera && (
            <g>
              <path d="M44 104 C52 122 68 122 76 104" stroke="#2b241c" strokeWidth="3.5" fill="none" />
              <rect x="50" y="118" width="20" height="14" rx="2.5" fill="#2b241c" />
              <circle cx="60" cy="125" r="4.6" fill="#8a7a62" />
              <circle cx="60" cy="125" r="2.2" fill="#f4ecd8" opacity=".8" />
            </g>
          )}

          {/* 실루엣 처리 — L.은 역광이라 얼굴이 어둡다. 윤곽에만 빛이 걸린다. */}
          {s.silhouette && (
            <g>
              <ellipse cx="60" cy="57" rx="27" ry="33" fill="#241f1a" opacity=".85" />
              <path d="M38 40 C44 28 76 28 82 40" stroke="rgba(252,243,216,.5)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
              <path d="M34 50 C32 64 37 78 45 86" stroke="rgba(252,243,216,.28)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <ellipse cx="51" cy="59" rx="3.4" ry="1.7" fill="#cdbc95" opacity=".3" />
              <ellipse cx="69" cy="59" rx="3.4" ry="1.7" fill="#cdbc95" opacity=".3" />
            </g>
          )}

          <rect width="120" height="138" fill={`url(#grain-${id})`} />
          <rect width="120" height="138" fill={`url(#vig-${id})`} />
        </g>
      </svg>
    </div>
  );
}
