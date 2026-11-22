import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** Reads a QR label with the camera: BarcodeDetector where available, jsQR otherwise. */
export default function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    const detector = BD ? new BD({ formats: ['qr_code'] }) : null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const scan = async () => {
      if (!alive) return;
      const v = video.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        try {
          let text: string | null = null;
          if (detector) {
            const r = await detector.detect(v);
            text = r[0]?.rawValue ?? null;
          } else {
            const s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
            canvas.width = Math.round(v.videoWidth * s);
            canvas.height = Math.round(v.videoHeight * s);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
          }
          if (text && alive) { alive = false; onResult(text); return; }
        } catch { /* keep scanning */ }
      }
      setTimeout(scan, 180);
    };
    navigator.mediaDevices?.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } })
      .then((s) => {
        stream = s;
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        video.current!.srcObject = s;
        video.current!.play().catch(() => {});
        scan();
      })
      .catch(() => setError('No camera. Type the inventory number instead.'));
    return () => { alive = false; stream?.getTracks().forEach((t) => t.stop()); };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5">✕ Close</button>
        <span className="font-medium">Scan the label</span>
        <span className="w-16" />
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,.45)]" />
        {error && <p className="absolute inset-x-4 top-4 rounded bg-black/70 p-3 text-center text-sm">{error}</p>}
      </div>
      <form
        className="flex gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        onSubmit={(e) => { e.preventDefault(); if (typed.trim()) onResult(typed.trim()); }}
      >
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="or type the number, e.g. XA-0042" className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none placeholder:text-white/40" />
        <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Go</button>
      </form>
    </div>
  );
}
