import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { missionById } from '../data/missions';
import { cityById } from '../data/cities';
import { cardById } from '../data/cards';
import type { GuideLook, Speaker, Step } from '../game/types';
import { ExchangeForm, FactCardView, Price } from './common';
import Dialogue from './Dialogue';
import { foodPrice, fmt, FX_EUR, type Grade } from '../game/economy';
import { primeAudio, sfx } from '../game/audio';
import GuideIntro from './GuideIntro';
import Illus from './Illus';
import Portrait from './Portrait';
import { useTypewriter } from './useTypewriter';
import { BASE_EXPRESSION, inferExpression, type Expression } from '../game/expression';

// ─── 비주얼 노벨 씬 ────────────────────────────────────────────────────────
// 위쪽(stage)에 퀴즈·영수증·기사 같은 상호작용, 아래쪽(dock)에 초상 + 한 글자씩
// 찍히는 대사창. 대사창을 클릭하면 타이핑을 건너뛰고, 다시 누르면 다음 칸으로.

export default function Scene() {
  const active = useGame((s) => s.active);
  const paused = useGame((s) => s.paused);
  const setPaused = useGame((s) => s.setPaused);
  const abandon = useGame((s) => s.abandonMission);
  const metGuides = useGame((s) => s.metGuides);
  if (!active || paused) return null;
  const m = missionById(active.missionId);
  const step = m.steps[active.step];
  if (!step) return null;
  const city = cityById(m.cityId);
  const pct = Math.round(((active.step + 1) / m.steps.length) * 100);
  const forced = m.type === 'tutorial'; // 첫 미션은 건너뛸 수 없다
  // 이 도시의 안내인이 처음 말을 거는 순간이면, 대사보다 먼저 인물 카드를 보여준다
  const meeting = speaksGuide(step) && !metGuides.includes(m.cityId);

  return (
    <div className="vn">
      <div className="vn-head">
        <span className="mission-tag">{city.names.ko} · 「{m.title}」 · {active.step + 1}/{m.steps.length}</span>
        <div className="vn-progress"><i style={{ width: `${pct}%` }} /></div>
        {!forced && (
          <span className="vn-head-btns">
            <button className="btn sm ghost" onClick={() => setPaused(true)}>잠시 접기</button>
            <button className="btn sm ghost" onClick={() => { if (confirm('이 취재를 포기할까요? 진행이 사라집니다.')) abandon(); }}>포기</button>
          </span>
        )}
      </div>
      {meeting
        ? <GuideIntro cityId={m.cityId} />
        : <StepView key={`${m.id}-${active.step}`} step={step} guideName={city.guide.name} guideRole={city.guide.archetype} guideColor={city.guide.color} guideMood={city.guide.mood} guideLook={city.guide.look} />}
    </div>
  );
}

/** 이 스텝에서 도시 안내인이 입을 여는가 — 첫 만남 카드를 띄울 시점 */
function speaksGuide(step: Step): boolean {
  switch (step.t) {
    case 'say': return step.who === 'guide';
    case 'card': return step.who === 'guide';
    case 'quiz': return (step.who ?? 'guide') === 'guide';
    case 'exchange':
    case 'visit':
    case 'buy': return true;
    default: return false;
  }
}

function Stage({ children }: { children: ReactNode }) {
  return <div className="vn-stage"><div className="vn-stage-inner">{children}</div></div>;
}

function Dock(props: Parameters<typeof Dialogue>[0]) {
  return <div className="vn-dock"><Dialogue {...props} /></div>;
}

