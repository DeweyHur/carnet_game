import { useState } from 'react';
import { useGame } from '../game/store';
import type { Currency } from '../game/types';
import { CURRENCY_META, FX_EUR, fmt } from '../game/economy';
import TravelPhoto from './TravelPhoto';
import { photoById } from '../data/photos';
import { MISSIONS } from '../data/missions';

export default function Intro() {
  const newGame = useGame((s) => s.newGame);
  const [name, setName] = useState('');
  const [home, setHome] = useState<Currency>('KRW');
  return (
    <div className="intro">
      <div className="intro-landscape"><TravelPhoto photo={photoById('paris')} priority /><div className="intro-photo-note"><span>01 / PARIS, FRANCE</span><b>길을 잃어도,<br />이야기는 남으니까.</b><small>한 장의 사진에서 시작하는 프랑스 여행</small></div></div>
      <div className="intro-card">
        <div className="eyebrow">A LITTLE JOURNEY, A THOUSAND STORIES</div>
        <h1>Carnet<span className="intro-period">.</span><small>세계를 걷는 기록</small></h1>
        <p className="intro-invitation">기차표 한 장, 카메라 하나.<br />당신만의 여행을 써 내려가세요.</p>
        <p>파리의 작은 여행 잡지에 도착한 낡은 사진 상자. 사라진 선배 L.의 흔적을 따라 골목을 걷고, 현지 음식을 맛보고, 다음 도시로 향하는 기사를 써보세요.</p>
        <div className="intro-features"><span><b>12</b>개의 실제 도시</span><span><b>{MISSIONS.length}</b>개의 취재 미션</span><span><b>∞</b>나만의 시선</span></div>
        <label>작가 이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김카르네" /></label>
        <label>출신국 통화 (자국 통화 — 모든 가격에 병기됩니다)
          <select value={home} onChange={(e) => setHome(e.target.value as Currency)}>
            {(['KRW', 'GBP', 'CHF', 'EUR'] as Currency[]).map((c) => <option key={c} value={c}>{c} · {CURRENCY_META[c].name} — 시작 예산 {fmt(2000 * FX_EUR[c], c)}</option>)}
          </select>
        </label>
        <div className="actions">
          <button className="btn red" onClick={() => newGame(name.trim(), home)}>여행의 첫 페이지 열기 <span>→</span></button>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>파리, 화요일 아침 09:00 · 자동 저장</span>
        </div>
        <div className="credit">실제 장소의 사진과 출처가 있는 역사 카드. 사진을 누르면 원본과 촬영자를 볼 수 있어요. 환율·가격·교통 시간은 게임용 예시입니다.</div>
      </div>
    </div>
  );
}
