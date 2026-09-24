// 지도 캔버스 하나에 three.js 렌더러 하나. 여러 커스텀 레이어(거리·사람들·여행자)가 같이 쓴다.
import * as THREE from 'three';

const byCanvas = new WeakMap<HTMLCanvasElement, THREE.WebGLRenderer>();

export function sharedRenderer(canvas: HTMLCanvasElement, gl: WebGLRenderingContext | WebGL2RenderingContext): THREE.WebGLRenderer {
  let r = byCanvas.get(canvas);
  if (!r) {
    r = new THREE.WebGLRenderer({ canvas, context: gl as WebGL2RenderingContext, antialias: true });
    r.autoClear = false;
    r.outputColorSpace = THREE.SRGBColorSpace;
    byCanvas.set(canvas, r);
  }
  return r;
}
