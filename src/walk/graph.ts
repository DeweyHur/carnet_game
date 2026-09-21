// 거리 그래프: OSM way 좌표열 → 노드/간선, 최근접 노드, 최단 경로.
export type LngLat = [number, number];

export interface Graph {
  nodes: LngLat[];
  adj: { to: number; len: number }[][];
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function dist(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const key = (p: LngLat) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;

/** ways: 각 way의 좌표열. 긴 구간은 maxSeg(m) 이하로 잘라 노드를 촘촘히 만든다. */
export function buildGraph(ways: LngLat[][], maxSeg = 12): Graph {
  const index = new Map<string, number>();
  const nodes: LngLat[] = [];
  const adj: Graph['adj'] = [];
  const id = (p: LngLat) => {
    const k = key(p);
    let i = index.get(k);
    if (i === undefined) {
      i = nodes.length;
      index.set(k, i);
      nodes.push(p);
      adj.push([]);
    }
    return i;
  };
  const link = (a: number, b: number) => {
    if (a === b || adj[a].some((e) => e.to === b)) return;
    const len = dist(nodes[a], nodes[b]);
    adj[a].push({ to: b, len });
    adj[b].push({ to: a, len });
  };
  for (const way of ways) {
    for (let i = 0; i + 1 < way.length; i++) {
      const a = way[i];
      const b = way[i + 1];
      const n = Math.max(1, Math.ceil(dist(a, b) / maxSeg));
      let prev = id(a);
      for (let s = 1; s <= n; s++) {
        const p: LngLat = s === n ? b : [a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n];
        const cur = id(p);
        link(prev, cur);
        prev = cur;
      }
    }
  }
  return largestComponent({ nodes, adj });
}

function largestComponent(g: Graph): Graph {
  const comp = new Int32Array(g.nodes.length).fill(-1);
  let best = -1;
  let bestSize = 0;
  let c = 0;
  for (let s = 0; s < g.nodes.length; s++) {
    if (comp[s] !== -1) continue;
    let size = 0;
    const stack = [s];
    comp[s] = c;
    while (stack.length) {
      const u = stack.pop()!;
      size++;
      for (const e of g.adj[u]) if (comp[e.to] === -1) { comp[e.to] = c; stack.push(e.to); }
    }
    if (size > bestSize) { bestSize = size; best = c; }
    c++;
  }
  const remap = new Int32Array(g.nodes.length).fill(-1);
  const nodes: LngLat[] = [];
  g.nodes.forEach((p, i) => { if (comp[i] === best) { remap[i] = nodes.length; nodes.push(p); } });
  const adj = nodes.map(() => [] as Graph['adj'][number]);
  g.adj.forEach((es, i) => { if (remap[i] >= 0) adj[remap[i]] = es.map((e) => ({ to: remap[e.to], len: e.len })); });
  return { nodes, adj };
}

export function nearestNode(g: Graph, p: LngLat): number {
  let best = 0;
  let bd = Infinity;
  const cos = Math.cos(rad(p[1]));
  for (let i = 0; i < g.nodes.length; i++) {
    const dx = (g.nodes[i][0] - p[0]) * cos;
    const dy = g.nodes[i][1] - p[1];
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** A* — 노드 인덱스 열을 돌려준다. 못 찾으면 null. */
export function route(g: Graph, from: number, to: number): number[] | null {
  if (from === to) return [from];
  const n = g.nodes.length;
  const gs = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap: [number, number][] = [];
  const push = (f: number, v: number) => {
    heap.push([f, v]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  gs[from] = 0;
  push(dist(g.nodes[from], g.nodes[to]), from);
  while (heap.length) {
    const [, u] = pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === to) break;
    for (const e of g.adj[u]) {
      const ng = gs[u] + e.len;
      if (ng < gs[e.to]) {
        gs[e.to] = ng;
        prev[e.to] = u;
        push(ng + dist(g.nodes[e.to], g.nodes[to]), e.to);
      }
    }
  }
  if (prev[to] === -1) return null;
  const path = [to];
  while (path[path.length - 1] !== from) path.push(prev[path[path.length - 1]]);
  return path.reverse();
}
