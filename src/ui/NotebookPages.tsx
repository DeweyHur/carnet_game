import { useGame } from '../game/store';
import { CARDS, cardById } from '../data/cards';
import { CITIES, cityById } from '../data/cities';
import { missionById } from '../data/missions';
import { ExchangeForm, FactCardView } from './common';
import Portrait from './Portrait';
import { CURRENCY_META, fmt, FX_EUR } from '../game/economy';
import type { Currency } from '../game/types';

export type PageTab = 'cards' | 'people' | 'wallet' | 'passport' | 'articles' | 'letters';

/** 수첩의 각 페이지 본문 (오늘·지도 탭은 Home이 직접 그린다) */
export default function NotebookPage({ tab }: { tab: PageTab }) {
  const s = useGame();
  const curs = (Object.keys(s.wallet) as Currency[]).filter((c) => s.wallet[c] > 0 || c === 'EUR' || c === s.home);
  const guessErr = s.guesses.length ? s.guesses.reduce((a, g) => a + Math.abs(g.expected - g.actual) / g.actual, 0) / s.guesses.length : null;
  const recent = s.guesses.slice(-5);
  const recentErr = recent.length ? recent.reduce((a, g) => a + Math.abs(g.expected - g.actual) / g.actual, 0) / recent.length : null;

  if (tab === 'cards') return (
    <>
      <div className="page-title">사실 카드 <small>{s.cards.length} / {CARDS.length}</small></div>
      <p className="blurb">취재하며 모은 문장들. 문장마다 출처를 열 수 있습니다 — "실제 역사 기반"이라는 약속의 실체입니다.</p>
      {CITIES.filter((c) => s.cards.some((id) => cardById(id).cityId === c.id)).map((c) => (
        <div key={c.id}>
          <div className="section-title">{c.names.ko} · {c.names.fr}</div>
          {s.cards.filter((id) => cardById(id).cityId === c.id).map((id) => <FactCardView key={id} card={cardById(id)} />)}
        </div>
      ))}
      {s.cards.length === 0 && <p className="blurb empty">아직 비어 있습니다. 미션에서 장소를 방문하고 퀴즈를 풀면 한 장씩 붙습니다.</p>}
    </>
  );

  if (tab === 'people') {
    const met = CITIES.filter((c) => s.metGuides.includes(c.id));
    const rest = CITIES.filter((c) => !s.metGuides.includes(c.id));
    return (
      <>
        <div className="page-title">사람들 <small>{met.length} / {CITIES.length}</small></div>
        <p className="blurb">도시마다 한 사람이 당신을 안내합니다. 만난 사람은 여기 남습니다 — 이름, 하는 일, 그리고 처음 건넨 한마디.</p>
        {met.length === 0 && <p className="blurb empty">아직 아무도 만나지 않았습니다.</p>}
        <div className="people">
          {met.map((c) => (
            <div className="person" key={c.id}>
              <Portrait who="guide" name={c.guide.name} color={c.guide.color} look={c.guide.look} expression={c.guide.mood ?? 'neutral'} size={96} />
              <div className="p-body">
                <div className="p-name">{c.guide.name}<span className="p-job">{c.guide.archetype}</span></div>
                <div className="p-city">{c.names.ko} · {c.names.fr}</div>
                <p className="p-quote">{c.guide.intro}</p>
              </div>
            </div>
          ))}
        </div>
        {rest.length > 0 && (
          <>
            <div className="section-title">아직 만나지 못한 사람 {rest.length}</div>
            <div className="people unmet">
              {rest.map((c) => (
                <div className="person" key={c.id}>
                  <div className="p-silhouette">?</div>
                  <div className="p-body"><div className="p-name">{c.names.ko}</div><div className="p-city">{c.guide.archetype}</div></div>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  if (tab === 'wallet') return (
    <>
      <div className="page-title">지갑 · 환전</div>
      <div className="section-title">현금</div>
      {curs.map((c) => (
        <div className="wallet-row" key={c}><span>{CURRENCY_META[c].name} <small>{c}</small></span><span>{fmt(s.wallet[c], c)}{c !== 'EUR' && <small> ≈ {fmt(s.wallet[c] / FX_EUR[c], 'EUR')}</small>}</span></div>
      ))}
      <div className="wallet-row" style={{ borderTop: '1px solid var(--line)', marginTop: 4 }}><span>수수료·스프레드로 잃은 돈</span><span style={{ color: 'var(--accent)' }}>−{fmt(s.fxLost, 'EUR')}</span></div>
      {s.debt > 0 && <div className="wallet-row"><span>편집부 선지급 부채</span><span style={{ color: 'var(--accent)' }}>{fmt(s.debt, 'EUR')}</span></div>}
      <div className="section-title">환율 보드 · 환전</div>
      <ExchangeForm />
      <div className="section-title">가격 맞히기 기록</div>
      {guessErr === null ? <p className="blurb empty">아직 기록 없음.</p> : (
        <p className="blurb">전체 평균 오차 <b>{Math.round(guessErr * 100)}%</b> · 최근 5회 평균 <b>{Math.round((recentErr ?? 0) * 100)}%</b> · 시도 {s.guesses.length}회<br />
          {s.guesses.slice(-8).reverse().map((g, i) => <span key={i}>{cityById(g.cityId).names.ko} {g.foodId}: 예상 €{g.expected} / 실제 €{g.actual}<br /></span>)}</p>
      )}
    </>
  );

  if (tab === 'passport') return (
    <>
      <div className="page-title">여권</div>
      <div className="section-title">스탬프</div>
      <div>{s.stamps.map((st) => <span className="passport-stamp" key={st.cityId}>VISÉ · {cityById(st.cityId).names.fr.toUpperCase()}<br /><small>{st.day}일차</small></span>)}</div>
      {s.stamps.length === 0 && <p className="blurb empty">도시 미션을 완료하면 스탬프가 찍힙니다.</p>}
      <div className="section-title">방문 도시 {s.visited.length}/{CITIES.length}</div>
      <p className="blurb">{s.visited.map((v) => cityById(v).names.ko).join(' · ')}</p>
      <div className="section-title">수집품</div>
      {s.collectibles.length === 0 ? <p className="blurb empty">엽서·옛 화폐·오토크롬 복제본이 여기 모입니다.</p> : s.collectibles.map((c, i) => <div className="row" key={i}><div className="n">🎞 {c}</div></div>)}
    </>
  );

  if (tab === 'articles') return (
    <>
      <div className="page-title">송고한 기사 <small>{s.articles.length}편</small></div>
      {s.articles.length === 0 && <p className="blurb empty">아직 송고한 기사가 없습니다.</p>}
      {[...s.articles].reverse().map((a, i) => (
        <div className="article-item" key={i}>
          <span className="g">{a.grade}</span><b>「{missionById(a.missionId).title}」</b> — {cityById(a.cityId).names.ko} · {a.day}일차 · 원고료 €{a.fee} · 카드 {a.cards.length}장
        </div>
      ))}
      <div className="section-title">작가 평판</div>
      <p className="blurb">{s.reputation}p · 원고료 배율 ×{(1 + s.reputation * 0.01).toFixed(2)}. 등급이 높을수록 평판이 빨리 오릅니다.</p>
    </>
  );

  return (
    <>
      <div className="page-title">L.의 편지 <small>{s.letters.length}통</small></div>
      {s.letters.length === 0 && <p className="blurb empty">L.의 편지는 지역 메인 미션을 완주하면 한 통씩 열립니다.</p>}
      {[...s.letters].reverse().map((l, i) => <div className="letter" key={i} style={{ marginBottom: 12 }}><h3>✉ {l.title} · {l.day}일차</h3>{l.text}</div>)}
    </>
  );
}
