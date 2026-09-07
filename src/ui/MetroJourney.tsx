import { translateDisplay as display } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { METRO_TRIPS, METRO_SOURCES, STATION_PHOTOS, tripStops, dayComparison } from '../data/metro';
import { photoById } from '../data/photos';
import TravelPhoto from './TravelPhoto';
import { sfxArrive, sfxDepart, unlockAudio } from '../audio';
import './metro.css';
import LanguageSwitch from './LanguageSwitch';
import { useGame } from '../game/store';

export default function MetroJourney({ onJournal }: { onJournal: () => void }) {
  // A locale change updates text without resetting the route or station.
  useGame((s) => s.lang);
  const [tripId, setTripId] = useState('eiffel');
  const trip = METRO_TRIPS.find((t) => t.id === tripId)!;
  const stops = tripStops(trip);
  const [index, setIndex] = useState(0);
  const [riding, setRiding] = useState(false);
  const [sound, setSound] = useState(false);
  const [journeys, setJourneys] = useState(3);
  const [saved, setSaved] = useState<string[]>(() => { try { const value: unknown = JSON.parse(localStorage.getItem('carnet-metro-postcards') ?? '[]'); return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; } catch { return []; } });
  const [saveError, setSaveError] = useState(false);
  const stationList = useRef<HTMLOListElement>(null);
  const stop = stops[index];
  const arrived = index === stops.length - 1;
  const transferAhead = !!stops[index + 1]?.transfer;
  const comparison = dayComparison(journeys);
  const stationPhoto = STATION_PHOTOS[stop.name];
  const scenePhoto = photoById(stationPhoto) ? stationPhoto : undefined;
  useEffect(() => {
    if (!riding || arrived || transferAhead) return;
    const timer = window.setTimeout(() => { setIndex((i) => Math.min(i + 1, stops.length - 1)); if (sound) sfxArrive(); }, 3500);
    return () => window.clearTimeout(timer);
  }, [riding, index, arrived, transferAhead, stops.length, sound]);
  useEffect(() => {
    const list = stationList.current;
    const item = list?.children[index] as HTMLElement | undefined;
    if (list && item) list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - 40;
  }, [index]);
  function advance() { unlockAudio(); if (sound) sfxDepart(); if (transferAhead) setIndex(index + 1); setRiding(true); }
  function choose(id: string) { setRiding(false); setIndex(0); setTripId(id); }
  function save() { const next = [...new Set([...saved, trip.id])]; setSaved(next); try { localStorage.setItem('carnet-metro-postcards', JSON.stringify(next)); } catch { setSaveError(true); } }
  return <main className="metro-page">
    <header className="metro-header"><a className="metro-brand" href="#">carnet<span>{display("파리를 여행하는 방법")}</span></a><nav><LanguageSwitch /><a href="#metro-routes">{display("여행 코스")}</a><a href="#metro-tickets">{display("교통비 아끼기")}</a><button onClick={onJournal}>{display("여행 수첩 ↗")}</button></nav></header>
    <section className="metro-intro"><div><p className="metro-kicker">PARIS, UNE STATION À LA FOIS</p><h1>{display("한 정거장씩,")}<br/>{display("파리와 가까워지는 여행.")}</h1><p>{display("어느 방향 열차를 타야 할지, 어디에서 갈아탈지.")}<br/>{display("함께 타보고, 마음에 드는 풍경 앞에서 내려요.")}</p></div><div className="metro-intro-note"><span>{display("오늘의 작은 모험")}</span><b>{display("루브르 → 에펠탑")}</b><p><i className="line-badge line-1">1</i> → <i className="line-badge line-6">6</i>{display(" 지하철 두 번, 하나의 여행")}</p><small>{display("실제 노선 · 역별 여행 체험 · 현장 사진")}</small></div></section>
    <section id="metro-routes" className="metro-route-picker" aria-label={display("여행 코스 선택")}>{display(METRO_TRIPS.map((t, i) => <button key={t.id} aria-pressed={trip.id === t.id} onClick={() => choose(t.id)}><span>0{display(i + 1)} / {t.legs.map((l) => display(`${l.line}호선`)).join(' → ')}</span><b>{display(t.title)}</b><small>{display(t.subtitle)}</small></button>))}</section>
    <section className="metro-experience">
      <div className="metro-main-scene"><div className="metro-scene-heading"><span className="metro-kicker">{display(arrived ? 'BONJOUR, PARIS / 도착했어요' : 'À BORD / 함께 타는 지하철')}</span><button className="metro-sound" aria-pressed={sound} onClick={() => { unlockAudio(); setSound(!sound); }}>{display("안내음 ")}{display(sound ? '켜짐' : '꺼짐')}</button></div>
        <div className={`metro-window ${riding && !transferAhead && !arrived ? 'moving' : ''}`}>
          {display(scenePhoto ? <TravelPhoto key={scenePhoto} photo={photoById(scenePhoto)} priority /> : <div className="metro-platform"><div className="metro-platform-tiles"/><div className="metro-station-sign" key={stop.name}><small>PARIS · MÉTRO {display(stop.line)}</small><b>{display(stop.name)}</b><span>{display(stop.direction)} →</span></div><div className="metro-platform-bench"/></div>)}
          <span className="metro-photo-label">{display(scenePhoto ? arrived ? '도착역의 실제 사진 · 여기에서 내려요' : '현재 역의 실제 사진 · 촬영 당시 모습' : '역명 안내 장면 · 실제 역 내부를 재현한 그림은 아니에요')}</span><div className="metro-window-rail"/>
        </div>
        <div className="metro-board" aria-live="polite"><i className={`line-badge line-${stop.line}`}>{display(stop.line)}</i><div><small>{display(arrived ? '목적지 역 도착' : transferAhead ? '이 역에서 갈아타요' : `${stop.direction} 방면`)}</small><h2>{display(stop.name)}</h2><p>{display(arrived ? trip.walk : transferAhead ? `Sortie(출구)로 나가지 말고 ${stops[index + 1].line}호선 환승 표지를 따라가세요. ${stops[index + 1].direction} 방면 승강장입니다.` : `다음 역 · ${stops[index + 1]?.name}`)}</p></div></div>
        <div className="metro-playback"><div><span>{display(index + 1)} / {display(stops.length)}{display(" 여행 단계")}</span><small>{display("역당 3.5초로 압축한 노선 체험 · 실시간 운행 화면 아님")}</small></div><div>{display(arrived ? <button className="metro-primary" onClick={save} disabled={saved.includes(trip.id)}>{display(saved.includes(trip.id) ? '✓ 여행 엽서에 담았어요' : '이 여행을 엽서에 담기')}</button> : transferAhead ? <button className="metro-primary" onClick={advance}>{display(stops[index + 1].line)}{display("호선으로 갈아타기 →")}</button> : <button className="metro-primary" onClick={() => { if (riding) setRiding(false); else advance(); }}>{display(riding ? '잠깐 멈추기' : index === 0 ? `${stop.line}호선 타고 출발 →` : '이어서 타기 →')}</button>)}<button onClick={() => choose(trip.id)}>{display("처음부터")}</button></div></div>
        {display(saveError && <p role="status">{display("이 브라우저에서 저장할 수 없어 이번 화면에만 엽서를 보관했어요.")}</p>)}
        <article className="metro-moment"><span>{display("✳ 여행의 즐거움은, 이동하는 순간에도")}</span><h3>{display(trip.subtitle)}</h3><p>{display(trip.moment)}</p></article>
      </div>
      <aside className="metro-itinerary"><div className="metro-itinerary-title"><span className="metro-kicker">YOUR LITTLE ITINERARY</span><h2>{display("이렇게 가면 돼요.")}</h2><p>{display(trip.duration)}{display(" · 도보·환승 포함 예상")}<br/>{display("편도 일반권 €2.55 · 역 밖으로 나가지 않는 환승")}</p></div><ol ref={stationList} className="metro-stations">{display(stops.map((s, i) => <li key={`${s.legIndex}-${s.stationIndex}`} className={`${i < index ? 'passed' : ''} ${s.transfer ? 'is-transfer' : ''}`} aria-current={i === index ? 'step' : undefined}>{display(s.stationIndex === 0 && <div className="metro-leg-label"><i className={`line-badge line-${s.line}`}>{display(s.line)}</i><b>{display(s.transfer ? '환승' : '탑승')} · {display(s.direction)}{display(" 방면")}</b></div>)}<button onClick={() => { setRiding(false); setIndex(i); }}><span className={`metro-station-dot line-${s.line}`}/><span>{display(s.name)}<small>{display(i === index ? '지금 여기' : i === stops.length - 1 ? '하차 후 산책' : s.transfer ? '환승 통로 → 새 승강장' : i === 0 ? '출발역' : '정차역')}</small></span>{display(i < index && <span>✓</span>)}</button></li>))}</ol><div className="metro-route-foot">{display("역 이름을 누르면 그 장면을 미리 볼 수 있어요.")}<br/>{display(trip.legs.map((l) => <a key={l.line} href={`https://www.ratp.fr/plans-lignes/metro/${l.line}`} target="_blank" rel="noreferrer">{display(l.line)}{display("호선 공식 노선도 ↗ ")}</a>))}</div></aside>
    </section>
    <section className="metro-after"><div><p className="metro-kicker">{display("SORTIE / 지상으로 나오면")}</p><h2>{display("이제, 발걸음을 느리게.")}</h2><p>{display(trip.walk)}</p><p>{display("사진을 누르면 크게 볼 수 있어요. 마음에 든 코스는 도착 후 엽서로 남겨 다음 여행을 준비하세요.")}</p><span className="metro-collected">{display("나의 여행 엽서 ")}{display(saved.length)} / 3</span></div><TravelPhoto key={trip.photo} photo={photoById(trip.photo)} /><TravelPhoto photo={photoById(trip.id === 'montmartre' ? 'food:cafe' : 'paris:louvre')} /></section>
    <section id="metro-tickets" className="metro-tickets"><div className="metro-section-title"><p className="metro-kicker">{display("LE BON BILLET / 표를 잘 고르는 여행")}</p><h2>{display("아낀 교통비로, 커피 한 잔 더.")}</h2><p>{display("성인 일반요금 · 2026년 기준 · 2026.09.07 공식 안내 확인")}</p></div><div className="metro-ticket-grid">
      <article><span>{display("01 / 적게 타는 날")}</span><h3>{display("메트로·기차·RER 1회권")}</h3><strong>€2.55</strong><p>{display("호환 스마트폰의 Île-de-France Mobilités 앱이나 Navigo Easy에 충전해요. 환승할 때는 출구 대신 Correspondance 표지를 따라가세요. 공항·버스·트램은 별도입니다.")}</p><a href={METRO_SOURCES.single} target="_blank" rel="noreferrer">{display("사용 조건과 구매 방법 ↗")}</a></article>
      <article><span>{display("02 / 하루 종일 돌아다닐 때")}</span><h3>{display("Navigo Jour · 1일권")}</h3><strong>€12.30</strong><p>{display("선택한 하루, 1–5존에서 이용해요. 공항은 제외됩니다. 일반 지하철만 5회 이상 타는 날이라면 1회권보다 저렴해요. 새로 개찰구에 들어가는 여정을 세어보세요.")}</p><a href={METRO_SOURCES.day} target="_blank" rel="noreferrer">{display("1일권 공식 안내 ↗")}</a></article>
      <article><span>{display("03 / 같은 주에 여러 날 머문다면")}</span><h3>{display("Navigo Semaine · 주간권")}</h3><strong>€32.40</strong><p>{display("1–5존 기준. 월요일부터 일요일까지 유효해요. 구매일부터 7일이 아닙니다. 호환 스마트폰 또는 Navigo Découverte 등에 충전하며, Easy에는 주간권을 담을 수 없어요.")}</p><a href={METRO_SOURCES.week} target="_blank" rel="noreferrer">{display("주간권과 지원 카드 확인 ↗")}</a></article>
    </div><div className="metro-calculator"><div><h3>{display("오늘 몇 번 이동할까요?")}</h3><p>{display("성인 · 공항 제외 · 지하철 여정 기준. 환승은 별도 횟수로 세지 않아요.")}</p><label>{display("하루 여정 ")}<input aria-label={display("하루 지하철 여정 수")} type="range" min="1" max="10" value={journeys} onChange={(e) => setJourneys(Number(e.target.value))}/><b>{display(journeys)}{display("회")}</b></label></div><div><b>{display(comparison.cheaper === 'single' ? '1회권이 더 알뜰해요' : '1일권이 더 알뜰해요')}</b><p>{display("1회권 합계 €")}{display(comparison.single.toFixed(2))}{display(" / 1일권 €12.30")}</p><small>{display("두 상품 비교 · 카드 발급비 별도 · 기존 패스·할인·Liberté+ 제외")}</small></div></div>
    <div className="metro-practical"><article><h3>{display("표는 어디에서 사나요?")}</h3><p>{display("역의 공식 자동판매기·매표소 또는 Île-de-France Mobilités 앱을 이용하세요. 실물 카드는 카드값과 승차권 가격이 별도예요. 동행도 각자의 카드나 휴대전화가 필요합니다.")}</p></article><article><h3>{display("공항에서부터 여행한다면")}</h3><p>{display("일반 1회권과 1일권은 공항 철도역에 쓸 수 없어요. 공항 전용권은 €14. 1–5존 주간권은 CDG의 RER B와 오를리의 14호선에 사용할 수 있지만 Orlyval은 제외돼요.")}</p></article><article><h3>{display("출발 전에 한 번만 확인해요")}</h3><p>{display("주말 공사·막차·승강장 변경은 공식 앱에서 확인하세요. 안내한 시간은 도보와 대기를 포함한 예상이며, 사진은 촬영 당시의 모습입니다. 현장의 표지와 운행 안내를 먼저 따라주세요.")}</p></article></div><a className="metro-source" href={METRO_SOURCES.fares} target="_blank" rel="noreferrer">{display("Île-de-France Mobilités · 2026 요금표 확인 ↗")}</a></section>
    <section className="metro-more-tips"><h2>{display("나비고, 이름보다 사용 방법을 보세요.")}</h2><div className="metro-practical">
      <article><h3>{display("카드값도 아끼려면")}</h3><p>{display("지원되는 스마트폰에 직접 표를 담으면 실물 카드 발급비를 아낄 수 있어요. 실물 Navigo Easy는 €2, Découverte는 €5입니다. Découverte에는 이름과 사진이 필요하며 함께 제공된 두 카드를 같이 지참해야 해요.")}</p><a href="https://www.iledefrance-mobilites.fr/titres-et-tarifs/supports/passe-navigo-easy" target="_blank" rel="noreferrer">{display("Easy 안내 ↗")}</a> · <a href="https://www.iledefrance-mobilites.fr/titres-et-tarifs/supports/passe-navigo-decouverte" target="_blank" rel="noreferrer">{display("Découverte 안내 ↗")}</a></article>
      <article><h3>{display("Liberté+도 비교해 보세요")}</h3><p>{display("메트로·기차·RER 여정은 €2.04이며 이용한 만큼 다음 달 청구됩니다. 공항 제외 하루 상한도 적용돼요. 앱이나 카드의 가입 조건과 결제 수단을 먼저 확인하세요. 위 계산기는 가입 없이 쓰는 1회권과 1일권만 비교합니다.")}</p><a href="https://www.iledefrance-mobilites.fr/titres-et-tarifs/detail/liberte-plus" target="_blank" rel="noreferrer">{display("Liberté+ 공식 가입 조건 ↗")}</a></article>
      <article><h3>{display("주간권은 여행 요일이 중요해요")}</h3><p>{display("일요일에서 월요일로 넘어가면 새 주가 시작됩니다. 같은 주에 머무르는 일정과 공항 이동을 함께 비교하세요. 주간권만 쓸 거라면 Easy를 먼저 사지 않아도 돼요. 휴대전화나 Découverte 등 지원 매체에 주간권을 담으세요.")}</p><a href={METRO_SOURCES.week} target="_blank" rel="noreferrer">{display("주간권 유효기간 확인 ↗")}</a></article>
    </div></section>
    <footer className="metro-footer"><b>carnet</b><span>{display("목적지뿐 아니라, 그곳에 가는 길까지 기억하는 여행.")}</span><a href="https://www.ratp.fr/" target="_blank" rel="noreferrer">{display("RATP 운행 정보 ↗")}</a></footer>
  </main>;
}
