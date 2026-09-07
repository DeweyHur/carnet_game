import { translateDisplay as display } from '../i18n';
import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { toEur, fmt } from '../game/economy';
import { cityById, REGIONS } from '../data/cities';
import type { Currency } from '../game/types';
import { useT, weekdayLabel, dayLabel } from '../i18n';
import LanguageSwitch from './LanguageSwitch';

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
      <div className="chip"><div className="k">{display(dayLabel(s.lang, s.day))} · {display(weekdayLabel(s.lang, weekdayOf(s.day), WEEKDAYS))}</div><div className="v">{display(clock(s.minute))}</div></div>
      <div className="chip" style={{ cursor: 'pointer' }} onClick={onCity}><div className="k">{t('현재 위치')} · {t(REGIONS[city.region].name)}</div><div className="v">{display(city.names.ko)}<small>{display(city.names.fr)}</small></div></div>
      <div className="chip" style={{ cursor: 'pointer' }} onClick={onNotebook}>
        <div className="k">{t('지갑')}</div>
        <div className="v">{display(fmt(s.wallet.EUR, 'EUR'))}<small>{display(fmt(s.wallet[s.home], s.home))} · {display(s.lang === 'en' ? 'total' : '합')} ≈ €{display(Math.round(eurTotal))}</small></div>
        {display(s.debt > 0 && <div className="k" style={{ color: 'var(--accent)' }}>{t('부채')} €{display(s.debt.toFixed(0))}</div>)}
      </div>
      <div className="chip"><div className="k">{t('체력')}</div><div className={`bar${s.stamina < 30 ? ' low' : ''}`}><i style={{ width: `${s.stamina}%` }} /></div></div>
      <div className="hud-spacer" />
      <LanguageSwitch />
      <button className="hud-btn icon" aria-label={display(s.muted ? t('소리 켜기') : t('소리 끄기'))} onClick={() => s.setMuted(!s.muted)}>{display(s.muted ? '🔇' : '🔊')}</button>
      <button className="hud-btn badge" data-n={unread || ''} onClick={onNotebook}>{t('수첩 · 여권 · 지갑')}</button>
    </div>
  );
}
