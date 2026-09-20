import { useState } from 'react';
import { useGame } from '../game/store';
import Dialogue from './Dialogue';
import Backdrop, { type BackdropKind } from './Backdrop';
import { primeAudio, sfx } from '../game/audio';
import type { Speaker } from '../game/types';
import { CURRENCY_META, fmt } from '../game/economy';

// ─── 프롤로그 ───────────────────────────────────────────────────────────────
// 지도를 보여주기 전에 "왜 파리인가 / 나는 무엇을 하는 사람인가"를 먼저 말한다.
// 끝나면 첫 미션 「사진 상자」가 강제로 시작된다.

interface Beat { bd: BackdropKind; chapter: string; who: Speaker; text: string }

const BEATS: Beat[] = [
  { bd: 'station', chapter: '하나 · 도착', who: 'narrator',
    text: '2026년 9월 8일, 화요일 아침 아홉 시. 파리 북역.\n어젯밤 늦게 도착했고, 아직 이 도시의 소리에 익숙하지 않다.' },
  { bd: 'station', chapter: '하나 · 도착', who: 'player',
    text: '가방 하나, 아직 아무것도 적지 않은 수첩 한 권. 그리고 석 달 전에 보낸 원고 한 편.' },
  { bd: 'station', chapter: '하나 · 도착', who: 'player',
    text: '답장이 왔을 때 나는 그 메일을 세 번 다시 읽었다. 「9월 8일 아침 아홉 시, 편집부로 오세요.」' },

  { bd: 'passage', chapter: '둘 · 《Carnet》', who: 'narrator',
    text: '《카르네(Carnet)》 — 발행부수 팔천 부, 직원 네 명. 파리 2구 파사주의 유리 지붕 아래 있는 작은 여행·역사 잡지.' },
  { bd: 'passage', chapter: '둘 · 《Carnet》', who: 'narrator',
    text: '왜 하필 파리에서 시작하는가. 1909년, 이 도시의 은행가 알베르 칸이 여기서 사진가들을 세계 오십여 개국으로 보냈기 때문이다.' },
  { bd: 'passage', chapter: '둘 · 《Carnet》', who: 'narrator',
    text: '전쟁을 줄이려면 사람들이 서로를 알아야 한다 — 그는 그렇게 믿었고, 이십이 년 동안 지구를 컬러 사진으로 모았다. 유리판 칠만 이천 장.' },
  { bd: 'passage', chapter: '둘 · 《Carnet》', who: 'narrator',
    text: '《Carnet》은 그 일을 21세기에 다시 하려 한다. 사진 대신 기사로, 유리판 대신 수첩으로.' },

  { bd: 'box', chapter: '셋 · 사진 상자', who: 'narrator',
    text: '그 기획을 맡은 사람은 선배 작가 L.이었다. 여섯 주 전, 취재 도중 연락이 끊겼다.' },
  { bd: 'box', chapter: '셋 · 사진 상자', who: 'narrator',
    text: '어제 편집부에 도착한 것은 L.이 아니라, L.이 부친 낡은 사진 상자였다. 사진 뒷면마다 도시 이름과 한 줄 수수께끼가 연필로 적혀 있다.' },
  { bd: 'box', chapter: '셋 · 사진 상자', who: 'L',
    text: '「불로뉴비양쿠르 — 유리판 칠만 장 속에서 나를 찾아.」' },
  { bd: 'box', chapter: '셋 · 사진 상자', who: 'narrator',
    text: '편집장은 그 상자를, 어제 계약서에 서명한 신입에게 넘기기로 했다. 다른 사람이 없기 때문이다.' },

  { bd: 'desk', chapter: '넷 · 당신의 일', who: 'player',
    text: '취재하고, 쓰고, 원고료를 받는다. 그 돈으로 다음 도시로 간다. 여기까지가 내가 아는 전부다.' },
  { bd: 'desk', chapter: '넷 · 당신의 일', who: 'narrator',
    text: '가진 것은 수첩 한 권. 지도도, 지갑도, 여권도, 모아둔 사실도 전부 그 안에 있다.\n지금부터 그 수첩이 당신의 화면이다.' },
];

export default function Prologue() {
  const finish = useGame((s) => s.finishPrologue);
  const playerName = useGame((s) => s.playerName);
  const home = useGame((s) => s.home);
  const wallet = useGame((s) => s.wallet);
  const [i, setI] = useState(0);
  const [goals, setGoals] = useState(false);

  const b = BEATS[i];
  const next = () => { if (i + 1 < BEATS.length) setI(i + 1); else setGoals(true); };

  if (goals) {
    return (
      <div className="prologue">
        <Backdrop kind="map" />
        <div className="goals">
          <div className="goals-head">
            <div className="k">{playerName || '신입 작가'} · 《Carnet》 소속 작가</div>
            <h2>당신이 할 일</h2>
          </div>
          <div className="goal-cards">
            <div className="goal">
              <div className="n">1</div>
              <h3>걷고, 취재한다</h3>
              <p>실제 지도 위의 도시를 직접 찾아가 장소를 보고, 사람을 만나고, <b>사실 카드</b>를 모읍니다. 모든 문장에는 출처가 붙습니다 — 그게 이 잡지의 약속입니다.</p>
            </div>
            <div className="goal">
              <div className="n">2</div>
              <h3>기사를 쓴다</h3>
              <p>모은 카드를 골라 기사를 조립해 편집부에 송고합니다. 수집률과 정확도로 <b>등급 C·B·A·S</b>가 정해지고, 등급이 원고료를 정합니다.</p>
            </div>
            <div className="goal">
              <div className="n">3</div>
              <h3>다음 도시로 간다</h3>
              <p>원고료가 곧 여행 자금입니다. 실제 열차 시간·요금·환율·물가로 움직입니다. 한 지역을 완주할 때마다 <b>L.의 편지</b>가 한 통 열리고 지도가 넓어집니다.</p>
            </div>
          </div>
          <div className="goals-foot">
            <div className="purse">
              출발 자금 <b>{fmt(wallet[home], home)}</b> <small>({CURRENCY_META[home].name} — 유로는 아직 한 푼도 없습니다)</small>
            </div>
            <button className="btn red" onClick={() => { primeAudio(); sfx.page(); finish(); }}>편집부 문을 연다 ▸</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="prologue">
      <Backdrop kind={b.bd} />
      <div className="prologue-top">
        <span className="chapter">{b.chapter}</span>
        <button className="skip" onClick={() => setGoals(true)}>프롤로그 건너뛰기 ⏭</button>
      </div>
      <div className="prologue-dim" />
      <div className="vn-dock">
        <Dialogue key={i} who={b.who} text={b.text} onAdvance={next} />
      </div>
    </div>
  );
}
