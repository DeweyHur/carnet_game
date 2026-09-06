import { useState } from 'react';
import type { Currency, FactCard, Speaker } from '../game/types';
import { sourceById } from '../data/sources';
import { CURRENCY_META, FX_CHANNELS, FX_EUR, FX_DATE, convert, fmt, quote, type FxChannel } from '../game/economy';
import { useGame } from '../game/store';
import { cityById } from '../data/cities';

export function FactCardView({ card }: { card: FactCard }) {
  const src = sourceById(card.sourceId);
  return (
    <div className="factcard">
      <div className="t">{card.text}</div>
      <div className="src">출처: {src ? <a href={src.url} target="_blank" rel="noreferrer">{src.title}</a> : card.sourceId} · {src?.license}</div>
    </div>
  );
}

export function Avatar({ who, name, color }: { who: Speaker; name?: string; color?: string }) {
  const map: Record<Speaker, { txt: string; bg: string }> = {
    margot: { txt: '마', bg: '#7a2e2e' },
    L: { txt: 'L', bg: '#3b3b3b' },
    theo: { txt: '테', bg: '#2f5d8a' },
    echo: { txt: '記', bg: '#6b5a2a' },
    narrator: { txt: '…', bg: '#8a7a62' },
    player: { txt: '나', bg: '#4f7a4a' },
    guide: { txt: name?.slice(0, 1) ?? '안', bg: color ?? '#4f6d7a' },
  };
  const m = map[who];
  return <div className={`avatar${who === 'narrator' ? ' narr' : ''}`} style={{ background: m.bg }}>{m.txt}</div>;
}

/** 통화 병기: 현지 통화 크게 + 자국 통화 작게 (기획서 §3.3) */
export function Price({ amount, currency = 'EUR' }: { amount: number; currency?: Currency }) {
  const home = useGame((s) => s.home);
  return (
    <div className="price">
      {fmt(amount, currency)}
      {home !== currency && <small>≈ {fmt(convert(amount, currency, home), home)}</small>}
    </div>
  );
}

export function ExchangeForm({ defaultFrom, defaultTo, onDone }: { defaultFrom?: Currency; defaultTo?: Currency; onDone?: () => void }) {
  const wallet = useGame((s) => s.wallet);
  const home = useGame((s) => s.home);
  const exchange = useGame((s) => s.exchange);
  const [from, setFrom] = useState<Currency>(defaultFrom ?? home);
  const [to, setTo] = useState<Currency>(defaultTo ?? 'EUR');
  const [amount, setAmount] = useState<number>(defaultFrom === 'KRW' || (!defaultFrom && home === 'KRW') ? 300000 : 200);
  const [ch, setCh] = useState<FxChannel>('city');
  const curs: Currency[] = ['KRW', 'EUR', 'GBP', 'CHF'];
  const q = quote(amount, from, to, ch);
  const ok = amount > 0 && from !== to && wallet[from] >= amount;
  return (
    <div>
      <div className="fxboard">
        <div className="l h"><span>ECB 기준환율 (EUR=1)</span><span>{FX_DATE}</span></div>
        {curs.filter((c) => c !== 'EUR').map((c) => (
          <div className="l" key={c}><span>1 EUR = {FX_EUR[c].toLocaleString()} {c}</span><span>1 {c} = {(1 / FX_EUR[c]).toFixed(c === 'KRW' ? 5 : 3)} EUR</span></div>
        ))}
      </div>
      <div className="fx-form">
        <select value={from} onChange={(e) => setFrom(e.target.value as Currency)}>{curs.map((c) => <option key={c} value={c}>{c} {CURRENCY_META[c].name} (보유 {fmt(wallet[c], c)})</option>)}</select>
        <select value={to} onChange={(e) => setTo(e.target.value as Currency)}>{curs.map((c) => <option key={c} value={c}>→ {c} {CURRENCY_META[c].name}</option>)}</select>
        <input className="full" type="number" value={amount} min={0} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
      {(Object.keys(FX_CHANNELS) as FxChannel[]).map((k) => {
        const c = FX_CHANNELS[k];
        const qq = quote(amount, from, to, k);
        return (
          <div className="channel" key={k} style={{ borderColor: ch === k ? 'var(--ink)' : undefined }} onClick={() => setCh(k)}>
            <div><div className="cn">{ch === k ? '● ' : '○ '}{c.name} <span className="tag">{k === 'atm' ? `€${c.fixedEur} + ${(c.spread * 100).toFixed(1)}%` : `${(c.spread * 100).toFixed(1)}%`}</span></div><div className="ct">{c.tip}</div></div>
            <div className="cr">{fmt(qq.receive, to)}<small>−{fmt(qq.lost, to)} 손실</small></div>
          </div>
        );
      })}
      <div className="scene-actions">
        <span className="hint">기준환율이면 {fmt(q.mid, to)} — 스프레드로 {fmt(q.lost, to)}이 사라진다.</span>
        <button className="btn" disabled={!ok} onClick={() => { exchange(amount, from, to, ch); onDone?.(); }}>환전하기</button>
      </div>
    </div>
  );
}

export function cityName(id: string) { return cityById(id).names.ko; }
