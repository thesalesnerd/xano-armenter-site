export type Pt = { x: number; y: number };
/** Corners in the order top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Pt, Pt, Pt, Pt];

export function orderCorners(pts: Pt[]): Quad {
  // Sort around the centroid by angle, then start at the point closest to
  // the top-left (smallest x + y). Robust for rotated and strongly skewed quads.
  const c = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
  const s = [...pts].sort((a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x));
  let start = 0;
  s.forEach((p, i) => { if (p.x + p.y < s[start].x + s[start].y) start = i; });
  const r = [...s.slice(start), ...s.slice(0, start)];
  return [r[0], r[1], r[2], r[3]];
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function quadArea(q: Pt[]): number {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i], n = q[(i + 1) % q.length];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function isConvex(q: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length], c = q[(i + 2) % q.length];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-9) continue;
    const s = Math.sign(z);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

/** Rotates the corner order so the output turns 90° clockwise per step. */
export function rotateQuad(q: Quad, quarterTurns: number): Quad {
  const n = ((quarterTurns % 4) + 4) % 4;
  const r = [...q];
  for (let i = 0; i < n; i++) r.unshift(r.pop()!);
  return r as Quad;
}

/** 3×3 homography mapping the four `from` points onto `to` (row-major). */
export function homography(from: Quad, to: Quad): number[] {
  // Solve the 8×8 linear system with Gaussian elimination.
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i], { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const h = A.map((row, i) => row[8] / row[i]);
  return [...h, 1];
}

export function applyH(h: number[], p: Pt): Pt {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/**
 * Width / height of the real rectangle behind a photographed quad, using the
 * camera-geometry method of Zhang & He ("Whiteboard scanning and image
 * enhancement", 2007). Assumes the principal point is the image centre. If the
 * focal length can't be recovered (near-frontal shots) it falls back to a
 * typical phone main camera (26 mm equivalent ≈ 0.6 × image diagonal), where
 * the result is insensitive to the focal length anyway.
 */
export function estimateAspect(q: Quad, imgW: number, imgH: number): { aspect: number; focal: number } {
  const u0 = imgW / 2, v0 = imgH / 2;
  const [tl, tr, br, bl] = q;
  const m = (p: Pt) => [p.x - u0, p.y - v0, 1];
  const m1 = m(tl), m2 = m(tr), m3 = m(bl), m4 = m(br);
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const c14 = cross(m1, m4);
  const k2 = dot(c14, m3) / dot(cross(m2, m4), m3);
  const k3 = dot(c14, m2) / dot(cross(m3, m4), m2);
  const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
  const n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
  const diag = Math.hypot(imgW, imgH);
  let f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
  let f = f2 > 0 ? Math.sqrt(f2) : NaN;
  if (!Number.isFinite(f) || f < 0.3 * diag || f > 2 * diag || Math.abs(n2[2] * n3[2]) < 1e-6) {
    f = 0.6 * diag;
  }
  f2 = f * f;
  const nw = (n2[0] ** 2 + n2[1] ** 2) / f2 + n2[2] ** 2;
  const nh = (n3[0] ** 2 + n3[1] ** 2) / f2 + n3[2] ** 2;
  let aspect = Math.sqrt(nw / nh);
  // Fallback: average opposite edges.
  if (!Number.isFinite(aspect) || aspect <= 0) {
    aspect = (dist(tl, tr) + dist(bl, br)) / (dist(tl, bl) + dist(tr, br));
  }
  return { aspect, focal: f };
}
