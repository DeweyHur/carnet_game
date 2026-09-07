import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { translateDisplay as d } from '../i18n';
import { RAIL_COPY as c, RAIL_TRIPS, railSource } from '../data/rail';
import { COUNTRIES, COMPANIONS } from '../data/railEurope';
import { railProgress, railReducer, restoreRailState, type RailAction, type RailState } from '../game/railJourney';
import { useGame } from '../game/store';
import { photoById } from '../data/photos';
import TravelPhoto from './TravelPhoto';
import LanguageSwitch from './LanguageSwitch';
import { CityCompanion, CountryMusic } from './CountryCompanion';
import './rail.css';

const SAVE_KEY='carnet-rail-v1';
export default function RailJourney({onMetro}:{onMetro:()=>void}) {
  const [state,dispatch]=useReducer(railReducer,undefined,()=>{try{return restoreRailState(localStorage.getItem(SAVE_KEY));}catch{return restoreRailState(null);}});
  const [paused,setPaused]=useState(false);
  const [saveError,setSaveError]=useState(false);
  const progress=railProgress(state);
  const rideClock=useRef({key:'',remaining:8000});
  useEffect(()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));setSaveError(false);}catch{setSaveError(true);}},[state]);
  useEffect(()=>{
    const key=`${state.selected}-${progress.phase}-${progress.leg}`;
    if(rideClock.current.key!==key) rideClock.current={key,remaining:8000};
    if(progress.phase!=='window'||paused) return;
    const started=Date.now();
    const timer=window.setTimeout(()=>dispatch({type:'advance'}),rideClock.current.remaining);
    return ()=>{window.clearTimeout(timer);rideClock.current.remaining=Math.max(0,rideClock.current.remaining-(Date.now()-started));};
  },[state.selected,progress.phase,progress.leg,paused]);
  return <RailJourneyView state={state} dispatch={dispatch} paused={paused} onPause={()=>setPaused(p=>!p)} saveError={saveError} onMetro={onMetro}/>;
}

