import { useState } from 'react';
import { useGame } from '../game/store';
import type { Currency } from '../game/types';
import { CURRENCY_META, FX_EUR, fmt } from '../game/economy';

export default function Intro() {
  const newGame = useGame((s) => s.newGame);
  const [name, setName] = useState('');
  const [home, setHome] = useState<Currency>('KRW');
  return (
    <div className="intro">
      <div className="intro-card">
        <h1>CARNET<small>세계를 걷는 기록 — 프로토타입 v0.1 (일드프랑스 · 프랑스 북부)</small></h1>
        <p>당신은 파리의 작은 여행·역사 잡지 《Carnet》의 신입 작가다. 실종된 선배 L.이 남긴 사진 상자를 따라 도시를 취재하고, 사실 카드로 기사를 써서 원고료를 받고, 그 돈으로 다음 도시로 떠난다.</p>
        <p style={{ fontSize: 13 }}>실제 지도 · 실제 열차 시간과 요금(예시) · 실제 환율과 물가 · 실제 역사. 모든 사실 카드에는 출처가 붙는다.</p>
        <label>작가 이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김카르네" /></label>
        <label>출신국 통화 (자국 통화 — 모든 가격에 병기됩니다)
          <select value={home} onChange={(e) => setHome(e.target.value as Currency)}>
            {(['KRW', 'GBP', 'CHF', 'EUR'] as Currency[]).map((c) => <option key={c} value={c}>{c} · {CURRENCY_META[c].name} — 시작 예산 {fmt(2000 * FX_EUR[c], c)}</option>)}
          </select>
        </label>
        <div className="actions">
          <button className="btn red" onClick={() => newGame(name, home)}>첫 출근 ▸</button>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>시작: 2026-09-08 화요일 09:00, 파리</span>
        </div>
        <div className="credit">지도: © OpenStreetMap contributors · OpenFreeMap. 사실: Wikipedia(CC BY-SA)·Wikidata(CC0)·기관 공식 자료. 환율·요금은 예시이며 실서비스에서 ECB·GTFS로 갱신됩니다.</div>
      </div>
    </div>
  );
}
