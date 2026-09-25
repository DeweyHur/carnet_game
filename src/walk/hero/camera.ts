// 어깨 너머 카메라. 끌어서 돌리고, 달리는 쪽으로 슬며시 따라 돌고, 벽이 끼면 앞으로 당겨진다.
import type { Body } from './body';
import type { World } from './world';
import { angleDiff, dirOf } from './geo';

export interface Shot { x: number; y: number; z: number; bearing: number; pitch: number; fx: number; fy: number; fz: number }

export class OrbitCam {
  yaw = 0; // 카메라가 바라보는 방위
  pitch = 14; // 수평 아래로 내려다보는 각
  dist = 6.5;
  wantDist = 6.5;
  private fx = 0; private fy = 0; private fz = 1.5;
  private idle = 9;
  private recenterT = 0;
  /** 옷장을 여는 동안 얼굴 쪽에서 본다 */
  portrait = false;
  /** 옷장일 때 비켜 세우기 [옆 m, 위아래 m, 거리 m] */
  portraitShift: [number, number, number] = [0, 0, 3.1];

  snap(b: Body) {
    this.fx = b.x; this.fy = b.y; this.fz = b.z + 1.45;
    this.yaw = b.facing;
    this.dist = this.wantDist;
  }

  recenter() { this.recenterT = 0.35; }
  /** 좌표 원점이 옮겨졌다 */
  shift(dx: number, dy: number) { this.fx += dx; this.fy += dy; }

  update(dt: number, b: Body, w: World, dYaw: number, dPitch: number, zoom: number): Shot {
    if (dYaw || dPitch) this.idle = 0; else this.idle += dt;
    this.yaw = (this.yaw + dYaw + 360) % 360;
    this.pitch = Math.max(-35, Math.min(75, this.pitch + dPitch)); // 음수 = 발밑에서 올려다본다(하늘·탑 꼭대기)
    if (zoom) this.wantDist = Math.max(2.4, Math.min(22, this.wantDist * Math.exp(zoom * 0.0012)));

    if (this.portrait) {
      // 옷장: 앞으로 돌아와 가까이서 본다
      this.yaw = (this.yaw + angleDiff(this.yaw, b.facing + 180) * Math.min(1, dt * 5) + 360) % 360;
      this.pitch += (6 - this.pitch) * Math.min(1, dt * 5);
    } else if (this.recenterT > 0) {
      this.recenterT -= dt;
      this.yaw = (this.yaw + angleDiff(this.yaw, b.facing) * Math.min(1, dt * 14) + 360) % 360;
      this.pitch += (14 - this.pitch) * Math.min(1, dt * 10);
    } else if (this.idle > 0.6) {
      // 옆으로 달리면 카메라가 뒤로 돌아 들어온다. 카메라 쪽으로 달려올 때는 돌지 않는다.
      const moving = b.mode === 'climb' ? b.climbMove * 1.5 : Math.min(1, b.speed / 4.6);
      if (moving > 0.05) {
        const d = angleDiff(this.yaw, b.facing);
        const rate = b.mode === 'glide' ? 70 : b.mode === 'climb' ? 50 : 45;
        this.yaw = (this.yaw + Math.sin((d * Math.PI) / 180) * rate * moving * dt + 360) % 360;
      }
      // 떨어지거나 활공할 때는 조금 내려다본다
      // 헤엄칠 때는 둑(2 m) 너머로 보이게 높이서 내려다본다
      const wantPitch = b.parachute || b.golden && b.mode === 'glide' ? 36 : b.freefall ? 40 : b.mode === 'glide' ? 22 : b.mode === 'climb' ? 8 : b.mode === 'swim' ? 42 : null;
      if (wantPitch !== null) this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 1.2);
    }

    // 헤엄칠 땐(움직이는 중에도) 둑 너머로 보이게 높이서
    if (b.mode === 'swim' && this.pitch < 42) this.pitch += (42 - this.pitch) * Math.min(1, dt * 3);
    const kh = 1 - Math.exp(-dt * 11), kv = 1 - Math.exp(-dt * (b.mode === 'ground' || b.mode === 'swim' ? 7 : 4.5));
    let tx = b.x, ty = b.y, focusZ = b.z + (b.mode === 'swim' ? 0.55 : b.mode === 'glide' ? 1.9 : 1.45);
    if (this.portrait) {
      // 옷장 판에 가리지 않게 사람을 화면 옆(위)으로 비켜 세운다
      const [lx0, ly0] = dirOf(this.yaw - 90);
      tx += lx0 * this.portraitShift[0]; ty += ly0 * this.portraitShift[0];
      focusZ = b.z + 1.05 + this.portraitShift[1];
    }
    this.fx += (tx - this.fx) * kh;
    this.fy += (ty - this.fy) * kh;
    this.fz += (focusZ - this.fz) * kv;

    // 벽에 가리면 가까이 당긴다
    const [lx, ly] = dirOf(this.yaw);
    const cp = Math.cos((this.pitch * Math.PI) / 180), sp = Math.sin((this.pitch * Math.PI) / 180);
    const bx = -lx * cp, by = -ly * cp, bz = sp; // 초점에서 카메라 쪽
    // 올려다볼수록 카메라가 사람 가까이 내려온다(땅에 박히지 않고 하늘이 보이게)
    const want = this.portrait ? this.portraitShift[2] : this.pitch < 0 ? this.wantDist * Math.max(0.4, 1 + this.pitch / 50) : this.wantDist;
    let free = want;
    for (let d = 0.6; d <= want; d += 0.35) {
      if (w.solidAt(this.fx + bx * d, this.fy + by * d, this.fz + bz * d)) { free = Math.max(1.1, d - 0.45); break; }
    }
    this.dist = free < this.dist ? free : this.dist + (free - this.dist) * Math.min(1, dt * 2.5);
    const x = this.fx + bx * this.dist, y = this.fy + by * this.dist;
    let z = this.fz + bz * this.dist;
    const floor = w.ground(x, y, z, 0) + 0.35;
    if (z < floor) z = floor;
    // 카메라 높이가 바닥에 걸려 올라갔으면 초점을 보도록 각도를 다시 잰다
    const horiz = Math.hypot(this.fx - x, this.fy - y);
    const lookDown = (Math.atan2(z - this.fz, horiz) * 180) / Math.PI;
    return { x, y, z, bearing: this.yaw, pitch: Math.min(85, 90 - lookDown), fx: this.fx, fy: this.fy, fz: this.fz };
  }
}
