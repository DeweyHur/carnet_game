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
type Item = 'camera' | 'crepe' | 'coffee' | 'balloon' | 'flowers' | 'book' | 'coin';

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
  }

  private mat(color: number) { return new THREE.MeshToonMaterial({ color, gradientMap: this.ramp }); }

  private part(geo: THREE.BufferGeometry, color: number, parent: THREE.Object3D, x = 0, y = 0, z = 0, lined = true): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.mat(color));
    m.position.set(x, y, z);
    parent.add(m);
    if (lined) m.add(new THREE.Mesh(geo, this.outline));
    return m;
  }

  /** 세로(z축)로 선 캡슐, 윗끝이 원점(관절)에 오게 */
  private limb(r: number, len: number) {
    return new THREE.CapsuleGeometry(r, len, 4, 10).rotateX(Math.PI / 2).translate(0, 0, -len / 2);
  }

  private basic(color: number) { return new THREE.MeshBasicMaterial({ color }); }
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

  private build() {
    const SKIN = 0xf2c9a0, HAIR = 0x3b2a1e, SCARF = 0xe0493a, INK = 0x1d1a17;
    this.root.add(this.tilt);
    this.tilt.position.z = 0.92;
    // 골반·허리띠
    this.partM(new THREE.BoxGeometry(0.3, 0.19, 0.16), this.pantsM, this.tilt, 0, 0, -0.02);
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
    this.partM(new THREE.CapsuleGeometry(0.165, 0.26, 6, 16).rotateX(Math.PI / 2), this.topM, this.spine, 0, 0, 0.25).scale.set(1.1, 0.82, 1);
    this.partM(new THREE.CapsuleGeometry(0.085, 0.3, 4, 10).rotateY(Math.PI / 2), this.topM, this.spine, 0, -0.005, 0.43).scale.set(1, 0.95, 0.8); // 어깨
    this.part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12).rotateX(Math.PI / 2), SKIN, this.spine, 0, 0, 0.52, false); // 목

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
    const lea = this.group(this.spine, this.tops, 'leather');
    for (const sx of [-1, 1]) this.part(new THREE.BoxGeometry(0.1, 0.025, 0.14).rotateY(sx * 0.35).rotateX(-0.3), 0x121212, lea, sx * 0.08, 0.12, 0.45, false); // 선 칼라
    this.part(new THREE.BoxGeometry(0.012, 0.02, 0.4).rotateY(0.12), 0xc9ccd0, lea, 0.02, 0.137, 0.24, false); // 지퍼
    this.part(new THREE.BoxGeometry(0.3, 0.02, 0.012), 0xc9ccd0, lea, 0, 0.135, 0.0, false);

    // 목도리(모두 두른다 — 이 여행자의 표시)
    this.part(new THREE.TorusGeometry(0.105, 0.05, 8, 16), SCARF, this.spine, 0, 0, 0.49);
    this.scarf.position.set(0.06, -0.1, 0.48);
    this.spine.add(this.scarf);
    this.part(new THREE.BoxGeometry(0.07, 0.03, 0.3).translate(0, 0, -0.15), SCARF, this.scarf);
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
    this.head.position.z = 0.56;
    this.spine.add(this.head);
    this.part(new THREE.SphereGeometry(0.145, 22, 16), SKIN, this.head, 0, 0.005, 0.16).scale.set(1, 0.95, 1.05);
    for (const sx of [-1, 1]) this.part(new THREE.SphereGeometry(0.034, 10, 8), SKIN, this.head, sx * 0.142, -0.005, 0.15).scale.set(0.55, 0.9, 1.2); // 귀
    // 머리카락: 뒤통수 + 앞머리 + 구레나룻
    this.part(new THREE.SphereGeometry(0.153, 20, 14, 0, TAU, 0, Math.PI * 0.6).rotateX(Math.PI / 2), HAIR, this.head, 0, -0.012, 0.172).rotation.x = 0.55;
    for (const [fx, fz, r] of [[-0.075, 0.245, 0.05], [-0.025, 0.26, 0.055], [0.03, 0.258, 0.052], [0.08, 0.24, 0.045]] as const) {
      const f = this.part(new THREE.SphereGeometry(r, 10, 8), HAIR, this.head, fx, 0.095, fz, false);
      f.scale.set(1, 0.7, 0.8);
    }
    for (const sx of [-1, 1]) this.part(new THREE.BoxGeometry(0.02, 0.05, 0.08), HAIR, this.head, sx * 0.138, 0.04, 0.15, false);
    // 맨머리일 때만: 바람에 날리는 앞머리 한 줌
    this.quiff = new THREE.Group();
    this.head.add(this.quiff);
    this.part(new THREE.ConeGeometry(0.06, 0.16, 8).rotateX(-1.1), HAIR, this.quiff, 0.02, 0.05, 0.3);
    this.part(new THREE.ConeGeometry(0.05, 0.14, 8).rotateX(-1.6), HAIR, this.quiff, -0.05, -0.02, 0.31);
    // 얼굴: 흰자·눈동자·반짝임, 눈썹, 웃는 입, 볼
    for (const sx of [-1, 1]) {
      this.partM(new THREE.SphereGeometry(0.03, 12, 10), this.basic(0xfbf8f2), this.head, sx * 0.052, 0.122, 0.172, false).scale.set(1, 0.55, 1.2);
      this.part(new THREE.SphereGeometry(0.02, 10, 8), 0x2d2016, this.head, sx * 0.05, 0.138, 0.17, false).scale.set(1, 0.6, 1.15);
      this.partM(new THREE.SphereGeometry(0.0065, 6, 6), this.basic(0xffffff), this.head, sx * 0.05 + 0.007, 0.151, 0.18, false);
      this.part(new THREE.BoxGeometry(0.048, 0.012, 0.012).rotateY(-sx * 0.18), HAIR, this.head, sx * 0.054, 0.13, 0.215, false);
      const blush = this.partM(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf08f7d, transparent: true, opacity: 0.45, depthWrite: false }), this.head, sx * 0.088, 0.118, 0.125, false);
      blush.scale.set(1, 0.4, 0.6);
    }
    this.part(new THREE.SphereGeometry(0.022, 8, 8), 0xf0b58c, this.head, 0, 0.148, 0.14, false); // 코
    this.part(new THREE.TorusGeometry(0.024, 0.006, 4, 10, Math.PI).rotateZ(Math.PI).rotateX(Math.PI / 2), 0x8a3a2a, this.head, 0, 0.135, 0.108, false); // 입

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
      this.part(new THREE.SphereGeometry(0.056, 10, 8), SKIN, el, 0, 0.005, -0.27);
      this.part(new THREE.SphereGeometry(0.022, 6, 6), SKIN, el, sx * -0.03, 0.04, -0.25, false); // 엄지
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
  }

  /** 입은 장비대로 겉모습을 바꾼다 */
  setGear(l: Loadout) {
    this.gear = { ...l };
    const pick = (set: Map<string, THREE.Object3D>, id: string) => { for (const [k, o] of set) o.visible = k === id; };
    pick(this.hats, l.head);
    this.quiff.visible = l.head === 'none';
    pick(this.tops, l.top);
    pick(this.packs, l.back);
    for (const s of this.shoes) pick(s, l.feet);
    pick(this.skirts, l.top === 'trench' ? 'long' : l.top === 'jacket' ? 'short' : ''); // 마리니에르·가죽은 허리까지
    const TOP: Record<string, [number, number, number]> = {
      jacket: [0x2f6db5, 0x24558f, 0xe9dcc0],
      trench: [0xc9a878, 0xb08f60, 0x4a3b30],
      mariniere: [0xffffff, 0x1d2c55, 0x2b3550],
      leather: [0x2a2624, 0x1a1716, 0x34425e],
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
      else if (id === 'golden') { col = i % 2 ? 0xe0a82e : 0xfff0b5; em = i % 2 ? 0x3a2600 : 0x2a2210; }
      m.color.setHex(col);
      m.emissive.setHex(em);
    });
  }

  /** 몸 상태를 받아 자세를 잡는다. groundZ는 발밑(그림자 자리). */
  update(b: Body, dt: number, groundZ: number, beacon: [number, number] | null) {
    this.t += dt;
    const t = this.t;
    const ph = b.phase;
    const want: Pose = { ...ZERO };
    const run = Math.min(1, b.speed / 4.6);
    const sprint = Math.max(0, Math.min(1, (b.speed - 4.8) / 2.2));
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
        }
        break;
      }
      case 'air': {
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
    const k = 1 - Math.exp(-dt * (b.mode === 'ground' ? 16 : 11));
    const p = this.pose;
    for (const key of Object.keys(p) as (keyof Pose)[]) p[key] += (want[key] - p[key]) * k;
    this.root.position.set(0, 0, p.bob);
    this.root.rotation.z = (-b.facing * Math.PI) / 180;
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
    const showItem: Item | null = act === 'photo' ? 'camera' : act === 'tip' ? 'coin' : b.carry && b.carry !== 'baguette' && !(act && act !== 'eat') ? b.carry : null;
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
