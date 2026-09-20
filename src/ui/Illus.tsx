// ─── 음식·장소 그림 ─────────────────────────────────────────────────────────
// "잠봉뵈르가 뭔지" 글자만 봐서는 모른다. 사진 에셋 없이 코드로 그린 SVG로 채운다.
// 데이터에 imageUrl이 생기면 그림 대신 실제 사진이 우선 쓰인다.

import type { ReactElement } from 'react';

const T = '#2b241c';      // 윤곽
const PLATE = '#f3ead6';  // 접시
const CRUST = '#d9a441';  // 빵 껍질
const CRUMB = '#f0dcae';  // 빵 속
const HAM = '#e08f8f';
const CHEESE = '#e8c45c';
const GREEN = '#7d9a5e';
const WINE = '#b5482f';

/** 접시 + 그림자 */
function Plate({ cy = 58, rx = 34 }: { cy?: number; rx?: number }) {
  return (
    <g>
      <ellipse cx="50" cy={cy + 3} rx={rx} ry={rx / 4.6} fill="rgba(70,52,30,.16)" />
      <ellipse cx="50" cy={cy} rx={rx} ry={rx / 4.6} fill={PLATE} stroke="rgba(70,52,30,.25)" />
    </g>
  );
}

/** 바게트 반쪽 — 잠봉뵈르·피셀 같은 샌드위치의 몸통 */
function Baguette({ y = 30 }: { y?: number }) {
  return (
    <g>
      <path d={`M14 ${y + 16} q6 -14 36 -14 q30 0 36 14 q-8 8 -36 8 q-28 0 -36 -8 z`} fill={CRUST} stroke={T} strokeWidth="1.2" />
      <path d={`M24 ${y + 6} l5 -5 M38 ${y + 3} l5 -5 M52 ${y + 3} l5 -5 M66 ${y + 6} l5 -5`} stroke="rgba(120,80,30,.55)" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

const FOOD: Record<string, () => ReactElement> = {
  // 바게트에 햄과 버터만 — 프랑스 국민 샌드위치
  'jambon-beurre': () => (
    <g>
      <Plate />
      <path d="M14 52 q4 -20 36 -20 q32 0 36 20 z" fill={CRUMB} stroke={T} strokeWidth="1.2" />
      <path d="M16 44 q10 6 34 6 q24 0 34 -6" stroke="#f7efd8" strokeWidth="3" fill="none" />
      <path d="M18 43 q8 5 14 3 q6 6 14 2 q8 6 16 1 q7 4 14 -2" stroke={HAM} strokeWidth="5" fill="none" strokeLinecap="round" />
      <Baguette y={16} />
    </g>
  ),
  croissant: () => (
    <g>
      <Plate rx={30} />
      <path d="M20 50 q-6 -20 12 -24 q18 -4 22 8 q4 12 16 10 q10 -2 10 6 q-14 6 -22 -2 q-8 -8 -18 -4 q-10 4 -8 12 z" fill={CRUST} stroke={T} strokeWidth="1.3" />
      <path d="M33 30 q4 8 2 16 M46 32 q2 8 -2 14 M58 40 q0 6 -3 9" stroke="rgba(120,80,30,.5)" strokeWidth="1.5" />
    </g>
  ),
  cafe: () => (
    <g>
      <Plate rx={26} />
      <path d="M32 26 h32 l-4 26 h-24 z" fill="#efe6d0" stroke={T} strokeWidth="1.3" />
      <path d="M34 30 h28 l-2 10 h-24 z" fill="#4a2c18" />
      <path d="M64 30 q10 0 10 8 q0 8 -9 8" fill="none" stroke={T} strokeWidth="2.4" />
      <path d="M42 18 q3 -5 0 -9 M52 18 q3 -5 0 -9" stroke="rgba(120,100,70,.5)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  ),
  croque: () => (
    <g>
      <Plate />
      <rect x="24" y="30" width="52" height="24" rx="3" fill={CRUMB} stroke={T} strokeWidth="1.2" />
      <path d="M24 32 q26 -10 52 0 l0 6 q-26 -8 -52 0 z" fill={CHEESE} stroke={T} strokeWidth="1" />
      <path d="M26 44 h48" stroke={HAM} strokeWidth="4" />
      <ellipse cx="50" cy="28" rx="15" ry="5" fill="#e9b94a" opacity=".8" />
    </g>
  ),
  'onion-soup': () => (
    <g>
      <Plate />
      <path d="M22 34 q28 10 56 0 l-6 20 q-22 8 -44 0 z" fill="#e2ceaa" stroke={T} strokeWidth="1.3" />
      <ellipse cx="50" cy="34" rx="28" ry="8" fill={CHEESE} stroke={T} strokeWidth="1.2" />
      <path d="M32 33 q8 -6 16 0 q8 -6 18 2" stroke="#c99a2e" strokeWidth="2" fill="none" />
    </g>
  ),
  'paris-brest': () => (
    <g>
      <Plate rx={30} />
      <ellipse cx="50" cy="40" rx="27" ry="15" fill={CRUST} stroke={T} strokeWidth="1.3" />
      <ellipse cx="50" cy="40" rx="11" ry="5" fill={PLATE} stroke={T} />
      <path d="M26 42 q10 8 24 8 q14 0 24 -8" stroke="#fff6e2" strokeWidth="4" fill="none" />
      <g fill="#fdf6e6">{[30, 42, 56, 68].map((x) => <circle key={x} cx={x} cy={30} r="2" />)}</g>
    </g>
  ),
  'lunch-formule': () => (
    <g>
      <Plate rx={32} />
      <ellipse cx="50" cy="52" rx="24" ry="7" fill="#fff9ea" stroke="rgba(70,52,30,.25)" />
      <path d="M36 46 q6 -12 16 -6 q10 6 14 6 z" fill={HAM} stroke={T} strokeWidth="1" />
      <ellipse cx="42" cy="48" rx="7" ry="3" fill={GREEN} />
      <path d="M14 30 v24 M14 30 l3 8 M18 30 l-2 8" stroke={T} strokeWidth="1.6" fill="none" />
      <path d="M86 30 v24 M86 30 q4 4 0 10" stroke={T} strokeWidth="1.6" fill="none" />
    </g>
  ),
  msemen: () => (
    <g>
      <Plate rx={28} />
      <rect x="28" y="34" width="44" height="18" rx="2" fill="#e6c98d" stroke={T} strokeWidth="1.2" transform="rotate(-4 50 43)" />
      <rect x="32" y="28" width="42" height="18" rx="2" fill="#eed8a6" stroke={T} strokeWidth="1.2" transform="rotate(3 50 37)" />
      <path d="M36 34 h34 M36 40 h34" stroke="rgba(150,110,50,.5)" strokeWidth="1.2" />
    </g>
  ),
  asperge: () => (
    <g>
      <Plate />
      <g stroke={T} strokeWidth="1.1">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(${-9 + i * 7} ${i % 2 ? 2 : 0}) rotate(${-8 + i * 5} 50 44)`}>
            <rect x="46" y="26" width="7" height="26" rx="3" fill="#e4e0c0" />
            <path d="M46 28 q3.5 -8 7 0 z" fill="#c9b9d6" />
          </g>
        ))}
      </g>
      <path d="M30 52 q20 6 40 0" stroke="#f0d98a" strokeWidth="3" fill="none" />
    </g>
  ),
  peche: () => (
    <g>
      <Plate rx={26} />
      <circle cx="46" cy="38" r="17" fill="#eda36f" stroke={T} strokeWidth="1.3" />
      <path d="M46 21 q0 17 0 34" stroke="rgba(150,80,40,.45)" strokeWidth="1.6" />
      <circle cx="40" cy="32" r="5" fill="rgba(255,240,210,.45)" />
      <path d="M48 21 q6 -8 14 -6 q-4 8 -13 8" fill={GREEN} stroke={T} strokeWidth="1" />
      <circle cx="70" cy="47" r="9" fill="#e08f5a" stroke={T} strokeWidth="1.2" />
    </g>
  ),
  'pate-chartres': () => (
    <g>
      <Plate />
      <path d="M26 32 h48 v20 q-24 6 -48 0 z" fill={CRUST} stroke={T} strokeWidth="1.3" />
      <ellipse cx="50" cy="32" rx="24" ry="6" fill="#e8bd72" stroke={T} strokeWidth="1.1" />
      <path d="M30 40 h40" stroke="#b07b45" strokeWidth="1.4" />
      <path d="M32 44 q8 -4 16 0 q8 4 18 -2" stroke="#c1806b" strokeWidth="4" fill="none" />
    </g>
  ),
  'macaron-amiens': () => (
    <g>
      <Plate rx={26} />
      <ellipse cx="38" cy="46" rx="13" ry="9" fill="#e0b073" stroke={T} strokeWidth="1.2" />
      <ellipse cx="62" cy="42" rx="13" ry="9" fill="#e8bd83" stroke={T} strokeWidth="1.2" />
      <path d="M25 46 q13 5 26 0 M49 42 q13 5 26 0" stroke="rgba(120,80,30,.4)" strokeWidth="1.2" fill="none" />
      <ellipse cx="50" cy="30" rx="12" ry="8" fill="#eec48d" stroke={T} strokeWidth="1.2" />
    </g>
  ),
  ficelle: () => (
    <g>
      <Plate />
      <path d="M22 32 q28 -8 56 0 l-4 22 q-24 8 -48 0 z" fill="#f0e2c0" stroke={T} strokeWidth="1.3" />
      <ellipse cx="50" cy="34" rx="28" ry="7" fill="#f6ecd2" />
      <path d="M30 36 q10 6 20 2 q10 -4 20 2" stroke="#c9a05a" strokeWidth="3" fill="none" />
      <g fill="#8a6a4a">{[[38, 42], [52, 45], [62, 41]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="4" ry="2.6" />)}</g>
    </g>
  ),
  'hort-veg': () => (
    <g>
      <path d="M24 34 h52 l-6 22 q-20 6 -40 0 z" fill="#c69a5e" stroke={T} strokeWidth="1.3" />
      <path d="M28 40 h44 M30 46 h40" stroke="rgba(90,60,30,.4)" strokeWidth="1.4" />
      <circle cx="38" cy="32" r="8" fill={WINE} stroke={T} strokeWidth="1" />
      <circle cx="54" cy="29" r="9" fill={GREEN} stroke={T} strokeWidth="1" />
      <path d="M66 32 q4 -12 10 -12 q-2 10 -6 13 z" fill="#8fae66" stroke={T} strokeWidth="1" />
      <path d="M24 34 q26 -8 52 0" stroke={T} strokeWidth="1.3" fill="none" />
    </g>
  ),
  'biscuit-rose': () => (
    <g>
      <Plate rx={26} />
      <g stroke={T} strokeWidth="1.2">
        <rect x="26" y="34" width="46" height="13" rx="4" fill="#e9a3ae" transform="rotate(-5 50 40)" />
        <rect x="30" y="42" width="46" height="13" rx="4" fill="#f2b8c1" transform="rotate(4 50 48)" />
      </g>
      <path d="M34 38 h30 M38 48 h30" stroke="rgba(255,255,255,.5)" strokeWidth="2" />
    </g>
  ),
  'champagne-glass': () => (
    <g>
      <Plate rx={22} />
      <path d="M38 16 h24 l-4 22 q-8 6 -16 0 z" fill="#f6e9a8" stroke={T} strokeWidth="1.3" />
      <path d="M40 24 h20" stroke="#fff" strokeWidth="1.5" opacity=".6" />
      <path d="M50 38 v14" stroke={T} strokeWidth="2" />
      <ellipse cx="50" cy="53" rx="12" ry="3.4" fill="#efe6d0" stroke={T} strokeWidth="1.2" />
      <g fill="#fff8d8">{[[45, 22], [53, 26], [48, 30], [55, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.4" />)}</g>
    </g>
  ),
  'jambon-reims': () => (
    <g>
      <Plate />
      <ellipse cx="44" cy="44" rx="18" ry="11" fill={HAM} stroke={T} strokeWidth="1.2" />
      <ellipse cx="44" cy="44" rx="10" ry="6" fill="#f0b4b4" />
      <ellipse cx="62" cy="48" rx="15" ry="9" fill="#e79b9b" stroke={T} strokeWidth="1.2" />
      <path d="M32 34 q12 -8 26 -2" stroke="#c97b7b" strokeWidth="2" fill="none" />
    </g>
  ),
  canard: () => (
    <g>
      <Plate />
      <g stroke={T} strokeWidth="1.1" fill="#9a5b45">
        <ellipse cx="42" cy="44" rx="14" ry="5" transform="rotate(-8 42 44)" />
        <ellipse cx="52" cy="48" rx="14" ry="5" transform="rotate(4 52 48)" />
        <ellipse cx="60" cy="42" rx="13" ry="5" transform="rotate(-3 60 42)" />
      </g>
      <path d="M28 52 q22 8 44 0" stroke="#6d2f2a" strokeWidth="4" fill="none" opacity=".8" />
      <path d="M66 32 q8 -4 10 2 q-6 4 -10 0 z" fill={GREEN} stroke={T} strokeWidth="1" />
    </g>
  ),
  'sucre-pomme': () => (
    <g>
      <Plate rx={24} />
      <rect x="44" y="12" width="12" height="40" rx="6" fill="#d4503f" stroke={T} strokeWidth="1.3" />
      <path d="M47 16 v32" stroke="rgba(255,255,255,.45)" strokeWidth="2.4" />
      <rect x="40" y="48" width="20" height="6" rx="2" fill="#efe6d0" stroke={T} strokeWidth="1.1" />
      <path d="M56 20 q10 -6 14 2 q-8 6 -14 0 z" fill="#f3d9a0" stroke={T} strokeWidth="1" />
    </g>
  ),
  carbonnade: () => (
    <g>
      <path d="M22 32 h56 l-5 22 q-23 7 -46 0 z" fill="#3f3a33" stroke={T} strokeWidth="1.3" />
      <ellipse cx="50" cy="32" rx="28" ry="8" fill="#6b3a24" stroke={T} strokeWidth="1.2" />
      <g fill="#8a4c2c">{[[42, 31], [55, 33], [49, 29], [60, 30]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="5" ry="2.6" />)}</g>
      <path d="M18 36 q-6 2 0 8 M82 36 q6 2 0 8" stroke={T} strokeWidth="2.4" fill="none" />
      <path d="M40 18 q3 -6 0 -10 M56 18 q3 -6 0 -10" stroke="rgba(120,100,70,.45)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  ),
  welsh: () => (
    <g>
      <Plate />
      <rect x="26" y="30" width="48" height="24" rx="4" fill="#d8cdb4" stroke={T} strokeWidth="1.3" />
      <path d="M28 32 q22 -8 44 0 q0 14 -6 18 q-16 5 -32 0 q-6 -6 -6 -18 z" fill="#e8b93f" stroke={T} strokeWidth="1.1" />
      <path d="M36 38 q8 6 16 0 q8 -6 14 2" stroke="#c9942a" strokeWidth="2" fill="none" />
    </g>
  ),
  moules: () => (
    <g>
      <path d="M20 34 q30 10 60 0 l-6 20 q-24 8 -48 0 z" fill="#4a6b7a" stroke={T} strokeWidth="1.3" />
      <g fill="#2f2a33" stroke={T} strokeWidth=".9">
        {[[34, 36, -18], [46, 40, 8], [58, 36, -6], [52, 32, 20]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx="8" ry="4.6" transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
      <g fill={CRUST} stroke={T} strokeWidth=".9">
        {[[74, 30, 70], [80, 36, 50], [76, 42, 84]].map(([x, y, r], i) => (
          <rect key={i} x={x - 2} y={y - 9} width="4" height="18" rx="1.5" transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
    </g>
  ),
  cotignac: () => (
    <g>
      <Plate rx={26} />
      <rect x="30" y="30" width="40" height="22" rx="2" fill="#a5794a" stroke={T} strokeWidth="1.3" />
      <rect x="30" y="30" width="40" height="6" fill="#bb8c58" stroke={T} strokeWidth="1" />
      <ellipse cx="50" cy="40" rx="13" ry="7" fill="#e58b2a" stroke={T} strokeWidth="1.1" />
      <ellipse cx="46" cy="38" rx="4" ry="2" fill="rgba(255,230,180,.6)" />
      <path d="M30 46 h40" stroke="rgba(60,40,20,.35)" strokeWidth="1.2" />
    </g>
  ),
};

/** 장소는 종류별로 한 장씩 */
const PLACE: Record<string, () => ReactElement> = {
  cathedral: () => (
    <g>
      <path d="M50 4 l4 8 h-8 z" fill={T} />
      <path d="M20 66 V30 l10 -10 v-6 l6 -6 l6 6 v6 l8 -8 l8 8 v-6 l6 -6 l6 6 v6 l10 10 v36 z" fill="#cbbd9c" stroke={T} strokeWidth="1.4" />
      <circle cx="50" cy="36" r="9" fill="#5a7fa8" stroke={T} strokeWidth="1.3" />
      <path d="M41 36 h18 M50 27 v18 M44 30 l12 12 M56 30 l-12 12" stroke={T} strokeWidth="1" />
      <path d="M44 66 v-16 q6 -8 12 0 v16 z" fill="#6b5236" stroke={T} strokeWidth="1.2" />
      <rect x="28" y="40" width="7" height="14" rx="3.5" fill="#5a7fa8" stroke={T} strokeWidth="1" />
      <rect x="65" y="40" width="7" height="14" rx="3.5" fill="#5a7fa8" stroke={T} strokeWidth="1" />
    </g>
  ),
  museum: () => (
    <g>
      <path d="M12 30 L50 12 L88 30 z" fill="#d8cbab" stroke={T} strokeWidth="1.4" />
      <rect x="14" y="30" width="72" height="5" fill="#c3b391" stroke={T} strokeWidth="1.2" />
      <g fill="#e6dcc0" stroke={T} strokeWidth="1.1">
        {[20, 34, 48, 62, 74].map((x) => <rect key={x} x={x} y="35" width="8" height="26" rx="1" />)}
      </g>
      <rect x="10" y="61" width="80" height="6" fill="#c3b391" stroke={T} strokeWidth="1.2" />
    </g>
  ),
  palace: () => (
    <g>
      <rect x="10" y="26" width="80" height="24" fill="#ddcfae" stroke={T} strokeWidth="1.3" />
      <path d="M36 20 h28 v6 h-28 z" fill="#e6dcc0" stroke={T} strokeWidth="1.2" />
      <g fill="#5a7fa8" stroke={T} strokeWidth=".9">
        {[16, 28, 40, 52, 64, 76].map((x) => <rect key={x} x={x} y="31" width="8" height="14" rx="4" />)}
      </g>
      <rect x="6" y="50" width="88" height="18" fill="#9fae86" stroke={T} strokeWidth="1.2" />
      <path d="M14 54 q36 -6 72 0 M14 62 q36 6 72 0" stroke="#7d9a5e" strokeWidth="2" fill="none" />
      <ellipse cx="50" cy="58" rx="9" ry="4" fill="#8fb0c4" stroke={T} strokeWidth="1" />
    </g>
  ),
  garden: () => (
    <g>
      <rect x="4" y="46" width="92" height="22" fill="#9fae86" stroke={T} strokeWidth="1.2" />
      <path d="M40 68 q10 -20 20 -22" stroke="#d8cbab" strokeWidth="8" fill="none" />
      <g stroke={T} strokeWidth="1.2">
        <circle cx="24" cy="34" r="13" fill="#6f8f56" /><rect x="22" y="44" width="4" height="10" fill="#6b5236" />
        <circle cx="72" cy="30" r="10" fill="#87a468" /><rect x="70" y="38" width="4" height="12" fill="#6b5236" />
      </g>
      <path d="M8 52 q14 -6 26 0 M64 54 q14 -6 24 0" stroke="#7d9a5e" strokeWidth="2.4" fill="none" />
    </g>
  ),
  market: () => (
    <g>
      <rect x="10" y="40" width="80" height="24" fill="#c69a5e" stroke={T} strokeWidth="1.3" />
      <path d="M6 28 h88 v10 h-88 z" fill={WINE} stroke={T} strokeWidth="1.2" />
      <g fill="#f4ecd8">{[14, 30, 46, 62, 78].map((x) => <rect key={x} x={x} y="28" width="8" height="10" />)}</g>
      <g stroke={T} strokeWidth="1">
        <circle cx="26" cy="46" r="5" fill={WINE} /><circle cx="38" cy="47" r="5" fill="#e0a83c" />
        <circle cx="52" cy="46" r="5" fill={GREEN} /><circle cx="66" cy="47" r="5" fill="#b8722e" />
      </g>
      <path d="M10 56 h80" stroke="rgba(90,60,30,.35)" strokeWidth="1.4" />
    </g>
  ),
  monument: () => (
    <g>
      <path d="M44 62 V20 l6 -12 l6 12 v42 z" fill="#d8cbab" stroke={T} strokeWidth="1.3" />
      <rect x="38" y="62" width="24" height="6" fill="#c3b391" stroke={T} strokeWidth="1.2" />
      <path d="M46 26 h8 M46 36 h8 M46 46 h8" stroke="rgba(90,70,40,.4)" strokeWidth="1.2" />
      <path d="M12 68 h76" stroke={T} strokeWidth="1.2" />
    </g>
  ),
  ruin: () => (
    <g>
      <path d="M10 66 V34 h14 v32 z M30 66 V28 h16 v38 z M52 66 V38 h12 v28 z" fill="#cdbfa0" stroke={T} strokeWidth="1.3" />
      <path d="M24 40 q6 -12 6 0 M46 34 q6 -10 6 0" fill="none" stroke={T} strokeWidth="1.3" />
      <path d="M70 66 V46 q8 -6 14 0 v20 z" fill="#c0b295" stroke={T} strokeWidth="1.3" />
      <path d="M6 66 h88" stroke={T} strokeWidth="1.4" />
    </g>
  ),
  cemetery: () => (
    <g>
      <rect x="4" y="52" width="92" height="16" fill="#9fae86" stroke={T} strokeWidth="1.2" />
      <g fill="#cdbfa0" stroke={T} strokeWidth="1.2">
        <path d="M18 54 V36 q8 -8 16 0 v18 z" />
        <rect x="44" y="34" width="12" height="20" rx="1" />
        <path d="M66 54 V40 q7 -7 14 0 v14 z" />
      </g>
      <path d="M50 30 v-8 M46 26 h8" stroke={T} strokeWidth="1.8" />
      <path d="M8 52 q10 -18 14 0" fill="#5d7a48" stroke={T} strokeWidth="1" />
    </g>
  ),
  boat: () => (
    <g>
      <rect x="0" y="44" width="100" height="24" fill="#6f92a0" />
      <path d="M8 46 q14 4 28 0 M60 52 q16 4 30 0" stroke="#9cbccb" strokeWidth="2" fill="none" />
      <path d="M22 44 h52 l-8 12 h-36 z" fill="#8a6a44" stroke={T} strokeWidth="1.3" />
      <path d="M46 44 V26 M46 26 q14 4 0 12" fill="#f0e6cc" stroke={T} strokeWidth="1.2" />
      <path d="M62 30 v16" stroke={T} strokeWidth="1.6" />
      <circle cx="34" cy="40" r="4" fill="#4f6d7a" stroke={T} strokeWidth="1" />
    </g>
  ),
  tour: () => (
    <g>
      <rect x="4" y="8" width="92" height="60" fill="#5a4a3c" />
      <path d="M20 68 V34 q30 -22 60 0 v34 z" fill="#7d6a52" stroke={T} strokeWidth="1.3" />
      <path d="M32 68 V40 q18 -14 36 0 v28 z" fill="#463a2c" />
      <g fill="#2a2420" stroke="#6b5a42" strokeWidth=".8">
        {[[38, 56], [46, 58], [54, 58], [62, 56]].map(([x, y], i) => <rect key={i} x={x} y={y} width="5" height="10" rx="2.5" />)}
      </g>
      <circle cx="50" cy="26" r="5" fill="#f0d98a" opacity=".8" />
    </g>
  ),
  venue: () => (
    <g>
      <rect x="0" y="52" width="100" height="16" fill="#6f92a0" />
      <path d="M18 56 q6 -34 34 -38 q26 -2 30 38 z" fill="#d8d2c2" stroke={T} strokeWidth="1.3" />
      <path d="M26 56 q6 -26 26 -30 q20 -2 24 30" fill="none" stroke="rgba(70,52,30,.35)" strokeWidth="1.2" />
      <path d="M52 18 q22 6 24 34" fill="none" stroke="#8fae66" strokeWidth="4" />
      <path d="M8 60 q16 4 30 0 M62 62 q16 4 30 0" stroke="#9cbccb" strokeWidth="2" fill="none" />
    </g>
  ),
  office: () => (
    <g>
      <rect x="16" y="20" width="68" height="46" fill="#d8cbab" stroke={T} strokeWidth="1.3" />
      <path d="M10 20 h80 l-6 -8 h-68 z" fill="#c3b391" stroke={T} strokeWidth="1.2" />
      <rect x="24" y="28" width="22" height="16" fill="#5a7fa8" stroke={T} strokeWidth="1" />
      <rect x="54" y="28" width="22" height="16" fill="#5a7fa8" stroke={T} strokeWidth="1" />
      <rect x="40" y="50" width="20" height="16" fill="#6b5236" stroke={T} strokeWidth="1.2" />
      <rect x="30" y="14" width="40" height="7" rx="2" fill={T} />
      <path d="M36 18 h28" stroke="#f4ecd8" strokeWidth="2" />
    </g>
  ),
  street: () => (
    <g>
      <rect x="4" y="16" width="30" height="50" fill="#d8cbab" stroke={T} strokeWidth="1.2" />
      <rect x="66" y="12" width="30" height="54" fill="#cdbfa0" stroke={T} strokeWidth="1.2" />
      <g fill="#5a7fa8" stroke={T} strokeWidth=".8">
        {[24, 38].map((y) => <rect key={y} x="10" y={y} width="8" height="12" rx="1" />)}
        {[20, 34, 48].map((y) => <rect key={y} x="74" y={y} width="8" height="12" rx="1" />)}
      </g>
      <path d="M34 66 L44 30 h12 l10 36 z" fill="#c7bda4" stroke={T} strokeWidth="1.2" />
      <path d="M46 66 l3 -28 M54 66 l-3 -28" stroke="rgba(90,70,40,.4)" strokeWidth="1.2" />
      <circle cx="50" cy="22" r="4" fill="#f0d98a" stroke={T} strokeWidth="1" />
    </g>
  ),
  heritage: () => (
    <g>
      <rect x="4" y="50" width="92" height="18" fill="#9fae86" stroke={T} strokeWidth="1.2" />
      <path d="M8 50 V24 h84 v26 z" fill="#d6c6a2" stroke={T} strokeWidth="1.3" />
      <path d="M8 32 h84 M8 41 h84 M30 24 v26 M56 24 v26" stroke="rgba(110,85,50,.35)" strokeWidth="1.2" />
      <g stroke={T} strokeWidth="1">
        <circle cx="24" cy="40" r="6" fill="#e39a63" /><circle cx="50" cy="36" r="6" fill="#eda36f" /><circle cx="74" cy="41" r="6" fill="#e08f5a" />
      </g>
      <path d="M16 50 q8 -10 16 0 M60 50 q10 -12 20 0" fill="none" stroke="#6f8f56" strokeWidth="2" />
    </g>
  ),
};

const PLACE_ALIAS: Record<string, keyof typeof PLACE> = {
  chapel: 'cathedral', site: 'street', square: 'street', walk: 'street', ruin: 'ruin', venue: 'venue',
};

interface Props {
  kind: 'food' | 'place';
  /** 음식은 id, 장소는 poi.type */
  id: string;
  /** 실제 사진이 생기면 그림 대신 이걸 쓴다 */
  imageUrl?: string;
  alt?: string;
  className?: string;
}

export default function Illus({ kind, id, imageUrl, alt, className }: Props) {
  if (imageUrl) return <div className={`illus photo ${className ?? ''}`}><img src={imageUrl} alt={alt ?? ''} /></div>;
  const draw = kind === 'food'
    ? FOOD[id]
    : PLACE[PLACE_ALIAS[id] ?? id] ?? PLACE.street;
  if (!draw) return <div className={`illus blank ${className ?? ''}`} aria-hidden />;
  return (
    <div className={`illus ${className ?? ''}`} aria-hidden>
      <svg viewBox="0 0 100 72" preserveAspectRatio="xMidYMid meet">
        <rect width="100" height="72" fill="#efe4c8" />
        <rect width="100" height="72" fill="url(#illus-vig)" />
        {draw()}
      </svg>
    </div>
  );
}

/** 그림자·질감용 그라디언트를 한 번만 정의한다 (App에서 한 번 렌더) */
export function IllusDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <radialGradient id="illus-vig" cx="50%" cy="42%" r="72%">
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(80,58,24,.28)" />
        </radialGradient>
      </defs>
    </svg>
  );
}
