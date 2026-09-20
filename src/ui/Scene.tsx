import { translateDisplay as display } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { useGame, WEEKDAYS, weekdayOf, clock } from '../game/store';
import { missionById } from '../data/missions';
import { cityById } from '../data/cities';
import { cardById } from '../data/cards';
import type { Speaker, Step } from '../game/types';
import { Avatar, ExchangeForm, FactCardView, Price } from './common';
import { cityCurrency, convert, foodPrice, fmt, CURRENCY_META, type Grade } from '../game/economy';
import { priceChoices } from '../game/priceChoices';
import { photoById, placePhoto } from '../data/photos';
import TravelPhoto from './TravelPhoto';
import CityMap from './CityMap';
import { useT, weekdayLabel, dayLabel } from '../i18n';
import GuideIntro from './GuideIntro';
import Portrait from './Portrait';
import { useTypewriter } from './useTypewriter';
import { primeAudio, sfx } from '../game/audio';
import { BASE_EXPRESSION, inferExpression, type Expression } from '../game/expression';
import type { GuideLook } from '../game/types';

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

/** step 배열에서 dir 방향으로 가장 가까운 'visit' 스텝의 poiId를 찾는다 (다음 목적지 / 직전 출발지 추론용). */
function nearestVisitPoiId(steps: Step[], from: number, dir: 1 | -1): string | undefined {
  for (let i = from; i >= 0 && i < steps.length; i += dir) {
    const s = steps[i];
    if (s.t === 'visit') return s.poiId;
    if (dir === 1 && s.t === 'unlock') break; // 지역 해금을 넘어서까지 앞을 내다보지 않는다
  }
  return undefined;
}

export default function Scene() {
  const t = useT();
  const active = useGame((s) => s.active);
  const paused = useGame((s) => s.paused);
  const metGuides = useGame((s) => s.metGuides);
  if (!active || paused) return null;
  const m = missionById(active.missionId);
  const step = m.steps[active.step];
  if (!step) return null;
  const city = cityById(m.cityId);
  const pct = Math.round((active.step / m.steps.length) * 100);
  const backdrop = step.t === 'visit' ? placePhoto(city.id, step.poiId) : step.t === 'photo' ? photoById(step.photoId) : photoById(city.id);
  const stagePoi = step.t === 'visit' ? city.pois.find((p) => p.id === step.poiId) : undefined;
  // 이 도시의 안내인이 처음 말을 거는 순간이면, 대사보다 먼저 인물 카드를 보여준다
  const meeting = speaksGuide(step) && !metGuides.includes(m.cityId);
  const showMap = (step.t === 'visit' && !!stagePoi?.coord) || step.t === 'move';
  // 'move' 스텝은 보통 바로 다음 'visit' 스텝의 장소로 걸어가는 구간이다. 목적지·직전 장소를 추론해
  // 지도에 도보 동선(점선)을 그려 "미션도 그에 맞게" 요청을 반영한다.
  const targetPoiId = step.t === 'visit' ? step.poiId : step.t === 'move' ? step.poiId ?? nearestVisitPoiId(m.steps, active.step + 1, 1) : undefined;
  const originPoiId = step.t === 'move' ? nearestVisitPoiId(m.steps, active.step - 1, -1) : undefined;
  return (
    <div className="scene mission-scene">
      <div className="scene-landscape">
        {display(showMap
            ? <CityMap cityId={city.id} highlightId={targetPoiId} routeFromId={originPoiId} readOnly controls={false} />
            : <TravelPhoto photo={backdrop ?? photoById(city.id)} priority mystery={step.t === 'photo'} />)}
      </div>
      <div className="scene-location"><span>CARNET / SUR LE TERRAIN</span><b>{display(city.names.fr)}</b><small>{display(city.names.ko)}{t('에서의 기록')}</small></div>
      <div className="scene-box">
        <div className="progress"><i style={{ width: `${pct}%` }} /></div>
        <div className="mission-tag">{display(city.names.ko)} · 「{display(m.title)}」 · {display(active.step + 1)}/{display(m.steps.length)}</div>
        <button className="pause-scene" onClick={() => useGame.getState().setPaused(true)}>{t('잠시 접기 ×')}</button>
        {meeting
          ? <GuideIntro cityId={m.cityId} />
          : <StepView key={`${m.id}-${active.step}`} step={step} guideName={city.guide.name} guideRole={city.guide.archetype} guideColor={city.guide.color} guideMood={city.guide.mood} guideLook={city.guide.look} />}
      </div>
    </div>
  );
}

