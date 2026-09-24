// 장소·역·숙소 핀. 지도 보기에서는 지도 엔진의 마커로, 걷는 동안에는 three.js 화면 위에 직접 띄운다.
// 같은 DOM 요소를 두 곳 사이에서 옮겨 다닌다(클래스·이벤트가 그대로 유지된다).
import * as maplibregl from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import type { LngLat } from './graph';

type Anchor = 'bottom' | 'left' | 'center';
const SHIFT: Record<Anchor, string> = { bottom: 'translate(-50%, -100%)', left: 'translate(0, -50%)', center: 'translate(-50%, -50%)' };

export class Pin {
  readonly marker: maplibregl.Marker;
  pos: LngLat;
  private readonly set: Pins;
  readonly anchor: Anchor;
  alive = true;
  constructor(set: Pins, el: HTMLElement, pos: LngLat, anchor: Anchor) {
    this.set = set; this.pos = pos; this.anchor = anchor;
    this.marker = new maplibregl.Marker({ element: el, anchor });
    this.marker.setLngLat(pos);
  }
  getElement() { return this.marker.getElement(); }
  setLngLat(p: LngLat) { this.pos = p; this.marker.setLngLat(p); return this; }
  remove() { this.alive = false; this.marker.remove(); this.getElement().remove(); this.set.forget(this); }
}

export class Pins {
  private readonly all = new Set<Pin>();
  private walk = true;
  private readonly map: MlMap;
  private readonly layer: HTMLElement;
  private readonly tmp = { x: 0, y: 0 };

  constructor(map: MlMap, layer: HTMLElement) { this.map = map; this.layer = layer; }

  add(el: HTMLElement, pos: LngLat, anchor: Anchor = 'center'): Pin {
    const p = new Pin(this, el, pos, anchor);
    this.all.add(p);
    this.place(p);
    return p;
  }
  forget(p: Pin) { this.all.delete(p); }

  /** 걷기(three.js 위) ↔ 지도 보기(지도 엔진 마커) */
  setWalk(on: boolean) {
    if (this.walk === on) return;
    this.walk = on;
    for (const p of this.all) this.place(p);
  }

  private place(p: Pin) {
    const el = p.getElement();
    if (this.walk) {
      p.marker.remove();
      this.layer.appendChild(el);
      el.style.visibility = 'hidden';
    } else {
      el.style.visibility = '';
      el.style.opacity = '';
      p.marker.addTo(this.map);
    }
  }

  /** 걷는 동안 매 프레임: 경위도 → 화면. 뒤에 있거나 너무 멀면 숨긴다. */
  update(toLocal: (p: LngLat) => [number, number], ground: (x: number, y: number) => number, eye: [number, number], project: (x: number, y: number, z: number, out: { x: number; y: number }) => boolean) {
    if (!this.walk) return;
    for (const p of this.all) {
      const el = p.getElement();
      const [x, y] = toLocal(p.pos);
      const d = Math.hypot(x - eye[0], y - eye[1]);
      const ok = d < 1800 && project(x, y, ground(x, y) + 0.3, this.tmp);
      if (!ok) { if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'; continue; }
      el.style.visibility = '';
      // 멀수록 조금 작고 옅게
      const k = Math.max(0.6, Math.min(1, 1.15 - d / 1400));
      el.style.transform = `translate(${this.tmp.x.toFixed(1)}px, ${this.tmp.y.toFixed(1)}px) ${SHIFT[p.anchor]} scale(${k.toFixed(2)})`;
      el.style.opacity = d > 1200 ? String(Math.max(0, (1800 - d) / 600).toFixed(2)) : '';
    }
  }
}
