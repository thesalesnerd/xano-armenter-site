import type { CV } from './opencv';
import { applyH, dist, estimateAspect, homography, rotateQuad, type Pt, type Quad } from './geometry';
import { detectPainting, glareShare } from './detect';

export const PIPELINE_VERSION = 'capture-1';
export const MAX_LONG_SIDE = 4000;
export const MIN_LONG_SIDE = 2000;
const MAX_SOURCE_SIDE = 4800;

export type WhiteBalance = 'wall' | 'point' | 'off';

export type CorrectOptions = {
  quad: Quad; // source pixels
  quarterTurns?: number;
  inset?: number; // 0..0.12, trims a frame
  /** Real width / height (after rotation) when the work's size is known. */
  recordedAspect?: number | null;
  whiteBalance?: WhiteBalance;
  /** Neutral point in source pixels, for whiteBalance = 'point'. */
  neutralPoint?: Pt | null;
  evenLighting?: boolean;
  autoExposure?: boolean;
  /** Manual exposure on top, in stops. */
  ev?: number;
  /** Manual warm/cool on top, -1..1. */
  warmth?: number;
  sharpen?: boolean;
  /** Cap the output for quick previews (the checks still describe the full size). */
  maxSide?: number;
  /** Outline of painting + frame as first detected: the wall is sampled outside it. */
  wallQuad?: Quad | null;
  /** false when the corners were not detected: don't measure the "wall". */
  trustSurroundings?: boolean;
};

export type Check = { level: 'ok' | 'warn' | 'bad'; text: string };

export type CorrectResult = {
  canvas: HTMLCanvasElement;
  /** Size the full-resolution save will have. */
  fullWidth: number;
  fullHeight: number;
  width: number;
  height: number;
  measuredAspect: number;
  usedAspect: number;
  aspectSource: 'recorded' | 'measured';
  gains: [number, number, number];
  exposureGain: number;
  lightingGradient: number;
  lightingCorrected: boolean;
  wallSamples: number;
  sharpness: number;
  glare: number;
  checks: Check[];
};

// sRGB <-> linear lookup tables
const toLin = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  toLin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const LUT_N = 4096;
const toSrgb = new Uint8ClampedArray(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) {
  const c = i / LUT_N;
  toSrgb[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
}
const enc = (v: number) => toSrgb[v <= 0 ? 0 : v >= 1 ? LUT_N : (v * LUT_N) | 0];
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export type SourceImage = { canvas: HTMLCanvasElement; width: number; height: number };

/** Decodes a photo (EXIF orientation applied) into a canvas, capped at 4800 px. */
export async function loadSource(blob: Blob): Promise<SourceImage> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const s = Math.min(1, MAX_SOURCE_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * s);
  canvas.height = Math.round(bmp.height * s);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return { canvas, width: canvas.width, height: canvas.height };
}

export function downscale(src: HTMLCanvasElement | HTMLVideoElement, maxSide: number): ImageData {
  const w = src instanceof HTMLVideoElement ? src.videoWidth : src.width;
  const h = src instanceof HTMLVideoElement ? src.videoHeight : src.height;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Detects the painting on a ~1000 px copy and returns corners in source pixels. */
export function detectInSource(cv: CV, src: SourceImage): { quad: Quad; detected: boolean } {
  const small = downscale(src.canvas, 1000);
  const s = src.width / small.width;
  const d = detectPainting(cv, small);
  if (d) return { quad: d.quad.map((p) => ({ x: p.x * s, y: p.y * s })) as Quad, detected: true };
  const m = 0.12;
  const W = src.width, H = src.height;
  return {
    quad: [{ x: W * m, y: H * m }, { x: W * (1 - m), y: H * m }, { x: W * (1 - m), y: H * (1 - m) }, { x: W * m, y: H * (1 - m) }],
    detected: false,
  };
}

type Sample = { u: number; v: number; r: number; g: number; b: number };

/** Linear-RGB samples of the wall in a ring just outside the painting. */
function wallRing(small: ImageData, scale: number, ringQuad: Quad, outQuad: Quad): Sample[] {
  const unit: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const toSrc = homography(unit, ringQuad);
  // Sample positions are reported in the output's (u, v), which differ from
  // the ring's when the corners were trimmed inside a frame.
  const toOut = homography(outQuad, unit);
  const out: Sample[] = [];
  const { width: W, height: H, data } = small;
  const N = 48;
  for (const off of [0.03, 0.05, 0.07]) {
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      for (const [u, v] of [[t, -off], [t, 1 + off], [-off, t], [1 + off, t]]) {
        const p = applyH(toSrc, { x: u, y: v });
        const x = Math.round(p.x / scale), y = Math.round(p.y / scale);
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        let r = 0, g = 0, b = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const k = ((y + dy) * W + x + dx) * 4;
            r += toLin[data[k]]; g += toLin[data[k + 1]]; b += toLin[data[k + 2]];
          }
        const o = applyH(toOut, p);
        out.push({ u: o.x, v: o.y, r: r / 9, g: g / 9, b: b / 9 });
      }
    }
  }
  // Drop clipped/black samples and things on the wall that aren't wall
  // (switches, other paintings): keep samples near the median chroma.
  const ok = out.filter((s) => Math.max(s.r, s.g, s.b) < 0.95 && lum(s.r, s.g, s.b) > 0.01);
  if (ok.length < 20) return ok;
  const ch = ok.map((s) => { const y = lum(s.r, s.g, s.b); return [s.r / y, s.b / y]; });
  const med = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
  const mr = med(ch.map((c) => c[0])), mb = med(ch.map((c) => c[1]));
  const dev = ch.map((c) => Math.hypot(c[0] - mr, c[1] - mb));
  const md = med(dev);
  return ok.filter((_, i) => dev[i] <= Math.max(0.04, 3 * md));
}

