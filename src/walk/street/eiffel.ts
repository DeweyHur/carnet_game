// 에펠탑 둘레에서만 생기는 일들. 게임이 탑 위에서 시작하니, 내려앉자마자 할 거리가 있어야 한다.
//  🎩 1층으로 날아간 모자   🏃 2층까지 3분 도전   📸 트로카데로에서 탑 전체 한 장
//  🧺 샹드마르스 소풍(잃어버린 와인 따개)   ⛴️ 센 강 유람선   🎠 회전목마   🗼 기념품 장수
//  ✨ 밤마다 정시 5분 반짝이는 탑   🟡 (숨은 것) 꼭대기에 바로 내려앉으면 금빛 낙하산
import * as THREE from 'three';
import type { Npc } from '../town/crowd';
import type { StreetCtx } from './index';
import type { StreetUi, Anchor } from './ui';
import { EIFFEL_POS, ax } from '../eiffel';
import * as sfx from '../sound';

export interface EiffelHost {
  readonly ui: StreetUi;
  readonly c: StreetCtx;
  readonly items: THREE.Group;
  helped(what: string): void;
}

type QuestId = 'hat' | 'race' | 'photo' | 'picnic';
type GiverId = QuestId | 'boat' | 'carrousel' | 'hawker1' | 'hawker2';

interface Giver { id: GiverId; name: string; role: Npc['role']; at: [number, number]; facing: number; sit?: boolean; npc: Npc | null; called: boolean }

const bearingOf = (x: number, y: number) => ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
const angleDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AXIS = 133.6; // 샹드마르스 축(남동) 방위

export class EiffelQuests {
  private readonly h: EiffelHost;
  private frameRef: unknown = null;
  private tower: [number, number] = [0, 0];
  /** 탑이 선 땅 높이 */
  private towerZ = 0;
  private givers: Giver[] = [
    { id: 'hat', name: '마고 (관광객)', role: 'tourist', at: [70, -118], facing: AXIS + 180, npc: null, called: false },
    { id: 'race', name: '야니스 (파쿠르)', role: 'jogger', at: [-88, 58], facing: AXIS, npc: null, called: false },
    { id: 'photo', name: '클레르 (사진가)', role: 'tourist', at: [-640, 26], facing: AXIS, npc: null, called: false },
    { id: 'picnic', name: '루이즈 (소풍)', role: 'sitter', at: [452, 48], facing: AXIS + 90, sit: true, npc: null, called: false },
    { id: 'boat', name: '선착장 매표원', role: 'passer', at: [-140, 128], facing: AXIS + 180, npc: null, called: false },
    { id: 'carrousel', name: '회전목마 주인', role: 'passer', at: [-121, -48], facing: AXIS, npc: null, called: false },
    { id: 'hawker1', name: '기념품 장수', role: 'passer', at: [-92, -24], facing: AXIS, npc: null, called: false },
    { id: 'hawker2', name: '기념품 장수', role: 'passer', at: [104, 40], facing: AXIS + 180, npc: null, called: false },
  ];
  private friends: Npc[] = []; // 소풍 친구들
  readonly done = new Set<QuestId>();
  active: QuestId | null = null;
  private raceT = 0;
  private item: { kind: 'hat' | 'cork'; x: number; y: number; z: number; mesh: THREE.Object3D; held: boolean } | null = null;
  private blanket: THREE.Object3D | null = null;
  private ride: { t: number; a: number } | null = null;
  private sparkle: THREE.Points | null = null;
  private sparkleMat: THREE.ShaderMaterial | null = null;
  sawSparkle = false;
  souvenirs = 0;
  boated = false;
  goldenFound = false;
  private highGlide = 0;
  private burst: { pts: THREE.Points; t: number } | null = null;
  private lastLine = '';

  constructor(h: EiffelHost) { this.h = h; }

  private get hero() { return this.h.c.hero; }
  private loc(u: number, v: number): [number, number] { return this.hero.frame.toLocal(ax(u, v)); }

