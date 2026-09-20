import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { cityById } from '../data/cities';
import { cardById } from '../data/cards';
import { missionById } from '../data/missions';
import { fmt, FX_EUR } from '../game/economy';
import { translateDisplay as display, useT, dayLabel, weekdayLabel } from '../i18n';

// ─── 소지품 칸 ──────────────────────────────────────────────────────────────
// 대사를 읽는 동안에도 "지금 내가 뭘 가졌는지"가 계속 보여야 한다.
// 시간 · 지갑 · 체력 · 지금 할 일 · 이번 취재에서 모은 카드 · 수집품.

export default function Satchel() {
  const t = useT();
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
        <div className="d">{display(dayLabel(s.lang, s.day))} <small>{display(weekdayLabel(s.lang, weekdayOf(s.day), WEEKDAYS))}</small></div>
        <div className="t">{display(clock(s.minute))}</div>
        <div className="c">{t(city.names.ko)}<small>{display(city.names.fr)}</small></div>
      </div>

      <div className="sat-block purse">
        <div className="k">{t('지갑')}</div>
        <div className="big">{display(fmt(s.wallet.EUR, 'EUR'))}</div>
        <div className="sub">{display(fmt(s.wallet[s.home], s.home))} · {t('합계')} ≈ €{display(Math.round(eurTotal))}</div>
        {display(s.debt > 0 && <div className="debt">{t('편집부 선지급 부채')} {display(fmt(s.debt, 'EUR'))}</div>)}
        {display(s.fxLost > 0 && <div className="sub">{t('수수료로 잃은 돈')} −{display(fmt(s.fxLost, 'EUR'))}</div>)}
      </div>

      <div className="sat-block">
        <div className="k">{t('체력')} <span className="v">{display(s.stamina)}</span></div>
        <div className={`bar${s.stamina < 30 ? ' low' : ''}`}><i style={{ width: `${s.stamina}%` }} /></div>
        <div className="k" style={{ marginTop: 8 }}>{t('작가 평판')} <span className="v">Lv {display(Math.floor(s.reputation / 5) + 1)} · {display(s.reputation)}p</span></div>
      </div>

      <div className="sat-block todo-mini">
        <div className="k">{t('지금 할 일')}</div>
        {m && s.active ? (
          <>
            <div className="t">「{t(m.title)}」</div>
            <div className="bar mission"><i style={{ width: `${pct}%` }} /></div>
            <div className="sub">{t(`${s.active.step + 1} / ${m.steps.length} 단계 · 퀴즈 오답 ${s.active.wrong}회`)}</div>
          </>
        ) : (
          <div className="sub">{t('진행 중인 취재가 없습니다. 도시 카드에서 취재를 시작하거나 지도에서 다음 도시로 가세요.')}</div>
        )}
      </div>

      <div className="sat-block grow">
        <div className="k">{m ? t('이번 취재에서 모은 사실') : t('최근에 모은 사실')} <span className="v">{display(m ? `${missionCards.length}/${m.cardIds.length}` : `${s.cards.length}`)}</span></div>
        <div className="sat-cards">
          {display(shown.length === 0 && <div className="sub">{t('아직 없습니다.')}</div>)}
          {display(shown.map((id) => <div className="sat-card" key={id}>{t(cardById(id).text)}</div>))}
          {display(m && missionCards.length < m.cardIds.length && (
            <div className="sub">{t(`남은 카드 ${m.cardIds.length - missionCards.length}장 — 장소를 더 보거나 퀴즈를 풀어야 합니다.`)}</div>
          ))}
        </div>
      </div>

      <div className="sat-block">
        <div className="k">{t('여권')} <span className="v">{t(`스탬프 ${s.stamps.length} · 수집품 ${s.collectibles.length}`)}</span></div>
        <div className="sat-stamps">
          {display(s.stamps.slice(-6).map((st) => <span className="mini-stamp" key={st.cityId}>{display(cityById(st.cityId).names.fr.slice(0, 3).toUpperCase())}</span>))}
          {display(s.stamps.length === 0 && <span className="sub">{t('아직 없습니다.')}</span>)}
        </div>
        {display(s.collectibles.slice(-2).map((c, i) => <div className="sub" key={i}>🎞 {t(c)}</div>))}
      </div>
    </aside>
  );
}
