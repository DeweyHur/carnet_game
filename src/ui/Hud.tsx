import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { toEur, fmt } from '../game/economy';
import { cityById, REGIONS } from '../data/cities';
import type { Currency } from '../game/types';

interface Props { onNotebook: () => void; onCity: () => void }

export default function Hud({ onNotebook, onCity }: Props) {
  const s = useGame();
  const city = cityById(s.cityId);
  const eurTotal = (Object.keys(s.wallet) as Currency[]).reduce((sum, c) => sum + toEur(s.wallet[c], c), 0);
  const unread = s.letters.length;
  return (
    <div className="hud">
      <div className="chip title"><div className="k">Carnet · 세계를 걷는 기록</div><div className="v">{s.playerName}</div></div>
      <div className="chip"><div className="k">{s.day}일차 · {WEEKDAYS[weekdayOf(s.day)]}요일</div><div className="v">{clock(s.minute)}</div></div>
      <div className="chip" style={{ cursor: 'pointer' }} onClick={onCity}><div className="k">현재 위치 · {REGIONS[city.region].name}</div><div className="v">{city.names.ko}<small>{city.names.fr}</small></div></div>
      <div className="chip" style={{ cursor: 'pointer' }} onClick={onNotebook}>
        <div className="k">지갑</div>
        <div className="v">{fmt(s.wallet.EUR, 'EUR')}<small>{fmt(s.wallet[s.home], s.home)} · 합 ≈ €{Math.round(eurTotal)}</small></div>
        {s.debt > 0 && <div className="k" style={{ color: 'var(--accent)' }}>부채 €{s.debt.toFixed(0)}</div>}
      </div>
      <div className="chip"><div className="k">체력</div><div className={`bar${s.stamina < 30 ? ' low' : ''}`}><i style={{ width: `${s.stamina}%` }} /></div></div>
      <div className="chip"><div className="k">작가 평판</div><div className="v">Lv {Math.floor(s.reputation / 5) + 1}<small>{s.reputation}p · 카드 {s.cards.length}</small></div></div>
      <div className="hud-spacer" />
      <button className="hud-btn badge" data-n={unread || ''} onClick={onNotebook}>수첩 · 여권 · 지갑</button>
    </div>
  );
}
