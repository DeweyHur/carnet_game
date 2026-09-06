import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { toEur, fmt } from '../game/economy';
import { cityById, REGIONS } from '../data/cities';
import type { Currency } from '../game/types';
import { useT, weekdayLabel, dayLabel } from '../i18n';

interface Props { onNotebook: () => void; onCity: () => void }

export default function Hud({ onNotebook, onCity }: Props) {
  const s = useGame();
  const t = useT();
  const city = cityById(s.cityId);
  const eurTotal = (Object.keys(s.wallet) as Currency[]).reduce((sum, c) => sum + toEur(s.wallet[c], c), 0);
  const unread = s.letters.length;
  return (
    <div className="hud">
      <div className="chip title"><div className="k">Carnet · {t('세계를 걷는 기록')}</div><div className="v">{s.playerName}</div></div>
      <div className="chip"><div className="k">{dayLabel(s.lang, s.day)} · {weekdayLabel(s.lang, weekdayOf(s.day), WEEKDAYS)}</div><div className="v">{clock(s.minute)}</div></div>
      <div className="chip" style={{ cursor: 'pointer' }} onClick={onCity}><div className="k">{t('현재 위치')} · {t(REGIONS[city.region].name)}</div><div className="v">{city.names.ko}<small>{city.names.fr}</small></div></div>
      <div className="chip" style={{ cursor: 'pointer' }} onClick={onNotebook}>
        <div className="k">{t('지갑')}</div>
        <div className="v">{fmt(s.wallet.EUR, 'EUR')}<small>{fmt(s.wallet[s.home], s.home)} · {s.lang === 'en' ? 'total' : '합'} ≈ €{Math.round(eurTotal)}</small></div>
        {s.debt > 0 && <div className="k" style={{ color: 'var(--accent)' }}>{t('부채')} €{s.debt.toFixed(0)}</div>}
      </div>
      <div className="chip"><div className="k">{t('체력')}</div><div className={`bar${s.stamina < 30 ? ' low' : ''}`}><i style={{ width: `${s.stamina}%` }} /></div></div>
      <div className="chip"><div className="k">{t('작가 평판')}</div><div className="v">Lv {Math.floor(s.reputation / 5) + 1}<small>{s.reputation}p · {s.lang === 'en' ? 'cards' : '카드'} {s.cards.length}</small></div></div>
      <div className="hud-spacer" />
      <button className="hud-btn badge" data-n={unread || ''} onClick={onNotebook}>{t('수첩 · 여권 · 지갑')}</button>
    </div>
  );
}
