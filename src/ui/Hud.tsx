import { useGame } from '../game/store';
import { cityById, REGIONS } from '../data/cities';
import { primeAudio, sfx } from '../game/audio';

/** 맨 위 띠 — 제목과 설정만. 숫자는 오른쪽 소지품 칸이 맡는다. */
export default function Hud() {
  const s = useGame();
  const city = cityById(s.cityId);
  const speeds: { ms: number; label: string }[] = [{ ms: 44, label: '느리게' }, { ms: 26, label: '보통' }, { ms: 12, label: '빠르게' }, { ms: 0, label: '즉시' }];

  return (
    <header className="hud">
      <div className="hud-title">CARNET<small>세계를 걷는 기록</small></div>
      <div className="hud-who">{s.playerName}<small>《Carnet》 소속 작가 · {REGIONS[city.region].name}</small></div>
      <div className="hud-spacer" />
      <button className={`opt${s.sound ? ' on' : ''}`} onClick={() => { primeAudio(); s.setSound(!s.sound); if (!s.sound) sfx.advance(); }}>
        {s.sound ? '🔊 소리 켬' : '🔇 소리 끔'}
      </button>
      <select className="opt" value={s.textSpeed} onChange={(e) => s.setTextSpeed(Number(e.target.value))} title="대사 속도">
        {speeds.map((x) => <option key={x.ms} value={x.ms}>대사 {x.label}</option>)}
      </select>
      <button className="opt" onClick={() => { if (confirm('저장을 지우고 처음부터 시작할까요?')) s.reset(); }}>새 게임</button>
    </header>
  );
}
