// 어깨 너머 카메라. 끌어서 돌리고, 달리는 쪽으로 슬며시 따라 돌고, 벽이 끼면 앞으로 당겨진다.
import type { Body } from './body';
import type { World } from './world';
import { angleDiff, dirOf } from './geo';

export interface Shot { x: number; y: number; z: number; bearing: number; pitch: number }

export class OrbitCam {
  yaw = 0; // 카메라가 바라보는 방위
  pitch = 14; // 수평 아래로 내려다보는 각
  dist = 6.5;
  wantDist = 6.5;
  private fx = 0; private fy = 0; private fz = 1.5;
  private idle = 9;
  private recenterT = 0;

  snap(b: Body) {
    this.fx = b.x; this.fy = b.y; this.fz = b.z + 1.45;
    this.yaw = b.facing;
    this.dist = this.wantDist;
  }

  recenter() { this.recenterT = 0.35; }

  update(dt: number, b: Body, w: World, dYaw: number, dPitch: number, zoom: number): Shot {
    if (dYaw || dPitch) this.idle = 0; else this.idle += dt;
    this.yaw = (this.yaw + dYaw + 360) % 360;
    this.pitch = Math.max(4, Math.min(68, this.pitch + dPitch)); // 지도 엔진이 지평선 위를 올려다보지 못한다(85° 넘으면 깨진다)
    if (zoom) this.wantDist = Math.max(2.4, Math.min(22, this.wantDist * Math.exp(zoom * 0.0012)));

    if (this.recenterT > 0) {
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
      const wantPitch = b.mode === 'glide' ? 22 : b.mode === 'climb' ? 8 : null;
      if (wantPitch !== null) this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 1.2);
    }

    const kh = 1 - Math.exp(-dt * 11), kv = 1 - Math.exp(-dt * (b.mode === 'ground' || b.mode === 'swim' ? 7 : 4.5));
    const focusZ = b.z + (b.mode === 'swim' ? 0.55 : b.mode === 'glide' ? 1.9 : 1.45);
    this.fx += (b.x - this.fx) * kh;
    this.fy += (b.y - this.fy) * kh;
    this.fz += (focusZ - this.fz) * kv;

    // 벽에 가리면 가까이 당긴다
    const [lx, ly] = dirOf(this.yaw);
    const cp = Math.cos((this.pitch * Math.PI) / 180), sp = Math.sin((this.pitch * Math.PI) / 180);
    const bx = -lx * cp, by = -ly * cp, bz = sp; // 초점에서 카메라 쪽
    let free = this.wantDist;
    for (let d = 0.6; d <= this.wantDist; d += 0.35) {
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
    return { x, y, z, bearing: this.yaw, pitch: Math.min(85, 90 - lookDown) };
  }
}
