import { translateDisplay as display } from '../i18n';
import { useState } from 'react';
import { useGame } from '../game/store';
import { CARDS, cardById } from '../data/cards';
import { CITIES, cityById } from '../data/cities';
import { missionById } from '../data/missions';
import { THEO_ROUTE, theoArrivalDay } from '../game/rival';
import { ExchangeForm, FactCardView } from './common';
import { CURRENCY_META, fmt, FX_EUR } from '../game/economy';
import type { Currency } from '../game/types';
import { PHOTOS, photoById, cityPhotos } from '../data/photos';
import TravelPhoto from './TravelPhoto';
import { useT, dayLabel } from '../i18n';

type Tab = 'album' | 'cards' | 'wallet' | 'passport' | 'articles' | 'letters';

export default function Notebook({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('album');
  const [albumCity, setAlbumCity] = useState('all');
  const s = useGame();
  const curs = (Object.keys(s.wallet) as Currency[]).filter((c) => s.wallet[c] > 0 || c === 'EUR' || c === s.home);
  const guessErr = s.guesses.length ? s.guesses.reduce((a, g) => a + Math.abs(g.expected - g.actual) / g.actual, 0) / s.guesses.length : null;
  const recent = s.guesses.slice(-5);
  const recentErr = recent.length ? recent.reduce((a, g) => a + Math.abs(g.expected - g.actual) / g.actual, 0) / recent.length : null;
  return (
    <div className="drawer">
      <div className="drawer-head">
        <h2>CARNET · {t('수첩')}</h2>
        <button className="hud-btn" style={{ boxShadow: 'none' }} onClick={() => { if (confirm(t('저장을 지우고 처음부터 시작할까요?'))) s.reset(); }}>{t('새 게임')}</button>
        <button className="close" aria-label={t('수첩 닫기')} style={{ background: 'none', border: 'none', fontSize: 22 }} onClick={onClose}>×</button>
      </div>
      <div className="tabs">
        {display((['album', 'cards', 'wallet', 'passport', 'articles', 'letters'] as Tab[]).map((tabId) => (
          <button key={tabId} className={tab === tabId ? 'on' : ''} onClick={() => setTab(tabId)}>{display({ album: `${s.lang === 'en' ? 'Photos' : '사진'} ${s.snapshots.length}`, cards: `${t('카드')} ${s.cards.length}`, wallet: t('지갑'), passport: t('여권'), articles: `${t('기사')} ${s.articles.length}`, letters: `${t('편지')} ${s.letters.length}` }[tabId])}</button>
        )))}
      </div>
      <div className="drawer-body">
        {display(tab === 'album' && <>
          <div className="album-intro"><span className="eyebrow">LES SOUVENIRS</span><h3>{t('여행이 남긴 장면들.')}</h3><p>{display(s.snapshots.length)} / {display(Object.keys(PHOTOS).length)}{t('장의 사진 · ')}{display(s.visitedPois.length)}{t('곳의 산책 · ')}{display(s.tastedFoods.length)}{t('가지의 맛')}</p></div>
          <div className="album-filters"><button className={albumCity === 'all' ? 'on' : ''} onClick={() => setAlbumCity('all')}>{t('전체')}</button>{display(s.visited.map((id) => <button key={id} className={albumCity === id ? 'on' : ''} onClick={() => setAlbumCity(id)}>{display(cityById(id).names.ko)}</button>))}</div>
          <div className="album-grid">{display(s.snapshots.filter((p) => albumCity === 'all' || p.cityId === albumCity).map((snapshot) => <div className="album-polaroid" key={snapshot.photoId}><TravelPhoto photo={photoById(snapshot.photoId)} /><small>{display(cityById(snapshot.cityId).names.ko)} · DAY {display(String(snapshot.day).padStart(2, '0'))}</small></div>))}</div>
          {display(s.snapshots.length === 0 && <div className="empty-note"><b>{t('첫 사진을 기다리는 페이지')}</b><p>{t("도시 화면의 '사진 담기'를 누르거나, 사진 산책에서 장소를 방문해보세요.")}</p><button className="btn" onClick={onClose}>{t('첫 풍경 만나러 가기 →')}</button></div>)}
          <div className="section-title">{t('앞으로 채워질 여행')}</div>
          <div className="album-destinations">{display(CITIES.map((city) => <div key={city.id}><span>{display(city.names.ko)}</span><small>{display(s.snapshots.filter((s) => s.cityId === city.id && !s.photoId.startsWith('food:')).length)} / {display(cityPhotos(city.id).length)}{t('장의 풍경')} {display(s.visited.includes(city.id) ? '' : t('· 미방문'))}</small></div>))}</div>
        </>)}
        {display(tab === 'cards' && (
          <>
            <p className="blurb">{display(s.lang === 'en' ? `Fact cards collected ${s.cards.length}/${CARDS.length}.` : `모은 사실 카드 ${s.cards.length}/${CARDS.length}.`)} {t('문장마다 출처를 열 수 있습니다 — "실제 역사 기반"이라는 약속의 실체.')}</p>
            {display(CITIES.filter((c) => s.cards.some((id) => cardById(id).cityId === c.id)).map((c) => (
              <div key={c.id}>
                <div className="section-title">{display(c.names.ko)} · {display(c.names.fr)}</div>
                {display(s.cards.filter((id) => cardById(id).cityId === c.id).map((id) => <FactCardView key={id} card={cardById(id)} />))}
              </div>
            )))}
            {display(s.cards.length === 0 && <p className="blurb">{t('아직 비어 있습니다. 미션에서 장소를 방문하고 퀴즈를 풀면 채워집니다.')}</p>)}
          </>
        ))}
        {display(tab === 'wallet' && (
          <>
            <div className="section-title">{t('현금')}</div>
            {display(curs.map((c) => (
              <div className="wallet-row" key={c}><span>{t(CURRENCY_META[c].name)} <small>{display(c)}</small></span><span>{display(fmt(s.wallet[c], c))}{display(c !== 'EUR' && <small> ≈ {display(fmt(s.wallet[c] / FX_EUR[c], 'EUR'))}</small>)}</span></div>
            )))}
            <div className="wallet-row" style={{ borderTop: '1px solid var(--line)', marginTop: 4 }}><span>{t('수수료·스프레드로 잃은 돈')}</span><span style={{ color: 'var(--accent)' }}>−{display(fmt(s.fxLost, 'EUR'))}</span></div>
            {display(s.debt > 0 && <div className="wallet-row"><span>{t('편집부 선지급 부채')}</span><span style={{ color: 'var(--accent)' }}>{display(fmt(s.debt, 'EUR'))}</span></div>)}
            <div className="section-title">{t('환율 보드 · 환전')}</div>
            <ExchangeForm />
            <div className="section-title">{t('가격표 맞추기 · 나의 물가 감각')}</div>
            {display(guessErr === null ? <p className="blurb">{t('아직 기록 없음.')}</p> : (
              <p className="blurb">{t('전체 평균 오차')} <b>{display(Math.round(guessErr * 100))}%</b> · {t('최근 5회 평균')} <b>{display(Math.round((recentErr ?? 0) * 100))}%</b> · {t('시도')} {display(s.guesses.length)}{display(s.lang === 'en' ? '' : '회')}<br />
                {display(s.guesses.slice(-8).reverse().map((g, i) => <span key={i}>{display(cityById(g.cityId).names.ko)} {display(g.foodId)}: {t('예상')} €{display(g.expected)} / {t('실제')} €{display(g.actual)}<br /></span>))}</p>
            ))}
          </>
        ))}
        {display(tab === 'passport' && (
          <>
            <div className="section-title">{t('스탬프')}</div>
            <div>{display(s.stamps.map((st) => <span className="passport-stamp" key={st.cityId}>VISÉ · {display(cityById(st.cityId).names.fr.toUpperCase())}<br /><small>{display(dayLabel(s.lang, st.day))}</small></span>))}</div>
            {display(s.stamps.length === 0 && <p className="blurb">{t('도시 미션을 완료하면 스탬프가 찍힙니다.')}</p>)}
            <div className="section-title">{t('방문 도시')} {display(s.visited.length)}/{display(CITIES.length)}</div>
            <p className="blurb">{display(s.visited.map((v) => cityById(v).names.ko).join(' · '))}</p>
            <div className="section-title">{t('수집품')}</div>
            {display(s.collectibles.length === 0 ? <p className="blurb">{t('엽서·옛 화폐·오토크롬 복제본이 여기 모입니다.')}</p> : s.collectibles.map((c, i) => <div className="row" key={i}><div className="n">🎞 {display(c)}</div></div>))}
            <div className="section-title">{t('테오의 경주')}</div>
            {display(s.theoStartDay === null ? (
              <p className="blurb">{t('불로뉴 메인 미션을 마치면 국경 너머에서 테오와의 경주가 시작됩니다.')}</p>
            ) : THEO_ROUTE.map((leg) => {
              const city = cityById(leg.cityId);
              const result = s.theoRace.find((r) => r.cityId === leg.cityId);
              const arrival = theoArrivalDay(leg.cityId, s.theoStartDay);
              const arrived = arrival !== null && s.day > arrival;
              return (
                <div className="row" key={leg.cityId}>
                  <div>
                    <div className="n">{display(city.names.ko)}</div>
                    <div className="s">
                      {display(result
                        ? (result.won ? t('먼저 도착해 특종을 냈다.') : t('테오가 먼저 도착해 특종은 없었다.'))
                        : (arrived ? t('테오가 이미 도착했다 — 지금 가면 특종을 놓친다.') : `${t('테오 도착 예정: ')}${dayLabel(s.lang, arrival!)}`))}
                    </div>
                  </div>
                  <span className="tag">{display(result ? (result.won ? '🏆' : '📰') : (arrived ? '🏃' : '⏳'))}</span>
                </div>
              );
            }))}
          </>
        ))}
        {display(tab === 'articles' && (
          <>
            {display(s.articles.length === 0 && <p className="blurb">{t('송고한 기사가 없습니다.')}</p>)}
            {display([...s.articles].reverse().map((a, i) => (
              <div className="article-item" key={i}>
                <span className="g">{display(a.grade)}</span><b>「{display(missionById(a.missionId).title)}」</b> — {display(cityById(a.cityId).names.ko)} · {display(dayLabel(s.lang, a.day))} · {display(s.lang === 'en' ? `fee €${a.fee}` : `원고료 €${a.fee}`)} · {display(s.lang === 'en' ? `${a.cards.length} cards` : `카드 ${a.cards.length}장`)}
              </div>
            )))}
            <div className="section-title">{t('작가 평판')}</div>
            <p className="blurb">{display(s.reputation)}p · {t('원고료 배율')} ×{display((1 + s.reputation * 0.01).toFixed(2))}{t('. 등급이 높을수록 평판이 빨리 오릅니다.')}</p>
          </>
        ))}
        {display(tab === 'letters' && (
          <>
            {display(s.letters.length === 0 && <p className="blurb">{t('L.의 편지는 지역 메인 미션을 완주하면 열립니다.')}</p>)}
            {display([...s.letters].reverse().map((l, i) => <div className="letter" key={i} style={{ marginBottom: 12 }}><h3>✉ {display(l.title)} · {display(dayLabel(s.lang, l.day))}</h3>{display(l.text)}</div>))}
          </>
        ))}
      </div>
    </div>
  );
}
