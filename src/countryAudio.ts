import type { CountryCode } from './data/railEurope';
// Original compositions: distinct melodies, metres and timbres, not recorded folk songs.
export const COUNTRY_SCORES:Record<CountryCode,{bpm:number;beats:number;root:number;wave:OscillatorType;notes:number[];chords:number[]}>={
  FR:{bpm:92,beats:3,root:60,wave:'triangle',notes:[4,7,12,11,7,4,2,5,9,7,5,2,0,4,7,9,7,4,2,0,4,7,2,0],chords:[0,5,7,0]},
  CZ:{bpm:108,beats:2,root:62,wave:'triangle',notes:[0,4,7,4,2,5,9,5,4,7,12,7,2,4,2,0],chords:[0,5,7,0]},
  AT:{bpm:84,beats:3,root:65,wave:'sine',notes:[7,12,16,14,12,7,5,9,12,14,9,5,4,7,12,11,7,4,2,7,11,12,7,0],chords:[0,5,7,0]},
  SK:{bpm:78,beats:4,root:62,wave:'sine',notes:[0,2,4,7,9,7,4,2,4,7,9,12,9,7,4,0],chords:[0,5,0,7]},
  HU:{bpm:96,beats:4,root:57,wave:'triangle',notes:[0,2,3,7,8,7,3,2,0,3,7,11,12,8,7,3],chords:[0,5,7,0]},
  PL:{bpm:82,beats:3,root:62,wave:'sine',notes:[0,7,3,2,5,8,7,3,0,2,7,11,12,7,3,5,8,12,11,7,2,3,2,0],chords:[0,5,7,0]},
  SI:{bpm:100,beats:3,root:67,wave:'triangle',notes:[0,4,7,9,7,4,2,5,9,12,9,5,4,7,12,9,7,4,2,5,7,4,2,0],chords:[0,5,7,0]},
  RO:{bpm:90,beats:4,root:64,wave:'sine',notes:[0,2,3,6,7,9,7,6,3,2,0,3,6,7,3,0],chords:[0,5,7,0]},
  HR:{bpm:95,beats:3,root:64,wave:'triangle',notes:[0,4,7,9,7,4,2,0,4,7,11,12,9,7,4,2,0,4,7,4,2,0],chords:[0,5,7,0]},
  RS:{bpm:100,beats:4,root:60,wave:'sine',notes:[0,3,5,7,10,7,5,3,0,3,7,10,12,10,7,3],chords:[0,5,7,0]},
  BG:{bpm:88,beats:4,root:62,wave:'triangle',notes:[0,2,4,6,7,9,7,6,4,2,0,2,7,9,7,4],chords:[0,5,7,0]},
  LT:{bpm:80,beats:3,root:69,wave:'sine',notes:[0,2,4,7,9,7,4,2,0,4,7,11,9,7,4,2],chords:[0,5,7,0]},
  LV:{bpm:86,beats:4,root:67,wave:'triangle',notes:[0,4,7,4,2,0,4,7,9,7,4,2,0,4,2,0],chords:[0,5,0,7]},
};
export class CountryPlayer {
  private ctx:AudioContext|null=null;
  private master:GainNode|null=null;
  private timer:ReturnType<typeof setInterval>|null=null;
  private voices=new Set<OscillatorNode>();
  private epoch=0;
  private disposed=false;
  setVolume(volume:number){if(this.ctx&&this.master)this.master.gain.setTargetAtTime(Math.max(0,Math.min(1,volume))*.28,this.ctx.currentTime,.08);}
  async play(country:CountryCode,volume:number):Promise<boolean>{
    this.stop();const epoch=this.epoch;
    if(this.disposed) return false;
    try {
      if(!this.ctx){const C=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!C)return false;this.ctx=new C();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);}
      if(this.ctx.state==='suspended')await this.ctx.resume();
      if(epoch!==this.epoch||this.disposed||this.ctx.state!=='running')return false;
      this.setVolume(volume);
      const score=COUNTRY_SCORES[country], beat=60/score.bpm;
      let index=0,at=this.ctx.currentTime+.04;
      const tick=()=>{
        const ctx=this.ctx;if(!ctx||epoch!==this.epoch)return;
        // Background tabs may throttle timers: skip stale notes instead of bursting.
        if(at<ctx.currentTime-.2)at=ctx.currentTime+.04;
        while(at<ctx.currentTime+.4){
          const note=score.root+score.notes[index%score.notes.length];
          this.note(note,at,beat*.8,score.wave,.12);
          if(country==='FR')this.note(note,at,beat*.75,'sine',.025,5);
          if(index%2===0){const bar=Math.floor(index/(score.beats*2));const bass=score.root-24+score.chords[bar%score.chords.length];this.note(bass+(index%(score.beats*2)===0?0:7),at,beat*.8,'triangle',.075);}
          index++;at+=beat/2;
        }
      };
      tick();this.timer=setInterval(tick,120);return true;
    }catch{this.stop();return false;}
  }
  private note(midi:number,at:number,duration:number,wave:OscillatorType,volume:number,detune=0){
    const ctx=this.ctx,master=this.master;if(!ctx||!master)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=wave;osc.frequency.value=440*2**((midi-69)/12);osc.detune.value=detune;
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.03);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(gain);gain.connect(master);this.voices.add(osc);
    osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices.delete(osc);};osc.start(at);osc.stop(at+duration+.03);
  }
  stop(){this.epoch++;if(this.timer!==null){clearInterval(this.timer);this.timer=null;}for(const voice of this.voices){try{voice.stop();}catch{/* already ended */}}this.voices.clear();}
  dispose(){this.stop();this.disposed=true;if(this.ctx){void this.ctx.close().catch(()=>{});this.ctx=null;}this.master=null;}
}