export function RailJourneyView({state,dispatch,paused,onPause,saveError,onMetro}:{state:RailState;dispatch:Dispatch<RailAction>;paused:boolean;onPause:()=>void;saveError:boolean;onMetro:()=>void}) {
  useGame(s=>s.lang);
  const [filter,setFilter]=useState('all');
  const [region,setRegion]=useState<'all'|'france'|'europe'>('all');
  const experience=useRef<HTMLElement>(null);
  const trip=RAIL_TRIPS.find(t=>t.id===state.selected)!;
  const p=railProgress(state);
  const current=trip.moments[p.step];
  const stamps=RAIL_TRIPS.filter(t=>state.trips[t.id]?.stamped).length;
  const inRegion=(t:typeof trip)=>region==='all'||(region==='europe'?!!t.country:!t.country);
  const choose=(id:string)=>{dispatch({type:'select',id});experience.current?.scrollIntoView({behavior:'smooth',block:'start'});experience.current?.focus({preventScroll:true});};
  const phaseLabel={boarding:c.depart,window:c.window,transfer:c.transfer,arrival:c.arrive,walk:c.keep,complete:c.complete}[p.phase];
  return <main className="metro-page rail-page">
    <header className="metro-header"><a className="metro-brand" href="#rail-top">carnet<span>LES GRANDS VOYAGES</span></a><nav><LanguageSwitch/><a href="#rail-passport">{d(c.passport)}</a><button onClick={onMetro}>{d(c.home)}</button></nav></header>
    <section className="rail-hero" id="rail-top"><div><p className="metro-kicker">FRANCE → EUROPE</p><h1>{d(c.title)}</h1><p>{d(c.intro)}</p><div className="rail-hero-stat">{String(RAIL_TRIPS.length).padStart(2,'0')} <span>{d(c.worldGoal)} · {stamps} / {RAIL_TRIPS.length}</span></div></div><TravelPhoto photo={photoById('nice')} priority/><span className="rail-ticket-mark">PARIS → AILLEURS<br/>UN BILLET POUR RÊVER</span></section>
    <section className="rail-destinations">
      <div className="rail-filters" aria-label={d(c.region)}>{(['all','france','europe'] as const).map(r=><button key={r} aria-pressed={region===r} onClick={()=>setRegion(r)}>{d(r==='all'?c.all:r==='france'?c.france:c.europe)}</button>)}</div>
      <div className="rail-filters" aria-label={d(c.all)}>{(['all','water','culture','green'] as const).map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{d(c[f])}</button>)}</div>
      <div className="rail-cards">{RAIL_TRIPS.filter(t=>inRegion(t)&&(filter==='all'||t.theme===filter)).map(t=><button className="rail-city" key={t.id} aria-pressed={state.selected===t.id} onClick={()=>choose(t.id)}><img src={photoById(t.id)?.thumb} alt={d(t.name)} loading="lazy" width="480" height="320"/><span className="rail-city-copy"><small>{t.train}{t.night?' · 🌙':''}</small><b>{d(t.name)} {state.trips[t.id]?.stamped?'✳':''}</b><span>{d(t.tagline)}</span><em>{d(c.select)} →</em></span></button>)}</div>
    </section>
    <section className="rail-experience" ref={experience} tabIndex={-1} id="rail-experience">
      <aside className="rail-ticket"><span className="metro-kicker">CARNET / RAIL PASS</span><h2>{d(trip.name)}</h2><p>{d(trip.tagline)}</p><h3>{d(c.route)}</h3><ol><li>{trip.from}</li>{trip.via&&<li className={p.phase==='transfer'?'rail-active-stop':''}>{trip.via}<small>{d(c.transfer)}</small></li>}<li>{trip.to}</li></ol><p>{trip.train}</p>{trip.night&&<p className="rail-badge rail-night">🌙 {d(c.night)}</p>}{trip.country&&<p className="rail-badge">{d(c.currency)}: {COUNTRIES[trip.country].currency}</p>}<small>{d(c.routeNote)}</small><small>{d(c.origin)}</small><a href={railSource(trip)} target="_blank" rel="noreferrer">{d(c.source)}</a>{trip.via&&!trip.source&&<a href={railSource(trip,true)} target="_blank" rel="noreferrer">Marseille → Nice ↗</a>}<a href={trip.guide} target="_blank" rel="noreferrer">{d(c.tourism)}</a><div className="rail-punches">○ ○ ○ ○ ○ ○ ○ ○ ○ ○</div>
      {trip.next&&trip.next.length>0&&<div className="rail-onward"><small>{d(c.onward)}</small><div>{trip.next.map(id=>{const nt=RAIL_TRIPS.find(x=>x.id===id);return nt&&<button key={id} onClick={()=>choose(id)}>{d(nt.name)} →</button>;})}</div></div>}
      {COMPANIONS[trip.id]&&<CityCompanion tripId={trip.id} complete={p.phase==='complete'}/>}
      {trip.country&&<CountryMusic country={trip.country}/>}
      </aside>
      <div className="rail-story"><div className={`rail-window ${p.phase==='window'&&!paused?'rail-moving':''}`}><TravelPhoto key={p.phase==='walk'?current.photo:trip.id} photo={photoById(p.phase==='walk'?current.photo:trip.id)} priority/>{p.phase==='window'&&<div className="rail-window-frame"/>}</div><div className="rail-story-copy"><p className="metro-kicker">{p.phase==='walk'?`${p.step+1} / ${trip.moments.length}`:trip.train}</p><h2 aria-live="polite">{d(phaseLabel)}</h2>
      {p.phase==='boarding'&&<><p>{d(c.platform)}</p><b>{trip.from} → {trip.via??trip.to}</b><button className="rail-primary" onClick={()=>dispatch({type:'advance'})}>{d(c.board)}</button></>}
      {p.phase==='window'&&<><p>{d(trip.window)}</p><small>{d(c.scene)}</small><div className="rail-ride-progress"><i key={`${state.selected}-${p.leg}`} style={{animationPlayState:paused?'paused':'running'}}/></div><div className="rail-actions"><button onClick={onPause}>{d(paused?c.resume:c.pause)}</button><button onClick={()=>dispatch({type:'advance'})}>{d(c.next)}</button></div></>}
      {p.phase==='transfer'&&<><h3>{trip.via} → {trip.to}</h3><p>{d(c.transferTip)}</p><button className="rail-primary" onClick={()=>dispatch({type:'advance'})}>{d(c.change)}</button></>}
      {p.phase==='arrival'&&<><h3>{trip.to}</h3><p>{d(trip.arrival)}</p><button className="rail-primary" onClick={()=>dispatch({type:'advance'})}>{d(c.walk)}</button></>}
      {p.phase==='walk'&&<><h3>{current.title}</h3><p>{d(current.text)}</p><div className="rail-choices">{current.choices.map((choice,i)=><button key={i} aria-pressed={p.choices[p.step]===i} onClick={()=>dispatch({type:'choose',choice:i})}>{p.choices[p.step]===i?'✓ ':''}{d(choice)}</button>)}</div><button className="rail-primary" disabled={p.choices[p.step]===undefined} onClick={()=>dispatch({type:'advance'})}>{d(p.step===trip.moments.length-1?c.finish:c.continue)}</button></>}
      {p.phase==='complete'&&<><div className="rail-memory">{trip.moments.map((m,i)=><p key={m.title}><b>{m.title}</b><br/>{d(m.choices[p.choices[i]])}</p>)}</div><div className="rail-quiz"><h3>{d(c.discovery)}</h3><details><summary>{d(c.review)}</summary>{trip.moments.map(m=><p key={m.title}><b>{m.title}</b><br/>{d(m.text)}</p>)}</details><p>{d(trip.quiz.question)}</p>{trip.quiz.options.map((o,i)=><button key={i} disabled={p.badge} aria-pressed={p.quiz===i} onClick={()=>dispatch({type:'quiz',choice:i})}>{d(o)}</button>)}<p role="status">{d(p.badge?c.correct:p.quiz!==undefined?c.retry:'')}</p></div><button onClick={()=>dispatch({type:'replay'})}>{d(c.again)}</button></>}
      <p className="rail-save" role="status">{d(saveError?c.saveError:c.saved)}</p></div></div>
    </section>
    <section id="rail-passport" className="rail-passport"><p className="metro-kicker">COLLECT MOMENTS, NOT MILES</p><h2>{d(c.passport)}</h2><div className="rail-stamps">{RAIL_TRIPS.map(t=><button onClick={()=>choose(t.id)} key={t.id} className={state.trips[t.id]?.stamped?'stamped':''}><span>{state.trips[t.id]?.stamped?'✳':'○'}</span><b>{d(t.name)}</b><small>{state.trips[t.id]?.badge?`★ ${d(c.badge)}`:t.to}</small></button>)}</div><div className="rail-goals">{[1,3,5,8].map((n,i)=><span key={n} className={stamps>=n?'earned':''}>{stamps>=n?'✓':'○'} {d(c.goals[i])} · {Math.min(stamps,n)}/{n}</span>)}<span className={stamps>=RAIL_TRIPS.length?'earned':''}>{stamps>=RAIL_TRIPS.length?'✓':'○'} {d(c.worldGoal)} · {Math.min(stamps,RAIL_TRIPS.length)}/{RAIL_TRIPS.length}</span></div></section>
    <section className="rail-tips"><h2>{d(c.price)}</h2><p>{d(c.tip)}</p><p>{d(c.navigo)}</p><a href="https://www.sncf-connect.com/en-en/train/route/paris/lyon" target="_blank" rel="noreferrer">SNCF Connect ↗</a></section>
  </main>;
}