  /** 원점이 바뀌면(동네 이동) 로컬 좌표로 만든 것들을 다시 놓는다 */
  private refresh() {
    if (this.frameRef === this.hero.frame) return;
    this.frameRef = this.hero.frame;
    this.tower = this.hero.frame.toLocal(EIFFEL_POS);
    this.towerZ = this.hero.world.relief.hill(this.tower[0], this.tower[1]);
    for (const g of this.givers) g.npc = null;
    this.friends = [];
    if (this.blanket) { this.h.items.remove(this.blanket); this.blanket = null; }
    if (this.item && !this.item.held) { this.h.items.remove(this.item.mesh); this.item = null; if (this.active === 'hat' || this.active === 'picnic') this.active = null; }
    if (this.sparkle) { this.h.items.remove(this.sparkle); this.sparkle = null; }
  }

  /** 탑에서 이만큼 안이면 에펠탑 둘레 */
  near(r = 900) { const b = this.hero.body; return Math.hypot(b.x - this.tower[0], b.y - this.tower[1]) < r; }

  owns(n: Npc) { return !!n.tag?.startsWith('eiffel:'); }
  giverOf(n: Npc) { return this.givers.find((g) => g.npc === n) ?? null; }

  label(n: Npc): [string, string, string] | null {
    const g = this.giverOf(n);
    if (!g) return null;
    const q = (g.id === 'hat' || g.id === 'race' || g.id === 'photo' || g.id === 'picnic') && !this.done.has(g.id) ? '❗' : g.id === 'boat' ? '⛴️' : g.id === 'carrousel' ? '🎠' : g.id.startsWith('hawker') ? '🗼' : '🙂';
    return [q, g.name, this.done.has(g.id as QuestId) ? '고마워함' : ''];
  }
  verb(n: Npc): string | null {
    const g = this.giverOf(n);
    if (!g) return null;
    if (g.id === 'boat') return '유람선 타기 €17';
    if (g.id === 'carrousel') return '회전목마 타기 €3';
    if (g.id.startsWith('hawker')) return '기념품 보기';
    if (this.active === g.id && this.item?.held) return '돌려주기';
    return '말 걸기';
  }

  get beacon(): [number, number] | null {
    if (this.active === 'hat' && this.item && !this.item.held) return [this.item.x, this.item.y];
    if (this.active === 'hat' && this.item?.held) { const n = this.givers[0].npc; return n ? [n.x, n.y] : null; }
    if (this.active === 'race') return this.tower;
    if (this.active === 'picnic' && this.item?.held) { const n = this.givers[3].npc; return n ? [n.x, n.y] : null; }
    return null;
  }

  // ───────── 매 프레임 ─────────
  update(dt: number) {
    this.refresh();
    const h = this.hero, b = h.body;
    const dTower = Math.hypot(b.x - this.tower[0], b.y - this.tower[1]);
    this.secret(dt, dTower);
    this.twinkle(dt, dTower);
    if (this.burst) this.stepBurst(dt);
    // 탑 둘레엔 관광객이 많다
    const want: typeof h.crowd.walkerRoles = dTower < 700 ? [['tourist', 45], ['passer', 30], ['jogger', 10], ['kid', 8], ['dogwalker', 4], ['cyclist', 3]] : [['passer', 50], ['tourist', 18], ['jogger', 8], ['dogwalker', 8], ['cyclist', 8], ['kid', 8]];
    if (h.crowd.walkerRoles[0][0] !== want[0][0]) h.crowd.walkerRoles = want;
    this.placeGivers();
    if (this.ride) this.stepRide(dt);
    this.stepItem();
    if (this.active === 'race') {
      this.raceT -= dt;
      if (b.z - this.towerZ >= 113 && dTower < 30) this.finish('race', '2층까지 3분 안에 올라갔다', 20, 'Incroyable ! Tu grimpes comme un chat !');
      else if (this.raceT <= 0) { this.active = null; this.line(''); this.h.c.toast('⏱ 시간 초과 — 야니스에게 다시 말을 걸면 또 도전할 수 있다'); sfx.exhausted(); }
      else this.line(`🏃 2층(115 m)까지 ${Math.ceil(this.raceT)}초 — 다리를 타고 올라가자 (지금 ${Math.round(b.z - this.towerZ)} m)`);
    }
  }

