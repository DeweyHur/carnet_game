// 여행자 한 사람. 모델 파일 없이 도형으로 빚고, 툰 셰이딩 + 외곽선으로 그린다.
// 관절 각도를 매 프레임 계산해 걷기·달리기·점프·활공·벽타기·헤엄을 보여 준다.
import * as THREE from 'three';
import type { Body } from './body';
import { DEFAULT_LOADOUT, type Loadout } from '../gear';

const TAU = Math.PI * 2;

function toonRamp(): THREE.DataTexture {
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** 외곽선: 법선 방향으로 조금 부풀린 뒷면을 검게 칠한다 */
function outlineMat(width: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: 0x1d1a17, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`);
  };
  return m;
}

type Pose = {
  bob: number; pitch: number; lean: number; twist: number; side: number; headX: number; headY: number;
  sLx: number; sLy: number; sRx: number; sRy: number; eL: number; eR: number;
  tL: number; tR: number; kL: number; kR: number; scarf: number;
};
const ZERO: Pose = { bob: 0, pitch: 0, lean: 0, twist: 0, side: 0, headX: 0, headY: 0, sLx: 0, sLy: 0, sRx: 0, sRy: 0, eL: 0, eR: 0, tL: 0, tR: 0, kL: 0, kR: 0, scarf: 0 };
type Item = 'camera' | 'crepe' | 'coffee' | 'balloon' | 'flowers' | 'book' | 'coin' | 'umbrella';

export type HairStyle = 'short' | 'bob' | 'ponytail' | 'bun' | 'long';
export type Extra = '' | 'mustache' | 'glasses' | 'beard';
export interface Look { skin: number; hair: number; style: HairStyle; eyes: number; height: number; accent: number; extra: Extra }
export const DEFAULT_LOOK: Look = { skin: 0xf2c9a0, hair: 0x3b2a1e, style: 'short', eyes: 0x2d2016, height: 1, accent: 0xe0493a, extra: '' };

export class Figure {
  readonly scene = new THREE.Scene();
  private readonly flip = new THREE.Group(); // 이 세계(x 동·y 북·z 위). 메르카토르로의 뒤집기는 레이어의 행렬이 한다.
  private readonly root = new THREE.Group();
  private readonly tilt = new THREE.Group();
  private readonly spine = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly sL = new THREE.Group(); private readonly sR = new THREE.Group();
  private readonly eL = new THREE.Group(); private readonly eR = new THREE.Group();
  private readonly tL = new THREE.Group(); private readonly tR = new THREE.Group();
  private readonly kL = new THREE.Group(); private readonly kR = new THREE.Group();
  private readonly scarf = new THREE.Group();
  private readonly handR = new THREE.Group();
  private readonly items = new Map<Item, THREE.Object3D>();
  /** 무기 모양들(옷장의 무기 칸) */
  private readonly weapons = new Map<string, THREE.Object3D>();
  private readonly baguette = new THREE.Group();
  private readonly glider = new THREE.Group();
  private readonly wings: THREE.Mesh[] = [];
  private landT = 0;
  private airT = 0;
  private lastFacing = 0;
  private turnRate = 0;
  private spinAcc = 0;
  private readonly shadow: THREE.Mesh;
  private readonly ripple: THREE.Mesh;
  private readonly surface: THREE.Mesh; // 헤엄칠 때 물속 몸을 가리는 수면(지도의 물은 평면이라 깊이를 쓰지 않는다)
  private readonly beacon: THREE.Group;
  private readonly legs: THREE.Object3D[] = [];
  private readonly ramp = toonRamp();
  private readonly outline = outlineMat(0.012);
  private pose: Pose = { ...ZERO };
  private sun!: THREE.DirectionalLight;
  private sky!: THREE.HemisphereLight;

  /** 하루의 빛: 햇빛 색·세기와 하늘빛 */
  light(sunColor: string, sunI: number, skyColor: string, skyI: number) {
    this.sun.color.set(sunColor);
    this.baseSun = sunI;
    this.sun.intensity = sunI * this.shade;
    this.sky.color.set(skyColor);
    this.sky.intensity = skyI;
  }
  private t = 0;
  private baseSun = 1;
  private shade = 1;
  /** 그늘에 들어가면(0.35) 햇빛을 줄인다 — 부드럽게 */
  setShade(k: number) { this.shade += (k - this.shade) * 0.35; this.sun.intensity = this.baseSun * this.shade; }

  constructor() {
    this.scene.add(this.flip);
    this.flip.add(this.root);
    const sun = (this.sun = new THREE.DirectionalLight(0xfff4e0, 2.3));
    sun.position.set(-0.6, 0.9, 1.4);
    const sky = (this.sky = new THREE.HemisphereLight(0xcfe3ff, 0x8a7a66, 1.35));
    sky.position.set(0, 0, 1);
    this.flip.add(sun, sun.target, sky);
    this.build();

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.flip.add(this.shadow);
    this.ripple = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    this.ripple.visible = false;
    this.flip.add(this.ripple);
    const fade = document.createElement('canvas');
    fade.width = fade.height = 64;
    const g2 = fade.getContext('2d')!;
    const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.6, '#fff');
    grad.addColorStop(1, '#fff0');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);
    this.surface = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshBasicMaterial({ color: 0x9ebdff, alphaMap: new THREE.CanvasTexture(fade), transparent: true }));
    this.surface.visible = false;
    this.flip.add(this.surface);

    this.beacon = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 90, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, 45),
      new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 90, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 45),
      new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.beacon.add(beam, core);
    this.beacon.visible = false;
    this.flip.add(this.beacon);
    // 상승: 몸을 감싸는 옥빛 기운 + 위로 흐르는 빛줄기
    const auraMat = new THREE.MeshBasicMaterial({ color: 0x7fffd4, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.aura.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 2.3, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, 1.0), auraMat));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1.6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8fff2, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      s.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0);
      s.userData.ph = Math.random() * 3;
      this.aura.add(s);
    }
    this.aura.visible = false;
    this.flip.add(this.aura);
  }
  private readonly aura = new THREE.Group();

  private mat(color: number) { return new THREE.MeshToonMaterial({ color, gradientMap: this.ramp }); }

  private part(geo: THREE.BufferGeometry, color: number, parent: THREE.Object3D, x = 0, y = 0, z = 0, lined = true): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.mat(color));
    m.position.set(x, y, z);
    parent.add(m);
    if (lined) m.add(new THREE.Mesh(geo, this.outline));
    return m;
  }

  /** 세로(z축)로 선 캡슐, 윗끝이 원점(관절)에 오게 */
  /** 팔다리: 위가 굵고 아래로 가늘어지며(종아리·팔뚝은 살짝 부푼다) 두 끝이 둥근 선반 모양 — 통 모양 로봇 팔다리가 아니게 */
  private limb(r: number, len: number, bottom = 0.78, bulge = 0.08) {
    const pts: THREE.Vector2[] = [];
    const cap = 6;
    for (let i = 0; i <= cap; i++) { const a = (i / cap) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * r * 0.8)); }
    const N = 10;
    for (let i = 1; i < N; i++) {
      const t = i / N;
      const rr = r * (1 + (bottom - 1) * t) * (1 + bulge * Math.sin(Math.min(1, t / 0.7) * Math.PI));
      pts.push(new THREE.Vector2(rr, -len * t));
    }
    const rb = r * bottom;
    for (let i = 0; i <= cap; i++) { const a = (i / cap) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * rb, -len - Math.sin(a) * rb * 0.8)); }
    return new THREE.LatheGeometry(pts.reverse(), 14).rotateX(Math.PI / 2); // 아래→위 순서여야 겉면이 바깥을 본다
  }
  /** 몸통: 엉덩이 → 잘록한 허리 → 가슴 → 어깨 → 목으로 이어지는 매끈한 선 */
  private torso() {
    const prof: [number, number][] = [[0.0, -0.02], [0.13, -0.01], [0.155, 0.04], [0.14, 0.1], [0.125, 0.15], [0.14, 0.22], [0.165, 0.3], [0.17, 0.36], [0.155, 0.42], [0.11, 0.47], [0.06, 0.5], [0.0, 0.51]];
    return new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 20).rotateX(Math.PI / 2);
  }
  /** 얼굴(그린 눈 · 눈썹 · 볼 · 입): 캔버스에 그려 머리 앞쪽에 입힌다 — 뜬 눈 / 감은 눈 둘 */
  private faceTex: [THREE.CanvasTexture, THREE.CanvasTexture] | null = null;
  private faceM: THREE.MeshToonMaterial | null = null;
  private blinkT = 2.5;
  private drawFace(eyes: number, hair: number, closed: boolean) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
    const mix = (n: number, k: number) => { const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255; const f = (v: number) => Math.round(v + (255 - v) * k); return `rgb(${f(r)},${f(gg)},${f(b)})`; };
    // 볼
    for (const sx of [-1, 1]) { const gr = g.createRadialGradient(128 + sx * 68, 172, 2, 128 + sx * 68, 172, 22); gr.addColorStop(0, 'rgba(240,120,110,0.55)'); gr.addColorStop(1, 'rgba(240,120,110,0)'); g.fillStyle = gr; g.fillRect(128 + sx * 68 - 24, 148, 48, 48); }
    for (const sx of [-1, 1]) {
      const cx = 128 + sx * 42, cy = 132;
      g.save(); g.translate(cx, cy); g.scale(1.3, 1.3); g.translate(-cx, -cy);
      if (closed) {
        g.strokeStyle = '#2a1c16'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx - 17, cy + 2); g.quadraticCurveTo(cx, cy + 12, cx + 17, cy + 2); g.stroke();
      } else {
        // 흰자
        g.fillStyle = '#fbf7f2'; g.beginPath(); g.ellipse(cx, cy + 2, 17, 22, 0, 0, Math.PI * 2); g.fill();
        // 홍채(위가 짙고 아래가 밝다)
        const ir = g.createLinearGradient(cx, cy - 18, cx, cy + 22); ir.addColorStop(0, `rgb(${((eyes >> 16) & 255) * 0.45 | 0},${((eyes >> 8) & 255) * 0.45 | 0},${(eyes & 255) * 0.45 | 0})`); ir.addColorStop(0.55, hex(eyes)); ir.addColorStop(1, mix(eyes, 0.55));
        g.fillStyle = ir; g.beginPath(); g.ellipse(cx + sx * 1, cy + 4, 13, 18, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#140d0a'; g.beginPath(); g.ellipse(cx + sx * 1, cy + 5, 6, 9, 0, 0, Math.PI * 2); g.fill();
        // 반짝임
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx - 5, cy - 5, 5, 6.5, -0.3, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(cx + 6, cy + 12, 2.6, 0, Math.PI * 2); g.fill();
        // 윗속눈썹(두껍게, 끝이 올라간다) · 아랫속눈썹
        g.strokeStyle = '#1e1411'; g.lineCap = 'round'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(cx - sx * 18, cy - 9); g.quadraticCurveTo(cx, cy - 27, cx + sx * 19, cy - 9); g.quadraticCurveTo(cx + sx * 22, cy - 7, cx + sx * 24, cy - 3); g.stroke(); // 둥근 윗속눈썹 · 바깥 끝이 살짝 내려간다(순한 눈)
        g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx - 10, cy + 25); g.quadraticCurveTo(cx, cy + 27, cx + 11, cy + 23); g.stroke();
      }
      g.restore();
      // 눈썹
      g.strokeStyle = hex(hair); g.lineWidth = 5; g.lineCap = 'round';
      g.lineWidth = 4; g.beginPath(); g.moveTo(cx - sx * 15, cy - 44); g.quadraticCurveTo(cx, cy - 52, cx + sx * 17, cy - 45); g.stroke();
    }
    // 코(작은 그림자) · 입
    g.fillStyle = 'rgba(190,110,90,0.5)'; g.beginPath(); g.ellipse(128, 166, 3, 2, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a3a2a'; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(119, 184); g.quadraticCurveTo(128, 192, 138, 183); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /** 바꿔 칠할 수 있는 재질을 나눠 쓰는 조각(옷 색) */
  private partM(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, lined = true): THREE.Mesh {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    parent.add(o);
    if (lined) o.add(new THREE.Mesh(geo, this.outline));
    return o;
  }
  private group(parent: THREE.Object3D, set: Map<string, THREE.Object3D>, id: string) {
    const g = new THREE.Group();
    parent.add(g);
    set.set(id, g);
    return g;
  }

  // 옷(장비) — 칸마다 갈아 끼우는 조각들
  // 생김새(캐릭터 · 캐릭터 만들기) — 바꿔 칠할 수 있게 재질을 나눠 쓴다
  private readonly skinM = this.mat(DEFAULT_LOOK.skin);
  private readonly hairM = this.mat(DEFAULT_LOOK.hair);
  private readonly eyeM = this.mat(DEFAULT_LOOK.eyes);
  private readonly scarfM = this.mat(DEFAULT_LOOK.accent);
  private readonly styles = new Map<string, THREE.Object3D>();
  private readonly extras = new Map<string, THREE.Object3D>();
  private readonly topM = this.mat(0x2f6db5);
  private readonly topDM = this.mat(0x24558f);
  private readonly pantsM = this.mat(0xe9dcc0);
  private readonly hats = new Map<string, THREE.Object3D>();
  private readonly tops = new Map<string, THREE.Object3D>();
  private readonly packs = new Map<string, THREE.Object3D>();
  private readonly shoes: Map<string, THREE.Object3D>[] = [new Map(), new Map()];
  private readonly skirts = new Map<string, THREE.Object3D>();
  private stripes: THREE.CanvasTexture | null = null;
  private quiff!: THREE.Object3D;
  private gliderId = 'tricolore';
  private wingsAs = '';
  private gear: Loadout = { ...DEFAULT_LOADOUT };
  /** 지금 캐릭터(싸움 모양 · 무기) */
  style = 'traveler';
  private charWeapon: string | null = null;

  private build() {
    const INK = 0x1d1a17;
    this.root.add(this.tilt);
    this.tilt.position.z = 0.92;
    // 골반·허리띠
    this.partM(new THREE.SphereGeometry(0.15, 18, 12), this.pantsM, this.tilt, 0, 0, -0.02).scale.set(1.05, 0.72, 0.62); // 골반(둥글게)
    // 옷자락: 재킷(짧게)·트렌치(무릎까지)
    const skirt = (id: string, len: number, flare: number) => {
      const g = this.group(this.tilt, this.skirts, id);
      this.partM(new THREE.CylinderGeometry(0.19, flare, len, 16, 1, true).rotateX(Math.PI / 2), this.topDM, g, 0, 0, 0.07 - len / 2);
    };
    skirt('short', 0.3, 0.245);
    skirt('long', 0.62, 0.3);
    this.topDM.side = THREE.DoubleSide;
    // 몸통: 어깨가 넓고 허리가 잘록하게
    this.tilt.add(this.spine);
    this.partM(this.torso(), this.topM, this.spine, 0, 0, 0.02).scale.set(1.08, 0.78, 1);
    for (const sx of [-1, 1]) this.partM(new THREE.SphereGeometry(0.075, 14, 10), this.topM, this.spine, sx * 0.2, -0.005, 0.42).scale.set(1, 0.95, 0.85); // 둥근 어깨
    this.partM(new THREE.CylinderGeometry(0.045, 0.055, 0.12, 12).rotateX(Math.PI / 2), this.skinM, this.spine, 0, 0, 0.53, false); // 목(가늘게)

    // 윗옷마다 붙는 것
    const jacket = this.group(this.spine, this.tops, 'jacket');
    for (const sx of [-1, 1]) this.part(new THREE.BoxGeometry(0.09, 0.02, 0.2).rotateY(sx * 0.42), 0x1f4b80, jacket, sx * 0.055, 0.132, 0.37, false); // 옷깃
    for (const z of [0.3, 0.2, 0.1]) this.part(new THREE.SphereGeometry(0.014, 8, 6), 0xe0b64a, jacket, 0, 0.14, z, false); // 금단추
    this.part(new THREE.BoxGeometry(0.05, 0.015, 0.035), 0xf3e7c9, jacket, -0.1, 0.135, 0.33, false); // 행커치프
    const trench = this.group(this.spine, this.tops, 'trench');
    for (const sx of [-1, 1]) {
      this.part(new THREE.BoxGeometry(0.13, 0.025, 0.18).rotateY(sx * 0.5), 0xa88a5a, trench, sx * 0.07, 0.13, 0.4, false); // 큰 칼라
      this.part(new THREE.BoxGeometry(0.1, 0.05, 0.02), 0xa88a5a, trench, sx * 0.19, 0, 0.5, false); // 견장
      for (const z of [0.28, 0.16]) this.part(new THREE.SphereGeometry(0.013, 8, 6), 0x3b2a1e, trench, sx * 0.06, 0.138, z, false); // 두 줄 단추
    }
    this.part(new THREE.CylinderGeometry(0.175, 0.175, 0.045, 18).rotateX(Math.PI / 2), 0x7a5a36, trench, 0, 0, 0.02).scale.set(1.12, 0.86, 1); // 허리띠
    this.part(new THREE.BoxGeometry(0.06, 0.02, 0.05), 0xd9c28a, trench, 0, 0.15, 0.02, false);
    this.group(this.spine, this.tops, 'mariniere'); // 줄무늬는 재질(텍스처)로
    const nap = this.group(this.spine, this.tops, 'napoleon');
    for (const sx of [-1, 1]) {
      this.part(new THREE.BoxGeometry(0.12, 0.1, 0.03), 0xe0b44a, nap, sx * 0.2, 0, 0.5); // 금 견장
      for (let k = 0; k < 5; k++) this.part(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 4).rotateX(Math.PI / 2), 0xe0b44a, nap, sx * (0.16 + (k - 2) * 0.018), 0, 0.46, false);
      for (const z of [0.36, 0.26, 0.16, 0.06]) this.part(new THREE.SphereGeometry(0.014, 8, 6), 0xe0b44a, nap, sx * 0.07, 0.137, z, false);
      this.part(new THREE.BoxGeometry(0.08, 0.02, 0.28).rotateY(sx * 0.3), 0xf2eee4, nap, sx * 0.045, 0.13, 0.3, false); // 흰 조끼 깃
    }
    this.part(new THREE.CylinderGeometry(0.176, 0.176, 0.05, 18).rotateX(Math.PI / 2), 0xb3262c, nap, 0, 0, 0.02).scale.set(1.12, 0.86, 1); // 붉은 띠
    const lea = this.group(this.spine, this.tops, 'leather');
    for (const sx of [-1, 1]) this.part(new THREE.BoxGeometry(0.1, 0.025, 0.14).rotateY(sx * 0.35).rotateX(-0.3), 0x121212, lea, sx * 0.08, 0.12, 0.45, false); // 선 칼라
    this.part(new THREE.BoxGeometry(0.012, 0.02, 0.4).rotateY(0.12), 0xc9ccd0, lea, 0.02, 0.137, 0.24, false); // 지퍼
    this.part(new THREE.BoxGeometry(0.3, 0.02, 0.012), 0xc9ccd0, lea, 0, 0.135, 0.0, false);

    // 목도리(모두 두른다 — 이 여행자의 표시)
    this.partM(new THREE.TorusGeometry(0.105, 0.05, 8, 16), this.scarfM, this.spine, 0, 0, 0.49);
    this.scarf.position.set(0.06, -0.1, 0.48);
    this.spine.add(this.scarf);
    this.partM(new THREE.BoxGeometry(0.07, 0.03, 0.3).translate(0, 0, -0.15), this.scarfM, this.scarf);
    this.part(new THREE.BoxGeometry(0.075, 0.035, 0.03), 0xf4ead2, this.scarf, 0, 0, -0.29, false); // 술 장식

    // 가방
    const pack = this.group(this.spine, this.packs, 'backpack');
    this.part(new THREE.BoxGeometry(0.28, 0.13, 0.32), 0x8a5a33, pack, 0, -0.2, 0.24);
    this.part(new THREE.BoxGeometry(0.29, 0.14, 0.1), 0x6f4526, pack, 0, -0.205, 0.37, false); // 덮개
    this.part(new THREE.BoxGeometry(0.18, 0.05, 0.12), 0x6f4526, pack, 0, -0.28, 0.18); // 앞주머니
    this.part(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 12).rotateZ(Math.PI / 2), 0x3f7a4a, pack, 0, -0.2, 0.45); // 돌돌 만 매트
    for (const sx of [-1, 1]) this.part(new THREE.BoxGeometry(0.035, 0.015, 0.32), 0x5b3a20, pack, sx * 0.1, 0.132, 0.28, false); // 멜빵
    const diag = (g: THREE.Object3D, color: number, dir: number) => {
      this.part(new THREE.BoxGeometry(0.035, 0.015, 0.62).rotateY(dir * 0.72), color, g, 0, 0.135, 0.25, false);
      this.part(new THREE.BoxGeometry(0.035, 0.015, 0.62).rotateY(-dir * 0.72), color, g, 0, -0.135, 0.25, false);
    };
    const camBag = this.group(this.spine, this.packs, 'camera');
    diag(camBag, 0x222222, 1);
    this.part(new THREE.BoxGeometry(0.1, 0.16, 0.13), 0x2a2a2a, camBag, 0.21, -0.02, 0.02);
    this.part(new THREE.BoxGeometry(0.12, 0.06, 0.08), 0x26221e, camBag, 0, 0.17, 0.3); // 가슴에 걸린 사진기
    this.part(new THREE.CylinderGeometry(0.028, 0.03, 0.05, 12), 0x3d3a36, camBag, 0, 0.215, 0.3, false);
    this.part(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12), 0x8fb6d8, camBag, 0, 0.24, 0.3, false);
    const satchel = this.group(this.spine, this.packs, 'satchel');
    diag(satchel, 0x5b3a20, -1);
    this.part(new THREE.BoxGeometry(0.07, 0.3, 0.22), 0x7a4a26, satchel, -0.22, 0, -0.02);
    this.part(new THREE.BoxGeometry(0.075, 0.3, 0.1), 0x5f3718, satchel, -0.22, 0, 0.05, false); // 덮개
    this.part(new THREE.BoxGeometry(0.08, 0.04, 0.03), 0xd9b44a, satchel, -0.22, 0, 0.0, false); // 잠금쇠

    // 머리
    this.head.position.z = 0.55;
    this.head.scale.setScalar(1.2); // 원신처럼 머리를 조금 크게
    this.spine.add(this.head);
    this.partM(new THREE.SphereGeometry(0.145, 22, 16), this.skinM, this.head, 0, 0.005, 0.16).scale.set(1, 0.95, 1.05);
    for (const sx of [-1, 1]) this.partM(new THREE.SphereGeometry(0.034, 10, 8), this.skinM, this.head, sx * 0.142, -0.005, 0.15).scale.set(0.55, 0.9, 1.2); // 귀
    // 머리카락: 뒤통수 + 앞머리 + 구레나룻
    this.partM(new THREE.SphereGeometry(0.153, 20, 14, 0, TAU, 0, Math.PI * 0.6).rotateX(Math.PI / 2), this.hairM, this.head, 0, -0.012, 0.172).rotation.x = 0.55;
    for (const [fx, fz, r] of [[-0.075, 0.245, 0.05], [-0.025, 0.26, 0.055], [0.03, 0.258, 0.052], [0.08, 0.24, 0.045]] as const) {
      const f = this.partM(new THREE.SphereGeometry(r, 10, 8), this.hairM, this.head, fx, 0.095, fz, false);
      f.scale.set(1, 0.7, 0.8);
    }
    for (const sx of [-1, 1]) this.partM(new THREE.BoxGeometry(0.02, 0.05, 0.08), this.hairM, this.head, sx * 0.138, 0.04, 0.15, false);
    // 맨머리일 때만: 바람에 날리는 앞머리 한 줌
    this.quiff = new THREE.Group();
    this.head.add(this.quiff);
    this.partM(new THREE.ConeGeometry(0.06, 0.16, 8).rotateX(-1.1), this.hairM, this.quiff, 0.02, 0.05, 0.3);
    this.partM(new THREE.ConeGeometry(0.05, 0.14, 8).rotateX(-1.6), this.hairM, this.quiff, -0.05, -0.02, 0.31);
    // 머리 모양(짧게는 기본 그대로): 단발 · 포니테일 · 올림머리 · 긴 머리
    const bob = this.group(this.head, this.styles, 'bob');
    for (const sx of [-1, 1]) this.partM(new THREE.CapsuleGeometry(0.06, 0.12, 4, 10).rotateX(Math.PI / 2), this.hairM, bob, sx * 0.125, -0.03, 0.1).scale.set(0.8, 1.2, 1);
    this.partM(new THREE.CapsuleGeometry(0.1, 0.1, 4, 12).rotateX(Math.PI / 2), this.hairM, bob, 0, -0.1, 0.1).scale.set(1.35, 0.7, 1);
    const pony = this.group(this.head, this.styles, 'ponytail');
    this.partM(new THREE.SphereGeometry(0.05, 10, 8), this.hairM, pony, 0, -0.15, 0.2);
    this.partM(new THREE.CapsuleGeometry(0.045, 0.2, 4, 10).rotateX(Math.PI / 2 - 0.35), this.hairM, pony, 0, -0.19, 0.07);
    const bun = this.group(this.head, this.styles, 'bun');
    this.partM(new THREE.SphereGeometry(0.075, 12, 10), this.hairM, bun, 0, -0.09, 0.3);
    const long = this.group(this.head, this.styles, 'long');
    this.partM(new THREE.CapsuleGeometry(0.12, 0.2, 4, 12).rotateX(Math.PI / 2), this.hairM, long, 0, -0.08, 0.02).scale.set(1.2, 0.6, 1);
    for (const sx of [-1, 1]) this.partM(new THREE.CapsuleGeometry(0.045, 0.16, 4, 8).rotateX(Math.PI / 2), this.hairM, long, sx * 0.13, 0, 0.05);
    this.group(this.head, this.styles, 'short');
    // 덧붙이는 것: 콧수염 · 둥근 안경 · 턱수염
    const mus = this.group(this.head, this.extras, 'mustache');
    for (const sx of [-1, 1]) this.partM(new THREE.CapsuleGeometry(0.014, 0.04, 3, 6).rotateY(Math.PI / 2 + sx * 0.3), this.hairM, mus, sx * 0.025, 0.145, 0.122, false);
    const gl = this.group(this.head, this.extras, 'glasses');
    for (const sx of [-1, 1]) this.part(new THREE.TorusGeometry(0.03, 0.006, 5, 14).rotateX(Math.PI / 2), 0x2a2a2a, gl, sx * 0.052, 0.155, 0.172, false);
    this.part(new THREE.BoxGeometry(0.03, 0.006, 0.006), 0x2a2a2a, gl, 0, 0.158, 0.178, false);
    const beard = this.group(this.head, this.extras, 'beard');
    this.partM(new THREE.SphereGeometry(0.09, 12, 10), this.hairM, beard, 0, 0.09, 0.07).scale.set(1.05, 0.7, 0.8);
    // 얼굴: 그린 얼굴(눈 · 눈썹 · 볼 · 입)을 머리 앞쪽 둥근 조각에 입힌다
    {
      const geo = new THREE.SphereGeometry(0.1462, 36, 18, 0, TAU, 0, 1.15);
      const pos = geo.attributes.position as THREE.BufferAttribute, uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / 0.29, 0.5 + pos.getZ(i) / 0.29);
      this.faceTex = [this.drawFace(DEFAULT_LOOK.eyes, DEFAULT_LOOK.hair, false), this.drawFace(DEFAULT_LOOK.eyes, DEFAULT_LOOK.hair, true)];
      this.faceM = new THREE.MeshToonMaterial({ map: this.faceTex[0], transparent: true, gradientMap: this.ramp, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const face = new THREE.Mesh(geo, this.faceM);
      face.position.set(0, 0.005, 0.16);
      face.scale.set(1, 0.95, 1.05);
      face.renderOrder = 1;
      this.head.add(face);
    }
    // 앞머리 가닥(이마를 덮고 옆으로 쓸린다) · 옆머리 · 정수리의 삐침
    for (let i = 0; i < 9; i++) {
      const u = (i - 4) / 4; // -1..1
      const strand = this.partM(new THREE.ConeGeometry(0.036 - Math.abs(u) * 0.006, 0.15 + (1 - Math.abs(u)) * 0.03, 6).rotateX(Math.PI), this.hairM, this.head, u * 0.105, 0.11 + (1 - Math.abs(u)) * 0.02, 0.245 - Math.abs(u) * 0.03, false);
      strand.rotation.set(-0.35 - Math.abs(u) * 0.2, u * 0.5 + 0.18, 0);
      strand.scale.set(1, 0.55, 1);
    }
    for (const sx of [-1, 1]) {
      const side = this.partM(new THREE.ConeGeometry(0.04, 0.2, 6).rotateX(Math.PI), this.hairM, this.head, sx * 0.14, 0.05, 0.12, false);
      side.rotation.set(-0.1, sx * 0.25, 0); side.scale.set(0.8, 0.7, 1);
    }
    for (const [x, y, z, rx, ry] of [[0.02, -0.06, 0.31, -0.9, 0.3], [-0.05, -0.1, 0.29, -1.3, -0.4], [0.07, -0.12, 0.27, -1.5, 0.6]] as const) {
      const spk = this.partM(new THREE.ConeGeometry(0.04, 0.12, 6), this.hairM, this.head, x, y, z, false);
      spk.rotation.set(rx, ry, 0);
    }

    // 모자
    const beret = this.group(this.head, this.hats, 'beret');
    this.part(new THREE.CylinderGeometry(0.15, 0.165, 0.05, 22).rotateX(Math.PI / 2), 0xb8322f, beret, 0.03, -0.01, 0.3).rotation.y = 0.28;
    this.part(new THREE.SphereGeometry(0.018, 6, 6), 0x3a2a20, beret, 0.03, -0.01, 0.335, false);
    const panama = this.group(this.head, this.hats, 'panama');
    this.part(new THREE.CylinderGeometry(0.27, 0.27, 0.014, 30).rotateX(Math.PI / 2), 0xeadcb4, panama, 0, -0.005, 0.27).rotation.x = -0.08;
    this.part(new THREE.CylinderGeometry(0.13, 0.155, 0.12, 22).rotateX(Math.PI / 2), 0xeadcb4, panama, 0, -0.005, 0.33);
    this.part(new THREE.CylinderGeometry(0.157, 0.157, 0.032, 22).rotateX(Math.PI / 2), 0x2b2b2b, panama, 0, -0.005, 0.293, false);
    const av = this.group(this.head, this.hats, 'aviator');
    this.part(new THREE.SphereGeometry(0.158, 20, 14, 0, TAU, 0, Math.PI * 0.55).rotateX(Math.PI / 2), 0x6b4226, av, 0, -0.01, 0.165).rotation.x = 0.35;
    for (const sx of [-1, 1]) {
      this.part(new THREE.BoxGeometry(0.03, 0.08, 0.1), 0x6b4226, av, sx * 0.148, -0.01, 0.1); // 귀덮개
      this.part(new THREE.TorusGeometry(0.036, 0.012, 6, 14).rotateX(Math.PI / 2), 0x9a7a3a, av, sx * 0.05, 0.12, 0.265, false);
      this.partM(new THREE.CircleGeometry(0.034, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fd0e8 }), av, sx * 0.05, 0.128, 0.265, false);
    }
    this.part(new THREE.TorusGeometry(0.152, 0.01, 4, 24).rotateX(0.35), 0x2a2a2a, av, 0, -0.01, 0.26, false);
    const marin = this.group(this.head, this.hats, 'marin');
    this.part(new THREE.CylinderGeometry(0.15, 0.14, 0.09, 22).rotateX(Math.PI / 2), 0xf6f4ee, marin, 0, -0.01, 0.31);
    this.part(new THREE.CylinderGeometry(0.143, 0.143, 0.035, 22).rotateX(Math.PI / 2), 0x1d2c55, marin, 0, -0.01, 0.275, false);
    this.part(new THREE.SphereGeometry(0.035, 10, 8), 0xd6303a, marin, 0, -0.01, 0.37); // 빨간 방울(프랑스 수병)
    const top = this.group(this.head, this.hats, 'tophat');
    this.part(new THREE.CylinderGeometry(0.24, 0.24, 0.014, 28).rotateX(Math.PI / 2), 0x16161a, top, 0, -0.005, 0.275);
    this.part(new THREE.CylinderGeometry(0.135, 0.14, 0.3, 22).rotateX(Math.PI / 2), 0x16161a, top, 0, -0.005, 0.43);
    this.part(new THREE.CylinderGeometry(0.142, 0.142, 0.045, 22).rotateX(Math.PI / 2), 0xb3262c, top, 0, -0.005, 0.31, false);
    this.group(this.head, this.hats, 'none');

    // 팔: 소매(옷 색) + 커프스 + 손
    for (const [sh, el, sx] of [[this.sL, this.eL, -1], [this.sR, this.eR, 1]] as const) {
      sh.position.set(sx * 0.23, 0, 0.43);
      this.spine.add(sh);
      this.partM(this.limb(0.062, 0.2), this.topM, sh);
      el.position.z = -0.27;
      sh.add(el);
      this.partM(this.limb(0.054, 0.17), this.topM, el);
      this.partM(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12).rotateX(Math.PI / 2), this.topDM, el, 0, 0, -0.22, false);
      this.partM(new THREE.SphereGeometry(0.056, 10, 8), this.skinM, el, 0, 0.005, -0.27);
      this.partM(new THREE.SphereGeometry(0.022, 6, 6), this.skinM, el, sx * -0.03, 0.04, -0.25, false); // 엄지
    }
    // 손에 드는 것들(오른손)
    this.handR.position.z = -0.29;
    this.eR.add(this.handR);
    const item = (name: Item, g: THREE.Object3D) => { g.visible = false; this.handR.add(g); this.items.set(name, g); return g; };
    const cam = item('camera', new THREE.Group());
    this.part(new THREE.BoxGeometry(0.13, 0.07, 0.085), 0x26221e, cam, 0, 0.04, 0.02);
    this.part(new THREE.CylinderGeometry(0.03, 0.034, 0.06, 12), 0x3d3a36, cam, 0, 0.09, 0.02, false);
    this.part(new THREE.BoxGeometry(0.03, 0.02, 0.02), 0xd9d2c4, cam, 0.04, 0.035, 0.07, false);
    const crepe = item('crepe', new THREE.Group());
    this.part(new THREE.ConeGeometry(0.075, 0.22, 10).rotateX(Math.PI), 0xe7b867, crepe, 0, 0.03, 0.08);
    this.part(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 10), 0x5b3219, crepe, 0, 0.03, 0.2, false); // 누텔라
    const coffee = item('coffee', new THREE.Group());
    this.part(new THREE.CylinderGeometry(0.04, 0.032, 0.1, 12).rotateX(Math.PI / 2), 0xf6f1e7, coffee, 0, 0.03, 0.04);
    this.part(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 12).rotateX(Math.PI / 2), 0x7a4a2a, coffee, 0, 0.03, 0.1, false);
    const balloon = item('balloon', new THREE.Group());
    this.part(new THREE.SphereGeometry(0.2, 16, 12), 0xe63a3a, balloon, 0, 0, 1.05).scale.set(1, 1, 1.18);
    balloon.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.82)]), new THREE.LineBasicMaterial({ color: 0xfafafa })));
    const flowers = item('flowers', new THREE.Group());
    this.part(new THREE.ConeGeometry(0.07, 0.3, 8).rotateX(Math.PI), 0xefe6d0, flowers, 0, 0.02, 0.1);
    for (const [fx, fy, c] of [[0.03, 0, 0xe0436c], [-0.03, 0.02, 0xf2c14e], [0, -0.03, 0xb04ad6], [0.01, 0.04, 0xf07f3c]] as const) this.part(new THREE.SphereGeometry(0.04, 8, 6), c, flowers, fx, 0.02 + fy, 0.27, false);
    const book = item('book', new THREE.Group());
    this.part(new THREE.BoxGeometry(0.15, 0.03, 0.2), 0x2f5d8a, book, 0, 0.03, 0.04);
    // 싸움: 무기(칼처럼 쥔다) — 손에서 팔 방향(-z)으로 뻗는다. 옷장에서 고른 것 하나만 보인다
    const wep = item('umbrella', new THREE.Group());
    const along = (r0: number, r1: number, len: number, z0: number, seg = 8) => new THREE.CylinderGeometry(r0, r1, len, seg).rotateX(Math.PI / 2).translate(0, 0, z0 - len / 2);
    const umb = this.group(wep, this.weapons, 'umbrella');
    this.part(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6).rotateX(Math.PI / 2).translate(0, 0, -0.42), 0x2b2b2b, umb, 0, 0.03, 0, false);
    this.part(new THREE.ConeGeometry(0.12, 0.9, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.58), 0xe0393f, umb, 0, 0.03, 0);
    this.part(new THREE.TorusGeometry(0.05, 0.014, 6, 10, Math.PI).rotateY(Math.PI / 2), 0x6b4423, umb, 0, 0.08, 0.06, false); // 손잡이
    this.part(new THREE.SphereGeometry(0.016, 6, 6), 0xd9b44a, umb, 0, 0.03, -0.9, false);
    // 바게트 검: 길쭉한 빵에 칼집(빗금)
    const bag = this.group(wep, this.weapons, 'baguette');
    this.part(new THREE.CapsuleGeometry(0.05, 0.78, 4, 10).rotateX(Math.PI / 2).translate(0, 0, -0.42), 0xd9a55a, bag, 0, 0.03, 0);
    for (let i = 0; i < 4; i++) this.part(new THREE.BoxGeometry(0.07, 0.012, 0.03).rotateY(0.6), 0xa86b2c, bag, 0, 0.078, -0.16 - i * 0.18, false);
    // 지팡이 검: 검은 막대 + 은 손잡이
    const cane = this.group(wep, this.weapons, 'cane');
    this.part(along(0.014, 0.012, 0.95, 0), 0x1b1a1a, cane, 0, 0.03, 0.02, false);
    this.part(new THREE.SphereGeometry(0.035, 10, 8), 0xd8dde3, cane, 0, 0.03, 0.05);
    this.part(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8).rotateX(Math.PI / 2), 0xd9b44a, cane, 0, 0.03, -0.9, false);
    // 뱃사공의 노: 긴 나무 자루 + 넓은 날
    const oar = this.group(wep, this.weapons, 'oar');
    this.part(along(0.02, 0.02, 1.25, 0.1), 0x8a5a2e, oar, 0, 0.03, 0, false);
    this.part(new THREE.BoxGeometry(0.2, 0.03, 0.42).translate(0, 0, -1.3), 0x9a6a38, oar, 0, 0.03, 0);
    this.part(new THREE.BoxGeometry(0.21, 0.032, 0.05).translate(0, 0, -1.05), 0x2f5d8a, oar, 0, 0.03, 0, false); // 파란 띠
    // 삼총사의 레이피어: 가는 은빛 날 + 금빛 잔 손잡이
    const rap = this.group(wep, this.weapons, 'rapier');
    this.part(new THREE.BoxGeometry(0.018, 0.01, 0.95).translate(0, 0, -0.52), 0xe3e7ec, rap, 0, 0.03, 0, false);
    this.part(new THREE.SphereGeometry(0.07, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).translate(0, 0, -0.04), 0xd9b44a, rap, 0, 0.03, 0);
    this.part(along(0.016, 0.016, 0.12, 0.08, 6), 0x5b3a20, rap, 0, 0.03, 0, false);
    // 혁명의 깃발: 긴 깃대 + 삼색기
    const flag = this.group(wep, this.weapons, 'flagpole');
    this.part(along(0.016, 0.016, 1.45, 0.12), 0x6b4423, flag, 0, 0.03, 0, false);
    this.part(new THREE.SphereGeometry(0.03, 8, 6), 0xd9b44a, flag, 0, 0.03, -1.35, false);
    for (const [i, c] of [[0, 0x2f4c9a], [1, 0xf4f1e9], [2, 0xd9363e]] as const) this.part(new THREE.BoxGeometry(0.012, 0.16, 0.36).translate(0, 0.1 + i * 0.16, -1.1), c, flag, 0, 0.03, 0, false);
    // 잔 다르크의 검: 넓은 은빛 날(은은히 빛난다) + 금빛 십자 가드
    const jn = this.group(wep, this.weapons, 'jeanne');
    const bladeM = new THREE.MeshToonMaterial({ color: 0xeef3f8, emissive: 0x3a4a66 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 0.92).translate(0, 0, -0.55), bladeM);
    blade.position.y = 0.03; jn.add(blade); blade.add(new THREE.Mesh(blade.geometry, this.outline));
    this.part(new THREE.BoxGeometry(0.28, 0.035, 0.04).translate(0, 0, -0.06), 0xd9b44a, jn, 0, 0.03, 0);
    this.part(along(0.02, 0.02, 0.14, 0.08, 6), 0x3b2616, jn, 0, 0.03, 0, false);
    this.part(new THREE.SphereGeometry(0.03, 8, 6), 0xd9b44a, jn, 0, 0.03, 0.09, false);
    // 동료들의 무기(캐릭터마다 하나 — 옷장 무기 대신 보인다, 능력은 옷장 무기를 따른다)
    const glow = (color: number, opacity = 0.75) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const whip = this.group(wep, this.weapons, 'c:julie'); // 물채찍: 손잡이 + 물줄기
    this.part(along(0.02, 0.02, 0.16, 0.06, 6), 0x2f5d8a, whip, 0, 0.03, 0, false);
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045 - i * 0.004, 8, 6), glow(0x6fc3ff, 0.8 - i * 0.07)); m.position.set(Math.sin(i * 0.8) * 0.05, 0.03 + i * 0.012, -0.12 - i * 0.16); whip.add(m); }
    const ham = this.group(wep, this.weapons, 'c:gustave'); // 리벳 망치
    this.part(along(0.022, 0.022, 0.8, 0.1), 0x5b3a20, ham, 0, 0.03, 0, false);
    this.part(new THREE.BoxGeometry(0.26, 0.16, 0.16).translate(0, 0, -0.75), 0x8a8f98, ham, 0, 0.03, 0);
    for (const sx of [-1, 1]) this.part(new THREE.SphereGeometry(0.022, 6, 6), 0xd9b44a, ham, sx * 0.1, 0.12, -0.75, false);
    const bay = this.group(wep, this.weapons, 'c:marcel'); // 총검 달린 옛 소총
    this.part(new THREE.BoxGeometry(0.05, 0.07, 0.75).translate(0, 0, -0.25), 0x6b4423, bay, 0, 0.03, 0);
    this.part(along(0.012, 0.012, 0.35, -0.55, 6), 0x3a3a3a, bay, 0, 0.05, 0, false);
    this.part(new THREE.ConeGeometry(0.018, 0.3, 4).rotateX(-Math.PI / 2).translate(0, 0, -1.02), 0xe3e7ec, bay, 0, 0.05, 0, false);
    const frame = this.group(wep, this.weapons, 'c:amelie'); // 금빛 액자
    for (const [w, h, x, z] of [[0.36, 0.04, 0, -0.08], [0.36, 0.04, 0, -0.38], [0.04, 0.3, -0.16, -0.23], [0.04, 0.3, 0.16, -0.23]] as const) this.part(new THREE.BoxGeometry(w, 0.03, h), 0xe6c35a, frame, x, 0.05, z, false);
    this.partM(new THREE.PlaneGeometry(0.28, 0.26).rotateX(Math.PI / 2).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3f6e8f, side: THREE.DoubleSide }), frame, 0, 0.05, -0.23, false);
    const bell = this.group(wep, this.weapons, 'c:quentin'); // 손종
    this.part(along(0.018, 0.018, 0.2, 0.06, 6), 0x3b2616, bell, 0, 0.03, 0, false);
    this.part(new THREE.CylinderGeometry(0.05, 0.13, 0.18, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.2), 0xd9b44a, bell, 0, 0.03, 0);
    const brush = this.group(wep, this.weapons, 'c:elodie'); // 큰 붓
    this.part(along(0.014, 0.018, 0.7, 0.05), 0xe8d9b8, brush, 0, 0.03, 0, false);
    this.part(new THREE.ConeGeometry(0.05, 0.2, 10).rotateX(-Math.PI / 2).translate(0, 0, -0.75), 0xff6fb0, brush, 0, 0.03, 0);
    const moon = this.group(wep, this.weapons, 'c:lune'); // 초승달 칼
    const cres = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 20, Math.PI).rotateY(Math.PI / 2).translate(0, 0, -0.35), new THREE.MeshToonMaterial({ color: 0xe9e4ff, emissive: 0x3a2a80 }));
    cres.position.y = 0.03; moon.add(cres); cres.add(new THREE.Mesh(cres.geometry, this.outline));
    this.part(along(0.016, 0.016, 0.12, 0.06, 6), 0x3a2a60, moon, 0, 0.03, 0, false);
    const coin = item('coin', new THREE.Group());
    this.part(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 12), 0xd9b44a, coin, 0, 0.03, 0, false);
    // 겨드랑이에 낀 바게트(왼쪽)
    this.part(new THREE.CapsuleGeometry(0.035, 0.62, 4, 8).rotateX(Math.PI / 2 - 0.45), 0xd9a55a, this.baguette, 0, 0.02, 0);
    this.baguette.position.set(-0.25, 0.02, 0.2);
    this.baguette.visible = false;
    this.spine.add(this.baguette);
    // 다리: 바지(윗옷 따라 색) + 신발 셋
    for (const [th, kn, sx, i] of [[this.tL, this.kL, -1, 0], [this.tR, this.kR, 1, 1]] as const) {
      th.position.set(sx * 0.09, 0, -0.04);
      this.tilt.add(th);
      this.partM(this.limb(0.077, 0.28), this.pantsM, th);
      kn.position.z = -0.41;
      th.add(kn);
      this.partM(this.limb(0.066, 0.28), this.pantsM, kn);
      const set = this.shoes[i];
      const boots = this.group(kn, set, 'boots');
      this.part(new THREE.CylinderGeometry(0.074, 0.07, 0.14, 12).rotateX(Math.PI / 2), 0x5a3a22, boots, 0, 0, -0.34);
      this.part(new THREE.BoxGeometry(0.12, 0.22, 0.09), 0x5a3a22, boots, 0, 0.04, -0.425);
      this.part(new THREE.BoxGeometry(0.13, 0.235, 0.025), 0x2a1c12, boots, 0, 0.04, -0.47, false);
      this.part(new THREE.TorusGeometry(0.075, 0.012, 4, 14), 0x3e2716, boots, 0, 0, -0.27, false);
      const sn = this.group(kn, set, 'sneakers');
      this.part(new THREE.BoxGeometry(0.115, 0.2, 0.08), 0xf4f2ee, sn, 0, 0.035, -0.425);
      this.part(new THREE.SphereGeometry(0.058, 10, 8), 0xf4f2ee, sn, 0, 0.13, -0.43, false).scale.set(1, 0.8, 0.7);
      this.part(new THREE.BoxGeometry(0.125, 0.25, 0.03), 0xd9d4ca, sn, 0, 0.045, -0.47, false);
      this.part(new THREE.BoxGeometry(0.12, 0.1, 0.018).rotateX(0.5), sx < 0 ? 0x2f6db5 : 0xd6303a, sn, 0, 0.03, -0.42, false); // 옆줄
      const hk = this.group(kn, set, 'hiking');
      this.part(new THREE.CylinderGeometry(0.08, 0.078, 0.12, 12).rotateX(Math.PI / 2), 0x8a5a2b, hk, 0, 0, -0.35);
      this.part(new THREE.BoxGeometry(0.135, 0.24, 0.1), 0x8a5a2b, hk, 0, 0.045, -0.42);
      this.part(new THREE.BoxGeometry(0.145, 0.26, 0.045), 0x1e1e1e, hk, 0, 0.045, -0.47, false);
      for (const z of [-0.33, -0.37, -0.41]) this.part(new THREE.BoxGeometry(0.07, 0.012, 0.012), 0xd6303a, hk, 0, 0.078, z, false); // 끈
      this.legs.push(th);
    }
    // 패러글라이더: 천 날개 + 나무 손잡이 + 줄
    // 날개는 가로로 누운 원통의 윗부분 — 크림색·빨간색 천을 번갈아 이어 붙인다
    const PANELS = 7;
    for (let i = 0; i < PANELS; i++) {
      const span = 1.25 / PANELS;
      // 원통 축이 앞뒤(y), 호의 가운데가 위(+z) — 날개 끝은 양옆으로 처진다
      const cloth = new THREE.CylinderGeometry(1.6, 1.6, 0.85, 3, 1, true, -0.625 + i * span, span).scale(1, 1, 0.5);
      const wing = this.part(cloth, i % 2 ? 0xc8412f : 0xf4ead2, this.glider, 0, 0, 0.5);
      (wing.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
      this.wings.push(wing);
    }
    this.part(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 6).rotateZ(Math.PI / 2), 0x7b5130, this.glider, 0, 0, 0);
    const strings = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(-0.93, 0.35, 1.14), new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(-0.93, -0.35, 1.14),
      new THREE.Vector3(0.3, 0, 0), new THREE.Vector3(0.93, 0.35, 1.14), new THREE.Vector3(0.3, 0, 0), new THREE.Vector3(0.93, -0.35, 1.14),
    ]);
    this.glider.add(new THREE.LineSegments(strings, new THREE.LineBasicMaterial({ color: 0x3a2e24 })));
    this.glider.position.set(0, 0.05, 2.02);
    this.glider.visible = false;
    this.root.add(this.glider);
    void INK;
    this.setGear(this.gear);
    this.setLook(DEFAULT_LOOK);
  }

  /** 캐릭터의 옷 색(윗옷 · 옷자락 · 바지) — setGear 뒤에 덮어쓴다 */
  setOutfit(c: [number, number, number] | null) {
    if (!c) return;
    this.topM.color.setHex(c[0]); this.topDM.color.setHex(c[1]); this.pantsM.color.setHex(c[2]);
    if (this.topM.map) { this.topM.map = null; this.topM.needsUpdate = true; }
  }

  /** 캐릭터: 싸움 자세와 무기가 달라진다 */
  setStyle(id: string) {
    this.style = id;
    this.charWeapon = id === 'traveler' ? null : `c:${id}`;
    for (const [k, o] of this.weapons) o.visible = k === (this.charWeapon ?? this.gear.weapon ?? 'umbrella');
  }

  /** 생김새(피부 · 머리색 · 머리 모양 · 눈 · 키 · 목도리 색 · 덧붙이는 것) */
  setLook(l: Look) {
    this.skinM.color.setHex(l.skin);
    this.hairM.color.setHex(l.hair);
    this.eyeM.color.setHex(l.eyes);
    if (this.faceM) { this.faceTex?.forEach((t) => t.dispose()); this.faceTex = [this.drawFace(l.eyes, l.hair, false), this.drawFace(l.eyes, l.hair, true)]; this.faceM.map = this.faceTex[0]; this.faceM.needsUpdate = true; }
    this.scarfM.color.setHex(l.accent);
    for (const [k, o] of this.styles) o.visible = k === l.style;
    for (const [k, o] of this.extras) o.visible = k === l.extra;
    this.root.scale.setScalar(l.height);
  }

  /** 입은 장비대로 겉모습을 바꾼다 */
  setGear(l: Loadout) {
    this.gear = { ...l };
    const pick = (set: Map<string, THREE.Object3D>, id: string) => { for (const [k, o] of set) o.visible = k === id; };
    pick(this.weapons, this.charWeapon ?? l.weapon ?? 'umbrella');
    pick(this.hats, l.head);
    this.quiff.visible = l.head === 'none';
    pick(this.tops, l.top);
    pick(this.packs, l.back);
    for (const s of this.shoes) pick(s, l.feet);
    pick(this.skirts, l.top === 'trench' || l.top === 'napoleon' ? 'long' : l.top === 'jacket' ? 'short' : ''); // 마리니에르·가죽은 허리까지
    const TOP: Record<string, [number, number, number]> = {
      jacket: [0x2f6db5, 0x24558f, 0xe9dcc0],
      trench: [0xc9a878, 0xb08f60, 0x4a3b30],
      mariniere: [0xffffff, 0x1d2c55, 0x2b3550],
      leather: [0x2a2624, 0x1a1716, 0x34425e],
      napoleon: [0x1d2c55, 0x14203f, 0xf0ece0],
    };
    const [c, d, p] = TOP[l.top] ?? TOP.jacket;
    this.topM.color.setHex(c);
    this.topDM.color.setHex(d);
    this.pantsM.color.setHex(p);
    const striped = l.top === 'mariniere';
    if (striped && !this.stripes) {
      const cv = document.createElement('canvas');
      cv.width = 4; cv.height = 32;
      const g = cv.getContext('2d')!;
      g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, 4, 32);
      g.fillStyle = '#1d2c55';
      for (let y = 0; y < 32; y += 8) g.fillRect(0, y, 4, 3);
      this.stripes = new THREE.CanvasTexture(cv);
      this.stripes.wrapS = this.stripes.wrapT = THREE.RepeatWrapping;
      this.stripes.repeat.set(1, 3);
      this.stripes.colorSpace = THREE.SRGBColorSpace;
      this.stripes.magFilter = THREE.NearestFilter;
    }
    if ((this.topM.map !== null) !== striped) { this.topM.map = striped ? this.stripes : null; this.topM.needsUpdate = true; }
    // 가죽은 반들반들
    this.topM.emissive.setHex(l.top === 'leather' ? 0x0c0c0e : 0x000000);
    this.gliderId = l.glider;
    this.paintWings(l.glider);
  }

  private paintWings(id: string) {
    if (this.wingsAs === id) return;
    this.wingsAs = id;
    const n = this.wings.length;
    this.wings.forEach((w, i) => {
      const m = w.material as THREE.MeshToonMaterial;
      let col = i % 2 ? 0xc8412f : 0xf4ead2, em = 0x000000;
      if (id === 'azure') col = i % 2 ? 0x4fa8e0 : 0xf2f8ff;
      else if (id === 'flag') col = [0x2a4fa0, 0xf4f4f4, 0xd8323a][Math.min(2, Math.floor((i / n) * 3))];
      else if (id === 'butterfly') { col = [0x3b6fd8, 0xf29a2e, 0x1b1b22, 0xf29a2e, 0x3b6fd8, 0xf29a2e, 0x1b1b22][i % 7]; em = i % 2 ? 0x2a1400 : 0x06163a; }
      else if (id === 'golden') { col = i % 2 ? 0xe0a82e : 0xfff0b5; em = i % 2 ? 0x3a2600 : 0x2a2210; }
      m.color.setHex(col);
      m.emissive.setHex(em);
    });
  }

  /** 동료들의 싸움 자세(여행자의 우산 검술 위에 덮어쓴다) */
  private stylePose(act: string, at: number, want: Pose) {
    const q = (a: number, b: number) => Math.min(1, Math.max(0, (at - a) / (b - a)));
    const alt = act === 'atk2' ? -1 : 1;
    switch (this.style) {
      case 'julie': // 물채찍: 팔을 높이 들어 옆으로 휘갈긴다, 넷째는 앞으로 쭉
        if (act === 'atk4') Object.assign(want, { sRx: 1.6, sRy: 0, eR: 0.05, lean: 0.35, tL: 0.6, kL: -0.4, twist: 0 });
        else if (act === 'atk3') Object.assign(want, { sRx: 3.0 - 2.3 * q(0.05, 0.25), sRy: -0.2, eR: 0.3, lean: 0.25 * q(0.05, 0.25), twist: 0 });
        else if (act.startsWith('atk')) Object.assign(want, { sRx: 2.2, sRy: alt * (1.3 - 2.6 * q(0, 0.18)), eR: 0.5, twist: alt * (-0.5 + q(0, 0.18)), lean: 0.12, sLx: 0.5, eL: 1.0 });
        else if (act === 'skill') Object.assign(want, { sLx: 2.4, sRx: 2.4, sLy: 0.9, sRy: -0.9, eL: 0.3, eR: 0.3, bob: 0.1 * Math.sin(at * 10) });
        break;
      case 'gustave': { // 망치: 두 손으로 크게 들었다 내리친다, 넷째는 뛰어올라 쾅
        const k = q(0.1, 0.32);
        if (act.startsWith('atk')) Object.assign(want, { sRx: 2.9 - 2.0 * k, sLx: 2.9 - 2.0 * k, sRy: -0.15, sLy: 0.15, eR: 0.2, eL: 0.2, lean: -0.1 + 0.55 * k, twist: 0, tL: 0.5 * k, kL: -0.6 * k, bob: act === 'atk4' ? 0.35 * Math.sin(Math.min(1, at / 0.35) * Math.PI) - 0.15 * k : -0.12 * k });
        else if (act === 'skill') Object.assign(want, { sLx: 1.4, sRx: 1.4, sLy: -0.6, sRy: 0.6, eL: 1.2, eR: 1.2, tL: 0.6, tR: 0.6, kL: -1.0, kR: -1.0, bob: -0.25, lean: 0.2 });
        break;
      }
      case 'marcel': // 총검: 뒤로 당겼다가 쭉 찌른다(발을 번갈아)
        if (act.startsWith('atk')) { const k = q(0.02, 0.12); Object.assign(want, { sRx: 0.6 + 1.0 * k, sRy: 0.1, eR: 1.6 - 1.58 * k, sLx: 1.2, sLy: 0.5, eL: 1.0, lean: 0.1 + (act === 'atk4' ? 0.5 : 0.35) * k, twist: -0.3 + 0.3 * k, tL: alt > 0 ? 0.7 * k : -0.3, kL: alt > 0 ? -0.4 : -0.1, tR: alt > 0 ? -0.3 : 0.7 * k, kR: alt > 0 ? -0.1 : -0.4 }); }
        else if (act === 'skill') Object.assign(want, { sRx: 1.58, eR: 0.02, sLx: 0.9, eL: 0.9, lean: 0.6, tL: 0.9, kL: -0.5, tR: -0.5, bob: -0.1 });
        break;
      case 'amelie': // 던지기: 팔을 뒤로 젖혔다 앞으로, 넷째는 두 팔로 부채
        if (act === 'atk4') Object.assign(want, { sLx: 1.5, sRx: 1.5, sLy: 1.2 - 1.2 * q(0, 0.2), sRy: -1.2 + 1.2 * q(0, 0.2), eL: 0.2, eR: 0.2, lean: 0.2 });
        else if (act.startsWith('atk')) { const k = q(0, 0.16); Object.assign(want, { sRx: 2.7 - 1.5 * k, sRy: -0.5 + 0.3 * k, eR: 1.3 - 1.1 * k, twist: 0.6 - 1.0 * k, lean: -0.1 + 0.35 * k, sLx: 1.0, sLy: 0.6, eL: 0.4, tL: 0.4 * k, kL: -0.3 }); }
        else if (act === 'skill') Object.assign(want, { sRx: 1.6, sLx: 1.6, sRy: -0.3, sLy: 0.3, eR: 0.1, eL: 0.1, headX: 0.1 });
        break;
      case 'quentin': // 종: 들어 올려 흔든다, 넷째는 두 손으로 크게
        if (act === 'atk4') Object.assign(want, { sRx: 2.9 - 1.5 * q(0.1, 0.3), sLx: 2.9 - 1.5 * q(0.1, 0.3), eR: 0.2, eL: 0.2, bob: -0.15 * q(0.1, 0.3), lean: 0.1 });
        else if (act.startsWith('atk')) Object.assign(want, { sRx: 2.4 + 0.35 * Math.sin(at * 45), sRy: -0.3, eR: 0.5, sLx: 0.4, sLy: 0.4, eL: 0.8, lean: -0.05, headX: 0.15 });
        else if (act === 'skill') Object.assign(want, { sRx: 1.2, eR: 0.3, lean: 0.3, tL: 0.4, kL: -0.4 });
        break;
      case 'elodie': // 붓: 손목으로 빠르게 휘날린다
        if (act.startsWith('atk') && act !== 'atk4') Object.assign(want, { sRx: 1.35, sRy: Math.sin(at * 26) * 1.3 * alt, eR: 0.6 + 0.3 * Math.sin(at * 30), twist: Math.sin(at * 26) * 0.45, lean: 0.15, sLx: 0.6, sLy: 0.9, eL: 0.9, headX: -0.1 });
        else if (act === 'skill' || act === 'burst') Object.assign(want, { sRx: 2.6, sLx: 2.6, sRy: -0.8 + Math.sin(at * 20) * 0.5, sLy: 0.8 - Math.sin(at * 20) * 0.5, eR: 0.4, eL: 0.4, bob: 0.06 * Math.sin(at * 14) });
        break;
      case 'lune': // 달그림자: 낮게 웅크려 베어 든다
        if (act.startsWith('atk')) Object.assign(want, { sRx: 1.3, sRy: alt * (-1.3 + 2.4 * q(0, 0.14)), eR: 0.1, twist: alt * (-0.6 + 1.1 * q(0, 0.14)), lean: 0.55, bob: -0.2, tL: 0.85, kL: -1.1, tR: -0.3, kR: -0.3, sLx: -0.4, sLy: 0.9, eL: 0.2, headX: -0.3 });
        else if (act === 'skill') Object.assign(want, { lean: 0.7, bob: -0.3, tL: 1.0, kL: -1.2, tR: -0.5, sRx: -0.5, sLx: -0.5, eR: 0.2, eL: 0.2 });
        break;
    }
  }

  /** 몸 상태를 받아 자세를 잡는다. groundZ는 발밑(그림자 자리). */
  update(b: Body, dt: number, groundZ: number, beacon: [number, number] | null) {
    this.t += dt;
    // 눈 깜빡임: 3~5초마다 0.12초
    this.blinkT -= dt;
    if (this.faceM && this.faceTex) {
      const shut = this.blinkT < 0.12;
      const want = shut ? this.faceTex[1] : this.faceTex[0];
      if (this.faceM.map !== want) { this.faceM.map = want; this.faceM.needsUpdate = true; }
      if (this.blinkT < 0) this.blinkT = 3 + Math.random() * 2;
    }
    const t = this.t;
    const ph = b.phase;
    const want: Pose = { ...ZERO };
    const run = Math.min(1, b.speed / 5.6);
    const sprint = Math.max(0, Math.min(1, (b.speed - 5.9) / 2.7));
    const breath = Math.sin(t * (b.exhausted ? 7 : 2.2)) * (b.exhausted ? 0.05 : 0.012);
    const act = b.act?.kind;
    const walkPose = (A: number, crouch: boolean) => {
      const s = Math.sin(ph), c = Math.cos(ph);
      if (crouch) return {
        tL: 0.75 + A * 0.7 * s, tR: 0.75 - A * 0.7 * s, kL: -1.35 - 0.3 * Math.max(0, c), kR: -1.35 - 0.3 * Math.max(0, -c),
        sLx: 0.45 - 0.3 * s, sRx: 0.45 + 0.3 * s, sLy: 0.15, sRy: -0.15, eL: 0.9, eR: 0.9,
        lean: 0.55, bob: -0.3 + Math.abs(s) * 0.02, headX: 0.35, scarf: 0.3,
      };
      return {
        tL: A * s, tR: -A * s,
        kL: -(0.1 + (0.6 + run) * Math.max(0, c)), kR: -(0.1 + (0.6 + run) * Math.max(0, -c)),
        sLx: -A * 0.9 * s, sRx: A * 0.9 * s, sLy: 0.08, sRy: -0.08,
        eL: 0.2 + 1.1 * run, eR: 0.2 + 1.1 * run,
        lean: 0.05 + 0.18 * run + 0.2 * sprint + (b.exhausted ? 0.3 : 0), twist: 0.12 * run * s,
        bob: Math.abs(s) * 0.05 * run - 0.03 * run, headX: -0.1 * run, scarf: 0.4 + 0.9 * run,
      };
    };
    const seated = () => b.seatZ >= 0
      ? { bob: -0.8, tL: 1.5, tR: 1.42, kL: -1.5, kR: -1.4, lean: -0.04, sLx: 0.55, sRx: 0.55, sLy: 0.12, sRy: -0.12, eL: 0.7, eR: 0.7, headY: 0.35 * Math.sin(t * 0.5) }
      : { bob: -0.8, tL: 1.42, tR: 1.3, kL: -0.25, kR: -0.6, lean: -0.12, sLx: -0.55, sRx: -0.55, sLy: 0.3, sRy: -0.3, eL: 0.05, eR: 0.05, headY: 0.35 * Math.sin(t * 0.5) };
    switch (b.mode) {
      case 'ground': {
        if (b.speed < 0.15) {
          if (b.crouch) Object.assign(want, { tL: 0.9, tR: 0.8, kL: -1.9, kR: -1.8, lean: 0.5, bob: -0.42 + breath * 0.5, sLx: 0.6, sRx: 0.6, eL: 0.8, eR: 0.8, headX: 0.4 });
          else Object.assign(want, { bob: breath * 0.5, lean: breath + (b.exhausted ? 0.45 : 0), headX: b.exhausted ? 0.3 : 0, sLy: 0.1, sRy: -0.1, eL: 0.18, eR: 0.18 });
          if (b.exhausted && !b.crouch) Object.assign(want, { sLx: 0.55, sRx: 0.55, eL: 0.35, eR: 0.35, tL: 0.28, tR: 0.28, kL: -0.5, kR: -0.5, bob: -0.05 + breath });
          // 오래 서 있으면 두리번거린다
          if (b.idleT > 5 && !b.exhausted) { want.headY = 0.75 * Math.sin(t * 0.55) * Math.min(1, (b.idleT - 5) / 2); want.headX += 0.12 * Math.sin(t * 0.31); }
        } else Object.assign(want, walkPose(0.22 + 0.5 * run + 0.22 * sprint, b.crouch));
        break;
      }
      case 'roll': {
        this.spinAcc += dt * (Math.PI * 2) / 0.62;
        Object.assign(want, { tL: 1.9, tR: 1.9, kL: -2.3, kR: -2.3, sLx: 1.3, sRx: 1.3, sLy: -0.1, sRy: 0.1, eL: 1.6, eR: 1.6, headX: 0.7, bob: -0.5, scarf: 1.2 });
        break;
      }
      case 'slide':
        Object.assign(want, { pitch: -0.42, bob: -0.58, tL: 1.5, kL: -0.12, tR: 0.55, kR: -1.95, sLx: -0.5, sLy: 0.9, eL: 0.2, sRx: 1.3, sRy: -0.3, eR: 0.3, lean: 0.1, headX: -0.1, scarf: 1.6, side: 0.12 });
        break;
      case 'stagger':
        Object.assign(want, { lean: -0.35, sLx: 0.4 + 0.5 * Math.sin(t * 17), sRx: 0.4 - 0.5 * Math.sin(t * 17), sLy: 1.0, sRy: -1.0, eL: 0.4, eR: 0.4, tL: 0.4, kL: -0.6, tR: -0.2, headX: 0.25, side: 0.2 * Math.sin(t * 9) });
        break;
      case 'sit':
        Object.assign(want, seated());
        break;
      case 'act': {
        const at = b.act?.t ?? 0;
        switch (act) {
          case 'dance': {
            const s = Math.sin(ph), c = Math.cos(ph * 0.5);
            // 캉캉 — 다리를 번갈아 차올리고 팔을 흔든다
            Object.assign(want, { bob: Math.abs(s) * 0.09 - 0.04, twist: 0.35 * c, side: 0.15 * s,
              tL: Math.max(0, s) * 1.5, kL: -0.15 - Math.max(0, -s) * 0.5, tR: Math.max(0, -s) * 1.5, kR: -0.15 - Math.max(0, s) * 0.5,
              sLx: 1.1 + 1.4 * s, sRx: 1.1 - 1.4 * s, sLy: 0.7, sRy: -0.7, eL: 0.6, eR: 0.6, headX: 0.15 * s, headY: 0.3 * c, scarf: 1.2 });
            break;
          }
          case 'photo': Object.assign(want, { sLx: 1.05, sRx: 1.05, sLy: -0.45, sRy: 0.45, eL: 1.55, eR: 1.55, lean: 0.06, headX: -0.05, bob: at > 0.6 && at < 0.8 ? -0.02 : 0 }); break;
          case 'drink': Object.assign(want, { lean: 0.95, headX: 0.55, sLx: 1.0, sRx: 1.0, sLy: -0.3, sRy: 0.3, eL: 1.3, eR: 1.3, tL: 0.3, tR: -0.1, kL: -0.3, kR: -0.1, bob: -0.08 }); break;
          case 'eat': Object.assign(want, { sRx: 0.55, sRy: -0.1, eR: 2.05 + 0.25 * Math.sin(t * 9), sLx: 0.2, eL: 0.4, headX: -0.08 }); break;
          case 'clap': Object.assign(want, { sLx: 1.15, sRx: 1.15, sLy: -0.3 + 0.2 * Math.sin(t * 16), sRy: 0.3 - 0.2 * Math.sin(t * 16), eL: 1.0, eR: 1.0, bob: 0.02 * Math.abs(Math.sin(t * 8)) }); break;
          case 'lie': Object.assign(want, { pitch: -1.5, bob: -0.8, sLx: 2.8, sRx: 2.8, sLy: 0.35, sRy: -0.35, eL: 2.3, eR: 2.3, tL: 0.05, kL: -0.05, tR: 0.55, kR: -1.1, headX: 0.25 }); break;
          case 'push': Object.assign(want, { sRx: 1.5, sRy: -0.05, eR: 0.15 + 0.2 * Math.max(0, 1 - at * 3), lean: 0.14, tL: 0.25, kL: -0.2, sLx: -0.2 }); break;
          case 'tip': Object.assign(want, { sRx: 0.95, eR: 0.3, lean: 0.4, headX: -0.25, tL: 0.25, kL: -0.35 }); break;
          case 'feed': Object.assign(want, { tL: 0.9, tR: 0.8, kL: -1.9, kR: -1.8, lean: 0.45, bob: -0.42, sRx: 0.5 + 0.7 * Math.max(0, Math.sin(t * 5)), eR: 0.3, sLx: 0.6, eL: 1.2, headX: -0.1 }); break;
          case 'pet': Object.assign(want, { tL: 1.0, tR: 0.3, kL: -2.2, kR: -1.2, lean: 0.55, bob: -0.5, sRx: 0.95, eR: 0.35 + 0.25 * Math.sin(t * 6), sLx: 0.3, eL: 0.6, headX: -0.3 }); break;
          case 'stretch': Object.assign(want, { sLx: 2.95, sRx: 2.95, sLy: 0.15, sRy: -0.15, eL: 0.1, eR: 0.1, lean: -0.18, bob: 0.03, headX: 0.35 }); break;
          case 'think': Object.assign(want, { sRx: 0.55, eR: 2.35, sRy: 0.2, sLx: 0.55, sLy: -0.55, eL: 1.45, headX: 0.12, headY: 0.2 }); break;
          // 싸움: 가로 베기 → 되베기 → 내려찍기 · 스킬(돌며 바람) · 폭발(두 팔 들었다 내뻗기)
          case 'atk1': { const q = Math.min(1, at / 0.2); Object.assign(want, { sRx: 1.45, sRy: -1.25 + 2.0 * q, eR: 0.15, twist: -0.55 + 1.0 * q, lean: 0.18, tL: 0.4, kL: -0.35, tR: -0.15, sLx: 0.3, sLy: 0.5, eL: 0.6, scarf: 1.2 }); break; }
          case 'atk2': { const q = Math.min(1, at / 0.2); Object.assign(want, { sRx: 1.35, sRy: 0.85 - 2.0 * q, eR: 0.2, twist: 0.5 - 1.0 * q, lean: 0.2, tR: 0.4, kR: -0.35, tL: -0.15, sLx: 0.3, sLy: 0.6, eL: 0.6, scarf: 1.3 }); break; }
          case 'atk3': { const q = Math.min(1, Math.max(0, (at - 0.12) / 0.18)); Object.assign(want, { sRx: 2.95 - 2.1 * q, sLx: 2.95 - 2.1 * q, sRy: -0.25, sLy: 0.25, eR: 0.15, eL: 0.4, lean: 0.05 + 0.35 * q, bob: -0.12 * q, tL: 0.55 * q, kL: -0.5 * q, tR: -0.2 * q, headX: -0.1, scarf: 1.6 }); break; }
          // 넷째: 우산을 옆으로 쭉 뻗고 한 바퀴 도는 회오리 베기
          case 'atk4': Object.assign(want, { sRx: 1.5, sRy: -1.35, eR: 0.08, sLx: 1.2, sLy: 1.2, eL: 0.25, lean: 0.18, bob: -0.1, tL: 0.45, kL: -0.5, tR: 0.3, kR: -0.45, scarf: 2.2 }); break;
          // 강공격: 뒤로 당겼다가 앞으로 쭉 찌른다
          case 'charge': if (at < 0.12) Object.assign(want, { sRx: 0.55, sRy: 0.45, eR: 1.7, lean: -0.12, tR: 0.35, kR: -0.5, sLx: 0.9, sLy: 0.6, eL: 0.9, scarf: 1.4 }); else Object.assign(want, { sRx: 1.58, sRy: 0.05, eR: 0.02, lean: 0.5, tL: 0.85, kL: -0.45, tR: -0.45, kR: -0.1, sLx: 0.1, sLy: 0.9, eL: 0.4, bob: -0.08, scarf: 2.4 }); break;
          case 'skill': Object.assign(want, { sLx: 1.5, sRx: 1.5, sLy: 1.35, sRy: -1.35, eL: 0.1, eR: 0.1, lean: 0.05, bob: 0.08 * Math.sin(at * 12), scarf: 2 }); break;
          case 'burst': if (at < 0.45) Object.assign(want, { sLx: 2.9, sRx: 2.9, sLy: 0.35, sRy: -0.35, eL: 0.1, eR: 0.1, lean: -0.25, headX: 0.4, bob: 0.05, scarf: 1.8 }); else Object.assign(want, { sLx: 1.55, sRx: 1.55, sLy: -0.2, sRy: 0.2, eL: 0.05, eR: 0.05, lean: 0.3, tL: 0.7, kL: -0.7, tR: -0.3, bob: -0.12, scarf: 2.2 }); break;
        }
        if (this.style !== 'traveler' && act && ['atk1', 'atk2', 'atk3', 'atk4', 'skill', 'burst'].includes(act)) this.stylePose(act, at, want);
        break;
      }
      case 'air': {
        if (b.plunging) { Object.assign(want, { sLx: 2.9, sRx: 2.9, sLy: 0.2, sRy: -0.2, eL: 0.2, eR: 0.2, tL: 1.0, tR: 0.9, kL: -1.6, kR: -1.5, lean: 0.25, headX: -0.2, scarf: 2.4 }); break; }
        const up = b.vz > -2;
        const drop = b.fallTopZ - b.z; // 얼마나 떨어졌나
        if (!up && (b.vz < -11 || drop > 9)) {
          // 스카이다이빙: 배를 땅으로, 팔다리를 벌리고 바람에 떨린다. 빠를수록 더 납작하게
          const w = Math.sin(t * 23) * 0.06, w2 = Math.sin(t * 17 + 1) * 0.08;
          const flat = Math.min(1, (-b.vz - 8) / 20);
          Object.assign(want, { pitch: 0.95 + 0.35 * flat, bob: 0.1, headX: -0.75 - 0.2 * flat,
            sLx: 1.35 + w, sRx: 1.35 - w, sLy: 1.45 + w2, sRy: -1.45 - w2, eL: 0.55 + w, eR: 0.55 - w,
            tL: -0.15 + w2, tR: -0.15 - w2, kL: -0.95 + w, kR: -0.95 - w, side: 0, twist: Math.sin(t * 1.3) * 0.08, scarf: 2.2 });
          break;
        }
        if (!up && drop > 3.5) {
          // 생각보다 높다: 팔을 휘젓는다
          Object.assign(want, { sLx: 1.6 + 1.3 * Math.sin(t * 14), sRx: 1.6 + 1.3 * Math.sin(t * 14 + Math.PI), sLy: 0.9, sRy: -0.9, eL: 0.4, eR: 0.4,
            tL: 0.5 + 0.35 * Math.sin(t * 12), tR: 0.5 - 0.35 * Math.sin(t * 12), kL: -0.9, kR: -0.9, lean: -0.2, headX: 0.25, scarf: 1.8 });
          break;
        }
        if (up) Object.assign(want, { tL: 0.8, kL: -1.3, tR: -0.25, kR: -0.35, sLx: -0.7, sRx: 0.9, sLy: 0.35, sRy: -0.35, eL: 0.5, eR: 0.6, lean: 0.12, scarf: 1.1 });
        else Object.assign(want, { tL: 0.35 + 0.15 * Math.sin(t * 9), tR: -0.1 - 0.15 * Math.sin(t * 9), kL: -0.5, kR: -0.3, sLx: 0.5, sRx: 0.5, sLy: 1.25 + 0.2 * Math.sin(t * 11), sRy: -1.25 - 0.2 * Math.sin(t * 11), eL: 0.3, eR: 0.3, lean: -0.1, scarf: 1.6 });
        break;
      }
      case 'glide':
        if (b.parachute || b.golden) {
          // 낙하산: 손잡이를 잡고 다리는 늘어져 흔들린다. 도는 쪽으로 몸이 기운다
          const turn = Math.max(-1, Math.min(1, this.turnRate / 90));
          const sw = Math.sin(t * 1.9) * 0.18;
          Object.assign(want, { sLx: 2.85, sRx: 2.85, sLy: 0.32 - turn * 0.25, sRy: -0.32 - turn * 0.25, eL: 0.2 + Math.max(0, turn) * 0.5, eR: 0.2 + Math.max(0, -turn) * 0.5,
            tL: 0.18 + sw, tR: 0.05 - sw, kL: -0.25 - Math.max(0, sw), kR: -0.35 - Math.max(0, -sw), side: turn * 0.35, lean: -0.05 + Math.min(0.3, b.speed / 100), pitch: 0.05, scarf: 1.8, headX: 0.15, headY: turn * 0.4 });
          break;
        }
        Object.assign(want, { sLx: 2.95, sRx: 2.95, sLy: 0.22, sRy: -0.22, eL: 0.12, eR: 0.12, tL: 0.25 + 0.12 * Math.sin(t * 2.2), tR: 0.1 - 0.12 * Math.sin(t * 2.2), kL: -0.35, kR: -0.5, lean: -0.08, pitch: 0.12, scarf: 1.4, headX: -0.1 });
        break;
      case 'climb': {
        const s = Math.sin(ph);
        Object.assign(want, { sLx: 2.55 + 0.45 * s, sRx: 2.55 - 0.45 * s, sLy: 0.35, sRy: -0.35, eL: 0.5 + 0.5 * Math.max(0, -s), eR: 0.5 + 0.5 * Math.max(0, s), tL: 0.75 - 0.35 * s, tR: 0.75 + 0.35 * s, kL: -1.25, kR: -1.25, lean: -0.08, headX: -0.25, bob: -0.05 });
        break;
      }
      case 'mantle':
        if (b.vaulting) Object.assign(want, { tL: 1.1, tR: 0.7, kL: -0.6, kR: -1.2, sRx: 1.2, eR: 0.05, sRy: 0.2, sLx: -0.2, sLy: 1.1, lean: 0.35, side: 0.55, bob: 0.05, scarf: 1.2 });
        else Object.assign(want, { tL: 1.3, tR: 0.9, kL: -1.9, kR: -1.5, sLx: 1.5, sRx: 1.5, eL: 0.7, eR: 0.7, lean: 0.55, bob: -0.2 });
        break;
      case 'down':
        Object.assign(want, { tL: 1.45, kL: -2.3, tR: 0.15, kR: -1.95, sLx: 0.7, sRx: 0.3, eL: 0.6, eR: 0.4, lean: 0.6, headX: 0.35, bob: -0.42 });
        break;
      case 'ascend': {
        const at2 = b.asc?.t ?? 0;
        if (at2 < 0.5) { const k2 = at2 / 0.5; Object.assign(want, { tL: 0.9 * k2, tR: 0.8 * k2, kL: -1.6 * k2, kR: -1.5 * k2, lean: 0.35 * k2, bob: -0.35 * k2, sLx: 0.4, sRx: 0.4, sLy: 0.6, sRy: -0.6, eL: 0.6, eR: 0.6, headX: -0.2, scarf: 0.6 }); }
        else Object.assign(want, { sLx: 2.95, sRx: 2.95, sLy: 0.12, sRy: -0.12, eL: 0.05, eR: 0.05, tL: 0.05, tR: -0.02, kL: -0.12, kR: -0.08, lean: -0.05, headX: -0.35, bob: 0, scarf: 2.4 });
        break;
      }
      case 'swim': {
        const s = Math.sin(ph);
        Object.assign(want, { pitch: b.speed > 0.4 ? 0.95 : 0.3, bob: b.speed > 0.4 ? -0.92 : -1.12, sLx: b.speed > 0.4 ? 1.6 + 1.5 * s : 0.9 + 0.4 * s, sRx: b.speed > 0.4 ? 1.6 - 1.5 * s : 0.9 - 0.4 * s, sLy: 0.5, sRy: -0.5, eL: 0.3, eR: 0.3, tL: 0.25 * Math.sin(ph * 3), tR: -0.25 * Math.sin(ph * 3), headX: b.speed > 0.4 ? -1.0 : -0.3 }); // 고개는 물 밖으로
        break;
      }
    }
    // 앉아서 하는 동작(사진·먹기·박수)은 윗몸만 바꾼다
    if (b.mode === 'sit' && act) {
      if (act === 'photo') Object.assign(want, { sLx: 1.05, sRx: 1.05, sLy: -0.45, sRy: 0.45, eL: 1.55, eR: 1.55 });
      else if (act === 'eat') Object.assign(want, { sRx: 0.55, eR: 2.05 + 0.25 * Math.sin(t * 9) });
      else if (act === 'clap') Object.assign(want, { sLx: 1.15, sRx: 1.15, sLy: -0.3 + 0.2 * Math.sin(t * 16), sRy: 0.3 - 0.2 * Math.sin(t * 16), eL: 1.0, eR: 1.0 });
    }
    // 손에 든 것: 걷는 동안 오른팔은 그걸 들고 있다
    const holding = b.carry && b.carry !== 'baguette' && (b.mode === 'ground' || b.mode === 'sit') && !act;
    if (holding) Object.assign(want, b.carry === 'balloon' ? { sRx: 0.35, sRy: -0.25, eR: 0.35 } : { sRx: 0.45, sRy: -0.05, eR: 1.35 });
    if (b.carry === 'baguette' && (b.mode === 'ground' || b.mode === 'sit')) Object.assign(want, { sLx: 0.08, sLy: 0.2, eL: 0.55 });
    // 손 흔들기·가리키기는 걷거나 앉은 채로도 윗몸만
    if (b.pointT > 0) Object.assign(want, { sRx: 1.55, sRy: -0.05, eR: 0.05, headX: 0.05 });
    if (b.waveT > 0) Object.assign(want, { sRx: 0.25, sRy: -2.45 + 0.35 * Math.sin(t * 10), eR: 0.45 + 0.25 * Math.sin(t * 10 + 1), headX: 0.08, headY: 0.1 });
    // 높은 데서 내려앉으면 무릎으로 받는다
    if (b.events.includes('land') && this.airT > 0.7) this.landT = 0.38;
    this.airT = b.mode === 'air' || b.mode === 'glide' ? this.airT + dt : 0;
    if (this.landT > 0) {
      this.landT -= dt;
      if (b.mode === 'ground') { const k2 = Math.min(1, this.landT / 0.2); Object.assign(want, { tL: 1.0 * k2, tR: 0.9 * k2, kL: -1.7 * k2, kR: -1.6 * k2, lean: 0.4 * k2, bob: -0.38 * k2, sLx: 0.5 * k2, sRx: 0.5 * k2, sLy: 0.5 * k2, sRy: -0.5 * k2 }); }
    }
    // 얼마나 빨리 도나(낙하산 기울기)
    const df = ((b.facing - this.lastFacing + 540) % 360) - 180;
    this.lastFacing = b.facing;
    if (dt > 0) this.turnRate += (df / dt - this.turnRate) * Math.min(1, dt * 4);
    // 부드럽게 옮겨 간다
    const fighting = !!act && ['atk1', 'atk2', 'atk3', 'atk4', 'charge', 'skill', 'burst'].includes(act);
    const k = 1 - Math.exp(-dt * (fighting ? 34 : b.mode === 'ground' ? 16 : 11));
    const p = this.pose;
    for (const key of Object.keys(p) as (keyof Pose)[]) p[key] += (want[key] - p[key]) * k;
    this.root.position.set(0, 0, p.bob);
    this.root.rotation.z = (-b.facing * Math.PI) / 180 - (act === 'skill' && this.style === 'traveler' ? (b.act?.t ?? 0) * 17 : act === 'atk4' && (this.style === 'traveler' || this.style === 'elodie') ? Math.min(1, (b.act?.t ?? 0) / 0.34) * Math.PI * 2 : act === 'atk4' && this.style === 'lune' ? Math.min(1, (b.act?.t ?? 0) / 0.2) * Math.PI : 0) - (b.mode === 'ascend' && b.asc ? Math.max(0, b.asc.t - 0.5) * 5 : 0); // 스킬: 제자리 두 바퀴 반 · 상승: 천천히 돈다
    // 상승 기운
    this.aura.visible = b.mode === 'ascend';
    if (this.aura.visible) {
      const at3 = b.asc?.t ?? 0, rise = at3 > 0.5;
      this.aura.scale.set(1, 1, rise ? 1.4 : 0.4 + at3);
      for (const ch of this.aura.children) if (ch.userData.ph !== undefined) { ch.position.z = ((t * 6 + (ch.userData.ph as number)) % 3) - 0.5; ch.visible = rise; }
      ((this.aura.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = rise ? 0.35 + Math.sin(t * 20) * 0.08 : 0.15 + at3 * 0.3;
    }
    if (b.mode !== 'roll') this.spinAcc = 0;
    this.tilt.rotation.set(-p.pitch - (b.mode === 'roll' ? Math.min(Math.PI * 2, this.spinAcc) : 0), p.side, 0);
    this.spine.rotation.set(-p.lean, p.side * 0.5, p.twist);
    this.head.rotation.set(p.headX - p.lean * 0.6, 0, p.headY);
    this.sL.rotation.set(p.sLx, p.sLy, 0); this.sR.rotation.set(p.sRx, p.sRy, 0);
    this.eL.rotation.x = p.eL; this.eR.rotation.x = p.eR;
    this.tL.rotation.x = p.tL; this.tR.rotation.x = p.tR;
    this.kL.rotation.x = p.kL; this.kR.rotation.x = p.kR;
    this.scarf.rotation.x = -0.25 - p.scarf + Math.sin(t * 13) * 0.08 * p.scarf;
    for (const l of this.legs) l.visible = b.mode !== 'swim';
    const showItem: Item | null = fighting || b.plunging || b.drawn > 0 ? 'umbrella' : act === 'photo' ? 'camera' : act === 'tip' ? 'coin' : b.carry && b.carry !== 'baguette' && !(act && act !== 'eat') ? b.carry : null;
    for (const [k, o] of this.items) o.visible = k === showItem && b.mode !== 'swim' && b.mode !== 'climb' && b.mode !== 'glide';
    this.baguette.visible = b.carry === 'baguette' && b.mode !== 'swim';
    // 글라이더: 펼칠 때 부풀어 오른다
    const g = b.gliderOpen;
    this.glider.visible = g > 0.02;
    // 금빛 낙하산(숨은 보상) — 한 번 받으면 글라이더 천이 금색으로 바뀐다
    this.paintWings(b.golden ? 'golden' : this.gliderId);
    const pk = b.parachute || b.golden ? 2 : 1; // 낙하산은 크게
    this.glider.scale.set((0.3 + 0.7 * g) * pk, (0.3 + 0.7 * g) * pk, g * pk);
    this.glider.rotation.x = 0.1 + Math.sin(t * 1.7) * 0.03;
    // 그림자: 높이 올라갈수록 옅고 작아진다
    const hgt = Math.max(0, b.z - groundZ);
    this.shadow.position.set(0, 0, groundZ - b.z + 0.03);
    this.shadow.scale.setScalar(Math.max(0.45, 1 - hgt * 0.03));
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = b.mode === 'swim' ? 0 : Math.max(0.08, 0.32 - hgt * 0.012);
    this.ripple.visible = this.surface.visible = b.mode === 'swim';
    this.surface.position.set(0, 0, 0.01);
    if (this.ripple.visible) {
      const r = (t * 0.8) % 1;
      this.ripple.position.set(0, 0, 0.03);
      this.ripple.scale.setScalar(0.8 + r * 1.2);
      (this.ripple.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - r);
    }
    this.beacon.visible = !!beacon;
    if (beacon) {
      this.beacon.position.set(beacon[0], beacon[1], -b.z);
      this.beacon.scale.set(1 + Math.sin(t * 3) * 0.08, 1 + Math.sin(t * 3) * 0.08, 1);
    }
  }
}