function median(a: number[]): number {
  const s = [...a].sort((p, q) => p - q);
  return s.length ? s[s.length >> 1] : NaN;
}

/** Least-squares plane L = a + b(u-.5) + c(v-.5). */
function fitPlane(s: Sample[]): [number, number, number] {
  let S = 0, Su = 0, Sv = 0, Suu = 0, Svv = 0, Suv = 0, Sl = 0, Slu = 0, Slv = 0;
  for (const p of s) {
    const u = p.u - 0.5, v = p.v - 0.5, l = lum(p.r, p.g, p.b);
    S++; Su += u; Sv += v; Suu += u * u; Svv += v * v; Suv += u * v; Sl += l; Slu += l * u; Slv += l * v;
  }
  const M = [[S, Su, Sv, Sl], [Su, Suu, Suv, Slu], [Sv, Suv, Svv, Slv]];
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c || !M[c][c]) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

function sharpnessOf(cv: CV, canvas: HTMLCanvasElement): number {
  const img = downscale(canvas, 1200);
  const m = cv.matFromImageData(img);
  const g = new cv.Mat();
  cv.cvtColor(m, g, cv.COLOR_RGBA2GRAY);
  const lap = new cv.Mat();
  cv.Laplacian(g, lap, cv.CV_64F);
  const mean = new cv.Mat(), sd = new cv.Mat();
  cv.meanStdDev(lap, mean, sd);
  const v = sd.data64F[0] ** 2;
  [m, g, lap, mean, sd].forEach((x) => x.delete());
  return v;
}

