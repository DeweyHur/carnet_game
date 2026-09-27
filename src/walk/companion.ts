// 길잡이 동료(파이몬처럼): 🧚 리리 — 베레모를 쓰고 별 망토를 두른 작은 요정. 어깨 곁에 떠서 따라다니며
// 둘레를 보고 먼저 말한다(보물상자·순간이동 포인트·깃털·요괴·위험·배고픔·밤). G(또는 🧚)를 누르면 다음에 할 일을 알려 주고
// 그쪽으로 날아가 가리킨다. 같은 이야기는 한동안 되풀이하지 않는다.
import * as THREE from 'three';
import type { Hero } from './hero';
import type { Progress } from './progress';
import type { Explore } from './explore';
import type { Combat } from './combat';
import type { Story } from './street/story';
import { COMMISSION_TEXT } from './progress';
import * as sfx from './sound';

export interface CompanionCtx {
  hero: Hero;
  progress: Progress;
  explore: () => Explore | null;
  combat: () => Combat | null;
  story: () => Story | null;
  say(at: () => { x: number; y: number; z: number }, text: string, secs: number): void;
  hunger(): number;
  night(): number;
  /** 지금 따라가는 곳(빛기둥, 로컬) */
  beacon(): [number, number] | null;
}

const TAU = Math.PI * 2;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Companion {
  private readonly c: CompanionCtx;
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly wingsL: THREE.Mesh;
  private readonly wingsR: THREE.Mesh;
  private x = 0; private y = 0; private z = 0;
  private t = 0;
  private said = new Map<string, number>(); // 주제 → 마지막으로 말한 때(초)
  private quietT = 6; // 아무 말이나 다음까지
  private lookT = 0;
  private point: { x: number; y: number; t: number } | null = null;
  private lastAr = 0;
  private lastHp = 1;
  private placed = false;
  private readonly btn: HTMLButtonElement;
  enabled = true;
  onAsk?: () => void;

  constructor(c: CompanionCtx) {
    this.c = c;
    this.group.name = 'companion';
    this.group.add(this.body);
    const m = (color: number, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color, ...extra });
    const skin = m(0xffe3cf), hair = m(0xf6f4ff, { emissive: 0x2a2a44 }), red = m(0xc8333a), cape = m(0x23336b), gold = m(0xffd35a, { emissive: 0x6a4a00 });
    const B = this.body;
    // 머리(크게) · 흰 머리카락 · 베레모 · 큰 눈
    B.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14).translate(0, 0, 0.26), skin));
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.142, 18, 14, 0, TAU, 0, Math.PI * 0.62).rotateX(Math.PI / 2).translate(0, -0.012, 0.28), hair);
    hairM.rotation.x = 0.45;
    B.add(hairM);
    for (const sx of [-1, 1]) {
      B.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8).scale(0.8, 0.8, 1.4).translate(sx * 0.12, -0.01, 0.2), hair)); // 옆머리
      B.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8).scale(1, 0.5, 1.3).translate(sx * 0.047, 0.118, 0.265), new THREE.MeshBasicMaterial({ color: 0x2b3a8a })));
      B.add(new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6).translate(sx * 0.047 + 0.008, 0.132, 0.278), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    }
    B.add(new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 4, 10, Math.PI).rotateZ(Math.PI).rotateX(Math.PI / 2).translate(0, 0.126, 0.215), new THREE.MeshBasicMaterial({ color: 0x8a3a2a })));
    B.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.145, 0.04, 20).rotateX(Math.PI / 2).translate(0.02, -0.01, 0.4), red)); // 베레모
    B.add(new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6).translate(0.02, -0.01, 0.43), m(0x3a2a20)));
    // 몸 · 별 망토 · 별 왕관
    B.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.1, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.1), m(0xf4f1ea)));
    const capeM = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 16, 1, true).rotateX(-Math.PI / 2).translate(0, -0.02, 0.06), new THREE.MeshToonMaterial({ color: 0x23336b, side: THREE.DoubleSide }));
    capeM.rotation.x = Math.PI;
    capeM.position.z = 0.24;
    B.add(capeM);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; B.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.012), new THREE.MeshBasicMaterial({ color: 0xfff2b0 })).translateX(Math.cos(a) * 0.1).translateY(Math.sin(a) * 0.1 - 0.02).translateZ(0.04 + (k % 3) * 0.04)); }
    void cape;
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 6, 20), gold);
    crown.position.z = 0.5;
    B.add(crown);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.025), gold);
    star.position.z = 0.52;
    B.add(star);
    // 투명한 날개
    const wingGeo = new THREE.CircleGeometry(0.12, 16).scale(0.6, 1, 1).rotateX(Math.PI / 2);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    this.wingsL = new THREE.Mesh(wingGeo, wingMat); this.wingsL.position.set(-0.07, -0.07, 0.2);
    this.wingsR = new THREE.Mesh(wingGeo, wingMat); this.wingsR.position.set(0.07, -0.07, 0.2);
    B.add(this.wingsL, this.wingsR);
    // 반짝임
    const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 64;
    const g2 = glowCv.getContext('2d')!; const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff8'); gr.addColorStop(1, '#fff0'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCv), color: 0xd8e8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(0.9); glow.position.z = 0.26;
    B.add(glow);
    this.body.scale.setScalar(1.25);
    // 🧚 단추(누르면 물어본다)
    this.btn = document.createElement('button');
    this.btn.className = 'lili-btn';
    this.btn.type = 'button';
    this.btn.title = '리리에게 묻기 (G) — 다음에 뭐 하지?';
    this.btn.innerHTML = '🧚<kbd>G</kbd>';
    this.btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.ask(); });
    document.body.appendChild(this.btn);
  }

  private get hero() { return this.c.hero; }
  private at = () => ({ x: this.x, y: this.y, z: this.z + 0.75 });
  /** 말하기(주제마다 cool 초 동안 되풀이하지 않는다) */
  private speak(topic: string, text: string, cool = 60, secs = 3.4) {
    const last = this.said.get(topic);
    if (last !== undefined && this.t - last < cool) return false;
    this.said.set(topic, this.t);
    this.c.say(this.at, text, secs);
    sfx.pop();
    this.quietT = 14 + Math.random() * 10;
    return true;
  }

  // ───────── 매 프레임 ─────────
  update(dt: number, live: boolean) {
    this.t += dt;
    const b = this.hero.body;
    const show = live && this.enabled;
    this.group.visible = show;
    this.btn.classList.toggle('on', show);
    if (!show) return;
    // 어깨 오른쪽 위(카메라 기준)에 떠 있다. 가리키는 중이면 그쪽으로 날아간다
    const yaw = (this.hero.cam.yaw * Math.PI) / 180;
    const rx = Math.cos(yaw), ry = -Math.sin(yaw); // 카메라 오른쪽
    let tx = b.x + rx * 0.75 - Math.sin(yaw) * 0.2, ty = b.y + ry * 0.75 - Math.cos(yaw) * 0.2;
    let tz = b.z + (b.mode === 'swim' ? 0.9 : b.mode === 'glide' ? 1.3 : 1.75);
    if (this.point) {
      this.point.t -= dt;
      const dx = this.point.x - b.x, dy = this.point.y - b.y, L = Math.hypot(dx, dy) || 1, k = Math.min(7, L);
      tx = b.x + (dx / L) * k; ty = b.y + (dy / L) * k; tz = b.z + 2.6;
      if (this.point.t <= 0) this.point = null;
    }
    if (!this.placed || Math.hypot(tx - this.x, ty - this.y) > 40) { this.x = tx; this.y = ty; this.z = tz; this.placed = true; }
    const k = 1 - Math.exp(-dt * (this.point ? 3 : 5));
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k; this.z += (tz - this.z) * k;
    this.group.position.set(this.x, this.y, this.z + Math.sin(this.t * 2.2) * 0.07);
    // 보는 쪽: 가리키면 그쪽, 아니면 카메라 쪽(얼굴이 보이게)
    const face = this.point ? Math.atan2(this.point.x - this.x, this.point.y - this.y) : yaw + Math.PI;
    this.body.rotation.z = -face + Math.sin(this.t * 0.9) * 0.15;
    this.body.rotation.x = Math.sin(this.t * 1.7) * 0.06;
    const flap = Math.sin(this.t * 22) * 0.6;
    this.wingsL.rotation.y = 0.5 + flap; this.wingsR.rotation.y = -0.5 - flap;
    this.lookT -= dt;
    if (this.lookT <= 0 && !this.hush) { this.lookT = 0.8; this.observe(); }
  }

  /** 둘레를 보고 먼저 말한다 */
  private observe() {
    const b = this.hero.body, P = this.c.progress, X = this.c.explore(), C = this.c.combat();
    // 싸움
    if (C) {
      const hp = C.hp / C.maxHp;
      const foes = C.list().filter((f) => f.state !== 'dead');
      const boss = foes.find((f) => f.kind === 'boss');
      const windup = foes.find((f) => f.state === 'windup' && Math.hypot(f.x - b.x, f.y - b.y) < (f.kind === 'boss' ? 8 : 4));
      if (windup && this.speak('dodge', windup.kind === 'boss' ? '빨간 원! 얼른 굴러서(V) 피해!' : '온다! V로 굴러!', 7, 1.8)) return;
      if (hp < 0.3 && this.lastHp >= 0.3 && this.speak('lowhp', '위험해! 물러나서 순간이동 포인트로 가면 다 나아!', 30)) { this.lastHp = hp; return; }
      this.lastHp = hp;
      if (boss && boss.state !== 'idle' && this.speak('boss', '저, 저건 노트르담의 큰 가고일이야! 빨간 원이 보이면 피해야 해!', 120)) return;
      const aggro = foes.filter((f) => f.state === 'chase' || f.state === 'windup' || f.state === 'dash');
      if (aggro.length && this.speak('fight', pick(['요괴다! 톡톡 때리고, E로 소용돌이!', '에너지가 차면 Q! 회오리로 한 방에!', '리리는 뒤에서 응원할게! 힘내!']), 40)) return;
      const idle = foes.filter((f) => f.state === 'idle' && Math.hypot(f.x - b.x, f.y - b.y) < 30);
      if (idle.length && this.speak(`camp`, idle.length > 1 ? '저기 요괴들이 상자를 지키고 있어… 다 물리치면 봉인이 풀려!' : '저기 요괴가 있어!', 90)) return;
    }
    // 모험 등급
    if (this.lastAr && P.ar > this.lastAr && this.speak('rank', `모험 등급 ${P.ar}! 우와, 대단해! 리리도 덩달아 신나!`, 5)) { this.lastAr = P.ar; return; }
    this.lastAr = P.ar;
    if (b.mode === 'swim' && this.speak('swim', '리리는 물에 젖는 거 싫어… 빨리 나가자!', 120)) return;
    if (b.mode === 'climb' && b.stamina < 0.25 && this.speak('climbtired', '기력이 바닥이야! 떨어지기 전에 턱에서 쉬자!', 40)) return;
    // 탐험: 가까운 상자·포인트·깃털
    if (X) {
      const list = X.list().map((e) => ({ ...e, d: Math.hypot(e.x - b.x, e.y - b.y), dz: e.z - b.z }));
      const chest = list.filter((e) => e.kind === 'chest' && e.d < 26 && !e.locked).sort((a, c) => a.d - c.d)[0];
      if (chest && this.speak(`chest:${chest.key}`, chest.dz > 5 ? '저 위에 보물상자가 반짝여! 올라가 보자!' : pick(['저기 보물상자다! 반짝반짝!', '상자다! 빨리 열어 보자, 뭐가 들었을까?']), 9999)) { this.flyTo(chest.x, chest.y, 2.5); return; }
      const wp = list.filter((e) => e.kind === 'waypoint' && e.key.startsWith('wp-') && !P.waypoints.has(e.key) && e.d < 70).sort((a, c) => a.d - c.d)[0];
      if (wp && this.speak(`wp:${wp.key}`, '저기 순간이동 포인트가 있어! 가까이 가서 켜 두면 언제든 날아올 수 있어!', 9999)) { this.flyTo(wp.x, wp.y, 2.5); return; }
      const plume = list.filter((e) => e.kind === 'plume' && e.d < 45).sort((a, c) => a.d - c.d)[0];
      if (plume && this.speak(`plume:${plume.key}`, '바람 깃털이다! 모아서 잔 다르크 성상에 바치면 기력이 커져!', 9999)) { this.flyTo(plume.x, plume.y, 2.5); return; }
      const cat = list.find((e) => e.kind === 'cat' && e.d < 20);
      if (cat && this.speak(`cat:${cat.key}`, '검은 고양이…? 따라와 달라는 것 같아!', 9999)) return;
      const orb = list.find((e) => e.kind === 'challenge' && e.d < 15);
      if (orb && this.speak(`orb:${orb.key}`, '빛나는 받침이야! F로 도전을 시작해 볼까?', 9999)) return;
    }
    // 메인 이벤트가 가까우면
    const st = this.c.story();
    if (st) {
      for (const [id] of [['m-eiffel'], ['m-arc'], ['m-louvre'], ['m-notre-dame'], ['m-sacre-coeur']]) {
        const ch = st.run(id).ch;
        if (st.done.has(id) || st.started.has(id)) continue;
        if (st.distTo(ch) < 180 && this.speak(`main:${id}`, `${st.landmarkName(ch)}이다! ⭐ 표시가 붙은 사람이 도움을 구하고 있어!`, 9999)) return;
      }
    }
    // 몸 상태
    if (this.c.hunger() > 70 && this.speak('hungry', pick(['배고파… 크레프 먹자, 크레프! 리리는 비상식량 아니야!', '꼬르륵… 저기 빵집 없나?']), 150)) return;
    if (this.c.night() > 0.6 && this.speak('night', '밤이 됐어… 가고일들이 날아다니니까 조심해!', 400)) return;
    // 한참 조용하면: 요령 하나
    this.quietT -= 0.8;
    if (this.quietT <= 0) {
      const tips = [
        'G를 누르면 리리가 다음에 할 일을 알려 줄게!',
        'J를 누르면 파리 수첩! 오늘의 의뢰도 거기 있어.',
        '높은 데서 뛰어내리다 공격하면 내려찍기! 엄청 세!',
        '별조각이 모이면 ✨ 기원! 5★ 나비 글라이더 갖고 싶다…',
        '지도(M)에서 🔷를 누르면 순간이동! 걷기 귀찮을 땐 그거야.',
        '벽을 오를 땐 턱에서 쉬어 가야 해. 기력 바퀴를 잘 봐!',
        '공원이나 광장에 가면 요괴 야영지가 있을지도 몰라.',
      ];
      const com = P.commissions.find((x) => !x.done);
      if (com) tips.push(`오늘의 의뢰: ${COMMISSION_TEXT[com.kind](com.goal)} — 아직 남았어!`);
      this.speak(`tip:${Math.floor(this.t / 30)}`, pick(tips), 0, 4);
    }
  }

  /** 바로 말한다(프롤로그 안내) — 쿨타임 없이, 그쪽을 가리키며 */
  line(text: string, secs = 4.5, at?: [number, number]) {
    this.c.say(this.at, text, secs);
    sfx.pop();
    this.quietT = 20;
    if (at) this.flyTo(at[0], at[1], 3);
  }
  /** 프롤로그 동안엔 알아서 떠들지 않는다 */
  hush = false;

  private flyTo(x: number, y: number, secs: number) { this.point = { x, y, t: secs }; }

  /** 반가운 첫인사 */
  greet(first: boolean) {
    this.speak('hello', first ? '안녕! 나는 리리, 파리의 요정이야. 길 안내는 나한테 맡겨! 궁금하면 G!' : pick(['다시 왔구나! 오늘은 어디로 갈까?', '보고 싶었어! 파리 산책 계속하자!']), 9999, 5);
  }

  /** G: 다음에 할 일 */
  ask() {
    const b = this.hero.body, P = this.c.progress, C = this.c.combat(), X = this.c.explore(), st = this.c.story();
    this.onAsk?.();
    this.said.delete('ask');
    if (C?.inCombat) { this.speak('ask', '지금은 요괴부터! 톡톡 때리고, E 소용돌이, 에너지 차면 Q!', 0); return; }
    const bc = this.c.beacon();
    if (st?.tracked && !st.done.has(st.tracked)) {
      const ch = st.run(st.tracked).ch;
      this.speak('ask', `${ch.main ? '⭐' : '📝'} ${ch.title}: ${st.lineOf(ch)}`, 0, 5);
      if (bc) this.flyTo(bc[0], bc[1], 3.5);
      return;
    }
    const list = X?.list().map((e) => ({ ...e, d: Math.hypot(e.x - b.x, e.y - b.y) })) ?? [];
    const wp = list.filter((e) => e.kind === 'waypoint' && e.key.startsWith('wp-') && !P.waypoints.has(e.key) && e.d < 400).sort((a, c) => a.d - c.d)[0];
    const chest = list.filter((e) => e.kind === 'chest' && e.d < 200).sort((a, c) => a.d - c.d)[0];
    if (chest) { this.speak('ask', `이쪽에 보물상자가 있어! ${Math.round(chest.d)} m쯤!${chest.locked ? ' 요괴들이 지키고 있으니까 조심!' : ''}`, 0, 4); this.flyTo(chest.x, chest.y, 3.5); return; }
    if (wp) { this.speak('ask', `저쪽에 아직 안 켠 순간이동 포인트가 있어. ${Math.round(wp.d)} m!`, 0, 4); this.flyTo(wp.x, wp.y, 3.5); return; }
    const com = P.commissions.find((x) => !x.done);
    if (com) { this.speak('ask', `오늘의 의뢰가 남았어: ${COMMISSION_TEXT[com.kind](com.goal)} (${Math.round(com.got)}/${com.goal})`, 0, 4.5); return; }
    this.speak('ask', 'J를 눌러 수첩을 보자! 아직 못 가 본 랜드마크가 많아!', 0, 4);
  }
}