function Who({ who, name, role }: { who: Speaker; name?: string; role?: string }) {
  const label: Record<Speaker, string> = { margot: '마고 뒤랑', L: 'L.', theo: '테오', echo: name ?? '메아리', narrator: '', player: '나', guide: name ?? '안내인' };
  const roleTxt: Record<Speaker, string> = { margot: '편집장', L: '실종된 선배', theo: '라이벌 작가', echo: '기록의 재구성', narrator: '', player: '', guide: role ?? '' };
  if (who === 'narrator') return null;
  return <div className="who">{display(label[who])}<span className="role">{display(roleTxt[who])}</span></div>;
}

function StepView({ step, guideName, guideRole, guideColor, guideMood, guideLook }: { step: Step; guideName: string; guideRole: string; guideColor: string; guideMood?: Expression; guideLook?: GuideLook }) {
  const g = useGame();
  const t = useT();
  const next = g.nextStep;
  const city = cityById(g.cityId);
  /** 안내인은 도시가 정한 기본 표정을, 나머지는 스텝이 지정한 표정을 쓴다 */
  const moodOf = (who: Speaker, override?: Expression) => override ?? (who === 'guide' ? guideMood : undefined);

  switch (step.t) {
    case 'say':
      return (
        <>
          <div className="speaker">
            <Portrait who={step.who} name={step.who === 'guide' ? guideName : step.name} color={guideColor} look={step.who === 'guide' ? guideLook : undefined} expression={inferExpression(step.text, moodOf(step.who, step.mood) ?? BASE_EXPRESSION[step.who])} size={104} />
            <div className="speech">
              <Who who={step.who} name={step.who === 'guide' ? guideName : step.name} role={guideRole} />
              <div className={`txt${step.who === 'narrator' ? ' narr' : ''}`}>{display(step.text)}</div>
              {display(step.who === 'echo' && <div className="fiction">{display(step.fiction ? t('✎ 창작 대사 — 실제 기록·저작을 바탕으로 재구성한 문장입니다.') : t('❝ 기록 인용 — 실제 저작·서한·기록에 근거한 문장입니다.'))}</div>)}
            </div>
          </div>
          <div className="scene-actions"><button className="btn" onClick={next}>{t('계속 ▸')}</button></div>
        </>
      );
    case 'card': {
      const card = cardById(step.cardId);
      return (
        <>
          {display(step.text && (
            <div className="speaker">
              <Portrait who={step.who ?? 'narrator'} name={guideName} color={guideColor} look={guideLook} expression={inferExpression(step.text ?? '', moodOf(step.who ?? 'narrator', step.mood) ?? BASE_EXPRESSION[step.who ?? 'narrator'])} size={104} />
              <div className="speech"><Who who={step.who ?? 'narrator'} name={guideName} role={guideRole} /><div className={`txt${!step.who || step.who === 'narrator' ? ' narr' : ''}`}>{display(step.text)}</div></div>
            </div>
          ))}
          <FactCardView card={card} />
          <div className="scene-actions"><span className="hint">{t('수첩에 붙입니다')}</span><button className="btn" onClick={next}>{t('수집 ▸')}</button></div>
        </>
      );
    }

    case 'quiz': return <Quiz step={step} />;
    case 'photo': return <Photo step={step} />;
    case 'order': return <Order step={step} />;
    case 'visit': return <Visit step={step} />;
    case 'buy': return <Buy step={step} />;
    case 'exchange': {
      const already = g.wallet[step.to] >= 20;
      return (
        <>
          <div className="speaker"><Avatar who="guide" name={guideName} color={guideColor} /><div className="speech"><Who who="guide" name={guideName} role={guideRole} /><div className="txt">{display(already ? `${t('이미 ')}${t(CURRENCY_META[step.to].name)}${t('를 충분히 갖고 있네요. 바로 다음 취재로 가도 좋아요.')}` : step.hint)}</div></div></div>
          {display(!already && <ExchangeForm defaultFrom={step.from} defaultTo={step.to} />)}
          <div className="scene-actions"><span className="hint">{t('보유')} {display(fmt(g.wallet[step.to], step.to))}</span><button className="btn ghost" disabled={g.wallet[step.to] < 20} onClick={next}>{t(CURRENCY_META[step.to].name)}{t('이가 생겼다 ▸')}</button></div>
        </>
      );
    }
    case 'move': {
      const moveCur = cityCurrency(city);
      const moveFare = city.transitFareEur ?? 2.5;
      return (
        <>
          <div className="speech"><div className="txt narr">🚇 {t('도시 안 이동')}: <b>{display(step.zone)}</b>. {display(fmt(moveFare, moveCur))}, {t('관람 약 ')}{display(step.minutes)}{t('분 · 지금 ')}{display(clock(g.minute))})</div></div>
          <div className="scene-actions">
            <button className="btn" onClick={next}>🚇 {t('풍경을 따라 이동 ▸')}</button>
          </div>
        </>
      );
    }
    case 'message': return <Message step={step} />;
    case 'article': return <Article baseFee={step.baseFee} />;

    case 'letter':
      return (
        <>
          <div className="letter"><h3>✉ {display(step.title)}</h3>{display(step.text)}</div>
          <div className="scene-actions"><span className="hint">{t('수첩 › 편지에 보관됩니다')}</span><button className="btn" onClick={next}>{t('접어 넣기 ▸')}</button></div>
        </>
      );

    case 'unlock':
      return (
        <>
          <div className="speech"><div className="txt">🗺 <b>{t('지도가 넓어졌다.')}</b><br />{display(step.note)}</div></div>
          <div className="scene-actions"><button className="btn" onClick={next}>{t('지도 보기 ▸')}</button></div>
        </>
      );
    case 'collect':
      return (
        <>
          <div className="speech"><div className="txt">🎞 {t('수집품 획득: ')}<b>{display(step.item)}</b></div></div>
          <div className="scene-actions"><button className="btn" onClick={next}>{t('계속 ▸')}</button></div>
        </>
      );
    case 'stamp':
      return (
        <>
          <div style={{ textAlign: 'center' }}>
            <div className="passport-stamp" style={{ fontSize: 16, padding: '12px 18px' }}>VISÉ · {display(city.names.fr.toUpperCase())}<br /><small>{display(dayLabel(g.lang, g.day))} · {display(g.lang === 'en' ? weekdayLabel(g.lang, weekdayOf(g.day), WEEKDAYS) : WEEKDAYS[weekdayOf(g.day)])}</small></div>
            <div className="speech"><div className="txt narr">{t('여권에 스탬프가 찍혔다.')}</div></div>
          </div>
          <div className="scene-actions"><button className="btn red" onClick={next}>{t('미션 완료 ▸')}</button></div>
        </>
      );
  }
}