/** The whole correction. Deterministic: same input + options = same output. */
export function correct(cv: CV, src: SourceImage, o: CorrectOptions): CorrectResult {
  const quarterTurns = o.quarterTurns ?? 0;
  const inset = Math.max(0, Math.min(0.15, o.inset ?? 0));
  const quad = rotateQuad(o.quad, quarterTurns);
  const checks: Check[] = [];

  // --- proportions
  const measuredAspect = estimateAspect(quad, src.width, src.height).aspect;
  let usedAspect = measuredAspect;
  let aspectSource: CorrectResult['aspectSource'] = 'measured';
  if (o.recordedAspect && o.recordedAspect > 0) {
    const r = measuredAspect / o.recordedAspect;
    if (Math.abs(r - 1) < 0.12) {
      usedAspect = o.recordedAspect;
      aspectSource = 'recorded';
    } else if (Math.abs(measuredAspect * o.recordedAspect - 1) < 0.12) {
      checks.push({ level: 'warn', text: 'The photo looks turned 90° compared with the recorded size. Use the rotate button, or check width × height.' });
    } else {
      checks.push({ level: 'warn', text: `Proportions differ from the recorded size by ${Math.round(Math.abs(r - 1) * 100)} %. Check the corners (or the recorded size). Using the measured proportions.` });
    }
  }

  // --- output size (the inner, inset-trimmed area)
  const natural = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]), dist(quad[0], quad[3]), dist(quad[1], quad[2])) * (1 - 2 * inset);
  const fullLong = Math.round(Math.min(MAX_LONG_SIDE, natural * 1.1));
  const long = Math.min(fullLong, o.maxSide ?? fullLong);
  const W = usedAspect >= 1 ? long : Math.round(long * usedAspect);
  const H = usedAspect >= 1 ? Math.round(long / usedAspect) : long;
  const fullW = usedAspect >= 1 ? fullLong : Math.round(fullLong * usedAspect);
  const fullH = usedAspect >= 1 ? Math.round(fullLong / usedAspect) : fullLong;
  // The full quad maps to an area larger than the output by the inset.
  const fw = W / (1 - 2 * inset), fh = H / (1 - 2 * inset);
  const ox = -inset * fw, oy = -inset * fh;
  const dst: Quad = [{ x: ox, y: oy }, { x: ox + fw, y: oy }, { x: ox + fw, y: oy + fh }, { x: ox, y: oy + fh }];

  // --- warp
  const srcCtx = src.canvas.getContext('2d', { willReadFrequently: true })!;
  const srcMat = cv.matFromImageData(srcCtx.getImageData(0, 0, src.width, src.height));
  const M = cv.matFromArray(3, 3, cv.CV_64F, homography(quad, dst));
  const warped = new cv.Mat();
  cv.warpPerspective(srcMat, warped, M, new cv.Size(W, H), cv.INTER_LANCZOS4, cv.BORDER_REPLICATE);
  srcMat.delete(); M.delete();

  const px = new Uint8ClampedArray(warped.data);
  warped.delete();

  // glare before any correction
  let hot = 0, n = 0;
  for (let i = 0; i < px.length; i += 4 * 7) { n++; if (px[i] > 248 && px[i + 1] > 248 && px[i + 2] > 248) hot++; }
  const glare = hot / n;

  // --- colour
  const small = downscale(src.canvas, 1200);
  const scale = src.width / small.width;
  const ringQuad = o.wallQuad ? rotateQuad(o.wallQuad, quarterTurns) : quad;
  const ring = o.trustSurroundings === false ? [] : wallRing(small, scale, ringQuad, quad);
  // Is what surrounds the painting a plain, roughly neutral wall? A gilt
  // frame, a coloured wall or clutter must not drive the colour.
  let wallGains: [number, number, number] | null = null;
  let wallPlane: [number, number, number] | null = null;
  let wallNote = '';
  if (ring.length >= 30) {
    const r = median(ring.map((s) => s.r)), g = median(ring.map((s) => s.g)), b = median(ring.map((s) => s.b));
    const cand: [number, number, number] = [g / r, 1, g / b];
    const spread = Math.max(...cand) / Math.min(...cand);
    const plane = fitPlane(ring);
    const rms = Math.sqrt(ring.reduce((a, p) => {
      const e = lum(p.r, p.g, p.b) - (plane[0] + plane[1] * (p.u - 0.5) + plane[2] * (p.v - 0.5));
      return a + e * e;
    }, 0) / ring.length);
    if (spread > 1.75) wallNote = 'What surrounds the painting is strongly coloured (a frame or coloured wall), so it was not used for white balance. Tap a neutral point if the colour looks off.';
    else wallGains = cand;
    if (plane[0] > 0 && rms / plane[0] < 0.12) wallPlane = plane;
  } else if (o.trustSurroundings !== false) {
    wallNote = 'Not enough wall around the painting to measure white balance. Step back a little, or tap a neutral point.';
  }
  let gains: [number, number, number] = [1, 1, 1];
  const wb = o.whiteBalance ?? 'wall';
  if (wb === 'wall') {
    if (wallGains) gains = wallGains;
    else if (wallNote) checks.push({ level: 'warn', text: wallNote });
  } else if (wb === 'point' && o.neutralPoint) {
    const d = small.data, x = Math.round(o.neutralPoint.x / scale), y = Math.round(o.neutralPoint.y / scale);
    let r = 0, g = 0, b = 0, k = 0;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= small.width || yy >= small.height) continue;
        const i = (yy * small.width + xx) * 4;
        r += toLin[d[i]]; g += toLin[d[i + 1]]; b += toLin[d[i + 2]]; k++;
      }
    if (k && r > 0 && b > 0) gains = [g / r, 1, g / b];
  }
  // warmth: a gentle shift along the blue–amber axis
  const warm = Math.max(-1, Math.min(1, o.warmth ?? 0));
  gains = [gains[0] * (1 + 0.12 * warm), gains[1], gains[2] * (1 - 0.12 * warm)];
  // keep luminance, and never correct by more than ×2
  const gy = lum(...gains);
  gains = gains.map((g) => Math.max(0.5, Math.min(2, g / gy))) as [number, number, number];

  // lighting fall-off measured on the wall
  let lightingGradient = 0;
  const plane = wallPlane;
  if (plane) lightingGradient = (Math.abs(plane[1]) + Math.abs(plane[2])) / plane[0];
  const lightingCorrected = !!(o.evenLighting ?? true) && !!plane && lightingGradient > 0.04 && plane[0] > 0;

  // exposure: white point at the 99.5th percentile and the wall, gain-limited
  let exposureGain = 1;
  if (o.autoExposure ?? true) {
    const hist = new Uint32Array(1024);
    let cnt = 0;
    for (let i = 0; i < px.length; i += 4 * 5) {
      const y = lum(toLin[px[i]] * gains[0], toLin[px[i + 1]] * gains[1], toLin[px[i + 2]] * gains[2]);
      hist[Math.min(1023, (y * 1023) | 0)]++; cnt++;
    }
    let acc = 0, p995 = 1;
    for (let i = 1023; i >= 0; i--) { acc += hist[i]; if (acc >= cnt * 0.005) { p995 = (i + 0.5) / 1023; break; } }
    let g = 0.9 / Math.max(0.05, p995);
    if (plane && wallGains) g = Math.min(g, 0.85 / Math.max(0.05, plane[0] * lum(...gains)));
    // Without a wall to anchor to, a dark painting must stay dark: limit the push.
    exposureGain = Math.max(0.8, Math.min(plane && wallGains ? 1.8 : 1.35, g));
    if (exposureGain < 1.02 && exposureGain > 0.98) exposureGain = 1;
  }
  exposureGain *= 2 ** (o.ev ?? 0);

  // apply, in linear light
  const out = new ImageData(W, H);
  const od = out.data;
  const [gr, gg, gb] = gains;
  for (let y = 0; y < H; y++) {
    let rowGain = exposureGain;
    let du = 0;
    if (lightingCorrected && plane) {
      const v = (y + 0.5) / H * (1 - 2 * inset) + inset - 0.5;
      const base = plane[0] + plane[2] * v;
      rowGain = exposureGain; du = plane[1];
      // per pixel below: f = a / (base + b u)
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W * (1 - 2 * inset) + inset - 0.5;
        const f = Math.max(0.8, Math.min(1.25, plane[0] / (base + du * u))) * rowGain;
        const i = (y * W + x) * 4;
        od[i] = enc(toLin[px[i]] * gr * f);
        od[i + 1] = enc(toLin[px[i + 1]] * gg * f);
        od[i + 2] = enc(toLin[px[i + 2]] * gb * f);
        od[i + 3] = 255;
      }
    } else {
      for (let x = 0, i = y * W * 4; x < W; x++, i += 4) {
        od[i] = enc(toLin[px[i]] * gr * rowGain);
        od[i + 1] = enc(toLin[px[i + 1]] * gg * rowGain);
        od[i + 2] = enc(toLin[px[i + 2]] * gb * rowGain);
        od[i + 3] = 255;
      }
    }
  }

  // light unsharp mask to undo the resampling softness
  if (o.sharpen ?? true) {
    const m = cv.matFromImageData(out);
    const bl = new cv.Mat();
    cv.GaussianBlur(m, bl, new cv.Size(0, 0), Math.max(0.8, long / 3000));
    const s = new cv.Mat();
    cv.addWeighted(m, 1.35, bl, -0.35, 0, s);
    od.set(s.data);
    for (let i = 3; i < od.length; i += 4) od[i] = 255;
    m.delete(); bl.delete(); s.delete();
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d')!.putImageData(out, 0, 0);

  const sharpness = sharpnessOf(cv, canvas);

  // --- checks
  checks.unshift(
    fullLong >= MIN_LONG_SIDE
      ? { level: 'ok', text: `${fullW} × ${fullH} px` }
      : { level: fullLong >= 1400 ? 'warn' : 'bad', text: `Only ${fullW} × ${fullH} px (portfolio needs ≥ ${MIN_LONG_SIDE} px on the long side). Move closer, or use “Phone camera”.` },
  );
  checks.push(
    sharpness > 60 ? { level: 'ok', text: 'Sharp' }
      : sharpness > 25 ? { level: 'warn', text: 'Slightly soft. Hold still or tap to focus, then retake if detail matters.' }
        : { level: 'bad', text: 'Blurry. Retake: hold still, more light, tap the painting to focus.' },
  );
  checks.push(
    glare < 0.002 ? { level: 'ok', text: 'No glare' }
      : glare < 0.01 ? { level: 'warn', text: `Some glare (${(glare * 100).toFixed(1)} % blown out). Step sideways or move the light.` }
        : { level: 'bad', text: `Glare on ${(glare * 100).toFixed(1)} % of the painting. Retake from a little to the side, or turn off the light behind you.` },
  );
  if (wb === 'wall' && wallGains) checks.push({ level: 'ok', text: `White balance from the wall (${ring.length} samples)` });
  if (lightingCorrected) checks.push({ level: 'ok', text: `Light fall-off evened out (${Math.round(lightingGradient * 100)} % across the painting)` });
  else if (lightingGradient > 0.04) checks.push({ level: 'warn', text: `Uneven light (${Math.round(lightingGradient * 100)} % across); turn on “Even out lighting”.` });

  return { canvas, fullWidth: fullW, fullHeight: fullH, width: W, height: H, measuredAspect, usedAspect, aspectSource, gains, exposureGain, lightingGradient, lightingCorrected, wallSamples: ring.length, sharpness, glare, checks };
}

