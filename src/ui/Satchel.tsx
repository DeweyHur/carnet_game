import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { cityById } from '../data/cities';
import { cardById } from '../data/cards';
import { missionById } from '../data/missions';
import { fmt, FX_EUR } from '../game/economy';

// ─── 소지품 칸 ──────────────────────────────────────────────────────────────
// 대사를 읽는 동안에도 "지금 내가 뭘 가졌는지"가 계속 보여야 한다.
// 시간 · 지갑 · 체력 · 지금 할 일 · 이번 취재에서 모은 카드 · 수집품.

export default function Satchel() {
  const s = useGame();
  const city = cityById(s.cityId);
  const eurTotal = s.wallet.EUR + s.wallet[s.home] / FX_EUR[s.home];
  const m = s.active ? missionById(s.active.missionId) : null;
  const pct = m && s.active ? Math.round(((s.active.step + 1) / m.steps.length) * 100) : 0;

  // 이번 취재에서 모은 카드 (없으면 최근에 모은 것)
  const missionCards = m ? m.cardIds.filter((id) => s.cards.includes(id)) : [];
  const recent = s.cards.slice(-3).reverse();
  const shown = m ? missionCards : recent;

  return (
    <aside className="satchel">
      <div className="sat-clock">
        <div className="d">{s.day}일차 <small>{WEEKDAYS[weekdayOf(s.day)]}요일</small></div>
        <div className="t">{clock(s.minute)}</div>
        <div className="c">{city.names.ko}<small>{city.names.fr}</small></div>
      </div>

      <div className="sat-block purse">
        <div className="k">지갑</div>
        <div className="big">{fmt(s.wallet.EUR, 'EUR')}</div>
        <div className="sub">{fmt(s.wallet[s.home], s.home)} · 합 ≈ €{Math.round(eurTotal)}</div>
        {s.debt > 0 && <div className="debt">편집부 선지급 부채 {fmt(s.debt, 'EUR')}</div>}
        {s.fxLost > 0 && <div className="sub">수수료로 잃은 돈 −{fmt(s.fxLost, 'EUR')}</div>}
      </div>

      <div className="sat-block">
        <div className="k">체력 <span className="v">{s.stamina}</span></div>
        <div className={`bar${s.stamina < 30 ? ' low' : ''}`}><i style={{ width: `${s.stamina}%` }} /></div>
        <div className="k" style={{ marginTop: 8 }}>작가 평판 <span className="v">Lv {Math.floor(s.reputation / 5) + 1} · {s.reputation}p</span></div>
      </div>

      <div className="sat-block todo-mini">
        <div className="k">지금 할 일</div>
        {m && s.active ? (
          <>
            <div className="t">「{m.title}」</div>
            <div className="bar mission"><i style={{ width: `${pct}%` }} /></div>
            <div className="sub">{s.active.step + 1} / {m.steps.length} 단계 · 퀴즈 오답 {s.active.wrong}회</div>
          </>
        ) : (
          <div className="sub">진행 중인 취재가 없습니다. 「오늘」에서 취재를 시작하거나 지도에서 다음 도시로 가세요.</div>
        )}
      </div>

      <div className="sat-block grow">
        <div className="k">{m ? '이번 취재에서 모은 사실' : '최근에 모은 사실'} <span className="v">{m ? `${missionCards.length}/${m.cardIds.length}` : `총 ${s.cards.length}`}</span></div>
        <div className="sat-cards">
          {shown.length === 0 && <div className="sub">아직 없습니다.</div>}
          {shown.map((id) => <div className="sat-card" key={id}>{cardById(id).text}</div>)}
          {m && missionCards.length < m.cardIds.length && (
            <div className="sub">남은 카드 {m.cardIds.length - missionCards.length}장 — 장소를 더 보거나 퀴즈를 풀어야 합니다.</div>
          )}
        </div>
      </div>

      <div className="sat-block">
        <div className="k">여권 <span className="v">스탬프 {s.stamps.length} · 수집품 {s.collectibles.length}</span></div>
        <div className="sat-stamps">
          {s.stamps.slice(-6).map((st) => <span className="mini-stamp" key={st.cityId}>{cityById(st.cityId).names.fr.slice(0, 3).toUpperCase()}</span>)}
          {s.stamps.length === 0 && <span className="sub">아직 없습니다.</span>}
        </div>
        {s.collectibles.slice(-2).map((c, i) => <div className="sub" key={i}>🎞 {c}</div>)}
      </div>
    </aside>
  );
}
