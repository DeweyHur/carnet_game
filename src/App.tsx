import { useEffect, useState } from 'react';
import Home from './ui/Home';
import Intro from './ui/Intro';
import Prologue from './ui/Prologue';
import { IllusDefs } from './ui/Illus';
import { useGame, clock } from './game/store';
import { cityById } from './data/cities';

export default function App() {
  const started = useGame((s) => s.started);
  const prologueDone = useGame((s) => s.prologueDone);
  const travelling = useGame((s) => s.travelling);
  const log = useGame((s) => s.log);
  const letters = useGame((s) => s.letters);
  const finalShown = useGame((s) => s.finalShown);
  const active = useGame((s) => s.active);
  const [finalOpen, setFinalOpen] = useState(false);

  useEffect(() => { if (finalShown && !active) setFinalOpen(true); }, [finalShown, active]);

  if (!started) return <Intro />;
  if (!prologueDone) return <Prologue />;

  const recent = log.slice(-4);
  const last = letters[letters.length - 1];

  return (
    <div className="app">
      <IllusDefs />
      <Home />
      {travelling && (
        <div className="travel-overlay">
          <div className="t">{travelling.edge.operator} · {travelling.edge.station} 출발</div>
          <div className="d">{cityById(travelling.edge.from).names.ko} → {cityById(travelling.edge.to).names.ko} · 도착 예정 {clock(travelling.arriveMinute)}</div>
          {travelling.edge.windowFact && <div className="w">🪟 차창 밖: {travelling.edge.windowFact}</div>}
        </div>
      )}
      <div className="log">{recent.map((e) => <div className={`e ${e.kind}`} key={e.id}>{e.text}</div>)}</div>
      {finalOpen && last && (
        <div className="overlay" onClick={() => setFinalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="mission-tag">프랑스 북부·중부 완주</div>
            <div className="letter"><h3>✉ {last.title}</h3>{last.text}</div>
            <div className="scene-actions"><button className="btn" onClick={() => setFinalOpen(false)}>닫기</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
