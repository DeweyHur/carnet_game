// 여행자 한 사람. 모델 파일 없이 도형으로 빚고, 툰 셰이딩 + 외곽선으로 그린다.
// 관절 각도를 매 프레임 계산해 걷기·달리기·점프·활공·벽타기·헤엄을 보여 준다.
import * as THREE from 'three';
import type { Body } from './body';

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
  bob: number; pitch: number; lean: number; twist: number; headX: number;
  sLx: number; sLy: number; sRx: number; sRy: number; eL: number; eR: number;
  tL: number; tR: number; kL: number; kR: number; scarf: number;
};
const ZERO: Pose = { bob: 0, pitch: 0, lean: 0, twist: 0, headX: 0, sLx: 0, sLy: 0, sRx: 0, sRy: 0, eL: 0, eR: 0, tL: 0, tR: 0, kL: 0, kR: 0, scarf: 0 };

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
  private readonly glider = new THREE.Group();
  private readonly shadow: THREE.Mesh;
  private readonly ripple: THREE.Mesh;
  private readonly surface: THREE.Mesh; // 헤엄칠 때 물속 몸을 가리는 수면(지도의 물은 평면이라 깊이를 쓰지 않는다)
  private readonly beacon: THREE.Group;
  private readonly legs: THREE.Object3D[] = [];
  private readonly ramp = toonRamp();
  private readonly outline = outlineMat(0.012);
  private pose: Pose = { ...ZERO };
  private t = 0;

  constructor() {
    this.scene.add(this.flip);
    this.flip.add(this.root);
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.3);
    sun.position.set(-0.6, 0.9, 1.4);
    const sky = new THREE.HemisphereLight(0xcfe3ff, 0x8a7a66, 1.35);
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

  private build() {
    const SKIN = 0xf2c9a0, COAT = 0x2f6db5, COAT_D = 0x24558f, PANTS = 0xe9dcc0, BOOT = 0x5a3a22, HAIR = 0x3b2a1e, BERET = 0xb8322f, SCARF = 0xe0493a, BAG = 0x8a5a33;
    this.root.add(this.tilt);
    this.tilt.position.z = 0.92;
    // 골반·코트 자락
    this.part(new THREE.BoxGeometry(0.3, 0.19, 0.16), PANTS, this.tilt, 0, 0, -0.02);
    this.part(new THREE.CylinderGeometry(0.19, 0.245, 0.3, 14, 1, true).rotateX(Math.PI / 2), COAT_D, this.tilt, 0, 0, -0.08).material = Object.assign(this.mat(COAT_D), { side: THREE.DoubleSide });
    // 몸통
    this.tilt.add(this.spine);
    this.part(new THREE.CapsuleGeometry(0.165, 0.26, 4, 12).rotateX(Math.PI / 2), COAT, this.spine, 0, 0, 0.25).scale.set(1.08, 0.82, 1);
    this.part(new THREE.BoxGeometry(0.035, 0.02, 0.36), 0xf3e7c9, this.spine, 0, 0.14, 0.24, false); // 코트 여밈
    this.part(new THREE.BoxGeometry(0.28, 0.12, 0.3), BAG, this.spine, 0, -0.19, 0.24); // 등에 멘 가방
    this.part(new THREE.BoxGeometry(0.05, 0.3, 0.02).rotateY(0.9), 0x6b4423, this.spine, 0.02, 0, 0.3, false); // 가방끈
    // 목도리
    this.part(new THREE.TorusGeometry(0.105, 0.05, 8, 16), SCARF, this.spine, 0, 0, 0.47);
    this.scarf.position.set(0.06, -0.1, 0.46);
    this.spine.add(this.scarf);
    this.part(new THREE.BoxGeometry(0.07, 0.03, 0.3).translate(0, 0, -0.15), SCARF, this.scarf);
    // 머리
    this.head.position.z = 0.54;
    this.spine.add(this.head);
    this.part(new THREE.SphereGeometry(0.145, 18, 14), SKIN, this.head, 0, 0.005, 0.16).scale.set(1, 0.95, 1.05);
    this.part(new THREE.SphereGeometry(0.153, 18, 14, 0, TAU, 0, Math.PI * 0.6).rotateX(Math.PI / 2), HAIR, this.head, 0, -0.012, 0.172).rotation.x = 0.55; // 정수리에서 뒤통수까지
    this.part(new THREE.CylinderGeometry(0.15, 0.165, 0.05, 20).rotateX(Math.PI / 2), BERET, this.head, 0.03, -0.01, 0.3).rotation.y = 0.28;
    this.part(new THREE.SphereGeometry(0.018, 6, 6), 0x3a2a20, this.head, 0.03, -0.01, 0.335, false);
    for (const sx of [-1, 1]) this.part(new THREE.SphereGeometry(0.02, 8, 8), 0x1d1a17, this.head, sx * 0.052, 0.135, 0.17, false);
    this.part(new THREE.SphereGeometry(0.022, 8, 8), 0xf0b58c, this.head, 0, 0.148, 0.14, false); // 코
    // 팔
    for (const [sh, el, sx] of [[this.sL, this.eL, -1], [this.sR, this.eR, 1]] as const) {
      sh.position.set(sx * 0.215, 0, 0.42);
      this.spine.add(sh);
      this.part(this.limb(0.058, 0.2), COAT, sh);
      el.position.z = -0.27;
      sh.add(el);
      this.part(this.limb(0.052, 0.18), COAT, el);
      this.part(new THREE.SphereGeometry(0.056, 10, 8), SKIN, el, 0, 0.005, -0.27);
    }
    // 다리
    for (const [th, kn, sx] of [[this.tL, this.kL, -1], [this.tR, this.kR, 1]] as const) {
      th.position.set(sx * 0.09, 0, -0.04);
      this.tilt.add(th);
      this.part(this.limb(0.075, 0.28), PANTS, th);
      kn.position.z = -0.41;
      th.add(kn);
      this.part(this.limb(0.066, 0.28), PANTS, kn);
      this.part(new THREE.BoxGeometry(0.12, 0.22, 0.1), BOOT, kn, 0, 0.04, -0.43);
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
    switch (b.mode) {
      case 'ground': {
        if (b.speed < 0.15) {
          Object.assign(want, { bob: breath * 0.5, lean: breath + (b.exhausted ? 0.45 : 0), headX: b.exhausted ? 0.3 : 0, sLy: 0.1, sRy: -0.1, eL: 0.18, eR: 0.18 });
          if (b.exhausted) Object.assign(want, { sLx: 0.55, sRx: 0.55, eL: 0.35, eR: 0.35, tL: 0.28, tR: 0.28, kL: -0.5, kR: -0.5, bob: -0.05 + breath });
        } else {
          const A = 0.22 + 0.5 * run + 0.22 * sprint;
          const s = Math.sin(ph), c = Math.cos(ph);
          Object.assign(want, {
            tL: A * s, tR: -A * s,
            kL: -(0.1 + (0.6 + run) * Math.max(0, c)), kR: -(0.1 + (0.6 + run) * Math.max(0, -c)),
            sLx: -A * 0.9 * s, sRx: A * 0.9 * s, sLy: 0.08, sRy: -0.08,
            eL: 0.2 + 1.1 * run, eR: 0.2 + 1.1 * run,
            lean: 0.05 + 0.18 * run + 0.2 * sprint + (b.exhausted ? 0.3 : 0), twist: 0.12 * run * s,
            bob: Math.abs(s) * 0.05 * run - 0.03 * run, headX: -0.1 * run, scarf: 0.4 + 0.9 * run,
          });
        }
        break;
      }
      case 'air': {
        const up = b.vz > -2;
        if (up) Object.assign(want, { tL: 0.8, kL: -1.3, tR: -0.25, kR: -0.35, sLx: -0.7, sRx: 0.9, sLy: 0.35, sRy: -0.35, eL: 0.5, eR: 0.6, lean: 0.12, scarf: 1.1 });
        else Object.assign(want, { tL: 0.35 + 0.15 * Math.sin(t * 9), tR: -0.1 - 0.15 * Math.sin(t * 9), kL: -0.5, kR: -0.3, sLx: 0.5, sRx: 0.5, sLy: 1.25 + 0.2 * Math.sin(t * 11), sRy: -1.25 - 0.2 * Math.sin(t * 11), eL: 0.3, eR: 0.3, lean: -0.1, scarf: 1.6 });
        break;
      }
      case 'glide':
        Object.assign(want, { sLx: 2.95, sRx: 2.95, sLy: 0.22, sRy: -0.22, eL: 0.12, eR: 0.12, tL: 0.25 + 0.12 * Math.sin(t * 2.2), tR: 0.1 - 0.12 * Math.sin(t * 2.2), kL: -0.35, kR: -0.5, lean: -0.08, pitch: 0.12, scarf: 1.4, headX: -0.1 });
        break;
      case 'climb': {
        const s = Math.sin(ph);
        Object.assign(want, { sLx: 2.55 + 0.45 * s, sRx: 2.55 - 0.45 * s, sLy: 0.35, sRy: -0.35, eL: 0.5 + 0.5 * Math.max(0, -s), eR: 0.5 + 0.5 * Math.max(0, s), tL: 0.75 - 0.35 * s, tR: 0.75 + 0.35 * s, kL: -1.25, kR: -1.25, lean: -0.08, headX: -0.25, bob: -0.05 });
        break;
      }
      case 'mantle':
        Object.assign(want, { tL: 1.3, tR: 0.9, kL: -1.9, kR: -1.5, sLx: 1.5, sRx: 1.5, eL: 0.7, eR: 0.7, lean: 0.55, bob: -0.2 });
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
    // 부드럽게 옮겨 간다
    const k = 1 - Math.exp(-dt * (b.mode === 'ground' ? 16 : 11));
    const p = this.pose;
    for (const key of Object.keys(p) as (keyof Pose)[]) p[key] += (want[key] - p[key]) * k;
    this.root.position.set(0, 0, p.bob);
    this.root.rotation.z = (-b.facing * Math.PI) / 180;
    this.tilt.rotation.x = -p.pitch;
    this.spine.rotation.set(-p.lean, 0, p.twist);
    this.head.rotation.x = p.headX - p.lean * 0.6;
    this.sL.rotation.set(p.sLx, p.sLy, 0); this.sR.rotation.set(p.sRx, p.sRy, 0);
    this.eL.rotation.x = p.eL; this.eR.rotation.x = p.eR;
    this.tL.rotation.x = p.tL; this.tR.rotation.x = p.tR;
    this.kL.rotation.x = p.kL; this.kR.rotation.x = p.kR;
    this.scarf.rotation.x = -0.25 - p.scarf + Math.sin(t * 13) * 0.08 * p.scarf;
    for (const l of this.legs) l.visible = b.mode !== 'swim';
    // 글라이더: 펼칠 때 부풀어 오른다
    const g = b.gliderOpen;
    this.glider.visible = g > 0.02;
    this.glider.scale.set(0.3 + 0.7 * g, 0.3 + 0.7 * g, g);
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
