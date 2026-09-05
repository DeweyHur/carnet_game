import { useState } from 'react';
import { useGame } from '../game/store';
import { CARDS, cardById } from '../data/cards';
import { CITIES, cityById } from '../data/cities';
import { missionById } from '../data/missions';
import { ExchangeForm, FactCardView } from './common';
import { CURRENCY_META, fmt, FX_EUR } from '../game/economy';
import type { Currency } from '../game/types';

type Tab = 'cards' | 'wallet' | 'passport' | 'articles' | 'letters';

export default function Notebook({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('cards');
  const s = useGame();
  const curs = (Object.keys(s.wallet) as Currency[]).filter((c) => s.wallet[c] > 0 || c === 'EUR' || c === s.home);
  const guessErr = s.guesses.length ? s.guesses.reduce((a, g) => a + Math.abs(g.expected - g.actual) / g.actual, 0) / s.guesses.length : null;
  const recent = s.guesses.slice(-5);
  const recentErr = recent.length ? recent.reduce((a, g) => a + Math.abs(g.expected - g.actual) / g.actual, 0) / recent.length : null;
  return (
    <div className="drawer">
      <div className="drawer-head">
        <h2>CARNET · 수첩</h2>
        <button className="hud-btn" style={{ boxShadow: 'none' }} onClick={() => { if (confirm('저장을 지우고 처음부터 시작할까요?')) s.reset(); }}>새 게임</button>
        <button className="close" style={{ background: 'none', border: 'none', fontSize: 22 }} onClick={onClose}>×</button>
      </div>
      <div className="tabs">
        {(['cards', 'wallet', 'passport', 'articles', 'letters'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ cards: `사실 카드 ${s.cards.length}`, wallet: '지갑·환전', passport: '여권', articles: `기사 ${s.articles.length}`, letters: `편지 ${s.letters.length}` }[t]}</button>
        ))}
      </div>
      <div className="drawer-body">
        {tab === 'cards' && (
          <>
            <p className="blurb">모은 사실 카드 {s.cards.length}/{CARDS.length}. 문장마다 출처를 열 수 있습니다 — "실제 역사 기반"이라는 약속의 실체.</p>
            {CITIES.filter((c) => s.cards.some((id) => cardById(id).cityId === c.id)).map((c) => (
              <div key={c.id}>
                <div className="section-title">{c.names.ko} · {c.names.fr}</div>
                {s.cards.filter((id) => cardById(id).cityId === c.id).map((id) => <FactCardView key={id} card={cardById(id)} />)}
              </div>
            ))}
            {s.cards.length === 0 && <p className="blurb">아직 비어 있습니다. 미션에서 장소를 방문하고 퀴즈를 풀면 채워집니다.</p>}
          </>
        )}
        {tab === 'wallet' && (
          <>
            <div className="section-title">현금</div>
            {curs.map((c) => (
              <div className="wallet-row" key={c}><span>{CURRENCY_META[c].name} <small>{c}</small></span><span>{fmt(s.wallet[c], c)}{c !== 'EUR' && <small> ≈ {fmt(s.wallet[c] / FX_EUR[c], 'EUR')}</small>}</span></div>
            ))}
            <div className="wallet-row" style={{ borderTop: '1px solid var(--line)', marginTop: 4 }}><span>수수료·스프레드로 잃은 돈</span><span style={{ color: 'var(--accent)' }}>−{fmt(s.fxLost, 'EUR')}</span></div>
            {s.debt > 0 && <div className="wallet-row"><span>편집부 선지급 부채</span><span style={{ color: 'var(--accent)' }}>{fmt(s.debt, 'EUR')}</span></div>}
            <div className="section-title">환율 보드 · 환전</div>
            <ExchangeForm />
            <div className="section-title">가격 맞히기 기록 (KPI: 물가 체감)</div>
            {guessErr === null ? <p className="blurb">아직 기록 없음.</p> : (
              <p className="blurb">전체 평균 오차 <b>{Math.round(guessErr * 100)}%</b> · 최근 5회 평균 <b>{Math.round((recentErr ?? 0) * 100)}%</b> · 시도 {s.guesses.length}회<br />
                {s.guesses.slice(-8).reverse().map((g, i) => <span key={i}>{cityById(g.cityId).names.ko} {g.foodId}: 예상 €{g.expected} / 실제 €{g.actual}<br /></span>)}</p>
            )}
          </>
        )}
        {tab === 'passport' && (
          <>
            <div className="section-title">스탬프</div>
            <div>{s.stamps.map((st) => <span className="passport-stamp" key={st.cityId}>VISÉ · {cityById(st.cityId).names.fr.toUpperCase()}<br /><small>{st.day}일차</small></span>)}</div>
            {s.stamps.length === 0 && <p className="blurb">도시 미션을 완료하면 스탬프가 찍힙니다.</p>}
            <div className="section-title">방문 도시 {s.visited.length}/{CITIES.length}</div>
            <p className="blurb">{s.visited.map((v) => cityById(v).names.ko).join(' · ')}</p>
            <div className="section-title">수집품</div>
            {s.collectibles.length === 0 ? <p className="blurb">엽서·옛 화폐·오토크롬 복제본이 여기 모입니다.</p> : s.collectibles.map((c, i) => <div className="row" key={i}><div className="n">🎞 {c}</div></div>)}
          </>
        )}
        {tab === 'articles' && (
          <>
            {s.articles.length === 0 && <p className="blurb">송고한 기사가 없습니다.</p>}
            {[...s.articles].reverse().map((a, i) => (
              <div className="article-item" key={i}>
                <span className="g">{a.grade}</span><b>「{missionById(a.missionId).title}」</b> — {cityById(a.cityId).names.ko} · {a.day}일차 · 원고료 €{a.fee} · 카드 {a.cards.length}장
              </div>
            ))}
            <div className="section-title">작가 평판</div>
            <p className="blurb">{s.reputation}p · 원고료 배율 ×{(1 + s.reputation * 0.01).toFixed(2)}. 등급이 높을수록 평판이 빨리 오릅니다.</p>
          </>
        )}
        {tab === 'letters' && (
          <>
            {s.letters.length === 0 && <p className="blurb">L.의 편지는 지역 메인 미션을 완주하면 열립니다.</p>}
            {[...s.letters].reverse().map((l, i) => <div className="letter" key={i} style={{ marginBottom: 12 }}><h3>✉ {l.title} · {l.day}일차</h3>{l.text}</div>)}
          </>
        )}
      </div>
    </div>
  );
}