function Quiz({ step }: { step: Extract<Step, { t: 'quiz' }> }) {
  const g = useGame();
  const t = useT();
  const [picked, setPicked] = useState<number | null>(g.active?.result?.kind === 'answer' ? g.active.result.picked ?? null : null);
  const done = picked !== null;
  return (
    <>
      <div className="q">❓ {display(step.q)}</div>
      <div className="options">
        {display(step.options.map((o, i) => (
          <button key={i} disabled={done} className={done ? (i === step.answer ? 'ok' : i === picked ? 'no' : '') : ''} onClick={() => { setPicked(i); g.answer(i === step.answer, i); }}>{display(String.fromCharCode(65 + i))}. {display(o)}</button>
        )))}
      </div>
      {display(done && (
        <>
          <div className="explain">{display(picked === step.answer ? t('정답. ') : t('오답 — 기사 정확도가 조금 떨어집니다. '))}{display(step.explain)}</div>
          <FactCardView card={cardById(step.cardId)} />
          <div className="scene-actions"><button className="btn" onClick={g.nextStep}>{t('계속 ▸')}</button></div>
        </>
      ))}
    </>
  );
}

function Photo({ step }: { step: Extract<Step, { t: 'photo' }> }) {
  const g = useGame();
  const t = useT();
  const [picked, setPicked] = useState<number | null>(g.active?.result?.kind === 'answer' ? g.active.result.picked ?? null : null);
  const done = picked !== null;
  return (
    <>
      <div className="q">📷 {t('포토 매칭 — L.의 사진은 지금 어디일까?')}</div>
      <TravelPhoto photo={photoById(step.photoId)} className="clue-photo" mystery={!done} priority />
      <div className="photo-note">✎ {display(step.hint)}</div>
      <div className="options">
        {display(step.options.map((o, i) => (
          <button key={i} disabled={done} className={done ? (i === step.answer ? 'ok' : i === picked ? 'no' : '') : ''} onClick={() => { setPicked(i); g.answer(i === step.answer, i); }}>{display(o)}</button>
        )))}
      </div>
      {display(done && (
        <>
          <div className="explain">{display(picked === step.answer ? t('맞았다. 사진 속 풍경과 지금의 장소가 겹쳐진다.') : t('아니다. 뒷면 메모를 다시 읽어보면 답이 보인다.'))}</div>
          {display(step.cardId && <FactCardView card={cardById(step.cardId)} />)}
          <div className="scene-actions"><button className="btn" onClick={g.nextStep}>{t('계속 ▸')}</button></div>
        </>
      ))}
    </>
  );
}

