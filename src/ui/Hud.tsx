import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { FX_EUR, fmt } from '../game/economy';
import { cityById, REGIONS } from '../data/cities';
import { primeAudio, sfx } from '../game/audio';

/** 수첩 위에 얹히는 상태 표시줄 */
export default function Hud() {
  const s = useGame();
  const city = cityById(s.cityId);
  const eurTotal = s.wallet.EUR + s.wallet[s.home] / FX_EUR[s.home];
  const speeds: { ms: number; label: string }[] = [{ ms: 44, label: '느리게' }, { ms: 26, label: '보통' }, { ms: 12, label: '빠르게' }, { ms: 0, label: '즉시' }];

  return (
    <div className="hud">
      <div className="chip title"><div className="k">Carnet · 세계를 걷는 기록</div><div className="v">{s.playerName}</div></div>
      <div className="chip"><div className="k">{s.day}일차 · {WEEKDAYS[weekdayOf(s.day)]}요일</div><div className="v">{clock(s.minute)}</div></div>
      <div className="chip"><div className="k">현재 위치 · {REGIONS[city.region].name}</div><div className="v">{city.names.ko}<small>{city.names.fr}</small></div></div>
      <div className="chip">
        <div className="k">지갑</div>
        <div className="v">{fmt(s.wallet.EUR, 'EUR')}<small>{fmt(s.wallet[s.home], s.home)} · 합 ≈ €{Math.round(eurTotal)}</small></div>
        {s.debt > 0 && <div className="k" style={{ color: 'var(--accent)' }}>부채 €{s.debt.toFixed(0)}</div>}
      </div>
      <div className="chip"><div className="k">체력</div><div className={`bar${s.stamina < 30 ? ' low' : ''}`}><i style={{ width: `${s.stamina}%` }} /></div></div>
      <div className="chip"><div className="k">작가 평판</div><div className="v">Lv {Math.floor(s.reputation / 5) + 1}<small>{s.reputation}p · 카드 {s.cards.length}</small></div></div>
      <div className="hud-spacer" />
      <div className="chip opts">
        <button className={`opt${s.sound ? ' on' : ''}`} title="효과음" onClick={() => { primeAudio(); s.setSound(!s.sound); if (!s.sound) sfx.advance(); }}>{s.sound ? '🔊 소리 켬' : '🔇 소리 끔'}</button>
        <select className="opt" value={s.textSpeed} onChange={(e) => s.setTextSpeed(Number(e.target.value))} title="대사 속도">
          {speeds.map((x) => <option key={x.ms} value={x.ms}>대사 {x.label}</option>)}
        </select>
      </div>
    </div>
  );
}