export { glareShare };

export function canvasToJpeg(c: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image'))), 'image/jpeg', quality));
}

/**
 * Looks for the canvas inside the current corners (a frame or mat around it):
 * flattens the quad, treats its outer border as the "wall" and detects again.
 * Returns the inner corners in source pixels, or null.
 */
export function detectInside(cv: CV, src: SourceImage, quad: Quad): Quad | null {
  const small = downscale(src.canvas, 1600);
  const s = small.width / src.width;
  const q = quad.map((p) => ({ x: p.x * s, y: p.y * s })) as Quad;
  const aspect = estimateAspect(q, small.width, small.height).aspect;
  const W = aspect >= 1 ? 800 : Math.round(800 * aspect), H = aspect >= 1 ? Math.round(800 / aspect) : 800;
  const rect: Quad = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  const m = cv.matFromImageData(small);
  const M = cv.matFromArray(3, 3, cv.CV_64F, homography(q, rect));
  const flat = new cv.Mat();
  cv.warpPerspective(m, flat, M, new cv.Size(W, H), cv.INTER_AREA, cv.BORDER_REPLICATE);
  const gray = new cv.Mat();
  cv.cvtColor(flat, gray, cv.COLOR_RGBA2GRAY);
  const gx = new cv.Mat(), gy = new cv.Mat();
  cv.Sobel(gray, gx, cv.CV_32F, 1, 0, 3);
  cv.Sobel(gray, gy, cv.CV_32F, 0, 1, 3);
  const fx = gx.data32F as Float32Array, fy = gy.data32F as Float32Array;
  // Mean |gradient| per column (x edges) and per row (y edges), over the
  // middle 70 % of the length, so corners and ornaments count less.
  const col = new Float32Array(W), row = new Float32Array(H);
  for (let y = Math.round(H * 0.15); y < H * 0.85; y++) for (let x = 0; x < W; x++) col[x] += Math.abs(fx[y * W + x]);
  for (let x = Math.round(W * 0.15); x < W * 0.85; x++) for (let y = 0; y < H; y++) row[y] += Math.abs(fy[y * W + x]);
  [m, M, flat, gray, gx, gy].forEach((x) => x.delete());
  // Strongest straight edge within 1.5–22 % of each side.
  const peak = (prof: Float32Array, from: number, to: number, step: number) => {
    let best = from, bv = -1;
    for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
      const v = prof[i - 1] + 2 * prof[i] + prof[i + 1];
      if (v > bv) { bv = v; best = i; }
    }
    return best;
  };
  const left = peak(col, Math.round(W * 0.015), Math.round(W * 0.22), 1);
  const right = peak(col, W - 1 - Math.round(W * 0.015), W - 1 - Math.round(W * 0.22), -1);
  const top = peak(row, Math.round(H * 0.015), Math.round(H * 0.22), 1);
  const bottom = peak(row, H - 1 - Math.round(H * 0.015), H - 1 - Math.round(H * 0.22), -1);
  const margins = [left / W, 1 - right / W, top / H, 1 - bottom / H];
  // A frame is an even border; very different margins mean we hit the painting.
  if (Math.max(...margins) > 2.5 * Math.min(...margins)) return null;
  const inner: Quad = [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
  const back = homography(rect, q);
  return inner.map((p) => { const r = applyH(back, p); return { x: r.x / s, y: r.y / s }; }) as Quad;
}

/** Maps a point of the corrected image back to source pixels (for "tap a neutral point"). */
export function outputToSource(o: Pick<CorrectOptions, 'quad' | 'quarterTurns' | 'inset'>, out: { width: number; height: number }, p: Pt): Pt {
  const inset = Math.max(0, Math.min(0.15, o.inset ?? 0));
  const q = rotateQuad(o.quad, o.quarterTurns ?? 0);
  const h = homography([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], q);
  return applyH(h, { x: inset + (p.x / out.width) * (1 - 2 * inset), y: inset + (p.y / out.height) * (1 - 2 * inset) });
}