function StepView({ step, guideName, guideRole, guideColor, guideMood, guideLook }: { step: Step; guideName: string; guideRole: string; guideColor: string; guideMood?: Expression; guideLook?: GuideLook }) {
  const g = useGame();
  const next = () => { primeAudio(); g.nextStep(); };
  const city = cityById(g.cityId);
  const gp: GP = { name: guideName, role: guideRole, color: guideColor, mood: guideMood, look: guideLook };
  /** 안내인은 도시가 정한 기본 표정을, 나머지는 스텝이 지정한 표정을 쓴다 */
  const moodOf = (who: Speaker, override?: Expression) => override ?? (who === 'guide' ? guideMood : undefined);

  switch (step.t) {
    case 'say':
      return <Dock who={step.who} name={step.who === 'guide' ? guideName : step.name} role={step.who === 'guide' ? guideRole : undefined}
        color={guideColor} look={guideLook} text={step.text} fiction={step.fiction} mood={moodOf(step.who, step.mood)} onAdvance={next} />;

    case 'card': {
      const card = cardById(step.cardId);
      const who: Speaker = step.who ?? 'narrator';
      return (
        <>
          <Stage><FactCardView card={card} /></Stage>
          <Dock who={who} name={who === 'guide' ? guideName : undefined} role={who === 'guide' ? guideRole : undefined} color={guideColor} look={guideLook}
            text={step.text ?? '사실 한 조각을 얻었다. 수첩에 붙여 둔다.'} mood={moodOf(who, step.mood)} onAdvance={next} nextLabel="수첩에 붙이기" />
        </>
      );
    }

    case 'quiz': return <Quiz step={step} gp={gp} />;
    case 'photo': return <Photo step={step} />;
    case 'order': return <Order step={step} />;
    case 'visit': return <Visit step={step} gp={gp} />;
    case 'buy': return <Buy step={step} gp={gp} />;

    case 'message': return <Message step={step} />;

    case 'exchange':
      return (
        <>
          <Stage><ExchangeForm defaultFrom={step.from} defaultTo={step.to} /></Stage>
          <Dock who="guide" name={guideName} role={guideRole} color={guideColor} look={guideLook} text={step.hint} mood={guideMood}
            onAdvance={g.wallet.EUR >= 20 ? next : undefined} nextLabel="유로가 생겼다"
            actions={g.wallet.EUR < 20 ? <span className="hint">유로가 €20은 있어야 다음으로 갈 수 있습니다 (지금 {fmt(g.wallet.EUR, 'EUR')})</span> : undefined} />
        </>
      );

    case 'move':
      return <Dock who="narrator" text={`도시 안 이동: ${step.zone}. 1회권 €2.50, 약 ${step.minutes}분. (지금 ${clock(g.minute)})`} onAdvance={next} nextLabel="🚇 타기" />;

    case 'article': return <Article baseFee={step.baseFee} />;

    case 'letter':
      return (
        <>
          <Stage><div className="letter"><h3>✉ {step.title}</h3>{step.text}</div></Stage>
          <Dock who="narrator" text="봉투를 열었다. 익숙한 필체다." onAdvance={next} nextLabel="접어 넣기" />
        </>
      );

    case 'unlock':
      return <Dock who="narrator" text={`🗺 지도가 넓어졌다.\n${step.note}`} onAdvance={next} nextLabel="지도 보기" />;

    case 'collect':
      return <Dock who="narrator" text={`🎞 수집품을 얻었다 — ${step.item}`} onAdvance={next} />;

    case 'stamp':
      return (
        <>
          <Stage>
            <div style={{ textAlign: 'center' }}>
              <div className="passport-stamp big">VISÉ · {city.names.fr.toUpperCase()}<br /><small>{g.day}일차 · {WEEKDAYS[weekdayOf(g.day)]}</small></div>
            </div>
          </Stage>
          <Dock who="narrator" text="여권에 스탬프가 찍혔다. 잉크 냄새가 잠깐 났다." onAdvance={next} nextLabel="미션 완료" />
        </>
      );
  }
}

interface GP { name: string; role: string; color: string; mood?: Expression; look?: GuideLook }

function Quiz({ step, gp }: { step: Extract<Step, { t: 'quiz' }>; gp: GP }) {
  const g = useGame();
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const who: Speaker = step.who ?? 'guide';
  return (
    <>
      <Stage>
        <div className="q">❓ {step.q}</div>
        <div className="options">
          {step.options.map((o, i) => (
            <button key={i} disabled={done} className={done ? (i === step.answer ? 'ok' : i === picked ? 'no' : '') : ''}
              onClick={() => { primeAudio(); setPicked(i); g.answer(i === step.answer); }}>{String.fromCharCode(65 + i)}. {o}</button>
          ))}
        </div>
        {done && <FactCardView card={cardById(step.cardId)} />}
      </Stage>
      <Dock who={who} name={who === 'guide' ? gp.name : undefined} role={who === 'guide' ? gp.role : undefined} color={gp.color} look={gp.look}
        mood={who === 'guide' ? (done && picked !== step.answer ? 'sad' : gp.mood) : undefined}
        text={done ? `${picked === step.answer ? '정답이에요. ' : '아쉽네요 — 기사 정확도가 조금 떨어집니다. '}${step.explain ?? ''}` : step.q}
        onAdvance={done ? () => g.nextStep() : undefined} />
    </>
  );
}

