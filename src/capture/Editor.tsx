import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadOpenCV, type CV } from '../lib/capture/opencv';
import {
  correct, detectInside, detectInSource, loadSource, outputToSource,
  type CorrectOptions, type CorrectResult, type SourceImage,
} from '../lib/capture/process';
import type { Pt, Quad } from '../lib/capture/geometry';
import type { Shot } from './CameraView';

export type Accepted = {
  result: CorrectResult; // full resolution
  src: SourceImage;
  options: CorrectOptions;
  shot: Shot;
};

type Opts = Omit<CorrectOptions, 'quad' | 'recordedAspect'>;
const DEFAULTS: Opts = { quarterTurns: 0, inset: 0, whiteBalance: 'wall', neutralPoint: null, evenLighting: true, autoExposure: true, ev: 0, warmth: 0, sharpen: true };

export default function Editor({
  shot, recordedAspect, title, acceptLabel, onRetake, onAccept, footer,
}: {
  shot: Shot;
  recordedAspect?: number | null;
  title?: string;
  acceptLabel: string;
  onRetake: () => void;
  onAccept: (a: Accepted) => void | Promise<void>;
  footer?: ReactNode;
}) {
  const [cv, setCv] = useState<CV | null>(null);
  const [src, setSrc] = useState<SourceImage | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [detected, setDetected] = useState(true);
  const [wallQuad, setWallQuad] = useState<Quad | null>(null);
  const [mode, setMode] = useState<'corners' | 'result'>('result');
  const [opts, setOpts] = useState<Opts>(DEFAULTS);
  const [useRecorded, setUseRecorded] = useState(true);
  const [preview, setPreview] = useState<{ url: string; res: CorrectResult } | null>(null);
  const [working, setWorking] = useState('Loading…');
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState('');
  const [shotUrl, setShotUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(shot.blob);
    setShotUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [shot]);

  // load + detect
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setWorking('Loading the image engine…');
        const [c, s] = await Promise.all([loadOpenCV(), loadSource(shot.blob)]);
        if (!alive) return;
        setWorking('Finding the painting…');
        await new Promise((r) => setTimeout(r, 30));
        const d = detectInSource(c, s);
        setCv(c); setSrc(s); setQuad(d.quad); setWallQuad(d.quad); setDetected(d.detected);
        if (!d.detected) { setMode('corners'); setNote('Couldn’t find the edges by itself. Drag the four corners onto the corners of the canvas.'); }
        setWorking('');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { alive = false; };
  }, [shot]);

  const options = (q: Quad, maxSide?: number): CorrectOptions => ({
    ...opts, quad: q, maxSide, recordedAspect: useRecorded ? recordedAspect ?? null : null, trustSurroundings: detected, wallQuad,
  });

  // preview render
  useEffect(() => {
    if (!cv || !src || !quad || mode !== 'result') return;
    let alive = true;
    setWorking('Correcting…');
    const t = setTimeout(async () => {
      try {
        const res = correct(cv, src, options(quad, 1400));
        const blob = await new Promise<Blob | null>((r) => res.canvas.toBlob(r, 'image/jpeg', 0.9));
        if (!alive || !blob) return;
        setPreview((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(blob), res }; });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      if (alive) setWorking('');
    }, 40);
    return () => { alive = false; clearTimeout(t); };
  }, [cv, src, quad, mode, opts, useRecorded]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Opts>(k: K, v: Opts[K]) => setOpts((o) => ({ ...o, [k]: v }));

  async function accept() {
    if (!cv || !src || !quad) return;
    setWorking('Making the full-size image…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const o = options(quad);
      const result = correct(cv, src, o);
      setWorking('');
      await onAccept({ result, src, options: o, shot });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setWorking('');
    }
  }

  function trimFrame() {
    if (!cv || !src || !quad) return;
    const inner = detectInside(cv, src, quad);
    if (inner) { setQuad(inner); setNote('Moved in to the next edge. Press again if there’s still frame showing.'); }
    else setNote('No even frame edge found inside. Drag the corners, or use the Trim slider.');
  }

  function redetect() {
    if (!cv || !src) return;
    const d = detectInSource(cv, src);
    setQuad(d.quad); setWallQuad(d.quad); setDetected(d.detected);
    setNote(d.detected ? 'Corners found again.' : 'Couldn’t find the edges. Drag the corners.');
  }

  function tapResult(e: React.MouseEvent<HTMLImageElement>) {
    if (!picking || !preview || !quad) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * preview.res.width, y: ((e.clientY - r.top) / r.height) * preview.res.height };
    const s = outputToSource({ quad, quarterTurns: opts.quarterTurns, inset: opts.inset }, preview.res, p);
    setOpts((o) => ({ ...o, whiteBalance: 'point', neutralPoint: s }));
    setPicking(false);
  }

  const res = preview?.res;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950 text-white" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
        <button onClick={onRetake} className="rounded-full bg-white/10 px-3 py-1.5">↺ Retake</button>
        <span className="min-w-0 truncate text-center font-medium">{title}</span>
        <button onClick={accept} disabled={!!working || !quad} className="rounded-full bg-emerald-500 px-3 py-1.5 font-medium text-black disabled:opacity-40">{acceptLabel}</button>
      </div>
      <div className="flex justify-center gap-1 pb-2 text-xs">
        {(['corners', 'result'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 ${mode === m ? 'bg-white text-black' : 'bg-white/10'}`}>
            {m === 'corners' ? '1 · Corners' : '2 · Result'}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        {error && <div className="absolute inset-x-4 top-4 z-10 rounded bg-rose-600 px-3 py-2 text-sm">{error}</div>}
        {mode === 'corners' && src && quad && <CornerEditor src={src} url={shotUrl} quad={quad} onChange={setQuad} />}
        {mode === 'result' && preview && (
          <div className="flex h-full items-center justify-center p-2">
            <img
              src={compare ? shotUrl : preview.url}
              alt="Corrected painting"
              onClick={tapResult}
              onPointerDown={() => !picking && setCompare(true)}
              onPointerUp={() => setCompare(false)}
              onPointerLeave={() => setCompare(false)}
              className={`max-h-full max-w-full select-none object-contain shadow-2xl ${picking ? 'cursor-crosshair ring-2 ring-amber-300' : ''}`}
              draggable={false}
            />
          </div>
        )}
        {working && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />{working}
            </span>
          </div>
        )}
        {mode === 'result' && preview && !working && (
          <div className="pointer-events-none absolute left-3 top-2 rounded bg-black/50 px-2 py-0.5 text-[11px] text-white/80">
            {picking ? 'Tap something that should be neutral white or grey' : compare ? 'Original photo' : 'Hold to compare with the original'}
          </div>
        )}
      </div>

      <div className="max-h-[42vh] overflow-y-auto border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-sm">
        {note && <p className="mb-2 text-xs text-amber-200">{note}</p>}
        {mode === 'corners' ? (
          <div className="flex flex-wrap gap-2">
            <Btn onClick={redetect}>Auto-detect</Btn>
            <Btn onClick={trimFrame}>Trim frame edge</Btn>
            <Btn onClick={() => set('quarterTurns', ((opts.quarterTurns ?? 0) + 1) % 4)}>Rotate ⟳</Btn>
            <Btn onClick={() => setMode('result')} primary>See result →</Btn>
            <p className="w-full text-xs text-white/50">Drag the corners onto the corners of the canvas. A magnifier shows while you drag.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {res && (
              <ul className="space-y-1 text-xs">
                {res.checks.map((c, i) => (
                  <li key={i} className={c.level === 'ok' ? 'text-emerald-300' : c.level === 'warn' ? 'text-amber-200' : 'text-rose-300'}>
                    {c.level === 'ok' ? '✓' : c.level === 'warn' ? '!' : '✕'} {c.text}
                  </li>
                ))}
                {recordedAspect ? (
                  <li className="text-white/60">
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={useRecorded} onChange={(e) => setUseRecorded(e.target.checked)} />
                      Use the recorded size for proportions {res.aspectSource === 'recorded' ? '(used)' : '(not used)'}
                    </label>
                  </li>
                ) : null}
              </ul>
            )}
            <Row label="White balance">
              {(['wall', 'point', 'off'] as const).map((w) => (
                <Btn key={w} small primary={opts.whiteBalance === w} onClick={() => { if (w === 'point') { setPicking(true); } else set('whiteBalance', w); }}>
                  {w === 'wall' ? 'From wall' : w === 'point' ? 'Tap neutral' : 'As shot'}
                </Btn>
              ))}
            </Row>
            <Row label="Lighting">
              <Btn small primary={!!opts.evenLighting} onClick={() => set('evenLighting', !opts.evenLighting)}>Even out</Btn>
              <Btn small primary={!!opts.autoExposure} onClick={() => set('autoExposure', !opts.autoExposure)}>Auto exposure</Btn>
              <Btn small onClick={() => set('quarterTurns', ((opts.quarterTurns ?? 0) + 1) % 4)}>Rotate ⟳</Btn>
            </Row>
            <Slider label="Exposure" min={-1} max={1} step={0.1} value={opts.ev ?? 0} onChange={(v) => set('ev', v)} fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} EV`} />
            <Slider label="Warmth" min={-1} max={1} step={0.1} value={opts.warmth ?? 0} onChange={(v) => set('warmth', v)} fmt={(v) => (v === 0 ? '0' : v > 0 ? `warmer ${v.toFixed(1)}` : `cooler ${(-v).toFixed(1)}`)} />
            <Slider label="Trim edges" min={0} max={0.1} step={0.0025} value={opts.inset ?? 0} onChange={(v) => set('inset', v)} fmt={(v) => `${(v * 100).toFixed(1)} %`} />
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({ children, onClick, primary, small }: { children: ReactNode; onClick: () => void; primary?: boolean; small?: boolean }) {
  return (
    <button onClick={onClick} className={`rounded-full ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5'} ${primary ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-24 shrink-0 text-xs text-white/60">{label}</span>
      {children}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, fmt }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; fmt: (v: number) => string }) {
  // Commit on release, so the full correction only re-runs once per gesture.
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-white/60">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={v} className="min-w-0 flex-1 accent-white"
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={() => onChange(v)} onKeyUp={() => onChange(v)} onTouchEnd={() => onChange(v)}
      />
      <span className="w-20 text-right text-xs tabular-nums text-white/70">{fmt(v)}</span>
    </label>
  );
}

/** Source photo with four draggable corners and a magnifier. */
function CornerEditor({ src, url, quad, onChange }: { src: SourceImage; url: string; quad: Quad; onChange: (q: Quad) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const loupe = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, s: 1 });
  const [drag, setDrag] = useState<{ i: number; off: Pt } | null>(null);
  const [q, setQ] = useState(quad);
  useEffect(() => setQ(quad), [quad]);

  useEffect(() => {
    const el = wrap.current!;
    const update = () => {
      const r = el.getBoundingClientRect();
      const s = Math.min((r.width - 24) / src.width, (r.height - 24) / src.height);
      setBox({ x: (r.width - src.width * s) / 2, y: (r.height - src.height * s) / 2, s });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [src]);

  const toScreen = (p: Pt) => ({ x: box.x + p.x * box.s, y: box.y + p.y * box.s });
  const toSrc = (x: number, y: number) => ({
    x: Math.max(0, Math.min(src.width, (x - box.x) / box.s)),
    y: Math.max(0, Math.min(src.height, (y - box.y) / box.s)),
  });

  function drawLoupe(p: Pt) {
    const c = loupe.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const size = c.width, zoom = box.s * 4; // 4× the on-screen size
    const r = size / zoom / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(src.canvas, p.x - r, p.y - r, r * 2, r * 2, 0, 0, size, size);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
    ctx.stroke();
  }

  const onDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const r = wrap.current!.getBoundingClientRect();
    const s = toScreen(q[i]);
    setDrag({ i, off: { x: s.x - (e.clientX - r.left), y: s.y - (e.clientY - r.top) } });
    drawLoupe(q[i]);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const r = wrap.current!.getBoundingClientRect();
    const p = toSrc(e.clientX - r.left + drag.off.x, e.clientY - r.top + drag.off.y);
    const n = [...q] as Quad;
    n[drag.i] = p;
    setQ(n);
    drawLoupe(p);
  };
  const onUp = () => {
    if (drag) onChange(q);
    setDrag(null);
  };

  const sp = q.map(toScreen);
  const leftSide = drag ? sp[drag.i].x < (wrap.current?.clientWidth ?? 0) / 2 : false;
  return (
    <div ref={wrap} className="relative h-full w-full touch-none select-none" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <img src={url} alt="" draggable={false} className="absolute" style={{ left: box.x, top: box.y, width: src.width * box.s, height: src.height * box.s }} />
      <svg className="absolute inset-0 h-full w-full">
        <polygon points={sp.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(16,185,129,.12)" stroke="#10b981" strokeWidth="2" />
        {sp.map((p, i) => (
          <g key={i} onPointerDown={onDown(i)} style={{ cursor: 'grab' }}>
            <circle cx={p.x} cy={p.y} r="22" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="9" fill="rgba(0,0,0,.35)" stroke="#fff" strokeWidth="2.5" />
          </g>
        ))}
      </svg>
      <canvas
        ref={loupe}
        width={140}
        height={140}
        className={`pointer-events-none absolute top-2 rounded-full border-2 border-white shadow-xl ${drag ? '' : 'hidden'} ${leftSide ? 'right-2' : 'left-2'}`}
      />
    </div>
  );
}
