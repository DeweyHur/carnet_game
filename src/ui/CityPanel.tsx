import { useState } from 'react';
import { cityById, edgesFrom, REGIONS } from '../data/cities';
import { missionById, missionsForCity } from '../data/missions';
import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { cityCurrency, coffeeIndex, convert, foodPrice, VENUE_NAME, fmt, FX_EUR } from '../game/economy';
import { Price } from './common';
import type { Edge } from '../game/types';
import { photoById, placePhoto } from '../data/photos';
import TravelPhoto from './TravelPhoto';

const MODE_NAME: Record<Edge['mode'], string> = { metro: '메트로', rer: 'RER', transilien: '트랑실리앙', ter: 'TER', tgv: 'TGV', intercites: 'Intercités', eurostar: '유로스타', bus: '버스' };
const MISSION_TYPE: Record<string, string> = { main: '메인', city: '도시 이야기', echo: '인물(메아리)', food: '미식', transport: '이동', tutorial: '튜토리얼' };

interface Props { cityId: string; onClose: () => void; initialTab?: Tab }
type Tab = 'places' | 'transport' | 'food' | 'missions';

export default function CityPanel({ cityId, onClose, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'missions');
  const s = useGame();
  const city = cityById(cityId);
  const cur = cityCurrency(city);
  const here = s.cityId === cityId;
  const paris = cityById('paris');
  const wd = weekdayOf(s.day);
  const locked = !s.unlocked.includes(city.region);
  const [msg, setMsg] = useState<string | null>(null);

  const edges = here ? edgesFrom(cityId) : edgesFrom(s.cityId).filter((e) => e.to === cityId);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2><span className="tier">{city.tier}</span>{city.names.ko}<small>{city.names.fr}</small></h2>
        <div className="meta">{REGIONS[city.region].name} · 인구 {city.population.toLocaleString()} · 물가지수 {city.priceIndex.toFixed(2)} (파리=1) · ☕ 내 커피 지표 ×{coffeeIndex(city).toFixed(1)}{locked ? ' · 🔒 잠김' : ''}{here ? ' · 현재 위치' : ''}</div>
        <button className="close" onClick={onClose} aria-label="도시 정보 닫기">×</button>
      </div>
      <div className="tabs">
        {(['missions', 'places', 'transport', 'food'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ places: '사진 산책', transport: '기차표', food: '작은 식탁', missions: '오늘의 취재' }[t]}</button>
        ))}
      </div>
      <div className="panel-body">
        {msg && <div className="closed-notice" onClick={() => setMsg(null)}>{msg}</div>}
        {tab === 'missions' && (
          <>
            <p className="blurb">{city.blurb}</p>
            {city.heritage?.map((h) => <div key={h} className="tag">{h}</div>)}
            <div className="guide-note"><span>✎ {city.guide.name}의 한마디</span>{city.guide.intro}</div>
            {missionsForCity(cityId).map((m) => {
              const id = m.id;
              const done = s.completed.includes(id);
              const reqOk = !m.requires || m.requires.every((r) => s.completed.includes(r));
              const active = s.active?.missionId === id;
              return (
                <div className={`row mission-row${done ? ' mission-done' : ''}`} key={id}>
                  <div>
                    <div className="n">{done ? '✓ ' : ''}「{m.title}」 <span className="tag">{MISSION_TYPE[m.type]}</span> <span className="tag">~{m.minutes}분</span></div>
                    <div className="s">{m.summary}</div>
                    {!reqOk && <div className="s closed">선행: {m.requires!.map((r) => `「${missionById(r).title}」`).join(', ')}</div>}
                  </div>
                  {here && !done && (active
                    ? <span><button className="btn sm" onClick={() => s.setPaused(false)}>재개</button> <button className="btn sm ghost" onClick={() => s.abandonMission()}>포기</button></span>
                    : <button className="btn sm" disabled={!reqOk || !!s.active} onClick={() => s.startMission(id)}>취재 →</button>)}
                </div>
              );
            })}
            {here && (
              <div className="row">
                <div><div className="n">숙소에서 자기</div><div className="s">호스텔 1박 {fmt(Math.round(city.hostelEur * city.priceIndex), cur)}{cur !== s.home && ` (≈ ${fmt(convert(Math.round(city.hostelEur * city.priceIndex), cur, s.home), s.home)})`} · 체력 회복 · 다음 날 08:00</div></div>
                <button className="btn sm ghost" onClick={() => s.sleep()}>자기</button>
              </div>
            )}
          </>
        )}
        {tab === 'places' && <p className="blurb">한 장소씩 걸으며 사진을 모으세요. 방문하면 현장 사진이 앨범에 남아요. 입장료와 30분의 여행 시간이 듭니다.</p>}
        {tab === 'places' && city.pois.map((p) => {
          const closed = p.closedDays?.includes(wd);
          const visited = s.visitedPois.includes(`${cityId}:${p.id}`);
          return (
            <div className="place-card" key={p.id}>
              <TravelPhoto photo={placePhoto(cityId, p.id)} compact className="place-image" />
              <div className="row">
              <div>
                <div className="n">{visited ? '✓ ' : ''}{p.name}</div>
                <div className={`s${closed ? ' closed' : ''}`}>{p.hours ?? '상시'}{p.closedDays?.length ? ` · ${p.closedDays.map((d) => WEEKDAYS[d]).join('·')} 휴관` : ''}{closed ? ` — 오늘(${WEEKDAYS[wd]}) 휴관` : ''}</div>
                {p.note && <div className="s">{p.note}</div>}
              </div>
              <div className="place-action"><Price amount={p.feeEur} currency={cur} />{here && <button className="btn sm ghost" disabled={closed || !!s.active} onClick={() => { const result = s.visitPoi(p.id, 30); setMsg(result.ok ? `${p.name} 방문 완료. ${placePhoto(cityId, p.id) ? '사진을 앨범에 붙였어요.' : '산책 기록을 남겼어요.'}` : result.reason!); }}>{visited ? '다시 산책' : '방문하기'}</button>}</div>
              </div>
            </div>
          );
        })}
        {tab === 'transport' && (
          <>
            {!here && edges.length === 0 && <p className="blurb">{cityById(s.cityId).names.ko}에서 {city.names.ko}로 가는 직행 노선이 없습니다. 파리를 경유하세요.</p>}
            {here && <p className="blurb">{city.names.ko}에서 출발하는 노선. 요금은 예시이며 분기별 갱신됩니다. "미리 예약"은 내일 첫차(오늘 숙박 포함), "당일"은 지금 다음 열차.</p>}
            {edges.map((e, i) => {
              const dest = cityById(e.to);
              const dl = !s.unlocked.includes(dest.region);
              return (
                <div className={`ticket${dl ? ' locked' : ''}`} key={i}>
                  <div className="top"><span className="dest">{dest.names.ko} <span className="mode">{MODE_NAME[e.mode]} · {e.operator}</span></span><span className="dur">{e.minutes >= 60 ? `${Math.floor(e.minutes / 60)}h${String(e.minutes % 60).padStart(2, '0')}` : `${e.minutes}분`}</span></div>
                  <div className="sub">{e.station} 출발 · 하루 {e.perDay}편 · 첫차 {e.first} / 막차 {e.last}{dl ? ' · 🔒 지역 잠김' : ''}</div>
                  <div className="fares">
                    <button disabled={dl || !!s.active} onClick={() => { const r = s.travel(e, false); if (!r.ok) setMsg(r.reason!); }}>
                      <b>{fmt(e.fareEur[1], 'EUR')}</b><span>당일 · 지금 {clock(s.minute)} 이후 다음 편 · ≈{fmt(e.fareEur[1] * FX_EUR[s.home], s.home)}</span>
                    </button>
                    {e.fareEur[0] !== e.fareEur[1] && (
                      <button disabled={dl || !!s.active} onClick={() => { const r = s.travel(e, true); if (!r.ok) setMsg(r.reason!); }}>
                        <b>{fmt(e.fareEur[0], 'EUR')}</b><span>미리 예약 · 내일 첫차 {e.first} · 숙박 포함</span>
                      </button>
                    )}
                  </div>
                  {e.windowFact && <div className="sub" style={{ marginTop: 6 }}>🪟 {e.windowFact}</div>}
                </div>
              );
            })}
            {s.active && <p className="blurb">진행 중인 미션이 있어 이동할 수 없습니다.</p>}
          </>
        )}
        {tab === 'food' && (
          <>
            <p className="blurb">{city.names.ko}에서 맛보는 한 끼. 먹으면 체력이 회복되고 음식 사진이 앨범에 남아요.</p>
            {here && !s.completed.includes(`${cityId}-discovery-food`) && <button className="food-challenge" disabled={!!s.active} onClick={() => s.startMission(`${cityId}-discovery-food`)}>가격표 맞추기 도전 <span>선택형 미식 미션 →</span></button>}
            {city.foods.map((f) => {
              const price = foodPrice(f, city);
              const pf = paris.foods.find((x) => x.id === f.id);
              const ratio = pf ? convert(price, cur, 'EUR') / foodPrice(pf, paris) : null;
              return (
                <div className="food-card" key={f.id}>
                  <TravelPhoto photo={photoById(`food:${f.id}`)} className="food-image" compact />
                  <div className="row">
                  <div>
                    <div className="n">{s.tastedFoods.includes(`${cityId}:${f.id}`) ? '✓ ' : ''}{f.name} <span className="tag">{VENUE_NAME[f.venue]}</span>{ratio !== null && ratio < 0.97 && <span className="tag cheap">파리 대비 {Math.round((1 - ratio) * 100)}% 저렴</span>}{ratio !== null && ratio > 1.03 && <span className="tag dear">파리보다 비쌈</span>}</div>
                    <div className="s">{f.nameLocal} · {f.origin}</div>
                  </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Price amount={price} currency={cur} />
                    {here && <button className="btn sm ghost" style={{ marginTop: 4 }} onClick={() => s.buyFood(f.id)}>먹기 +{f.stamina}</button>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
