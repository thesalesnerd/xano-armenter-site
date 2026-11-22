import { useEffect, useRef, useState } from 'react';
import { loadOpenCV, type CV } from '../lib/capture/opencv';
import { detectPainting, glareShare } from '../lib/capture/detect';
import { downscale } from '../lib/capture/process';
import { dist, type Quad } from '../lib/capture/geometry';

export type Shot = { blob: Blob; via: 'guided' | 'phone-camera' | 'library' };

type Live = { quad: Quad | null; coverage: number; touchesEdge: boolean; glare: number; steady: boolean; w: number; h: number };
type Tilt = { a: number; b: number; mode: 'wall' | 'floor' } | null;

const DEG = 180 / Math.PI;

/** Phone tilt from gravity. Wall: phone upright; floor: phone face-down over a painting lying flat. */
function useTilt(enabled: boolean): [Tilt, () => void, boolean] {
  const [tilt, setTilt] = useState<Tilt>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const listen = () => {
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null || g.z == null) return;
      const n = Math.hypot(g.x, g.y, g.z) || 1;
      const x = g.x / n, y = g.y / n, z = g.z / n;
      if (Math.abs(z) > 0.8) {
        setTilt({ a: Math.asin(x) * DEG, b: Math.asin(y) * DEG, mode: 'floor' });
      } else {
        // pitch: leaning forwards/backwards; roll: rotation in the screen plane,
        // measured to the nearest upright or sideways position.
        let roll = Math.atan2(x, -y) * DEG;
        roll = ((roll + 45) % 90 + 90) % 90 - 45;
        setTilt({ a: roll, b: Math.asin(z) * DEG, mode: 'wall' });
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  };
  useEffect(() => {
    if (!enabled) return;
    const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (DM?.requestPermission) { setNeedsPermission(true); return; }
    return listen();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  const ask = () => {
    const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    DM?.requestPermission?.().then((r) => { if (r === 'granted') { setNeedsPermission(false); listen(); } }).catch(() => setNeedsPermission(false));
  };
  return [tilt, ask, needsPermission];
}

export default function CameraView({ onShot, onClose, title }: { onShot: (s: Shot) => void; onClose: () => void; title?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [cv, setCv] = useState<CV | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [tilt, askTilt, tiltNeedsPermission] = useTilt(true);

  // camera
  useEffect(() => {
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('This browser can’t show a live camera here. Use “Phone camera” instead.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 4032 }, height: { ideal: 3024 } } })
      .then(async (s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        const track = s.getVideoTracks()[0];
        // Continuous autofocus where supported.
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }); } catch { /* not supported */ }
        const v = videoRef.current!;
        v.srcObject = s;
        await v.play().catch(() => {});
      })
      .catch((e) => setCamError(e?.name === 'NotAllowedError'
        ? 'Camera access was refused. Allow the camera for this site, or use “Phone camera”.'
        : 'No camera available here. Use “Phone camera” or “Library”.'));
    loadOpenCV().then(setCv).catch(() => setCv(null));
    return () => { stopped = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // where the video is drawn (object-contain)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const update = () => {
      const r = v.getBoundingClientRect();
      const vw = v.videoWidth || 4, vh = v.videoHeight || 3;
      const s = Math.min(r.width / vw, r.height / vh);
      setBox({ x: (r.width - vw * s) / 2, y: (r.height - vh * s) / 2, w: vw * s, h: vh * s });
    };
    const ro = new ResizeObserver(update);
    ro.observe(v);
    v.addEventListener('loadedmetadata', update);
    return () => { ro.disconnect(); v.removeEventListener('loadedmetadata', update); };
  }, []);

  // live detection loop
  useEffect(() => {
    if (!cv) return;
    let alive = true;
    const history: Quad[] = [];
    let smooth: Quad | null = null;
    const tick = () => {
      if (!alive) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        const img = downscale(v, 360);
        const d = detectPainting(cv, img);
        if (d) {
          const diag = Math.hypot(img.width, img.height);
          const jump = smooth ? Math.max(...d.quad.map((p, i) => dist(p, smooth![i]))) / diag : 1;
          smooth = smooth && jump < 0.08 ? (smooth.map((p, i) => ({ x: p.x * 0.5 + d.quad[i].x * 0.5, y: p.y * 0.5 + d.quad[i].y * 0.5 })) as Quad) : d.quad;
          history.push(d.quad);
          if (history.length > 6) history.shift();
          const steady = history.length >= 4 && history.every((q) => Math.max(...q.map((p, i) => dist(p, d.quad[i]))) / diag < 0.015);
          setLive({ quad: smooth, coverage: d.coverage, touchesEdge: d.touchesEdge, glare: glareShare(img, d.quad), steady, w: img.width, h: img.height });
        } else {
          smooth = null;
          history.length = 0;
          setLive({ quad: null, coverage: 0, touchesEdge: false, glare: 0, steady: false, w: img.width, h: img.height });
        }
      }
      setTimeout(tick, 140);
    };
    tick();
    return () => { alive = false; };
  }, [cv]);

  async function shoot() {
    const v = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!v || !track) return;
    setBusy(true);
    try {
      let blob: Blob | null = null;
      const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
      if (IC) {
        try { blob = await new IC(track).takePhoto(); } catch { blob = null; }
      }
      if (!blob) {
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d')!.drawImage(v, 0, 0);
        blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.95));
      }
      if (blob) onShot({ blob, via: 'guided' });
    } finally {
      setBusy(false);
    }
  }

  const fromFile = (via: Shot['via']) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onShot({ blob: f, via });
  };

  // guidance, most important first
  const tiltOff = tilt ? Math.max(Math.abs(tilt.a), Math.abs(tilt.b)) : 0;
  let hint = 'Starting camera…';
  let good = false;
  if (camError) hint = camError;
  else if (!cv) hint = 'Loading the painting detector…';
  else if (!live) hint = 'Point at the painting';
  else if (!live.quad) hint = 'Point at the painting: the whole canvas in view, with a little wall around it';
  else if (live.touchesEdge) hint = 'Step back: part of the painting is cut off';
  else if (live.coverage < 0.22) hint = 'Move closer';
  else if (live.coverage > 0.88) hint = 'Step back a little so some wall shows around it';
  else if (live.glare > 0.004) hint = 'Glare on the painting: step to the side or move the light';
  else if (tiltOff > 5) hint = tilt!.mode === 'floor' ? 'Hold the phone flat over the painting' : 'Hold the phone straight, square to the wall';
  else if (!live.steady) hint = 'Hold still…';
  else { hint = 'Looks good: take the photo'; good = true; }

  const sx = live?.w ? box.w / live.w : 1;
  const pts = live?.quad?.map((p) => `${box.x + p.x * sx},${box.y + p.y * sx}`).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5">✕ Close</button>
        <span className="truncate font-medium">{title ?? 'Photograph a painting'}</span>
        <span className="w-16" />
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-contain" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {pts && <polygon points={pts} fill={good ? 'rgba(16,185,129,.18)' : 'rgba(255,255,255,.08)'} stroke={good ? '#10b981' : '#fbbf24'} strokeWidth="3" strokeLinejoin="round" />}
        </svg>
        {tilt && (
          <div className="absolute right-3 top-3 flex flex-col items-center gap-1" aria-label="Level">
            <div className="relative h-16 w-16 rounded-full border-2 border-white/60 bg-black/30">
              <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
              <div
                className={`absolute h-3.5 w-3.5 rounded-full ${tiltOff < 2 ? 'bg-emerald-400' : tiltOff < 5 ? 'bg-amber-300' : 'bg-rose-400'}`}
                style={{ left: `calc(50% + ${Math.max(-26, Math.min(26, tilt.a * 2.6))}px - 7px)`, top: `calc(50% + ${Math.max(-26, Math.min(26, tilt.b * 2.6))}px - 7px)` }}
              />
            </div>
            <span className="text-[10px] text-white/70">{tilt.mode === 'floor' ? 'flat' : 'upright'} · {tiltOff.toFixed(0)}°</span>
          </div>
        )}
        {tiltNeedsPermission && (
          <button onClick={askTilt} className="absolute right-3 top-3 rounded-full bg-white/15 px-3 py-1.5 text-xs">Show level</button>
        )}
        <div className={`absolute inset-x-4 bottom-4 rounded-lg px-3 py-2 text-center text-sm backdrop-blur ${good ? 'bg-emerald-600/80' : 'bg-black/60'}`}>{hint}</div>
      </div>
      <div className="grid grid-cols-3 items-center px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <button onClick={() => libRef.current?.click()} className="justify-self-start text-sm text-white/80">Library</button>
        <button
          onClick={shoot}
          disabled={!!camError || busy}
          aria-label="Take photo"
          className={`justify-self-center h-[72px] w-[72px] rounded-full border-4 ${good ? 'border-emerald-400' : 'border-white'} bg-white/90 disabled:opacity-40 ${busy ? 'animate-pulse' : ''}`}
        />
        <button onClick={() => phoneRef.current?.click()} className="justify-self-end text-right text-sm text-white/80">Phone<br />camera</button>
      </div>
      <input ref={phoneRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={fromFile('phone-camera')} />
      <input ref={libRef} type="file" accept="image/*" className="hidden" onChange={fromFile('library')} />
    </div>
  );
}