function Photo({ step }: { step: Extract<Step, { t: 'photo' }> }) {
  const g = useGame();
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  return (
    <>
      <Stage>
        <div className="q">📷 포토 매칭 — L.의 사진은 지금 어디일까?</div>
        <div className="photo">{step.hint}</div>
        <div className="options">
          {step.options.map((o, i) => (
            <button key={i} disabled={done} className={done ? (i === step.answer ? 'ok' : i === picked ? 'no' : '') : ''}
              onClick={() => { primeAudio(); setPicked(i); g.answer(i === step.answer); }}>{o}</button>
          ))}
        </div>
        {done && step.cardId && <FactCardView card={cardById(step.cardId)} />}
      </Stage>
      <Dock who="narrator"
        text={done
          ? (picked === step.answer ? '맞았다. 사진 속 풍경과 지금의 장소가 겹쳐진다.' : '아니다. 뒷면 메모를 다시 읽어보면 답이 보인다.')
          : '사진을 뒤집어 연필 메모를 읽는다.'}
        onAdvance={done ? () => g.nextStep() : undefined} />
    </>
  );
}

function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function Order({ step }: { step: Extract<Step, { t: 'order' }> }) {
  const g = useGame();
  const items = useMemo(() => shuffle(step.items), [step.items]);
  const [seq, setSeq] = useState<string[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const complete = seq.length === step.items.length;
  const check = () => { const ok = seq.every((x, i) => x === step.items[i]); setResult(ok); g.answer(ok); };
  return (
    <>
      <Stage>
        <div className="q">🔢 {step.prompt}</div>
        <div className="orderlist">
          {items.map((it) => <button key={it} className={seq.includes(it) ? 'picked' : ''} disabled={result !== null || seq.includes(it)} onClick={() => setSeq([...seq, it])}>{seq.includes(it) ? `${seq.indexOf(it) + 1}. ` : ''}{it}</button>)}
        </div>
        <div className="picked-seq">{seq.join(' → ') || '순서대로 눌러 주세요'}</div>
        {result === null
          ? <div className="scene-actions"><button className="btn ghost sm" onClick={() => setSeq([])}>다시</button><button className="btn" disabled={!complete} onClick={check}>확인</button></div>
          : <FactCardView card={cardById(step.cardId)} />}
      </Stage>
      <Dock who="narrator"
        text={result === null ? step.prompt : result ? '정확한 순서다.' : `아쉽다. 정답은 ${step.items.join(' → ')}.`}
        onAdvance={result === null ? undefined : () => g.nextStep()} />
    </>
  );
}

function Visit({ step, gp }: { step: Extract<Step, { t: 'visit' }>; gp: GP }) {
  const g = useGame();
  const city = cityById(g.cityId);
  const poi = city.pois.find((p) => p.id === step.poiId)!;
  const [err, setErr] = useState<string | null>(null);
  const wd = weekdayOf(g.day);
  const closed = poi.closedDays?.includes(wd);
  const go = () => { const r = g.visitPoi(step.poiId, step.minutes); if (r.ok) g.nextStep(); else setErr(r.reason!); };
  return (
    <>
      <Stage>
        <div className="q">📍 {poi.name}</div>
        <div className="illus-wide"><Illus kind="place" id={poi.type} imageUrl={poi.imageUrl} alt={poi.name} /></div>
        <div className="row" style={{ borderBottom: 'none' }}>
          <div className="s">{poi.hours ?? '상시'}{poi.closedDays?.length ? ` · ${poi.closedDays.map((d) => WEEKDAYS[d]).join('·')} 휴관` : ''} · 관람 약 {step.minutes}분 · 지금 {clock(g.minute)}, {WEEKDAYS[wd]}요일{poi.note ? ` · ${poi.note}` : ''}</div>
          <Price eur={poi.feeEur} />
        </div>
        {(err || closed) && <div className="closed-notice">{err ?? `${poi.name}은(는) ${WEEKDAYS[wd]}요일 휴관입니다. 실제 개장 요일을 따릅니다.`}<br /><small>숙소에서 자고 내일 다시 오거나, 취재를 잠시 접어둘 수 있습니다.</small></div>}
        <div className="scene-actions">
          <span className="hint">체력 {g.stamina}</span>
          <button className="btn ghost sm" onClick={() => g.setPaused(true)}>잠시 접기</button>
          {(err || closed) && <button className="btn ghost" onClick={() => { g.sleep(); setErr(null); }}>숙소에서 자기 (€{Math.round(city.hostelEur * city.priceIndex)})</button>}
          <button className="btn" disabled={closed} onClick={go}>입장 ▸</button>
        </div>
      </Stage>
      <Dock who="guide" name={gp.name} role={gp.role} color={gp.color} look={gp.look} mood={closed ? 'sad' : gp.mood}
        text={closed ? `오늘은 문을 닫았어요. ${WEEKDAYS[wd]}요일은 휴관이거든요.` : `${poi.name}이에요. 표를 끊고 들어가죠.`} />
    </>
  );
}

function Buy({ step, gp }: { step: Extract<Step, { t: 'buy' }>; gp: GP }) {
  const g = useGame();
  const city = cityById(g.cityId);
  const food = city.foods.find((f) => f.id === step.foodId)!;
  const price = foodPrice(food, city);
  const [guess, setGuess] = useState<string>('');
  const [bought, setBought] = useState<number | null>(null);
  const home = g.home;
  const doBuy = () => { const gv = step.guess ? Number(guess) : undefined; g.buyFood(food.id, gv); setBought(gv ?? -1); };
  const err = bought !== null && bought >= 0 ? Math.abs(bought - price) / price : null;
  return (
    <>
      <Stage>
        <div className="q">🥐 {food.name} <span className="tag">{food.nameLocal}</span></div>
        <div className="illus-wide"><Illus kind="food" id={food.id} imageUrl={food.imageUrl} alt={food.name} /></div>
        {bought === null ? (
          <>
            {step.guess ? (
              <div className="guess">
                <span>가격 맞히기 — 여기서는 얼마일까? €</span>
                <input type="number" step="0.5" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="예상가" />
                <button className="btn" disabled={!guess} onClick={doBuy}>이 값에 걸고 사기</button>
              </div>
            ) : (
              <div className="scene-actions"><Price eur={price} /><button className="btn" onClick={doBuy}>사기</button></div>
            )}
            <div className="hint" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>힌트: 파리 기준가 {fmt(food.baseEur, 'EUR')} · 이 도시 물가지수 {city.priceIndex.toFixed(2)}</div>
          </>
        ) : (
          <div className="receipt">
            <div className="l"><span>{food.nameLocal}</span><span>{fmt(price, 'EUR')}</span></div>
            <div className="l"><span>≈ 자국 통화</span><span>{fmt(price * FX_EUR[home], home)}</span></div>
            {err !== null && <div className="l"><span>내 예상 €{bought}</span><span>오차 {Math.round(err * 100)}%</span></div>}
            <div className="l tot"><span>체력 +{food.stamina}</span><span>{fmt(g.wallet.EUR, 'EUR')} 남음</span></div>
          </div>
        )}
      </Stage>
      <Dock who={bought === null ? 'narrator' : 'guide'} name={gp.name} role={bought === null ? undefined : gp.role} color={gp.color} look={gp.look}
        mood={bought === null ? undefined : err !== null && err < 0.15 ? 'smile' : err !== null && err >= 0.4 ? 'sad' : gp.mood}
        text={bought === null ? food.origin
          : err === null ? '잘 샀어요.'
          : err < 0.15 ? '거의 정확해요. 이 도시 물가가 손에 잡히기 시작했네요.'
          : err < 0.4 ? '방향은 맞아요. 파리 기준가에 물가지수를 곱해 보세요.'
          : '많이 빗나갔어요. 계산 전에 현지 통화로 한 번 더 셈해 보는 습관을 들이세요.'}
        onAdvance={bought === null ? undefined : () => g.nextStep()} />
    </>
  );
}

function Article({ baseFee }: { baseFee: number }) {
  const g = useGame();
  const m = missionById(g.active!.missionId);
  const [sel, setSel] = useState<string[]>(m.cardIds.filter((c) => g.cards.includes(c)));
  const [res, setRes] = useState<{ grade: Grade; fee: number } | null>(null);
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const have = m.cardIds.filter((c) => g.cards.includes(c)).length;
  return (
    <>
      <Stage>
        <div className="q">📝 기사 조립 — 「{m.title}」</div>
        {res === null ? (
          <>
            <div className="hint" style={{ fontSize: 12, color: 'var(--ink-3)' }}>수집한 사실 카드 {have}/{m.cardIds.length}장 · 퀴즈 오답 {g.active!.wrong}회 · 기본 원고료 €{baseFee}. 카드를 골라 기사에 넣으세요. 등급(C/B/A/S)은 수집률과 정확도로 결정됩니다.</div>
            <div className="article-cards">
              {m.cardIds.map((id) => {
                const c = cardById(id);
                const has = g.cards.includes(id);
                return (
                  <label key={id} className={has ? '' : 'missing'}>
                    <input type="checkbox" disabled={!has} checked={sel.includes(id)} onChange={() => toggle(id)} />
                    <span>{has ? c.text : '(수집하지 못한 카드)'}</span>
                  </label>
                );
              })}
            </div>
            <div className="scene-actions"><button className="btn red" onClick={() => setRes(g.submitArticle(sel))}>편집장에게 송고</button></div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}><div className="grade">{res.grade}</div></div>
        )}
      </Stage>
      <Dock who="margot"
        mood={res === null ? 'wry' : res.grade === 'S' ? 'smile' : res.grade === 'C' ? 'sad' : 'warm'}
        text={res === null ? '보내기 전에 한 번만 더 읽어봐요. 넣을 문장과 뺄 문장을 정하는 게 기사예요.'
          : `${{ S: '이건 표지감이에요. 사실마다 출처가 붙어 있고 문장이 살아 있어요.', A: '좋아요. 빠진 카드 한두 장이 아깝지만, 이대로 실어요.', B: '실을 수는 있어요. 다음엔 장소를 하나라도 더 가요.', C: '원고료는 주지만… L.이라면 이렇게 안 썼을 거예요.' }[res.grade]} 원고료 €${res.fee} 송금했어요.`}
        onAdvance={res === null ? undefined : () => g.nextStep()} />
    </>
  );
}