function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function Order({ step }: { step: Extract<Step, { t: 'order' }> }) {
  const g = useGame();
  const t = useT();
  const items = useMemo(() => shuffle(step.items), [step.items]);
  const [seq, setSeq] = useState<string[]>([]);
  const [result, setResult] = useState<boolean | null>(g.active?.result?.kind === 'answer' ? g.active.result.correct : null);
  const complete = seq.length === step.items.length;
  const check = () => { const ok = seq.every((x, i) => x === step.items[i]); setResult(ok); g.answer(ok); };
  return (
    <>
      <div className="q">🔢 {display(step.prompt)}</div>
      <div className="orderlist">
        {display(items.map((it) => <button key={it} className={seq.includes(it) ? 'picked' : ''} disabled={result !== null || seq.includes(it)} onClick={() => setSeq([...seq, it])}>{display(seq.includes(it) ? `${seq.indexOf(it) + 1}. ` : '')}{display(it)}</button>))}
      </div>
      <div className="picked-seq">{display(seq.join(' → ') || t('순서대로 눌러 주세요'))}</div>
      {display(result === null ? (
        <div className="scene-actions"><button className="btn ghost sm" onClick={() => setSeq([])}>{t('다시')}</button><button className="btn" disabled={!complete} onClick={check}>{t('확인')}</button></div>
      ) : (
        <>
          <div className="explain">{display(result ? t('정확한 순서.') : `${t('아쉽다. 정답: ')}${step.items.join(' → ')}`)}</div>
          <FactCardView card={cardById(step.cardId)} />
          <div className="scene-actions"><button className="btn" onClick={g.nextStep}>{t('계속 ▸')}</button></div>
        </>
      ))}
    </>
  );
}

function Visit({ step }: { step: Extract<Step, { t: 'visit' }> }) {
  const g = useGame();
  const t = useT();
  const city = cityById(g.cityId);
  const poi = city.pois.find((p) => p.id === step.poiId)!;
  const cur = cityCurrency(city);
  const [err, setErr] = useState<string | null>(null);
  const wd = weekdayOf(g.day);
  const closed = poi.closedDays?.includes(wd);
  const go = () => { const r = g.visitPoi(step.poiId, step.minutes); if (r.ok) g.nextStep(); else setErr(r.reason!); };
  const wdLabel = (d: number) => g.lang === 'en' ? weekdayLabel(g.lang, d, WEEKDAYS) : WEEKDAYS[d];
  return (
    <>
      <div className="q">📍 {display(poi.name)}</div>
      <div className="row" style={{ borderBottom: 'none' }}>
        <div className="s">{display(poi.hours ?? t('상시'))}{display(poi.closedDays?.length ? ` · ${poi.closedDays.map((d) => wdLabel(d)).join('·')} ${t('휴관')}` : '')} · {t('관람 약 ')}{display(step.minutes)}{t('분 · 지금 ')}{display(clock(g.minute))}, {display(wdLabel(wd))}{display(g.lang === 'en' ? '' : '요일')}{display(poi.note ? ` · ${poi.note}` : '')}</div>
        <Price amount={poi.feeEur} currency={cur} />
      </div>
      {display((err || closed) && <div className="closed-notice">{display(err ?? (g.lang === 'en' ? `${poi.name} is closed on ${wdLabel(wd)}s, following its real schedule.` : `${poi.name}은(는) ${WEEKDAYS[wd]}요일 휴관입니다. 실제 개장 요일을 따릅니다.`))}<br /><small>{t('숙소에서 자고 내일 다시 오거나, 미션을 잠시 접어둘 수 있습니다.')}</small></div>)}
      <div className="scene-actions">
        <span className="hint">{t('체력')} {display(g.stamina)}</span>
        <button className="btn ghost sm" onClick={() => g.setPaused(true)}>{t('잠시 접기')}</button>
        {display((err || closed) && <button className="btn ghost" onClick={() => { g.sleep(); setErr(null); }}>{t('숙소에서 자기')} ({display(fmt(Math.round(city.hostelEur * city.priceIndex), cur))})</button>)}
        <button className="btn" disabled={closed} onClick={go}>{t('입장 ▸')}</button>
      </div>
    </>
  );
}

