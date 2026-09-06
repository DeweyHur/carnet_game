import { lazy, Suspense, useEffect, useState } from 'react';
import Hud from './ui/Hud';
import CityPanel from './ui/CityPanel';
import Scene from './ui/Scene';
import Notebook from './ui/Notebook';
import Intro from './ui/Intro';
import { useGame, clock } from './game/store';
import { cityById } from './data/cities';
import Journey from './ui/Journey';
import TravelPhoto from './ui/TravelPhoto';
import { photoById } from './data/photos';
import { useT } from './i18n';
import { requestAmbient, sfxPage, stopAmbient, unlockAudio } from './audio';
import DriveMove from './ui/DriveMove';
const MapView = lazy(() => import('./ui/MapView'));

export default function App() {
  const t = useT();
  const started = useGame((s) => s.started);
  const cityId = useGame((s) => s.cityId);
  const travelling = useGame((s) => s.travelling);
  const log = useGame((s) => s.log);
  const letters = useGame((s) => s.letters);
  const finalShown = useGame((s) => s.finalShown);
  const voyageShown = useGame((s) => s.voyageShown);
  const active = useGame((s) => s.active);
  const muted = useGame((s) => s.muted);
  const [selected, setSelected] = useState<string | null>('paris');
  const [notebook, setNotebook] = useState(false);
  const [finalOpen, setFinalOpen] = useState(false);
  const [mapMode, setMapMode] = useState(true);
  const [driveOpen, setDriveOpen] = useState(false);
  const driveRun = useGame((s) => s.driveRun);

  // 브라우저 자동재생 정책: 첫 사용자 제스처에서 오디오 컨텍스트를 깨운다
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  // 여행 중에는 은은한 배경음, 음소거 시 정지
  useEffect(() => { if (started && !muted) requestAmbient(); else stopAmbient(); }, [started, muted]);
  // 도착하면 도착 도시 카드 열기
  useEffect(() => { if (!travelling) setSelected(cityId); }, [cityId, travelling]);
  useEffect(() => { if (finalShown && !active) setFinalOpen(true); }, [finalShown, active]);
  useEffect(() => { if (voyageShown && !active) setFinalOpen(true); }, [voyageShown, active]);
  useEffect(() => {
    if (!travelling) return;
    const timer = window.setTimeout(() => useGame.getState().arrive(), 4500);
    return () => window.clearTimeout(timer);
  }, [travelling]);

  if (!started) return <Intro />;
  const recent = log.slice(-1);
  const last = letters[letters.length - 1];

  return (
    <div className={`app${mapMode ? ' map-mode' : ''}`}>
      {mapMode && <Suspense fallback={<div className="map-loading">{t('여행 지도를 펼치는 중…')}</div>}><MapView onSelect={(id) => setSelected(id)} selected={selected} /></Suspense>}
      <Hud onNotebook={() => { sfxPage(); setNotebook(true); }} onCity={() => setSelected(cityId)} />
      <Journey key={`journey-${selected ?? cityId}`} selected={selected} onSelect={setSelected} onAlbum={() => { sfxPage(); setNotebook(true); }} mapMode={mapMode} onMap={() => setMapMode((m) => !m)} />
      {selected && !travelling && <CityPanel key={`panel-${selected}`} cityId={selected} onClose={() => setSelected(null)} onDrive={() => setDriveOpen(true)} initialTab={selected === cityId ? 'missions' : 'transport'} />}
      {travelling && (
        <div className="travel-overlay">
          <TravelPhoto photo={photoById(travelling.edge.to)} className="train-window" priority />
          <div className="eyebrow">EN ROUTE / 다음 풍경으로</div>
          <div className="t">{travelling.edge.operator} · {travelling.edge.station} 출발</div>
          <div className="d">{cityById(travelling.edge.from).names.ko} → {cityById(travelling.edge.to).names.ko} · 도착 예정 {clock(travelling.arriveMinute)}</div>
          {travelling.edge.windowFact && <div className="w">🪟 차창 밖: {travelling.edge.windowFact}</div>}
          <div className="train-progress"><i /></div>
        </div>
      )}
      <div className="log">{recent.map((e) => <div className={`e ${e.kind}`} key={e.id}>{e.text}</div>)}</div>
      {notebook && <Notebook onClose={() => { sfxPage(); setNotebook(false); }} />}
      <Scene />
      {(driveOpen || (driveRun && !driveRun.missionKey)) && <DriveMove onArrive={() => setDriveOpen(false)} onClose={() => setDriveOpen(false)} />}
      {finalOpen && last && (
        <div className="scene" onClick={() => setFinalOpen(false)}>
          <div className="scene-box" onClick={(e) => e.stopPropagation()}>
            <div className="mission-tag">{t('지역 완주 · L.의 편지')}</div>
            <div className="letter"><h3>✉ {last.title}</h3>{last.text}</div>
            <div className="scene-actions"><button className="btn" onClick={() => setFinalOpen(false)}>{t('닫기')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
