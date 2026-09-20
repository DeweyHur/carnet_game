// ─── 프롤로그 배경 삽화 ─────────────────────────────────────────────────────
// 에셋 없이 코드로 그린 실루엣 배경. 오토크롬 인화처럼 따뜻하고 살짝 바랜 색.

export type BackdropKind = 'station' | 'passage' | 'box' | 'desk' | 'map';

export default function Backdrop({ kind }: { kind: BackdropKind }) {
  return (
    <svg className="backdrop" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6ecd2" />
          <stop offset="55%" stopColor="#e3d0a8" />
          <stop offset="100%" stopColor="#b79f74" />
        </linearGradient>
        <linearGradient id="bd-warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2e2c0" />
          <stop offset="100%" stopColor="#9d8259" />
        </linearGradient>
        <radialGradient id="bd-vig" cx="50%" cy="45%" r="70%">
          <stop offset="50%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(50,36,16,.55)" />
        </radialGradient>
        <pattern id="bd-grain" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".7" fill="rgba(90,70,40,.10)" />
          <circle cx="3.5" cy="3.5" r=".6" fill="rgba(255,250,230,.10)" />
        </pattern>
      </defs>

      <rect width="1200" height="700" fill="url(#bd-sky)" />

      {kind === 'station' && (
        <g>
          {/* 북역 유리 지붕 아치와 플랫폼 */}
          <path d="M0 700 L0 240 Q600 -40 1200 240 L1200 700 Z" fill="none" />
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M${60 + i * 130} 700 L${60 + i * 130} ${300 - Math.sin(i / 8 * Math.PI) * 190}`} stroke="rgba(70,52,30,.35)" strokeWidth="6" />
          ))}
          <path d="M0 250 Q600 30 1200 250" stroke="rgba(60,44,24,.6)" strokeWidth="12" fill="none" />
          <path d="M0 300 Q600 90 1200 300" stroke="rgba(60,44,24,.35)" strokeWidth="6" fill="none" />
          <rect x="0" y="560" width="1200" height="140" fill="rgba(58,44,26,.55)" />
          <rect x="150" y="430" width="420" height="140" rx="10" fill="rgba(40,32,22,.75)" />
          <rect x="180" y="455" width="360" height="52" rx="4" fill="rgba(230,215,180,.35)" />
          <circle cx="880" cy="470" r="26" fill="rgba(40,32,22,.8)" />
          <path d="M880 470 L880 452 M880 470 L893 476" stroke="#f0e2c2" strokeWidth="3" />
        </g>
      )}

      {kind === 'passage' && (
        <g>
          {/* 파사주: 유리 천장 복도 끝의 작은 잡지사 */}
          <path d="M0 0 L1200 0 L1200 700 L0 700 Z" fill="url(#bd-warm)" />
          <path d="M300 700 L470 180 L730 180 L900 700 Z" fill="rgba(238,224,192,.55)" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M${470 + i * 22} 180 L${300 + i * 50} 700`} stroke="rgba(80,60,34,.18)" strokeWidth="3" />
          ))}
          <path d="M470 180 Q600 96 730 180" stroke="rgba(60,44,24,.55)" strokeWidth="10" fill="none" />
          <rect x="520" y="360" width="160" height="240" rx="4" fill="rgba(44,34,24,.8)" />
          <rect x="545" y="392" width="110" height="80" fill="rgba(240,226,194,.5)" />
          <text x="600" y="345" textAnchor="middle" fontFamily="Georgia, serif" fontSize="30" fill="rgba(52,38,20,.85)" letterSpacing="4">CARNET</text>
          <rect x="0" y="600" width="1200" height="100" fill="rgba(58,44,26,.35)" />
        </g>
      )}

      {kind === 'box' && (
        <g>
          {/* 책상 위의 낡은 사진 상자 */}
          <rect x="0" y="380" width="1200" height="320" fill="rgba(74,54,32,.65)" />
          <g transform="translate(600 400)">
            <rect x="-210" y="-120" width="420" height="200" rx="6" fill="#6d5636" />
            <rect x="-210" y="-120" width="420" height="34" fill="#83693f" />
            <rect x="-190" y="-104" width="140" height="18" fill="rgba(240,230,200,.5)" />
          </g>
          {[[-330, -40, -9], [-120, -90, 5], [130, -60, -4], [320, -20, 11]].map(([x, y, r], i) => (
            <g key={i} transform={`translate(${600 + x} ${360 + y}) rotate(${r})`}>
              <rect x="-90" y="-70" width="180" height="150" fill="#f6efdc" stroke="rgba(70,52,30,.4)" />
              <rect x="-78" y="-58" width="156" height="110" fill={['#9fae92', '#c2a06e', '#8e9db0', '#b98d78'][i]} />
              <rect x="-78" y="58" width="90" height="6" fill="rgba(70,52,30,.25)" />
            </g>
          ))}
        </g>
      )}

      {kind === 'desk' && (
        <g>
          {/* 수첩과 펜, 커피 한 잔 */}
          <rect x="0" y="330" width="1200" height="370" fill="rgba(80,58,34,.7)" />
          <g transform="translate(560 420) rotate(-4)">
            <rect x="-250" y="-160" width="500" height="330" rx="8" fill="#6a4a2c" />
            <rect x="-234" y="-146" width="468" height="302" rx="5" fill="#f4ecd8" />
            {Array.from({ length: 8 }, (_, i) => (
              <path key={i} d={`M-200 ${-90 + i * 34} H200`} stroke="rgba(120,96,56,.28)" strokeWidth="2" />
            ))}
            <path d="M0 -146 V156" stroke="rgba(120,96,56,.35)" strokeWidth="3" />
          </g>
          <g transform="translate(960 470)">
            <ellipse cx="0" cy="60" rx="90" ry="20" fill="rgba(40,28,14,.25)" />
            <path d="M-56 -40 h112 l-14 96 h-84 z" fill="#efe6d0" />
            <path d="M-46 -30 h92 l-10 34 h-72 z" fill="#5a3b22" />
          </g>
          <path d="M210 520 l190 -120 l24 18 l-190 120 z" fill="#2b241c" />
          <path d="M424 418 l22 -14 l10 24 l-24 8 z" fill="#b8892b" />
        </g>
      )}

      {kind === 'map' && (
        <g>
          <rect x="0" y="0" width="1200" height="700" fill="url(#bd-warm)" />
          <path d="M320 120 L520 80 L700 140 L860 110 L940 260 L880 420 L700 520 L480 500 L340 380 Z"
            fill="rgba(246,238,218,.72)" stroke="rgba(70,52,30,.55)" strokeWidth="4" />
          {[[520, 220], [700, 300], [430, 360], [820, 240], [610, 440]].map(([x, y], i) => (
            <g key={i}><circle cx={x} cy={y} r="10" fill="#b5482f" /><circle cx={x} cy={y} r="20" fill="none" stroke="rgba(181,72,47,.4)" strokeWidth="2" /></g>
          ))}
          <path d="M520 220 L700 300 L820 240" stroke="rgba(47,93,138,.7)" strokeWidth="4" strokeDasharray="10 8" fill="none" />
        </g>
      )}

      <rect width="1200" height="700" fill="url(#bd-grain)" />
      <rect width="1200" height="700" fill="url(#bd-vig)" />
    </svg>
  );
}
