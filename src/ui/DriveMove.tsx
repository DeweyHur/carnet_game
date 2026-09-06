import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { CONTRACTS, DRIVE_LENGTH, driverLevel, nextDriverXp, tickDrive, upgradePrice, upgradeUnlock, type DriveInput, type DriveRun, type DriveState, type Upgrade } from '../game/driving';
import { cityById } from '../data/cities';
import { photoById } from '../data/photos';
import TravelPhoto from './TravelPhoto';
import { setEngineIntensity, sfxCard, sfxWrong, startEngine, stopEngine, unlockAudio } from '../audio';
import { drawRoad } from './driveCanvas';

interface Props { fromCoord?: [number, number]; toCoord?: [number, number]; toLabel?: string; missionKey?: string; onArrive: () => void; onClose?: () => void }

export default function DriveMove({ toLabel, missionKey, onArrive, onClose }: Props) {
  const g = useGame();
  const run = g.driveRun;
  const city = cityById(g.cityId);
  const level = driverLevel(g.driverXp);
  const finish = () => { g.endDrive(); onArrive(); };
  const close = () => { g.endDrive(); (onClose ?? onArrive)(); };
  return <div className="drive-game" role="dialog" aria-modal="true" aria-label="도시 드라이브">
    <header className="drive-header"><div><span>CARNET / ROAD TRIP</span><h2>{toLabel ?? `${city.names.ko} 자유 드라이브`}</h2></div><div className="driver-badge">운전 Lv.{level} <span>€{g.wallet.EUR.toFixed(0)}</span></div></header>
    {!run ? <div className="drive-lobby">
      <div className="drive-lobby-photo"><TravelPhoto photo={photoById(city.id)} priority /><div><span>TAKE THE SCENIC ROUTE</span><h3>길 위에서도,<br />당신만의 플레이.</h3><p>차선을 바꿔 교통을 피하고 사진 필름을 모으세요.<br />40~60초의 아케이드 드라이브 · 목표 달성 시 보너스</p></div></div>
      <div className="drive-briefing"><h3>오늘은 어떤 운전자?</h3><div className="drive-contracts">{CONTRACTS.map((c) => <button key={c.id} onClick={() => { unlockAudio(); g.beginDrive(c.id, toLabel ?? city.names.ko, missionKey); }}><strong>{c.title}<span>목표 +€{c.bonus}</span></strong><small>{c.description}</small><b>{c.goal} →</b></button>)}</div>
        <div className="drive-instructions">← → / A D 차선 변경 · ↑ / W 가속<br />↓ / S 감속 · Space 부스트 · P 일시정지<br /><small>모바일에서는 아래 조작 버튼을 누르세요. 50 표지에서는 감속!</small></div>
        <details className="drive-garage"><summary>차고 · 성장과 업그레이드 <span>{g.driverXp} / {nextDriverXp(g.driverXp)} XP</span></summary><p>운전 보상은 유로 지갑에 들어옵니다. 레벨이 오르면 업그레이드가 열려요.</p>{(['handling', 'boost', 'bumper'] as Upgrade[]).map((part) => {
          const rank = g.carUpgrades[part], price = upgradePrice(rank), required = upgradeUnlock(rank);
          return <div key={part}><span><b>{{ handling: '반응 빠른 핸들', boost: '부스트 효율', bumper: '튼튼한 범퍼' }[part]} {rank}/3</b><small>{{ handling: '차선 이동 속도 증가', boost: '부스트 에너지 소모 감소', bumper: '충돌 피해 감소' }[part]}</small></span><button disabled={rank >= 3 || level < required || g.wallet.EUR < price} onClick={() => g.upgradeCar(part)}>{rank >= 3 ? 'MAX' : level < required ? `Lv.${required} 해금` : `€${price} 업그레이드`}</button></div>;
        })}</details>
        <button className="drive-exit" onClick={close}>{missionKey ? '일반 이동으로 건너뛰기 · 운전 보상 없음' : '지도 돌아가기'}</button>
      </div>
    </div> : run.result ? <div className="drive-results">
      <span className="eyebrow">DRIVE COMPLETE</span><div className="drive-grade">{run.result.grade}</div><h3>{run.result.arrived ? '도착! 오늘의 운전 기록' : '잠깐 쉬어가는 것도 여행'}</h3>
      <p>{run.result.goal ? '목표 달성! 보너스가 정산되었습니다.' : run.result.arrived ? '다음에는 목표 보너스에도 도전해보세요.' : '차량 상태 또는 제한 시간으로 주행을 마쳤어요. 금전 손실은 없습니다.'}</p>
      <div className="drive-result-stats"><span><b>{run.result.score.toLocaleString()}</b>점수</span><span><b>{run.result.elapsed}초</b>주행 시간</span><span><b>{run.result.films}개</b>사진 필름</span><span><b>{run.result.bestCombo}</b>최고 콤보</span></div>
      <div className="drive-payout"><div>기본·목표·실력 보상 <b>€{run.result.gross}</b></div><div>충돌·과속 공제 <b>−€{run.result.repairs}</b></div><div className="total">지갑에 들어온 돈 <b>+€{run.result.earned}</b></div></div>
      <div className="drive-xp"><b>운전 경험치 +{run.result.xp} · Lv.{level}</b><progress max={nextDriverXp(g.driverXp)} value={g.driverXp} /><small>다음 레벨까지 {Math.max(0, nextDriverXp(g.driverXp) - g.driverXp)} XP · 차고에서 성장한 차량을 확인하세요.</small></div>
      <button className="btn" onClick={finish}>{missionKey ? '목적지에서 취재 계속 →' : '기록 저장하고 지도 돌아가기 →'}</button>
    </div> : <DrivingSession key={run.id} run={run} onExit={close} />}
  </div>;
}

