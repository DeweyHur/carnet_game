import { useEffect, useState } from 'react';
import MapView from './MapView';
import CityPanel from './CityPanel';
import Hud from './Hud';
import NotebookPage, { type PageTab } from './NotebookPages';
import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { cityById } from '../data/cities';
import { missionById } from '../data/missions';
import { fmt } from '../game/economy';
import { primeAudio, sfx } from '../game/audio';

type Tab = 'today' | 'map' | PageTab;

const MISSION_TYPE: Record<string, string> = { main: '메인', city: '도시 이야기', echo: '인물(메아리)', food: '미식', transport: '이동', tutorial: '튜토리얼' };

// ─── 여행수첩 = 홈 화면 ─────────────────────────────────────────────────────
// 지도는 수첩 안의 한 페이지다. 게임의 중심은 수첩.

export default function Home() {
  const s = useGame();
  const [tab, setTab] = useState<Tab>('today');
  const [selected, setSelected] = useState<string | null>(null);
  const city = cityById(s.cityId);

  // 열차가 달리는 동안은 지도 페이지를 펼쳐 둔다 (도착 처리가 지도에서 일어난다)
  useEffect(() => { if (s.travelling) setTab('map'); }, [s.travelling]);
  useEffect(() => { if (!s.travelling) setSelected(s.cityId); }, [s.cityId, s.travelling]);

  const go = (t: Tab) => { primeAudio(); if (t !== tab) sfx.page(); setTab(t); };

  const TABS: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'today', label: '오늘', icon: '☀' },
    { id: 'map', label: '지도', icon: '🗺' },
    { id: 'cards', label: '사실 카드', icon: '✎', badge: s.cards.length },
    { id: 'people', label: '사람들', icon: '☻', badge: s.metGuides.length },
    { id: 'wallet', label: '지갑·환전', icon: '€' },
    { id: 'passport', label: '여권', icon: '✈', badge: s.stamps.length },
    { id: 'articles', label: '기사', icon: '📰', badge: s.articles.length },
    { id: 'letters', label: 'L.의 편지', icon: '✉', badge: s.letters.length },
  ];

  // 이 도시에서 지금 손댈 수 있는 미션
  const missions = city.missionIds.map((id) => missionById(id));
  const activeMission = s.active ? missionById(s.active.missionId) : null;
  const nextMission = missions.find((m) => !s.completed.includes(m.id) && (!m.requires || m.requires.every((r) => s.completed.includes(r))));
  const allDoneHere = missions.every((m) => s.completed.includes(m.id));

  return (
    <div className="notebook">
      <Hud />
      <div className="nb-body">
        <nav className="nb-tabs">
          <div className="nb-brand">CARNET<small>여행수첩</small></div>
          {TABS.map((t) => (
            <button key={t.id} className={`nb-tab${tab === t.id ? ' on' : ''}`} onClick={() => go(t.id)}>
              <span className="i">{t.icon}</span>
              <span className="l">{t.label}</span>
              {t.badge ? <span className="b">{t.badge}</span> : null}
            </button>
          ))}
          <div className="nb-foot">
            <button className="nb-reset" onClick={() => { if (confirm('저장을 지우고 처음부터 시작할까요?')) s.reset(); }}>새 게임</button>
          </div>
        </nav>

        <section className={`nb-page${tab === 'map' ? ' is-map' : ''}`}>
          {tab === 'map' && (
            <div className="nb-map">
              <MapView onSelect={(id) => setSelected(id)} selected={selected} />
              {selected && !s.travelling && (
                <CityPanel key={selected} cityId={selected} onClose={() => setSelected(null)} initialTab={selected === s.cityId ? 'missions' : 'transport'} />
              )}
              <div className="map-hint">도시 핀을 눌러 장소·음식·요금을 보고, 「이동」 탭에서 표를 삽니다.</div>
            </div>
          )}

          {tab === 'today' && (
            <div className="nb-scroll today">
              <div className="today-head">
                <div className="date">{s.day}일차 · {WEEKDAYS[weekdayOf(s.day)]}요일 · {clock(s.minute)}</div>
                <h1>{city.names.ko}<small>{city.names.fr}</small></h1>
                <p className="blurb">{city.blurb}</p>
              </div>

              <div className="todo">
                <div className="todo-k">지금 할 일</div>
                {activeMission ? (
                  <>
                    <div className="todo-t">「{activeMission.title}」 취재 중 — {(s.active!.step + 1)}/{activeMission.steps.length} 단계</div>
                    <p>{activeMission.summary}</p>
                    <button className="btn red" onClick={() => { primeAudio(); s.setPaused(false); }}>취재 이어하기 ▸</button>
                  </>
                ) : nextMission ? (
                  <>
                    <div className="todo-t">「{nextMission.title}」 — {city.names.ko}</div>
                    <p>{nextMission.summary}</p>
                    <button className="btn red" onClick={() => { primeAudio(); s.startMission(nextMission.id); }}>취재 시작 ▸</button>
                  </>
                ) : allDoneHere ? (
                  <>
                    <div className="todo-t">{city.names.ko}에서 할 일은 끝났습니다</div>
                    <p>지도를 펼쳐 다음 도시를 고르세요. 원고료가 여행 자금입니다 — 지금 가진 돈은 {fmt(s.wallet.EUR, 'EUR')}.</p>
                    <button className="btn red" onClick={() => go('map')}>🗺 지도 펼치기 ▸</button>
                  </>
                ) : (
                  <>
                    <div className="todo-t">선행 취재가 남았습니다</div>
                    <p>아래 목록에서 잠긴 미션의 선행 조건을 확인하세요.</p>
                  </>
                )}
              </div>

              <div className="section-title">{city.names.ko}의 취재거리</div>
              {missions.map((m) => {
                const done = s.completed.includes(m.id);
                const reqOk = !m.requires || m.requires.every((r) => s.completed.includes(r));
                const isActive = s.active?.missionId === m.id;
                return (
                  <div className="row" key={m.id}>
                    <div>
                      <div className="n">{done ? '✓ ' : ''}「{m.title}」 <span className="tag">{MISSION_TYPE[m.type]}</span> <span className="tag">~{m.minutes}분</span></div>
                      <div className="s">{m.summary}</div>
                      {!reqOk && <div className="s closed">선행: {m.requires!.map((r) => `「${missionById(r).title}」`).join(', ')}</div>}
                    </div>
                    {!done && (isActive
                      ? <button className="btn sm" onClick={() => s.setPaused(false)}>이어하기</button>
                      : <button className="btn sm" disabled={!reqOk || !!s.active} onClick={() => { primeAudio(); s.startMission(m.id); }}>시작</button>)}
                  </div>
                );
              })}

              <div className="row">
                <div><div className="n">숙소에서 자기</div><div className="s">호스텔 1박 {fmt(Math.round(city.hostelEur * city.priceIndex), 'EUR')} · 체력 회복 · 다음 날 08:00</div></div>
                <button className="btn sm ghost" disabled={!!s.active} onClick={() => s.sleep()}>자기</button>
              </div>

              <div className="section-title">최근 기록</div>
              {s.log.length === 0 && <p className="blurb empty">아직 아무 일도 일어나지 않았습니다.</p>}
              {[...s.log].slice(-8).reverse().map((e) => <div className={`logline ${e.kind}`} key={e.id}>{e.text}</div>)}
            </div>
          )}

          {tab !== 'map' && tab !== 'today' && (
            <div className="nb-scroll"><NotebookPage tab={tab} /></div>
          )}
        </section>
      </div>
    </div>
  );
}