function Buy({ step }: { step: Extract<Step, { t: 'buy' }> }) {
  const g = useGame();
  const t = useT();
  const city = cityById(g.cityId);
  const food = city.foods.find((f) => f.id === step.foodId)!;
  const cur = cityCurrency(city);
  const price = foodPrice(food, city);
  const [guess, setGuess] = useState<number | null>(null);
  const choices = useMemo(() => priceChoices(price, `${city.id}:${food.id}`), [price, city.id, food.id]);
  const [bought, setBought] = useState<number | null>(g.active?.result?.kind === 'buy' ? g.active.result.expected ?? -1 : null);
  const home = g.home;
  const doBuy = () => { if (step.guess && guess === null) return; const gv = step.guess ? guess! : undefined; if (g.buyFood(food.id, gv)) setBought(gv ?? -1); };
  const err = bought !== null && bought >= 0 ? Math.abs(bought - price) / price : null;
  return (
    <>
      <div className="q">🥐 {display(food.name)} <span className="tag">{display(food.nameLocal)}</span></div>
      <TravelPhoto photo={photoById(`food:${food.id}`)} className="food-scene-photo" />
      <div className="speech"><div className="txt narr" style={{ fontSize: 14 }}>{display(food.origin)}</div></div>
      {display(bought === null ? (
        <>
          {display(step.guess ? (
            <div className="price-game">
              <p>{t('이 도시에서는 얼마일까요? 가격표 하나를 골라보세요.')}</p>
              <div className="price-options">{display(choices.map((value, i) => <button key={value} aria-pressed={guess === value} className={guess === value ? 'selected' : ''} onClick={() => setGuess(value)}><span>{display(String.fromCharCode(65 + i))}</span><b>{display(fmt(value, cur))}</b><small>≈ {display(fmt(convert(value, cur, home), home))}</small></button>))}</div>
              <div className="scene-actions"><span className="hint">{t('선택한 값은 예상가예요. 결제는 실제 가격으로 진행돼요.')}</span><button className="btn" disabled={guess === null} onClick={doBuy}>{t('가격 확인하고 맛보기 →')}</button></div>
            </div>
          ) : (
            <div className="scene-actions"><Price amount={price} currency={cur} /><button className="btn" onClick={doBuy}>{t('사기')}</button></div>
          ))}
          <div className="hint" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>{t('힌트: 기준가')} {display(fmt(food.baseEur, cur))} · {t('이 도시 물가지수')} {display(city.priceIndex.toFixed(2))}</div>
        </>
      ) : (
        <>
          <div className="receipt">
            <div className="l"><span>{display(food.nameLocal)}</span><span>{display(fmt(price, cur))}</span></div>
            {display(cur !== home && <div className="l"><span>≈ {t('자국 통화')}</span><span>{display(fmt(convert(price, cur, home), home))}</span></div>)}
            {display(err !== null && <div className="l"><span>{t('내 예상 ')}{display(fmt(bought, cur))}</span><span>{t('오차 ')}{display(Math.round(err * 100))}%</span></div>)}
            <div className="l tot"><span>{t('체력 +')}{display(food.stamina)}</span><span>{display(fmt(g.wallet[cur], cur))} {t('남음')}</span></div>
          </div>
          {display(err !== null && <div className="explain">{display(err < 0.15 ? t('거의 정확. 이 도시 물가가 손에 잡히기 시작했다.') : err < 0.4 ? t('방향은 맞다. 기준가에 물가지수를 곱해 보자.') : t('많이 빗나갔다. 카드 결제 전에 현지 통화로 한 번 더 셈해 보는 습관.'))}</div>)}
          <div className="scene-actions"><button className="btn" onClick={g.nextStep}>{t('계속 ▸')}</button></div>
        </>
      ))}
    </>
  );
}

