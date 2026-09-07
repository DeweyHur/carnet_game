import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { CONTRACTS, CORNERS, DRIVE_LENGTH, DRIVE_LIMIT, SPRINT_TARGET, driverLevel, nextDriverXp, restoreDrive, roadDistrict, tickDrive, upgradePrice, upgradeUnlock, type DriveInput, type DriveRun, type DriveState, type Upgrade } from '../game/driving';
import { cityById } from '../data/cities';
import { setEngineIntensity, sfxDrive, startEngine, stopEngine, unlockAudio, isDriveMusicEnabled, setDriveMusicEnabled } from '../audio';
import { drawRoad, loadDriveArt } from './driveCanvas';
import DriveRouteMap from './DriveRouteMap';
import './driving.css';

interface Props { fromCoord?: [number, number]; toCoord?: [number, number]; toLabel?: string; missionKey?: string; onArrive: () => void; onClose?: () => void }
const idleInput = (): DriveInput => ({ gas: true, brake: false, boost: false, drift: false });

export default function DriveMove({ fromCoord, toCoord, toLabel, missionKey, onArrive, onClose }: Props) {
  const g = useGame(), root = useRef<HTMLDivElement>(null);
  const [music, setMusic] = useState(isDriveMusicEnabled);
  const [artStatus, setArtStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [destinationId, setDestinationId] = useState('');
  const run = g.driveRun, city = cityById(g.cityId), level = driverLevel(g.driverXp);
  const freeTarget = city.pois.find((p) => p.coord && (p.id === destinationId || p.name === run?.label)) ?? city.pois.find((p) => p.coord && (p.coord[0] !== city.coord[0] || p.coord[1] !== city.coord[1]));
  const destination = toLabel ?? freeTarget?.name ?? city.names.ko;
  const from = fromCoord ?? city.coord, to = toCoord ?? freeTarget?.coord ?? city.coord;
  const finish = () => { g.endDrive(); onArrive(); };
  const close = () => { g.endDrive(); (onClose ?? onArrive)(); };
  const best = Math.max(g.driveBestScores[city.id] ?? 0, ...g.driveHistory.filter((entry) => entry.cityId === city.id).map((entry) => entry.result.score));
  useEffect(() => {
    let disposed = false;
    loadDriveArt().then(() => { if (!disposed) setArtStatus('ready'); }).catch(() => { if (!disposed) setArtStatus('error'); });
    return () => { disposed = true; };
  }, [loadAttempt]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; root.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const racing = !!run && !run.result;
  return <div ref={root} tabIndex={-1} className={`drive-game ${racing ? 'is-racing' : ''}`} role="dialog" aria-modal="true" aria-label="도시 드라이브" onKeyDown={(e) => {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, summary, [tabindex="0"]')).filter((node) => node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }}>
    <header className="drive-header">
      <div className="drive-wordmark">carnet<span>DRIVE CLUB</span></div>
      <div className="drive-header-city"><span>{city.names.fr.toUpperCase()} / GOLDEN HOUR</span><h2>{toLabel ?? '도시를 달리는 가장 좋은 시간'}</h2></div>
      <div className="drive-audio-controls">
        <button aria-label="운전 음악" aria-pressed={music} onClick={() => { unlockAudio(); setDriveMusicEnabled(!music); setMusic(!music); }}>♫<span> {music ? 'ON' : 'OFF'}</span></button>
        <button aria-label="운전 소리" aria-pressed={!g.muted} onClick={() => { unlockAudio(); g.setMuted(!g.muted); }}>{g.muted ? '소리 OFF' : '소리 ON'}</button>
      </div>
      <div className="driver-badge">LV. {String(level).padStart(2, '0')}<span>€{g.wallet.EUR.toFixed(0)}</span></div>
    </header>
    {!run ? <div className="drive-lobby">
      <div className="drive-lobby-art">
        <img className="drive-lobby-sky" src={`${import.meta.env.BASE_URL}art/driving/skyline.png`} alt="황금빛 석양 아래 유럽 도시" />
        <div className="drive-lobby-copy"><span className="drive-kicker">THE CITY IS YOURS.</span><h3>오늘의 도시,<br /><em>나의 서킷.</em></h3><p>코너를 흘리고. 니트로를 터뜨리고.<br />다음 풍경까지, 한 번 더 달리고 싶은 드라이브.</p></div>
        <svg className="drive-hero-car" viewBox="55 55 450 386" role="img" aria-label="골드 스트라이프 스포츠 쿠페"><image href={`${import.meta.env.BASE_URL}art/driving/vehicles.png`} width="1536" height="1024" /></svg>
        <div className="drive-car-caption"><span>YOUR RIDE</span><strong>SOLEIL GT <small>01</small></strong><p>도심 스포츠 쿠페 · 자동 가속</p></div>
        <div className="drive-lobby-record"><span>PERSONAL BEST</span><b>{best.toLocaleString()}</b><small>{city.names.ko} 최고 기록</small></div>
      </div>
      <div className="drive-briefing">
        <span className="drive-kicker">PICK YOUR DRIVE / 01</span><h3>어떤 기분으로 달릴까요?</h3>
        {!missionKey ? <label className="drive-destination">목적지<select value={freeTarget?.id ?? ''} onChange={(e) => setDestinationId(e.target.value)}>{city.pois.filter((p) => p.coord).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : <p className="drive-destination">목적지 · {destination}</p>}
        <div className="drive-contracts">{CONTRACTS.map((c, i) => <button key={c.id} disabled={artStatus !== 'ready'} onClick={() => { unlockAudio(); g.beginDrive(c.id, destination, missionKey); }}>
          <span className="drive-contract-number">0{i + 1}</span><span className="drive-contract-copy"><strong>{c.title}<span>+€{c.bonus}</span></strong><small>{c.description}</small><b>{c.goal}</b></span><span className="drive-contract-arrow">↗</span>
        </button>)}</div>
        {artStatus !== 'ready' && <p className="drive-load-status" role="status">{artStatus === 'loading' ? '차량과 도시를 준비하고 있어요…' : <>그래픽을 불러오지 못했어요. <button onClick={() => { setArtStatus('loading'); setLoadAttempt((n) => n + 1); }}>다시 불러오기</button></>}</p>}
        <div className="drive-howto"><span><b>01</b> 좌우로 추월</span><span><b>02</b> 코너 드리프트</span><span><b>03</b> 니트로 질주</span></div>
        <p className="drive-instructions">자동 가속 · ← → / A D 조향 · Shift 드리프트<br />Space 니트로 · ↓ / S 브레이크 · P 일시정지<br /><small>니트로를 누르고 파란 타이밍에 다시 누르면 퍼펙트!<br />90% 이상 충전하면 쇼크웨이브. 50 표지 앞에서는 감속하세요.</small></p>
        <details className="drive-garage"><summary>차고 · SOLEIL GT 업그레이드 <span>{g.driverXp} XP</span></summary><p>운전으로 유로와 경험치를 모아 차량을 성장시키세요.</p>{(['handling', 'boost', 'bumper'] as Upgrade[]).map((part) => {
          const rank = g.carUpgrades[part], price = upgradePrice(rank), required = upgradeUnlock(rank);
          return <div key={part}><span><b>{{ handling: '핸들링', boost: '니트로 효율', bumper: '차체 보호' }[part]} {rank}/3</b><small>{{ handling: '빠른 차선 이동', boost: '더 오래 유지되는 니트로', bumper: '충돌 피해 감소' }[part]}</small></span><button disabled={rank >= 3 || level < required || g.wallet.EUR < price} onClick={() => g.upgradeCar(part)}>{rank >= 3 ? 'MAX' : level < required ? `Lv.${required} 해금` : `€${price} 업그레이드`}</button></div>;
        })}</details>
        <button className="drive-exit" onClick={close}>{missionKey ? '일반 이동으로 건너뛰기 · 운전 보상 없음' : '← 여행 지도 돌아가기'}</button>
      </div>
    </div> : run.result ? <div className="drive-results">
      <span className="drive-kicker">{run.result.arrived ? 'FINISH LINE / 기록 저장 완료' : 'DRIVE ENDED'}</span><div className={`drive-grade grade-${run.result.grade}`}>{run.result.grade}</div>
      <h3>{run.result.arrived ? '이 도시, 제대로 달렸다.' : '다음 코너에서 다시 만나요.'}</h3>
      <p>{run.result.goal ? '목표 달성! 보너스가 지갑에 들어왔어요.' : run.result.arrived ? '다음 주행에서는 목표 보너스에도 도전해보세요.' : '차량 상태 또는 제한 시간으로 주행을 마쳤어요. 금전 손실은 없습니다.'}</p>
      <div className="drive-result-stats"><span><b>{run.result.score.toLocaleString()}</b>SCORE</span><span><b>{run.result.elapsed}<small>s</small></b>주행 시간</span><span><b>{run.result.bestCombo}<small>×</small></b>최고 콤보</span><span><b>{run.result.films}</b>사진 필름</span></div>
      <p className="drive-style-stats">드리프트 {run.result.drifts ?? 0}회 · 니어 미스 {run.result.nearMisses ?? 0}회 · 충돌 {run.result.collisions}회</p>
      <div className="drive-payout"><div>기본·목표·실력 보상 <b>€{run.result.gross}</b></div><div>충돌·과속 공제 <b>−€{run.result.repairs}</b></div><div className="total">이번 주행 수입 <b>+€{run.result.earned}</b></div></div>
      <div className="drive-xp"><b>+{run.result.xp} XP · 운전 Lv.{level}</b><progress aria-label="운전 레벨 경험치" max={nextDriverXp(g.driverXp)} value={g.driverXp} /><small>다음 레벨까지 {Math.max(0, nextDriverXp(g.driverXp) - g.driverXp)} XP</small></div>
      {!missionKey && <button className="drive-primary" onClick={() => { g.endDrive(); g.beginDrive(run.contract, destination); }}>한 번 더 달리기 ↗</button>}
      <button className={missionKey ? 'drive-primary' : 'drive-exit'} onClick={finish}>{missionKey ? '목적지에서 취재 계속 →' : '여행 지도 돌아가기 →'}</button>
    </div> : <DrivingSession key={run.id} run={run} from={from} to={to} destination={destination} artStatus={artStatus} onRetryArt={() => { setArtStatus('loading'); setLoadAttempt((n) => n + 1); }} onExit={close} />}
  </div>;
}

function DrivingSession({ run, from, to, destination, artStatus, onRetryArt, onExit }: { run: DriveRun; from: [number, number]; to: [number, number]; destination: string; artStatus: string; onRetryArt: () => void; onExit: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), engine = useRef<DriveState>(restoreDrive(run.state));
  const input = useRef<DriveInput>(idleInput());
  const [frame, setFrame] = useState(() => restoreDrive(run.state)), [paused, setPaused] = useState(run.state.elapsed > 0);
  const pausedRef = useRef(paused), countdownRef = useRef(run.state.elapsed > 0 ? 0 : 3);
  const [countdown, setCountdown] = useState(run.state.elapsed > 0 ? 0 : 3);
  const [exitPrompt, setExitPrompt] = useState(false), [mapOpen, setMapOpen] = useState(false);
  const mapOpenRef = useRef(false), touchStart = useRef<number | null>(null);
  const canControl = () => !pausedRef.current && countdownRef.current <= 0 && artStatus === 'ready';
  const changeLane = useCallback((dir: number) => {
    if (pausedRef.current || countdownRef.current > 0) return;
    const next = Math.max(0, Math.min(2, engine.current.lane + dir));
    if (next !== engine.current.lane) sfxDrive('lane'); engine.current.lane = next;
  }, []);
  const pause = useCallback((value: boolean) => {
    pausedRef.current = value; setPaused(value); input.current = idleInput();
    useGame.getState().saveDrive(run.id, engine.current);
    if (value) stopEngine(); else { unlockAudio(); if (countdownRef.current <= 0) startEngine(); }
  }, [run.id]);
  const showMap = () => { pause(true); setMapOpen(true); mapOpenRef.current = true; };
  const resume = () => { setMapOpen(false); mapOpenRef.current = false; setExitPrompt(false); pause(false); };
  useEffect(() => {
    if (artStatus !== 'ready') return;
    if (engine.current.finished) { useGame.getState().settleDrive(run.id); return; }
    let raf = 0, last = performance.now(), checkpoint = last, lastRender = 0, accumulator = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!pausedRef.current && countdownRef.current <= 0) startEngine();
    let lastDriftSound = 0;
    const tick = (now: number) => {
      const seconds = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
      if (!pausedRef.current && !engine.current.finished) {
        if (countdownRef.current > 0) {
          const old = Math.ceil(countdownRef.current); countdownRef.current = Math.max(0, countdownRef.current - seconds);
          if (Math.ceil(countdownRef.current) !== old) { setCountdown(Math.ceil(countdownRef.current)); sfxDrive(countdownRef.current === 0 ? 'start' : 'countdown'); }
          if (countdownRef.current === 0) startEngine();
        } else {
          accumulator += seconds;
          while (accumulator >= 1 / 120 && !engine.current.finished) {
            const previous = engine.current;
            engine.current = tickDrive(previous, input.current, 1 / 120, run.upgrades); accumulator -= 1 / 120;
            const current = engine.current;
            if (current.collisions > previous.collisions) sfxDrive('bump');
            else if (current.speeding > previous.speeding) sfxDrive('warning');
            else if (Math.floor(current.combo / 4) > Math.floor(previous.combo / 4)) sfxDrive('combo');
            else if (current.films > previous.films) sfxDrive('film', current.combo);
            else if (current.nearMisses > previous.nearMisses) sfxDrive('near');
            else if (current.zones > previous.zones) sfxDrive('zone');
            if (current.nitro !== previous.nitro && current.nitro !== 'off') sfxDrive(current.nitro === 'normal' ? 'boost' : 'perfect');
            if (current.drifting && current.elapsed - lastDriftSound > .35) { sfxDrive('drift'); lastDriftSound = current.elapsed; }
          }
          setEngineIntensity(engine.current.speed / 142);
          if (now - checkpoint > 1000 || engine.current.finished) {
            useGame.getState().saveDrive(run.id, engine.current); checkpoint = now;
            if (engine.current.finished) { stopEngine(); useGame.getState().settleDrive(run.id); }
          }
        }
      } else accumulator = 0;
      const node = canvas.current, ctx = node?.getContext('2d');
      if (node && ctx) {
        const width = node.clientWidth, height = node.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (node.width !== Math.round(width * dpr) || node.height !== Math.round(height * dpr)) { node.width = Math.round(width * dpr); node.height = Math.round(height * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawRoad(ctx, engine.current, width, height, reduced.matches);
      }
      if (now - lastRender > 60) { setFrame({ ...engine.current }); lastRender = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const blur = () => pause(true), hide = () => { if (document.hidden) pause(true); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hide);
    const keyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(e.key) && !pausedRef.current) e.preventDefault();
      const key = e.key.toLowerCase();
      if ((key === 'p' || key === 'escape') && !e.repeat) {
        if (mapOpenRef.current) { setMapOpen(false); mapOpenRef.current = false; }
        setExitPrompt(false); pause(!pausedRef.current); return;
      }
      if (pausedRef.current || countdownRef.current > 0) return;
      if (!e.repeat && (key === 'arrowleft' || key === 'a')) changeLane(-1);
      if (!e.repeat && (key === 'arrowright' || key === 'd')) changeLane(1);
      if (key === 'arrowdown' || key === 's') input.current.brake = true;
      if (key === 'shift') input.current.drift = true;
      if (key === ' ') input.current.boost = true;
    };
    const keyUp = (e: KeyboardEvent) => { const key = e.key.toLowerCase(); if (key === 'arrowdown' || key === 's') input.current.brake = false; if (key === 'shift') input.current.drift = false; if (key === ' ') input.current.boost = false; };
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp);
    return () => { cancelAnimationFrame(raf); stopEngine(); useGame.getState().saveDrive(run.id, engine.current); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hide); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); };
  }, [run.id, run.upgrades, pause, changeLane, artStatus]);
  const zone = frame.objects.find((o) => o.kind === 'zone' && !o.resolved);
  const nearZone = zone && zone.distance - frame.distance < Math.max(150, frame.speed * 2);
  const corner = CORNERS.find((c) => frame.distance < c.end && frame.distance + 110 > c.start);
  const district = roadDistrict(frame.distance), contract = CONTRACTS.find((c) => c.id === run.contract)!;
  const hold = (key: keyof DriveInput) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); if (!canControl()) return; e.currentTarget.setPointerCapture(e.pointerId); input.current[key] = true; },
    onPointerUp: () => { input.current[key] = false; }, onPointerCancel: () => { input.current[key] = false; }, onLostPointerCapture: () => { input.current[key] = false; },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => { if (e.key === 'Enter' && canControl()) input.current[key] = true; },
    onKeyUp: (e: React.KeyboardEvent<HTMLButtonElement>) => { if (e.key === 'Enter') input.current[key] = false; }, onBlur: () => { input.current[key] = false; },
  });
  // Browsers synthesize click only for the primary touch. Steering must respond
  // to pointerdown so a second thumb works while drift or nitro is held.
  const steer = (direction: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); if (canControl()) changeLane(direction); },
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => { if (e.detail === 0 && canControl()) changeLane(direction); },
  });
  const disabled = paused || countdown > 0 || artStatus !== 'ready';
  return <div className="drive-session">
    <div className="drive-scorebar"><span className="drive-score"><small>SCORE</small><b>{frame.score.toLocaleString().padStart(5, '0')}</b></span>
      <span className={`drive-combo ${frame.combo >= 4 ? 'combo-party' : ''}`}>{frame.combo >= 2 ? <><b>×{Math.min(4, 1 + Math.floor(frame.combo / 4))}</b> {frame.combo} COMBO<progress aria-label="콤보 남은 시간" value={frame.comboTime} max={5} /></> : <span>{contract.title}</span>}</span>
      <button onClick={() => paused ? resume() : pause(true)} aria-label="주행 일시정지">{paused ? '▶' : 'Ⅱ'}</button></div>
    <div className={`drive-road nitro-${frame.nitro}`} onPointerDown={(e) => { if ((e.target as HTMLElement).tagName === 'CANVAS') touchStart.current = e.clientX; }} onPointerUp={(e) => { if (touchStart.current !== null && canControl() && Math.abs(e.clientX - touchStart.current) > 25) changeLane(e.clientX > touchStart.current ? 1 : -1); touchStart.current = null; }} onPointerCancel={() => { touchStart.current = null; }}>
      <canvas ref={canvas} aria-label="입체 도시 도로. 좌우로 추월하고 Shift로 코너 드리프트, Space로 니트로를 사용하세요." />
      <div className="drive-course"><span>{district.en}</span><progress aria-label="목적지까지 주행 진행률" value={frame.distance} max={DRIVE_LENGTH} /><b>{Math.round(frame.distance / DRIVE_LENGTH * 100)}<small>%</small></b></div>
      <div className="drive-route-chip"><span className="drive-route-arrow">{corner ? corner.bend > 0 ? '↱' : '↰' : '↑'}</span><span><b>{corner ? `${corner.bend > 0 ? '우' : '좌'}회전 코너 · 드리프트` : district.name}</b><small>{destination}</small></span><button onClick={showMap} aria-label="목적지 지도 열기">지도 ↗</button></div>
      <div className="drive-mission-chip">{run.contract === 'scenic' ? `필름 ${frame.films} / 6` : run.contract === 'express' ? `목표까지 ${Math.max(0, SPRINT_TARGET - frame.elapsed).toFixed(1)}s` : `충돌 ${frame.collisions} · 과속 ${frame.speeding}`}<small>{Math.ceil(DRIVE_LIMIT - frame.elapsed)}s 남음</small></div>
      {nearZone && <div className={`drive-zone ${frame.speed > 55 ? 'too-fast' : ''}`}><b>50</b><span>{Math.max(0, Math.round(zone.distance - frame.distance))}m 앞<small>브레이크로 감속</small></span></div>}
      {frame.drifting ? <div className="drive-feedback drifting"><small>DRIFT CHARGE</small>{frame.driftCharge.toFixed(1)}<span>s</span></div> : frame.noticeUntil > frame.elapsed && <div className="drive-feedback" role="status">{frame.notice}</div>}
      {frame.nitro === 'normal' && frame.nitroAge < .85 && <div className="drive-perfect-window"><span>파란 구간에 NITRO 한 번 더</span><div><i /><b style={{ left: `${Math.min(100, frame.nitroAge / .85 * 100)}%` }} /></div></div>}
      {frame.nitro === 'perfect' || frame.nitro === 'shockwave' ? <div className={`drive-nitro-label ${frame.nitro}`}>{frame.nitro === 'perfect' ? 'PERFECT NITRO' : 'SHOCKWAVE'}</div> : null}
      <div className="drive-dashboard"><div className="drive-speed"><b>{Math.round(frame.speed).toString().padStart(2, '0')}</b><span>KM/H<small>AUTO DRIVE</small></span></div><div className="drive-telemetry"><span>차체 <b>{Math.round(frame.integrity)}%</b></span><progress aria-label="차량 상태" value={frame.integrity} max={100} /><span>필름 <b>{frame.films} / 6</b></span></div></div>
      {countdown > 0 && !paused && artStatus === 'ready' && <div className="drive-countdown" role="status"><span>READY TO DRIVE</span><b key={countdown}>{countdown}</b><p>자동 가속 · 좌우로 차선을 선택하세요</p></div>}
      {artStatus !== 'ready' && <div className="drive-pause"><h3>{artStatus === 'loading' ? '도시를 준비하고 있어요…' : '그래픽을 불러오지 못했어요'}</h3>{artStatus === 'error' && <button className="drive-primary" onClick={onRetryArt}>다시 불러오기</button>}<button className="drive-exit" onClick={onExit}>지도 돌아가기</button></div>}
      {paused && !mapOpen && artStatus === 'ready' && <div className="drive-pause"><span className="drive-kicker">TAKE A BREATHER</span><h3>{exitPrompt ? '이번 주행을 그만둘까요?' : '잠깐, 숨 고르기.'}</h3><p>{exitPrompt ? '완주 전에는 돈과 경험치를 받지 않습니다.' : '주행은 저장됐어요. 다음 코너가 기다리고 있어요.'}</p><button className="drive-primary" onClick={resume}>주행 계속 ↗</button>{exitPrompt ? <button className="drive-exit" onClick={onExit}>보상 없이 나가기</button> : <><button className="drive-exit" onClick={showMap}>목적지 지도 보기</button><button className="drive-exit" onClick={() => setExitPrompt(true)}>주행 그만두기</button></>}</div>}
      {mapOpen && <div className="drive-map-sheet"><div><strong>목적지까지의 실제 도시 경로</strong><button onClick={resume}>닫고 주행 계속 →</button></div><DriveRouteMap cityId={run.cityId} from={from} to={to} destination={destination} progress={frame.distance / DRIVE_LENGTH} /></div>}
    </div>
    <div className="drive-nitro-meter"><span>{frame.energy >= 90 ? 'SHOCKWAVE READY' : 'NITRO'} <b>{Math.round(frame.energy)}%</b></span><progress aria-label="니트로 충전량" value={frame.energy} max={100} /><small>{frame.energy >= 90 ? '풀 차지!' : '드리프트 · 필름 · 추월로 충전'}</small></div>
    <div className="drive-controls"><button {...steer(-1)} disabled={disabled} aria-label="왼쪽 차선">←<small>A / ←</small></button><button {...steer(1)} disabled={disabled} aria-label="오른쪽 차선">→<small>D / →</small></button><button {...hold('brake')} disabled={disabled}>감속<small>S / ↓</small></button><button {...hold('drift')} disabled={disabled} className={`drift ${frame.drifting ? 'active' : ''}`}>드리프트<small>SHIFT</small></button><button {...hold('boost')} disabled={disabled} className={`boost ${frame.nitro !== 'off' ? 'active' : ''}`}>NITRO<small>SPACE / TAP</small></button></div>
  </div>;
}
