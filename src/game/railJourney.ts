import { RAIL_TRIPS } from '../data/rail';
export type RailPhase = 'boarding'|'window'|'transfer'|'arrival'|'walk'|'complete';
export interface RailProgress { phase: RailPhase; leg: number; step: number; choices: number[]; quiz?: number; badge: boolean; stamped: boolean }
export interface RailState { selected: string; trips: Record<string,RailProgress> }
export type RailAction = {type:'select'; id:string}|{type:'advance'}|{type:'choose'; choice:number}|{type:'quiz'; choice:number}|{type:'replay'};
export const freshRailProgress = (): RailProgress => ({phase:'boarding',leg:0,step:0,choices:[],badge:false,stamped:false});
export const initialRailState = (): RailState => ({selected:RAIL_TRIPS[0].id,trips:{}});
export const railProgress = (state:RailState) => state.trips[state.selected] ?? freshRailProgress();
export function railReducer(state:RailState, action:RailAction):RailState {
  if(action.type==='select') return RAIL_TRIPS.some(t=>t.id===action.id)?{...state,selected:action.id}:state;
  const trip=RAIL_TRIPS.find(t=>t.id===state.selected)!;
  const progress=railProgress(state);
  let p={...progress};
  if(action.type==='replay') p={...freshRailProgress(),badge:progress.badge,stamped:progress.stamped};
  if(action.type==='advance') {
    if(p.phase==='boarding') p.phase='window';
    else if(p.phase==='window') p.phase=trip.via && p.leg===0?'transfer':'arrival';
    else if(p.phase==='transfer') {p.phase='window';p.leg=1;}
    else if(p.phase==='arrival') p.phase='walk';
    else if(p.phase==='walk' && p.choices[p.step]!==undefined) {
      if(p.step<trip.moments.length-1) p.step++; else {p.phase='complete';p.stamped=true;}
    }
  }
  if(action.type==='choose' && p.phase==='walk' && [0,1].includes(action.choice)) {p.choices=[...p.choices];p.choices[p.step]=action.choice;}
  if(action.type==='quiz' && p.phase==='complete' && Number.isInteger(action.choice) && action.choice>=0 && action.choice<trip.quiz.options.length) {p.quiz=action.choice;p.badge=p.badge||action.choice===trip.quiz.answer;}
  return {...state,trips:{...state.trips,[trip.id]:p}};
}
// Rebuild only supported fields. Broken or older saves cannot unlock missing choices.
export function restoreRailState(raw:string|null):RailState {
  const state=initialRailState();
  try {
    const value=JSON.parse(raw??'null');
    if(!value||typeof value!=='object') return state;
    if(RAIL_TRIPS.some(t=>t.id===value.selected)) state.selected=value.selected;
    for(const trip of RAIL_TRIPS) {
      const saved=value.trips?.[trip.id];
      if(!saved||typeof saved!=='object') continue;
      const phases:RailPhase[]=['boarding','window','transfer','arrival','walk','complete'];
      if(!phases.includes(saved.phase)) continue;
      const p=freshRailProgress();
      p.leg=trip.via && saved.leg===1?1:0;
      p.phase=saved.phase==='transfer'&&!trip.via?'boarding':saved.phase;
      if(p.phase==='transfer') p.leg=0;
      if(trip.via && ['arrival','walk','complete'].includes(p.phase)) p.leg=1;
      if(Array.isArray(saved.choices)) for(const choice of saved.choices.slice(0,trip.moments.length)) {
        if(choice!==0&&choice!==1) break;
        p.choices.push(choice);
      }
      p.step=Number.isInteger(saved.step)?Math.max(0,Math.min(saved.step,trip.moments.length-1,p.choices.length)):0;
      if(p.phase==='complete'&&p.choices.length!==trip.moments.length) {p.phase='walk';p.step=Math.min(p.choices.length,trip.moments.length-1);}
      p.badge=saved.badge===true;
      p.stamped=saved.stamped===true||p.phase==='complete';
      if(Number.isInteger(saved.quiz)&&saved.quiz>=0&&saved.quiz<trip.quiz.options.length) p.quiz=saved.quiz;
      state.trips[trip.id]=p;
    }
  }catch { /* Start fresh if the storage record is malformed. */ }
  return state;
}
