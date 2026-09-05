import { useEffect, useState } from 'react';
import MapView from './ui/MapView';
import Hud from './ui/Hud';
import CityPanel from './ui/CityPanel';
import Scene from './ui/Scene';
import Notebook from './ui/Notebook';
import Intro from './ui/Intro';
import { useGame, clock } from './game/store';
import { cityById } from './data/cities';

export default function App() {
  const started = useGame((s) => s.started);
  const cityId = useGame((s) => s.cityId);
  const travelling = useGame((s) => s.travelling);
  const log = useGame((s) => s.log);
  const letters = useGame((s) => s.letters);
  const finalShown = useGame((s) => s.finalShown);
  const active = useGame((s) => s.active);
  const [selected, setSelected] = useState<string | null>('paris');
  const [notebook, setNotebook] = useState(false);
  const [finalOpen, setFinalOpen] = useState(false);

  // 도착하면 도착 도시 카드 열기
  useEffect(() => { if (!travelling) setSelected(cityId); }, [cityId, travelling]);
  useEffect(() => { if (finalShown && !active) setFinalOpen(true); }, [finalShown, active]);

  if (!started) return <Intro />;
  const recent = log.slice(-4);
  const last = letters[letters.length - 1];

  return (
    <div className="app">
      <MapView onSelect={(id) => setSelected(id)} selected={selected} />
      <Hud onNotebook={() => setNotebook(true)} onCity={() => setSelected(cityId)} />
      {selected && !travelling && <CityPanel key={selected} cityId={selected} onClose={() => setSelected(null)} initialTab={selected === cityId ? 'missions' : 'transport'} />}
      {travelling && (
        <div className="travel-overlay">
          <div className="t">{travelling.edge.operator} · {travelling.edge.station} 출발</div>
          <div className="d">{cityById(travelling.edge.from).names.ko} → {cityById(travelling.edge.to).names.ko} · 도착 예정 {clock(travelling.arriveMinute)}</div>
          {travelling.edge.windowFact && <div className="w">🪟 차창 밖: {travelling.edge.windowFact}</div>}
        </div>
      )}
      <div className="log">{recent.map((e) => <div className={`e ${e.kind}`} key={e.id}>{e.text}</div>)}</div>
      {notebook && <Notebook onClose={() => setNotebook(false)} />}
      <Scene />
      {finalOpen && last && (
        <div className="scene" onClick={() => setFinalOpen(false)}>
          <div className="scene-box" onClick={(e) => e.stopPropagation()}>
            <div className="mission-tag">프랑스 북부·중부 완주</div>
            <div className="letter"><h3>✉ {last.title}</h3>{last.text}</div>
            <div className="scene-actions"><button className="btn" onClick={() => setFinalOpen(false)}>닫기</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
