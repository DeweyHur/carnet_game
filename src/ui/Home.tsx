import { useEffect, useState } from 'react';
import MapView from './MapView';
import Hud from './Hud';
import Scene from './Scene';
import Satchel from './Satchel';
import Center, { type CenterTab } from './Center';
import { useGame } from '../game/store';
import { cityById, REGIONS, edgesFrom } from '../data/cities';
import { primeAudio, sfx } from '../game/audio';

// ─── 대시보드 ───────────────────────────────────────────────────────────────
// 왼쪽 = 지도(항상 살아 있다) · 가운데 = 지금 하는 일 · 오른쪽 = 내가 가진 것.
// 대사는 화면을 덮는 오버레이가 아니라 가운데 칸 안에서 진행된다.

export default function Home() {
  const s = useGame();
  const [tab, setTab] = useState<CenterTab>('today');
  const [selected, setSelected] = useState<string | null>(null);
  const city = cityById(s.cityId);
  const inScene = !!s.active && !s.paused;

  useEffect(() => { if (!s.travelling) setSelected(s.cityId); }, [s.cityId, s.travelling]);

  const pick = (id: string) => {
    primeAudio(); sfx.page();
    setSelected(id);
    if (!inScene) setTab('city');
  };

  const sel = selected ? cityById(selected) : city;
  const reachable = selected && selected !== s.cityId ? edgesFrom(s.cityId).some((e) => e.to === selected) : false;

  return (
    <div className="dash">
      <Hud />
      <div className="dash-cols">
        <aside className="col col-map">
          <div className="col-head">지도 <small>{REGIONS[city.region].name} · 현재 {city.names.ko}</small></div>
          <div className="map-box"><MapView onSelect={pick} selected={selected} /></div>
          <div className="map-foot">
            <div className="mf-name">{sel.names.ko}<small>{sel.names.fr}</small></div>
            <div className="mf-sub">
              {sel.id === s.cityId ? '지금 여기 있습니다'
                : !s.unlocked.includes(sel.region) ? '🔒 아직 잠긴 지역'
                : reachable ? `${city.names.ko}에서 직행 노선이 있습니다`
                : `${city.names.ko}에서 직행이 없습니다 — 파리 경유`}
            </div>
            <button className="btn sm" disabled={inScene} onClick={() => { primeAudio(); setTab('city'); }}>
              {sel.id === s.cityId ? '이 도시 보기' : '도시 카드 열기'} ▸
            </button>
          </div>
        </aside>

        <main className="col col-main">
          {inScene ? <Scene /> : <Center tab={tab} onTab={setTab} selected={selected} />}
        </main>

        <Satchel />
      </div>
    </div>
  );
}