/** 편집부에서 오는 휴대폰 메시지 — 얼굴을 마주보는 대사가 아니라 화면 너머의 목소리 */
function Message({ step }: { step: Extract<Step, { t: 'message' }> }) {
  const g = useGame();
  const sound = useGame((s) => s.sound);
  const speed = useGame((s) => s.textSpeed);
  const { shown, done, skip } = useTypewriter(step.text, { speed, voice: 'margot', sound, animate: speed > 0 });
  const label = step.from === 'margot' ? '마고 뒤랑' : step.from === 'theo' ? '테오' : 'L.';
  const role = step.from === 'margot' ? '《Carnet》 편집장' : step.from === 'theo' ? '라이벌 작가' : '발신인 불명';
  const expression = done ? inferExpression(step.text, BASE_EXPRESSION[step.from]) : BASE_EXPRESSION[step.from];

  useEffect(() => { primeAudio(); sfx.buzz(); const t = window.setTimeout(() => sfx.notify(), 260); return () => window.clearTimeout(t); }, []);

  return (
    <div className="vn-center" onClick={() => { if (!done) skip(); }}>
      <div className="phone">
        <div className="phone-bar"><span>{clock(g.minute)}</span><span className="notch" /><span>{g.day}일차 ▮▮▯</span></div>
        <div className="phone-head">
          <Portrait who={step.from} talking={!done} expression={expression} size={40} framed={false} />
          <div className="who"><b>{label}</b><small>{role}</small></div>
          <span className="back">‹</span>
        </div>
        <div className="phone-body">
          <div className="day-sep">{step.subject ?? '오늘'}</div>
          <div className="bubble in">
            {shown}<span className="caret" style={{ opacity: done ? 0 : 1 }}>▏</span>
            <span className="stamp">{clock(g.minute)}</span>
          </div>
          {!done && <div className="typing"><i /><i /><i /></div>}
        </div>
        <div className="phone-foot">
          <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); skip(); }} disabled={done}>전부 보기</button>
          <button className="btn red sm" onClick={(e) => { e.stopPropagation(); primeAudio(); sfx.advance(); g.nextStep(); }} disabled={!done}>주머니에 넣는다 ▸</button>
        </div>
      </div>
    </div>
  );
}
