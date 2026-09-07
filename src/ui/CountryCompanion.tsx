import { useEffect, useRef, useState } from 'react';
import { COUNTRIES, COMPANIONS, type CountryCode } from '../data/railEurope';
import { RAIL_COPY as c } from '../data/rail';
import { translateDisplay as d } from '../i18n';
import { CountryPlayer } from '../countryAudio';

function initial(name:string){ return name.trim().charAt(0).toUpperCase(); }
function hue(name:string){ let h=0; for(const ch of name) h=(h*31+ch.charCodeAt(0))%360; return h; }

export function Portrait({slug,index,name}:{slug:string;index?:number;name:string}){
  const [broken,setBroken]=useState(false);
  return <span className="companion-portrait" role="img" aria-label={name}>
    <b className="companion-portrait-initial" style={{background:`hsl(${hue(name)} 55% 85%)`,color:`hsl(${hue(name)} 45% 30%)`}}>{initial(name)}</b>
    {index!==undefined&&<span className="companion-portrait-atlas" style={{backgroundPosition:`${index%3*50}% ${Math.floor(index/3)*50}%`}}/>}
    {!broken&&<img src={`/characters/${slug}.png`} alt="" onError={()=>setBroken(true)}/>}
  </span>;
}
/** One local companion per city, not per country — every stop gets a face and a name. */
export function CityCompanion({tripId,complete}:{tripId:string;complete:boolean}){
  const friend=COMPANIONS[tripId];
  if(!friend) return null;
  return <section className="country-companion"><Portrait slug={tripId} index={friend.portrait} name={friend.name}/><div><small>{d(c.friend)}</small><h3>{friend.name}</h3><p>{d(complete?friend.farewell:friend.hello)}</p><details><summary>{d(c.ask)}</summary><p>{d(friend.tip)}</p></details></div></section>;
}
export function CountryMusic({country}:{country:CountryCode}){
  const player=useRef<CountryPlayer|null>(null);
  const [enabled,setEnabled]=useState(false),[error,setError]=useState(false);
  const [volume,setVolume]=useState(()=>{try{const raw=localStorage.getItem('carnet-music-volume');const n=raw===null?.45:Number(raw);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):.45;}catch{return .45;}});
  const volumeRef=useRef(volume);
  useEffect(()=>{return ()=>{player.current?.dispose();player.current=null;};},[]);
  useEffect(()=>{if(!enabled)return;let cancelled=false;void player.current?.play(country,volumeRef.current).then(ok=>{if(!cancelled&&!ok){setError(true);setEnabled(false);}});return ()=>{cancelled=true;player.current?.stop();};},[country,enabled]);
  function toggle(){setError(false);if(enabled){player.current?.stop();setEnabled(false);return;}player.current??=new CountryPlayer();setEnabled(true);}
  function changeVolume(n:number){setVolume(n);volumeRef.current=n;player.current?.setVolume(n);try{localStorage.setItem('carnet-music-volume',String(n));}catch{/* Audio still works without storage. */}}
  return <section className="country-music"><button aria-pressed={enabled} onClick={toggle}>{d(enabled?c.musicOff:c.musicOn)}</button><div><b>♫ {d(COUNTRIES[country].music)}</b><small>{d(c.musicNote)}</small></div><label>{d(c.volume)}<input type="range" min="0" max="1" step=".05" value={volume} onChange={e=>changeVolume(Number(e.target.value))}/></label>{error&&<p role="status">{d(c.musicError)}</p>}</section>;
}