function DrivingSession({ run, onExit }: { run: DriveRun; onExit: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<DriveState>(run.state);
  const input = useRef<DriveInput>({ gas: false, brake: false, boost: false });
  const [frame, setFrame] = useState(run.state);
  const [paused, setPaused] = useState(run.state.elapsed > 0);
  const pausedRef = useRef(paused);
  const [exitPrompt, setExitPrompt] = useState(false);
  const changeLane = (dir: number) => { if (!pausedRef.current) engine.current.lane = Math.max(0, Math.min(2, engine.current.lane + dir)); };
  const pause = useCallback((value: boolean) => {
    pausedRef.current = value; setPaused(value); input.current = { gas: false, brake: false, boost: false };
    useGame.getState().saveDrive(run.id, engine.current);
    if (value) stopEngine(); else { unlockAudio(); startEngine(); }
  }, [run.id]);
  useEffect(() => {
    if (engine.current.finished) { useGame.getState().settleDrive(run.id); return; }
    let raf = 0, last = performance.now(), checkpoint = 0, lastRender = 0;
    if (!pausedRef.current) startEngine();
    const tick = (now: number) => {
      const seconds = Math.min(.05, (now - last) / 1000); last = now;
      if (!pausedRef.current && !engine.current.finished) {
        const previous = engine.current;
        engine.current = tickDrive(previous, input.current, seconds, run.upgrades);
        if (engine.current.films > previous.films) sfxCard();
        if (engine.current.collisions > previous.collisions || engine.current.speeding > previous.speeding) sfxWrong();
        setEngineIntensity(engine.current.speed / 112);
        if (now - checkpoint > 1000 || engine.current.finished) {
          useGame.getState().saveDrive(run.id, engine.current); checkpoint = now;
          if (engine.current.finished) { stopEngine(); useGame.getState().settleDrive(run.id); }
        }
      }
      const node = canvas.current, ctx = node?.getContext('2d');
      if (node && ctx) {
        const width = node.clientWidth, height = node.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (node.width !== Math.round(width * dpr) || node.height !== Math.round(height * dpr)) { node.width = Math.round(width * dpr); node.height = Math.round(height * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawRoad(ctx, engine.current, width, height);
      }
      if (now - lastRender > 70) { setFrame({ ...engine.current }); lastRender = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const blur = () => pause(true);
    const hide = () => { if (document.hidden) pause(true); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hide);
    const keyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      const key = e.key.toLowerCase();
      if ((key === 'p' || key === 'escape') && !e.repeat) { pause(!pausedRef.current); return; }
      if (pausedRef.current) return;
      if (!e.repeat && (key === 'arrowleft' || key === 'a')) changeLane(-1);
      if (!e.repeat && (key === 'arrowright' || key === 'd')) changeLane(1);
      if (key === 'arrowup' || key === 'w') input.current.gas = true;
      if (key === 'arrowdown' || key === 's') input.current.brake = true;
      if (key === ' ') input.current.boost = true;
    };
    const keyUp = (e: KeyboardEvent) => { const key = e.key.toLowerCase(); if (key === 'arrowup' || key === 'w') input.current.gas = false; if (key === 'arrowdown' || key === 's') input.current.brake = false; if (key === ' ') input.current.boost = false; };
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp);
    return () => { cancelAnimationFrame(raf); stopEngine(); useGame.getState().saveDrive(run.id, engine.current); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hide); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); };
  }, [run.id, run.upgrades, pause]);
  const zone = frame.objects.find((o) => o.kind === 'zone' && !o.resolved);
  const nearZone = zone && zone.distance - frame.distance < 230;
  const hold = (key: keyof DriveInput) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); if (pausedRef.current) return; e.currentTarget.setPointerCapture(e.pointerId); input.current[key] = true; },
    onPointerUp: () => { input.current[key] = false; }, onPointerCancel: () => { input.current[key] = false; }, onLostPointerCapture: () => { input.current[key] = false; },
  });
  return <div className="drive-session">
    <div className="drive-scorebar"><span><b>{frame.score.toLocaleString()}</b> SCORE</span><span className="drive-combo">{frame.combo >= 2 ? `${frame.combo} COMBO ×${Math.min(4, 1 + Math.floor(frame.combo / 4))}` : CONTRACTS.find((c) => c.id === run.contract)?.title}</span><button onClick={() => pause(!paused)} aria-label="주행 일시정지">{paused ? '계속 ▶' : '일시정지 Ⅱ'}</button></div>
    <div className="drive-road"><canvas ref={canvas} aria-label="3차선 도로. 방향키로 교통을 피하고 노란 사진 필름을 수집하세요." /><div className="drive-course"><progress value={frame.distance} max={DRIVE_LENGTH} /><span>{Math.round(frame.distance / DRIVE_LENGTH * 100)}% · {frame.elapsed.toFixed(0)}초</span></div>
      {nearZone && <div className={`drive-zone ${frame.speed > 55 ? 'too-fast' : ''}`}>50 <small>앞쪽 제한 구간 · 감속</small></div>}
      {frame.noticeUntil > frame.elapsed && <div className="drive-feedback" aria-live="polite">{frame.notice}</div>}
      <div className="drive-dashboard"><span><b>{Math.round(frame.speed)}</b> km/h</span><span>차량 {Math.round(frame.integrity)}%<progress max={100} value={frame.integrity} /></span><span>부스트 {Math.round(frame.energy)}%<progress max={100} value={frame.energy} /></span><span>▣ {frame.films}</span></div>
      {paused && <div className="drive-pause"><h3>{exitPrompt ? '이번 주행을 그만둘까요?' : '잠시 쉬어가는 중'}</h3><p>{exitPrompt ? '완주 전에는 돈과 경험치를 받지 않습니다.' : '주행 기록이 저장됐어요. 준비되면 이어가세요.'}</p><button className="btn" onClick={() => { setExitPrompt(false); pause(false); }}>주행 계속 →</button>{exitPrompt ? <button className="btn ghost" onClick={onExit}>보상 없이 나가기</button> : <button className="btn ghost" onClick={() => setExitPrompt(true)}>주행 그만두기</button>}</div>}
    </div>
    <div className="drive-controls"><button onClick={() => changeLane(-1)} disabled={paused} aria-label="왼쪽 차선">←<small>A / ←</small></button><button onClick={() => changeLane(1)} disabled={paused} aria-label="오른쪽 차선">→<small>D / →</small></button><button {...hold('brake')} disabled={paused}>감속<small>S / ↓</small></button><button {...hold('gas')} disabled={paused} className="gas">가속<small>W / ↑</small></button><button {...hold('boost')} disabled={paused} className="boost">부스트<small>SPACE</small></button></div>
  </div>;
}
