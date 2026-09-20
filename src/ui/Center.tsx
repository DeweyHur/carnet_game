import CityPanel from './CityPanel';
import NotebookPage, { type PageTab } from './NotebookPages';
import Illus from './Illus';
import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { cityById } from '../data/cities';
import { missionById } from '../data/missions';
import { fmt } from '../game/economy';
import { primeAudio, sfx } from '../game/audio';

export type CenterTab = 'today' | 'city' | PageTab;

const MISSION_TYPE: Record<string, string> = { main: '메인', city: '도시 이야기', echo: '인물(메아리)', food: '미식', transport: '이동', tutorial: '튜토리얼' };

interface Props { tab: CenterTab; onTab: (t: CenterTab) => void; selected: string | null }

/** 가운데 칸 — 취재가 없을 때 수첩을 펼쳐 두는 자리 */
export default function Center({ tab, onTab, selected }: Props) {
  const s = useGame();
  const city = cityById(s.cityId);
  const missions = city.missionIds.map((id) => missionById(id));
  const nextMission = missions.find((m) => !s.completed.includes(m.id) && (!m.requires || m.requires.every((r) => s.completed.includes(r))));
  const allDoneHere = missions.every((m) => s.completed.includes(m.id));

  const TABS: { id: CenterTab; label: string; badge?: number }[] = [
    { id: 'today', label: '오늘' },
    { id: 'city', label: selected && selected !== s.cityId ? cityById(selected).names.ko : '이 도시' },
    { id: 'cards', label: '사실 카드', badge: s.cards.length },
    { id: 'people', label: '사람들', badge: s.metGuides.length },
    { id: 'wallet', label: '지갑·환전' },
    { id: 'passport', label: '여권' },
    { id: 'articles', label: '기사', badge: s.articles.length },
    { id: 'letters', label: '편지', badge: s.letters.length },
  ];

  const go = (t: CenterTab) => { primeAudio(); if (t !== tab) sfx.page(); onTab(t); };

  return (
    <>
      <nav className="ctabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            {t.label}{t.badge ? <span className="b">{t.badge}</span> : null}
          </button>
        ))}
      </nav>
      <div className="center-body">
        {tab === 'city' && <CityPanel key={selected ?? s.cityId} cityId={selected ?? s.cityId} inline />}

        {tab === 'today' && (
          <div className="today">
            <div className="today-head">
              <div className="date">{s.day}일차 · {WEEKDAYS[weekdayOf(s.day)]}요일 · {clock(s.minute)}</div>
              <h1>{city.names.ko}<small>{city.names.fr}</small></h1>
              <p className="blurb">{city.blurb}</p>
            </div>

            <div className="todo">
              <div className="todo-k">지금 할 일</div>
              {s.active ? (
                <>
                  <div className="todo-t">「{missionById(s.active.missionId).title}」 취재 중 — {s.active.step + 1}/{missionById(s.active.missionId).steps.length} 단계</div>
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
                  <p>왼쪽 지도에서 다음 도시 핀을 누르고 「이동」에서 표를 사세요. 지금 가진 돈은 {fmt(s.wallet.EUR, 'EUR')}.</p>
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

            <div className="section-title">오늘 먹을 수 있는 것</div>
            <div className="food-grid">
              {city.foods.slice(0, 4).map((f) => (
                <div className="food-chip" key={f.id}>
                  <Illus kind="food" id={f.id} imageUrl={f.imageUrl} alt={f.name} />
                  <div className="fn">{f.name}</div>
                </div>
              ))}
            </div>

            <div className="row">
              <div><div className="n">숙소에서 자기</div><div className="s">호스텔 1박 {fmt(Math.round(city.hostelEur * city.priceIndex), 'EUR')} · 체력 회복 · 다음 날 08:00</div></div>
              <button className="btn sm ghost" disabled={!!s.active} onClick={() => s.sleep()}>자기</button>
            </div>

            <div className="section-title">최근 기록</div>
            {s.log.length === 0 && <p className="blurb empty">아직 아무 일도 일어나지 않았습니다.</p>}
            {[...s.log].slice(-8).reverse().map((e) => <div className={`logline ${e.kind}`} key={e.id}>{e.text}</div>)}
          </div>
        )}

        {tab !== 'today' && tab !== 'city' && <NotebookPage tab={tab} />}
      </div>
    </>
  );
}