  private line(s: string) { if (s !== this.lastLine) { this.lastLine = s; this.h.ui.questLine(s); } }

  /** 가까워지면 퀘스트 주는 사람들을 세운다(멀어져 사라졌으면 다시) */
  private placeGivers() {
    const h = this.hero, b = h.body;
    for (const g of this.givers) {
      const [x, y] = this.loc(g.at[0], g.at[1]);
      const d = Math.hypot(x - b.x, y - b.y);
      if (g.npc && !h.crowd.npcs.includes(g.npc)) g.npc = null;
      if (!g.npc && d < 110) { // 사람들은 125 m 밖에서 사라진다 — 그보다 안쪽에서 세운다
        const z = (g.sit ? 0.12 : 0) + h.world.terrain(x, y); // 잔디 둔덕 위
        g.npc = h.crowd.spawn(g.role, x, y, g.facing, { state: g.sit ? 'sit' : 'stand', anchor: { x, y, z, facing: g.facing }, home: null, speed: 0, tag: `eiffel:${g.id}` });
        g.npc.z = z;
        if (g.id === 'picnic') this.setPicnic(x, y);
      }
      // 처음 가까이 오면 불러 세운다
      if (g.npc && !g.called && d < 22 && b.mode === 'ground' && (g.id === 'hat' || g.id === 'race' || g.id === 'photo' || g.id === 'picnic') && !this.done.has(g.id)) {
        g.called = true;
        const call = { hat: 'Oh non, mon chapeau !', race: 'Hé ! Tu grimpes ?', photo: 'Excusez-moi, vous avez une minute ?', picnic: 'Quelqu’un a vu notre tire-bouchon ?' }[g.id];
        this.h.ui.say(this.at(g.npc), call, 3, '', g.npc.id);
        h.crowd.gesture(g.npc, 'wave', 2);
        sfx.spot();
      }
      if (g.id.startsWith('hawker') && g.npc && d < 9 && Math.random() < 0.004) this.h.ui.say(this.at(g.npc), 'Tour Eiffel, un euro ! One euro !', 2.2, '', g.npc.id);
    }
  }

