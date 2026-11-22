import type { CV } from './opencv';
import { isConvex, orderCorners, quadArea, type Pt, type Quad } from './geometry';

export type Detection = {
  /** Corners in pixels of the analysed image. */
  quad: Quad;
  /** 0..1, how much the shape looks like a painting seen in perspective. */
  score: number;
  /** Share of the frame the painting covers. */
  coverage: number;
  /** A corner sits on the edge of the frame: the painting is probably cut off. */
  touchesEdge: boolean;
  method: 'edges' | 'wall';
};

/** Largest-area quadrilateral whose corners are points of a convex polygon. */
function maxAreaQuad(poly: Pt[]): Pt[] | null {
  const n = poly.length;
  if (n < 4) return null;
  if (n === 4) return poly;
  let best: Pt[] | null = null;
  let bestA = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        for (let l = k + 1; l < n; l++) {
          const q = [poly[i], poly[j], poly[k], poly[l]];
          const a = quadArea(q);
          if (a > bestA) { bestA = a; best = q; }
        }
  return best;
}

function matToPts(m: CV): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < m.rows; i++) pts.push({ x: m.data32S[i * 2], y: m.data32S[i * 2 + 1] });
  return pts;
}

/** Turn every external contour of a binary image into a candidate quad. */
function candidates(cv: CV, bin: CV, W: number, H: number, method: Detection['method']): Detection[] {
  const out: Detection[] = [];
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const imgArea = W * H;
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const area = cv.contourArea(c);
    if (area < imgArea * 0.06) { c.delete(); continue; }
    const hull = new cv.Mat();
    cv.convexHull(c, hull, false, true);
    // Simplify the hull until it has few enough points for the brute force.
    const peri = cv.arcLength(hull, true);
    let approx = new cv.Mat();
    for (let eps = 0.004; eps < 0.08; eps *= 1.5) {
      approx.delete();
      approx = new cv.Mat();
      cv.approxPolyDP(hull, approx, eps * peri, true);
      if (approx.rows <= 24) break;
    }
    const poly = matToPts(approx);
    approx.delete();
    hull.delete();
    const q = maxAreaQuad(poly);
    if (q && isConvex(q)) {
      const quad = orderCorners(q);
      const qa = quadArea(quad);
      const coverage = qa / imgArea;
      // How well the contour fills its quad (1 = perfect rectangle in perspective).
      const fill = Math.min(1, area / qa);
      const m = Math.max(W, H) * 0.012;
      const touchesEdge = quad.filter((p) => p.x < m || p.y < m || p.x > W - m || p.y > H - m).length >= 2;
      // Favour big, well-filled quads; very full-frame quads are often the
      // image border itself, so they lose a little.
      const sizeScore = coverage > 0.96 ? 0.4 : Math.min(1, coverage / 0.35);
      const score = fill ** 3 * sizeScore * (touchesEdge ? 0.6 : 1);
      out.push({ quad, score, coverage, touchesEdge, method });
    }
    c.delete();
  }
  contours.delete();
  hierarchy.delete();
  return out;
}

/**
 * Finds the painting in a small RGBA image (≈ 320–1000 px on the long side).
 * Two detectors run and the best candidate wins:
 *   edges: Canny edge map, closed, outer contours;
 *   wall:  colour distance from the wall, estimated from the frame border.
 * The second one is what makes it work on paintings with busy interiors and
 * soft edges, where document scanners fail.
 */
export function detectPainting(cv: CV, img: ImageData): Detection | null {
  const W = img.width, H = img.height;
  const src = cv.matFromImageData(img);
  const rgb = new cv.Mat();
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
  const gray = new cv.Mat();
  cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
  const blur = new cv.Mat();
  const k = Math.max(3, Math.round(Math.max(W, H) / 160) | 1);
  cv.GaussianBlur(gray, blur, new cv.Size(k, k), 0);

  const found: Detection[] = [];
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));

  // --- edges
  {
    // Auto thresholds from the median brightness.
    const hist = new Uint32Array(256);
    for (let i = 0; i < blur.data.length; i += 7) hist[blur.data[i]]++;
    let total = 0, med = 128;
    const half = hist.reduce((a, b) => a + b, 0) / 2;
    for (let i = 0; i < 256; i++) { total += hist[i]; if (total >= half) { med = i; break; } }
    const edges = new cv.Mat();
    cv.Canny(blur, edges, Math.max(10, 0.5 * med), Math.max(30, 1.2 * med));
    cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 2);
    found.push(...candidates(cv, edges, W, H, 'edges'));
    edges.delete();
  }

  // --- wall colour
  {
    const lab = new cv.Mat();
    const rgbBlur = new cv.Mat();
    cv.GaussianBlur(rgb, rgbBlur, new cv.Size(k, k), 0);
    cv.cvtColor(rgbBlur, lab, cv.COLOR_RGB2Lab);
    const d = lab.data as Uint8Array;
    const b = Math.max(2, Math.round(Math.min(W, H) * 0.04));
    const L: number[] = [], A: number[] = [], B: number[] = [];
    for (let y = 0; y < H; y += 2)
      for (let x = 0; x < W; x += 2) {
        if (x >= b && y >= b && x < W - b && y < H - b) continue;
        const i = (y * W + x) * 3;
        L.push(d[i]); A.push(d[i + 1]); B.push(d[i + 2]);
      }
    const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
    const wl = median(L), wa = median(A), wb = median(B);
    const dists = L.map((_, i) => Math.hypot((L[i] - wl) * 0.5, A[i] - wa, B[i] - wb));
    const mad = median(dists.map((x) => Math.abs(x)));
    const thr = Math.max(14, 3 * mad + 6);
    const mask = new cv.Mat(H, W, cv.CV_8UC1);
    const md = mask.data as Uint8Array;
    for (let i = 0, j = 0; i < md.length; i++, j += 3) {
      md[i] = Math.hypot((d[j] - wl) * 0.5, d[j + 1] - wa, d[j + 2] - wb) > thr ? 255 : 0;
    }
    const big = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(k * 2 + 1, k * 2 + 1));
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, big);
    found.push(...candidates(cv, mask, W, H, 'wall'));
    big.delete(); mask.delete(); lab.delete(); rgbBlur.delete();
  }

  kernel.delete(); blur.delete(); gray.delete(); rgb.delete(); src.delete();
  if (!found.length) return null;
  found.sort((a, b) => b.score - a.score);
  return found[0].score > 0.15 ? found[0] : null;
}

/** Share of pixels inside the quad that are blown out (specular glare). */
export function glareShare(img: ImageData, quad: Quad): number {
  const { width: W, height: H, data } = img;
  const xs = quad.map((p) => p.x), ys = quad.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  const inside = (x: number, y: number) => {
    for (let i = 0; i < 4; i++) {
      const a = quad[i], b = quad[(i + 1) % 4];
      if ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) < 0) return false;
    }
    return true;
  };
  let n = 0, hot = 0;
  for (let y = y0; y <= y1; y += 2)
    for (let x = x0; x <= x1; x += 2) {
      if (!inside(x, y)) continue;
      n++;
      const i = (y * W + x) * 4;
      if (data[i] > 248 && data[i + 1] > 248 && data[i + 2] > 248) hot++;
    }
  return n ? hot / n : 0;
}
