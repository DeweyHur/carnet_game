// 지도와 같은 GL 문맥·깊이 버퍼에 사람을 그린다. 건물 뒤로 돌아가면 건물에 가려진다.
import * as THREE from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';
import type { LngLat } from '../graph';
import type { Figure } from './figure';

export interface Anchor { at: LngLat; z: number; visible: boolean }

export function figureLayer(fig: Figure, anchor: () => Anchor, onScreen: (x: number, y: number, ok: boolean) => void): CustomLayerInterface {
  let renderer: THREE.WebGLRenderer;
  let map: MlMap;
  const cam = new THREE.Camera();
  const main = new THREE.Matrix4();
  const model = new THREE.Matrix4();
  const v = new THREE.Vector4();
  return {
    id: 'hero',
    type: 'custom',
    renderingMode: '3d',
    onAdd(m, gl) {
      map = m;
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    },
    render(_gl, args: CustomRenderMethodInput) {
      const a = anchor();
      if (!a.visible) { onScreen(0, 0, false); return; }
      const mc = MercatorCoordinate.fromLngLat(a.at, a.z);
      const s = mc.meterInMercatorCoordinateUnits();
      // 메르카토르는 y가 남쪽이라 여기서 뒤집는다(삼각형 감김 방향도 이 한 번의 뒤집기로 맞는다)
      model.makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s));
      main.fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
      cam.projectionMatrix.multiplyMatrices(main, model);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      renderer.resetState();
      renderer.render(fig.scene, cam);
      // 기력 바퀴를 머리 옆에 띄우려고 머리 높이의 화면 좌표를 알려 준다
      v.set(0, 0, 1.5, 1).applyMatrix4(cam.projectionMatrix);
      const c = map.getCanvas();
      if (v.w > 0) onScreen(((v.x / v.w + 1) / 2) * c.clientWidth, ((1 - v.y / v.w) / 2) * c.clientHeight, true);
      else onScreen(0, 0, false);
    },
  };
}