  private setPicnic(x: number, y: number) {
    const h = this.hero;
    if (!this.blanket) {
      const g = new THREE.Group();
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), new THREE.MeshBasicMaterial({ color: 0xd94a3b }));
      const check = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.35), new THREE.MeshBasicMaterial({ color: 0xf4efe2 }));
      check.position.set(0, 0.45, 0.005);
      const check2 = check.clone(); check2.position.y = -0.45;
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.3).translate(0, 0, 0.15), new THREE.MeshToonMaterial({ color: 0xa8773e }));
      basket.position.set(0.6, 0.2, 0);
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.34, 8).rotateX(Math.PI / 2).translate(0, 0, 0.17), new THREE.MeshToonMaterial({ color: 0x3d5a2a }));
      bottle.position.set(-0.3, -0.2, 0);
      const bread = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.55, 3, 8).rotateZ(Math.PI / 2).translate(0, 0, 0.07), new THREE.MeshToonMaterial({ color: 0xd6a25a }));
      bread.position.set(0.1, -0.4, 0);
      g.add(cloth, check, check2, basket, bottle, bread);
      g.position.set(x + 1.2, y, h.world.terrain(x + 1.2, y) + 0.06);
      this.blanket = g;
      this.h.items.add(g);
    }
    // 친구 둘
    this.friends = this.friends.filter((n) => h.crowd.npcs.includes(n));
    if (!this.friends.length) {
      for (const [dx, dy, f] of [[2.4, 0.8, 250], [2.2, -0.9, 300]] as const) {
        const fz = 0.12 + h.world.terrain(x + dx, y + dy);
        const n = h.crowd.spawn('sitter', x + dx, y + dy, f, { state: 'sit', anchor: { x: x + dx, y: y + dy, z: fz, facing: f }, home: null, speed: 0, tag: 'eiffel:friend' });
        n.z = fz;
        this.friends.push(n);
      }
    }
  }

  private at(n: Npc): () => Anchor { return () => ({ x: n.x, y: n.y, z: n.z + 2.1 * n.scale + (n.state === 'sit' ? -0.7 : 0) }); }

  // ───────── 말 걸기 ─────────
  async talk(n: Npc) {
    const g = this.giverOf(n);
    if (!g) { this.h.ui.say(this.at(n), 'On pique-nique ! Santé !', 2.2, '', n.id); return; }
    const h = this.hero, b = h.body, ui = this.h.ui, c = this.h.c;
    b.facing = bearingOf(n.x - b.x, n.y - b.y);
    n.greeted = true;
    switch (g.id) {
      case 'hat': {
        if (this.done.has('hat')) { ui.say(this.at(n), 'Merci encore ! 🎩', 2); return; }
        if (this.active === 'hat' && this.item?.held) { this.h.items.remove(this.item.mesh); this.item = null; this.finish('hat', '1층에 걸린 모자를 찾아 줬다', 12, 'Mon chapeau ! Vous êtes un ange !'); return; }
        const i = await ui.talk(g.name, 'Le vent a emporté mon chapeau… il est là-haut, au premier étage !', '바람에 모자가 날아가 탑 1층(58 m)에 걸렸어요… 엘리베이터 줄은 두 시간이래요. 다리를 타고 올라가 볼 수 있어요?', ['찾아 올게요', '다음에요']);
        if (i !== 0) return;
        this.start('hat');
        const [x, y] = this.loc(20, -26);
        this.item = { kind: 'hat', x, y, z: 58 + this.towerZ, mesh: hatMesh(), held: false };
        this.h.items.add(this.item.mesh);
        this.line('🎩 1층(58 m)에 걸린 모자를 가져오자 — 탑 다리를 타고 오르거나, 위에서 글라이더로 내려앉기');
        return;
      }
      case 'race': {
        if (this.done.has('race')) { ui.say(this.at(n), 'Le chat de la tour Eiffel ! 🐈', 2); return; }
        const i = await ui.talk(g.name, 'Deuxième étage en trois minutes. Chiche ?', '2층(115 m)까지 3분 안에 올라갈 수 있어? 나는 2분 40초였어. 계단은 반칙 — 다리를 타는 거야.', ['해 볼게!', '무리야']);
        if (i !== 0) return;
        this.start('race');
        this.raceT = 180;
        h.crowd.gesture(n, 'point', 3);
        sfx.questStart();
        return;
      }
      case 'photo': {
        if (this.done.has('photo')) { ui.say(this.at(n), 'Magnifique, votre photo !', 2); return; }
        const i = await ui.talk(g.name, 'Une photo de la tour entière, d’ici. La lumière est parfaite.', '여기 트로카데로 광장에서 탑 전체가 들어오게 한 장 찍어 줄래요? 잘 나오면 제가 사요. 탑을 정면으로 보고 3(사진).', ['찍어 볼게요', '괜찮아요']);
        if (i !== 0) return;
        this.start('photo');
        this.line('📸 트로카데로 광장에서 탑을 정면으로 보고 3(사진)');
        return;
      }
      case 'picnic': {
        if (this.done.has('picnic')) { await this.sitPicnic(n); return; }
        if (this.active === 'picnic' && this.item?.held) { this.h.items.remove(this.item.mesh); this.item = null; this.finish('picnic', '소풍 온 사람들의 와인 따개를 찾아 줬다', 0, 'Le tire-bouchon ! Assieds-toi avec nous !'); await wait(900); await this.sitPicnic(n); return; }
        const i = await ui.talk(g.name, 'On a perdu notre tire-bouchon quelque part sur la pelouse…', '잔디밭 어딘가에 와인 따개를 떨어뜨렸어요… 아까 저쪽(탑 반대편)으로 공놀이하러 갔었는데. 반짝이는 걸 찾아 주면 같이 먹어요!', ['찾아 볼게요', '다음에요']);
        if (i !== 0) return;
        this.start('picnic');
        // 잔디밭 어딘가(길은 피해서)
        const u = 540 + Math.random() * 180, v = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 55);
        const [x, y] = this.loc(u, v);
        this.item = { kind: 'cork', x, y, z: h.world.terrain(x, y), mesh: corkMesh(), held: false };
        this.h.items.add(this.item.mesh);
        h.crowd.gesture(n, 'point', 3);
        n.facing = bearingOf(x - n.x, y - n.y);
        this.line('🧺 샹드마르스 잔디밭에서 반짝이는 와인 따개를 찾자 (에콜 밀리테르 쪽)');
        return;
      }
      case 'boat': {
        const i = await ui.talk(g.name, 'Une heure sur la Seine, jusqu’à Notre-Dame. Dix-sept euros.', '센 강 한 시간 — 노트르담까지 갔다 돌아와요. 17유로. 해 질 녘이 제일 좋아요.', ['타요 (€17)', '다음에요']);
        if (i !== 0 || !c.pay(17, '센 강 유람선')) return;
        await this.cruise();
        return;
      }
      case 'carrousel': {
        const i = await ui.talk(g.name, 'Un tour ? Trois euros. Les grands aussi !', '한 바퀴 3유로. 어른도 타요!', ['타요 (€3)', '괜찮아요']);
        if (i !== 0 || !c.pay(3, '회전목마')) return;
        this.startRide();
        return;
      }
      case 'hawker1': case 'hawker2': {
        const i = await ui.talk(g.name, 'Tour Eiffel ! Cinq pour deux euros ! Très jolie !', '미니 에펠탑 다섯 개 2유로! (허가 없이 파는 장수다. 경찰이 오면 순식간에 사라진다.)', ['하나 살게요 (€2)', '괜찮아요']);
        if (i !== 0 || !c.pay(2, '미니 에펠탑')) return;
        this.souvenirs++;
        sfx.coin();
        ui.say(this.at(n), 'Merci ! Bonne journée !', 2, '', n.id);
        c.toast('🗼 미니 에펠탑 다섯 개를 샀다 — 공식 기념품점보다 싸지만, 파리 사람들은 잘 안 산다');
        return;
      }
    }
  }

  private start(id: QuestId) {
    // 하던 부탁을 두고 새 부탁을 받으면 앞의 물건은 치운다
    if (this.item) { this.h.items.remove(this.item.mesh); this.item = null; }
    this.active = id;
    this.line('');
    sfx.questStart();
  }

  private finish(id: QuestId, what: string, eur: number, fr: string) {
    const g = this.givers.find((x) => x.id === id)!;
    this.done.add(id);
    this.active = null;
    this.line('');
    if (g.npc) { this.h.ui.say(this.at(g.npc), fr, 3, '', g.npc.id); this.hero.crowd.gesture(g.npc, 'clap', 2.5); }
    if (eur) this.h.c.S.money = Math.round((this.h.c.S.money + eur) * 100) / 100;
    this.h.helped(what);
    sfx.questDone();
    this.h.c.toast(`✨ ${what}${eur ? ` · 고맙다며 €${eur}` : ''}`);
    if (this.done.size === 4) setTimeout(() => { sfx.fanfare(); this.h.c.toast('🗼 에펠탑 둘레의 부탁을 전부 들어줬다!'); }, 2500);
  }

  // ───────── 물건 줍기 ─────────
  private stepItem() {
    const it = this.item;
    if (!it) return;
    const b = this.hero.body;
    const t = performance.now() / 1000;
    if (it.held) { it.mesh.visible = false; return; }
    it.mesh.position.set(it.x, it.y, it.z + (it.kind === 'hat' ? 0.05 : 0.02));
    it.mesh.rotation.z = t * (it.kind === 'cork' ? 0.8 : 0.3);
    const glint = it.mesh.userData.glint as THREE.Mesh | undefined;
    if (glint) glint.visible = Math.sin(t * 5 + it.x) > 0.6;
    if (Math.hypot(it.x - b.x, it.y - b.y) < 1.5 && Math.abs(it.z - b.z) < 2.2 && b.mode !== 'climb') {
      it.held = true;
      sfx.grab();
      this.h.c.toast(it.kind === 'hat' ? '🎩 모자를 찾았다! 마고에게 돌려주자 (뛰어내려 글라이더로)' : '🍷 와인 따개를 찾았다! 루이즈에게 가져가자');
      this.line(it.kind === 'hat' ? '🎩 모자를 마고에게 돌려주자' : '🧺 와인 따개를 루이즈에게 가져가자');
    }
  }

  /** 사진이 찍혔다 — 트로카데로 부탁이면 라벨을 돌려준다 */
  onShutter(yaw: number): string | null {
    const b = this.hero.body;
    const dT = Math.hypot(b.x - this.tower[0], b.y - this.tower[1]);
    const facing = Math.abs(angleDiff(yaw, bearingOf(this.tower[0] - b.x, this.tower[1] - b.y))) < 14;
    if (this.active === 'photo') {
      const g = this.givers[2].npc;
      const close = g && Math.hypot(g.x - b.x, g.y - b.y) < 90;
      if (close && facing && dT > 450) { this.finish('photo', '트로카데로에서 탑 사진을 찍어 줬다', 8, 'Parfait ! Je vous l’achète !'); return '트로카데로에서 본 에펠탑'; }
      if (close && !facing) this.h.c.toast('탑이 한가운데 오게 — 탑 쪽을 정면으로 보고 찍자');
    }
    if (facing && dT < 6000) return dT < 150 ? '올려다본 에펠탑' : b.z > 50 ? '높은 데서 본 에펠탑' : '에펠탑';
    return null;
  }

  // ───────── 소풍 ─────────
  private async sitPicnic(n: Npc) {
    const b = this.hero.body, c = this.h.c;
    if (!this.blanket) return;
    const p = this.blanket.position;
    if (!b.sit({ x: p.x - 0.4, y: p.y + 0.2, z: p.z + 0.06, facing: bearingOf(n.x - p.x, n.y - p.y) })) return;
    sfx.sit();
    await wait(800);
    this.h.ui.say(this.at(n), 'Un peu de fromage ? Du pain ?', 2.5, '', n.id);
    c.eat(22);
    c.rest(14);
    c.passTime(25);
    b.carry = 'baguette';
    setTimeout(() => { if (b.carry === 'baguette') b.carry = null; }, 20000);
    c.toast('🧺 잔디에 앉아 치즈와 바게트를 나눠 먹었다 (허기 −22 · 지침 −14 · 25분)');
  }

  // ───────── 유람선 ─────────
  private async cruise() {
    const c = this.h.c, ui = this.h.ui, h = this.hero;
    sfx.chime();
    await ui.fade(true, '#1d3550');
    this.hero.body.sit(null);
    c.passTime(60);
    c.rest(18);
    this.boated = true;
    // 배에서 돌아오며 강 위에서 본 탑 — 카메라를 강 쪽으로 돌려 한 장
    h.cam.yaw = bearingOf(this.tower[0] - h.body.x, this.tower[1] - h.body.y);
    h.cam.pitch = 6;
    await ui.fade(false);
    await wait(500);
    c.shot('센 강 유람선에서 본 에펠탑');
    c.toast('⛴️ 한 시간 동안 센 강을 따라 노트르담까지 갔다 왔다 (지침 −18)');
  }

  // ───────── 회전목마 ─────────
  private startRide() {
    const b = this.hero.body;
    const [cx, cy] = this.hero.frame.toLocal([2.29268, 48.85871]);
    const a = Math.atan2(b.y - cy, b.x - cx);
    if (!b.sit({ x: cx + Math.cos(a) * 4.2, y: cy + Math.sin(a) * 4.2, z: 0.9, facing: 0 })) return;
    this.ride = { t: 0, a };
    sfx.sit();
    sfx.music(1);
  }
  private stepRide(dt: number) {
    const r = this.ride!, b = this.hero.body;
    if (b.mode !== 'sit' || r.t > 18) { this.ride = null; sfx.music(0); if (r.t > 18) { this.h.c.rest(3); this.h.c.toast('🎠 한 바퀴… 아니 열 바퀴 돌았다'); } return; }
    r.t += dt;
    r.a += dt * 0.7; // 지붕과 같은 빠르기
    const [cx, cy] = this.hero.frame.toLocal([2.29268, 48.85871]);
    b.x = cx + Math.cos(r.a) * 4.2; b.y = cy + Math.sin(r.a) * 4.2;
    b.z = 0.9 + Math.sin(r.t * 2.2) * 0.25; // 말이 오르내린다
    b.facing = (bearingOf(-Math.sin(r.a), Math.cos(r.a)) + 360) % 360;
  }

  // ───────── 숨은 것: 꼭대기에 바로 내려앉기 ─────────
  private secret(dt: number, dTower: number) {
    const b = this.hero.body;
    if (b.golden) return;
    // 낙하산·글라이더로 탑 위를 날고 있었나(기어 올라온 게 아니라)
    const rz = b.z - this.towerZ;
    if ((b.mode === 'glide' || b.mode === 'air') && rz > 278) this.highGlide = 3;
    else this.highGlide = Math.max(0, this.highGlide - dt);
    if ((b.mode === 'ground' || b.mode === 'roll') && this.highGlide > 0 && rz > 270 && dTower < 12) { // 다치며 떨어진 건 '잘' 내려앉은 게 아니다
      // 알림 없이: 반짝임 한 번, 작은 종소리, 그리고 천이 금빛으로
      b.golden = true;
      this.goldenFound = true;
      sfx.chime();
      this.spawnBurst(b.x, b.y, b.z + 1.5);
    }
  }
  private spawnBurst(x: number, y: number, z: number) {
    const N = 90;
    const pos = new Float32Array(N * 3), vel: number[] = [];
    for (let i = 0; i < N; i++) {
      pos.set([x, y, z], i * 3);
      const t = Math.random() * Math.PI * 2, p = Math.random() * Math.PI * 0.5;
      const s = 3 + Math.random() * 4;
      vel.push(Math.cos(t) * Math.cos(p) * s, Math.sin(t) * Math.cos(p) * s, Math.sin(p) * s + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd966, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.userData.vel = vel;
    this.h.items.add(pts);
    this.burst = { pts, t: 0 };
  }
  private stepBurst(dt: number) {
    const bu = this.burst!;
    bu.t += dt;
    const a = bu.pts.geometry.attributes.position as THREE.BufferAttribute;
    const vel = bu.pts.userData.vel as number[];
    for (let i = 0; i < a.count; i++) {
      vel[i * 3 + 2] -= 6 * dt;
      a.setXYZ(i, a.getX(i) + vel[i * 3] * dt, a.getY(i) + vel[i * 3 + 1] * dt, a.getZ(i) + vel[i * 3 + 2] * dt);
    }
    a.needsUpdate = true;
    (bu.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - bu.t / 2.2);
    if (bu.t > 2.2) { this.h.items.remove(bu.pts); bu.pts.geometry.dispose(); this.burst = null; }
  }

  // ───────── 밤마다 정시 5분, 탑이 반짝인다 ─────────
  private twinkle(_dt: number, dTower: number) {
    const hour = (this.h.c.S.clock / 60) % 24, minute = this.h.c.S.clock % 60;
    const on = (hour >= 21 || hour < 2) && minute < 5 && dTower < 7000;
    if (!on) { if (this.sparkle) this.sparkle.visible = false; return; }
    if (!this.sparkle) this.buildSparkle();
    this.sparkle!.visible = true;
    this.sparkleMat!.uniforms.uT.value = performance.now() / 1000;
    if (!this.sawSparkle && dTower < 2500) { this.sawSparkle = true; this.h.c.toast('✨ 에펠탑이 반짝인다 — 밤마다 정시에 5분'); sfx.chime(); }
  }
  private buildSparkle() {
    const [tx, ty] = this.tower;
    const pts: number[] = [], ph: number[] = [];
    const rot = ((90 - 44) * Math.PI) / 180, c = Math.cos(rot), s = Math.sin(rot);
    const put = (lx: number, ly: number, z: number) => { pts.push(tx + lx * c - ly * s, ty + lx * s + ly * c, z + this.towerZ); ph.push(Math.random() * 100); };
    // 다리 넷(0~57 m), 1~2층 사이(57~115 m), 몸통(115~277 m) — 단면 둘레에 흩뿌린다
    for (let i = 0; i < 1400; i++) {
      const z = Math.pow(Math.random(), 0.8) * 300;
      let half: number;
      if (z < 57) half = 62 - (z / 57) * 37; else if (z < 115) half = 25 - ((z - 57) / 58) * 12; else half = Math.max(1.5, 13 - ((z - 115) / 162) * 10.5);
      const side = Math.floor(Math.random() * 4), t = Math.random() * 2 - 1;
      const [lx, ly] = side === 0 ? [half, t * half] : side === 1 ? [-half, t * half] : side === 2 ? [t * half, half] : [t * half, -half];
      put(lx, ly, z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('ph', new THREE.Float32BufferAttribute(ph, 1));
    this.sparkleMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: 'attribute float ph; uniform float uT; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float f = fract(sin(ph * 12.9898 + floor(uT * 9.0 + ph)) * 43758.5453); vA = step(0.72, f); gl_PointSize = 7.0 * vA; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = vA * smoothstep(0.5, 0.0, length(d)); if (a < 0.02) discard; gl_FragColor = vec4(vec3(1.0, 0.97, 0.85) * a, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.sparkle = new THREE.Points(geo, this.sparkleMat);
    this.sparkle.frustumCulled = false;
    this.h.items.add(this.sparkle);
  }

  summary(): string[] {
    const out: string[] = [];
    const names: Record<QuestId, string> = { hat: '1층의 모자', race: '2층 3분 도전', photo: '트로카데로 사진', picnic: '샹드마르스 소풍' };
    if (this.done.size) out.push(`에펠탑 둘레에서 한 일: ${[...this.done].map((d) => names[d]).join(', ')}.`);
    if (this.boated) out.push('센 강 유람선을 탔어요.');
    if (this.souvenirs) out.push(`미니 에펠탑을 ${this.souvenirs * 5}개 샀어요. (파리 사람들은 웃을지도)`);
    if (this.sawSparkle) out.push('밤에 반짝이는 에펠탑을 봤어요.');
    return out;
  }
}

function hatMesh() {
  const g = new THREE.Group();
  const straw = new THREE.MeshToonMaterial({ color: 0xe8cf8a });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 18).rotateX(Math.PI / 2), straw);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.16, 14).rotateX(Math.PI / 2).translate(0, 0, 0.09), straw);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.05, 14).rotateX(Math.PI / 2).translate(0, 0, 0.04), new THREE.MeshToonMaterial({ color: 0x2b3f7a }));
  g.add(brim, crown, band);
  g.scale.setScalar(1.5);
  return g;
}

function corkMesh() {
  const g = new THREE.Group();
  const metal = new THREE.MeshToonMaterial({ color: 0xc8c8c8 });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04).translate(0, 0, 0.04), new THREE.MeshToonMaterial({ color: 0x7a4a26 }));
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6).translate(0, -0.06, 0.04), metal);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6).translate(0, 0, 0.18), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  g.add(handle, screw, glint);
  g.userData.glint = glint;
  g.scale.setScalar(1.8);
  return g;
}
