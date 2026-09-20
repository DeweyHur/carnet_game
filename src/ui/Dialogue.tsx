import { useEffect, type ReactNode } from 'react';
import Portrait from './Portrait';
import { useTypewriter } from './useTypewriter';
import { useGame } from '../game/store';
import { primeAudio, sfx, type VoiceId } from '../game/audio';
import type { GuideLook, Speaker } from '../game/types';
import { BASE_EXPRESSION, inferExpression, type Expression } from '../game/expression';

export const SPEAKER_ROLE: Record<Speaker, string> = {
  margot: '《Carnet》 편집장', L: '실종된 선배', theo: '라이벌 작가',
  echo: '기록의 재구성', narrator: '', player: '', guide: '',
};

const VOICE: Record<Speaker, VoiceId> = {
  margot: 'margot', L: 'L', theo: 'theo', echo: 'echo',
  narrator: 'narrator', player: 'player', guide: 'guide',
};

interface Props {
  who: Speaker;
  /** 안내인·메아리처럼 이름이 데이터에서 오는 화자 */
  name?: string;
  role?: string;
  color?: string;
  /** 안내인 생김새 (도시 데이터) */
  look?: GuideLook;
  text: string;
  /** 이 화자의 기본 표정 (안내인은 도시 데이터의 mood). 없으면 캐스트 기본값 */
  mood?: Expression;
  /** 메아리 대사의 창작/인용 표시 */
  fiction?: boolean;
  /** 눌러서 다음으로. 없으면 아래 상호작용을 기다리는 상태 */
  onAdvance?: () => void;
  nextLabel?: string;
  /** 대사창 오른쪽 아래에 붙는 버튼 등 */
  actions?: ReactNode;
}

export default function Dialogue({ who, name, role, color, look, text, mood, fiction, onAdvance, nextLabel = '계속', actions }: Props) {
  const sound = useGame((s) => s.sound);
  const speed = useGame((s) => s.textSpeed);
  const playerName = useGame((s) => s.playerName);
  const { shown, done, skip } = useTypewriter(text, { speed, voice: VOICE[who], sound, animate: speed > 0 });
  // 대사를 다 읽고 나면 그 문장에 맞는 표정으로 바뀐다 — 말하는 동안은 기본 표정
  const base = mood ?? BASE_EXPRESSION[who];
  const expression = done ? inferExpression(text, base) : base;

  const label = who === 'player' ? (playerName || '나')
    : who === 'guide' ? (name ?? '안내인')
    : who === 'echo' ? (name ?? '메아리')
    : { margot: '마고 뒤랑', L: 'L.', theo: '테오', narrator: '', player: '나', guide: '', echo: '' }[who];

  const click = () => {
    primeAudio();
    if (!done) { skip(); return; }
    if (onAdvance) { sfx.advance(); onAdvance(); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const t = e.target as HTMLElement | null;
      if (t && /INPUT|TEXTAREA|SELECT|BUTTON/.test(t.tagName)) return;
      e.preventDefault();
      click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const narr = who === 'narrator';

  return (
    <div className={`vn-box${narr ? ' narr' : ''}${onAdvance && done ? ' clickable' : ''}`} onClick={click}>
      <Portrait who={who} name={name} color={color} look={look} talking={!done} expression={expression} size={narr ? 96 : 132} />
      <div className="vn-text">
        {!narr && <div className="vn-name">{label}{(role ?? SPEAKER_ROLE[who]) && <span className="role">{role ?? SPEAKER_ROLE[who]}</span>}</div>}
        <p className="vn-line">{shown}<span className="caret" style={{ opacity: done ? 0 : 1 }}>▏</span></p>
        {who === 'echo' && done && (
          <div className="fiction">{fiction ? '✎ 창작 대사 — 실제 기록·저작을 바탕으로 재구성한 문장입니다.' : '❝ 기록 인용 — 실제 저작·서한·기록에 근거한 문장입니다.'}</div>
        )}
        <div className="vn-foot" onClick={(e) => e.stopPropagation()}>
          {actions}
          {onAdvance && <button className="btn sm" onClick={click}>{done ? `${nextLabel} ▸` : '전부 보기 ⏩'}</button>}
        </div>
      </div>
      {onAdvance && done && <span className="vn-caret">▼</span>}
    </div>
  );
}