function Article({ baseFee }: { baseFee: number }) {
  const g = useGame();
  const t = useT();
  const m = missionById(g.active!.missionId);
  const [sel, setSel] = useState<string[]>(m.cardIds.filter((c) => g.cards.includes(c)));
  const [res, setRes] = useState<{ grade: Grade; fee: number } | null>(g.active?.result?.kind === 'article' ? g.active.result : null);
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const have = m.cardIds.filter((c) => g.cards.includes(c)).length;
  return (
    <>
      <div className="q">📝 {t('기사 조립 — ')}「{display(m.title)}」</div>
      {display(res === null ? (
        <>
          <div className="hint" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('수집한 사실 카드 ')}{display(have)}/{display(m.cardIds.length)}{t('장 · 퀴즈 오답 ')}{display(g.active!.wrong)}{t('회 · ')}{t('기본 원고료')} €{display(baseFee)}{t('. 카드를 골라 기사에 넣으세요. 등급(C/B/A/S)은 수집률과 정확도로 결정됩니다.')}</div>
          <div className="article-cards">
            {display(m.cardIds.map((id) => {
              const c = cardById(id);
              const has = g.cards.includes(id);
              return (
                <label key={id} className={has ? '' : 'missing'}>
                  <input type="checkbox" disabled={!has} checked={sel.includes(id)} onChange={() => toggle(id)} />
                  <span>{display(has ? c.text : t('(수집하지 못한 카드)'))}</span>
                </label>
              );
            }))}
          </div>
          <div className="scene-actions"><button className="btn red" onClick={() => setRes(g.submitArticle(sel))}>{t('편집장에게 송고')}</button></div>
        </>
      ) : (
        <>
          <div style={{ textAlign: 'center' }}>
            <div className="grade">{display(res.grade)}</div>
            <div className="speaker" style={{ textAlign: 'left', marginTop: 8 }}>
              <Avatar who="margot" />
              <div className="speech"><Who who="margot" /><div className="txt">{t({ S: '이건 표지감이에요. 사실마다 출처가 붙어 있고 문장이 살아 있어요.', A: '좋아요. 빠진 카드 한두 장이 아깝지만, 이대로 실어요.', B: '실을 수는 있어요. 다음엔 장소를 하나라도 더 가요.', C: '원고료는 주지만… L.이라면 이렇게 안 썼을 거예요.' }[res.grade])} {t('원고료')} €{display(res.fee)}{t(' 송금했어요.')}</div></div>
            </div>
          </div>
          <div className="scene-actions"><button className="btn" onClick={g.nextStep}>{t('계속 ▸')}</button></div>
        </>
      ))}
    </>
  );
}

/** 편집부에서 오는 휴대폰 메시지 — 얼굴을 마주보는 대사가 아니라 화면 너머의 목소리 */
function Message({ step }: { step: Extract<Step, { t: 'message' }> }) {
  const t = useT();
  const g = useGame();
  const sound = useGame((s) => !s.muted);
  const speed = useGame((s) => s.textSpeed);
  const { shown, done, skip } = useTypewriter(t(step.text), { speed, voice: 'margot', sound, animate: speed > 0 });
  const label = t(step.from === 'margot' ? '마고 뒤랑' : step.from === 'theo' ? '테오' : 'L.');
  const role = t(step.from === 'margot' ? '《Carnet》 편집장' : step.from === 'theo' ? '라이벌 작가' : '발신인 불명');
  const expression = done ? inferExpression(step.text, BASE_EXPRESSION[step.from]) : BASE_EXPRESSION[step.from];

  useEffect(() => { primeAudio(); sfx.buzz(); const t = window.setTimeout(() => sfx.notify(), 260); return () => window.clearTimeout(t); }, []);

  return (
    <div className="vn-center" onClick={() => { if (!done) skip(); }}>
      <div className="phone">
        <div className="phone-bar"><span>{display(clock(g.minute))}</span><span className="notch" /><span>{display(dayLabel(g.lang, g.day))} ▮▮▯</span></div>
        <div className="phone-head">
          <Portrait who={step.from} talking={!done} expression={expression} size={40} framed={false} />
          <div className="who"><b>{display(label)}</b><small>{display(role)}</small></div>
          <span className="back">‹</span>
        </div>
        <div className="phone-body">
          <div className="day-sep">{t(step.subject ?? '오늘')}</div>
          <div className="bubble in">
            {display(shown)}<span className="caret" style={{ opacity: done ? 0 : 1 }}>▏</span>
            <span className="stamp">{display(clock(g.minute))}</span>
          </div>
          {!done && <div className="typing"><i /><i /><i /></div>}
        </div>
        <div className="phone-foot">
          <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); skip(); }} disabled={done}>{t('전부 보기')}</button>
          <button className="btn red sm" onClick={(e) => { e.stopPropagation(); primeAudio(); sfx.advance(); g.nextStep(); }} disabled={!done}>{t('주머니에 넣는다 ▸')}</button>
        </div>
      </div>
    </div>
  );
}
