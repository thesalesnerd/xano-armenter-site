import { useState } from 'react';
import CameraView, { type Shot } from '../capture/CameraView';
import Editor from '../capture/Editor';
import { downloadCanvas } from '../lib/capture/save';

/**
 * No-login sandbox for the photo capture: same camera and correction as in
 * Artfolio, but the result is only downloaded. Nothing is uploaded.
 */
export default function CaptureTry() {
  const [stage, setStage] = useState<'intro' | 'camera' | 'edit'>('intro');
  const [shot, setShot] = useState<Shot | null>(null);
  const [size, setSize] = useState({ w: '', h: '' });
  const aspect = Number(size.w) > 0 && Number(size.h) > 0 ? Number(size.w) / Number(size.h) : null;

  if (stage === 'camera') return <CameraView title="Try it: photograph a painting" onClose={() => setStage('intro')} onShot={(s) => { setShot(s); setStage('edit'); }} />;
  if (stage === 'edit' && shot) {
    return (
      <Editor
        shot={shot}
        title="Try it"
        recordedAspect={aspect}
        acceptLabel="Download"
        onRetake={() => setStage('camera')}
        onAccept={async ({ result }) => { await downloadCanvas(result.canvas, `painting-${result.width}x${result.height}.jpg`); }}
      />
    );
  }
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-2 font-serif text-3xl">Photograph a painting</h1>
      <p className="mb-6 text-sm text-stone-600">
        A sandbox of Artfolio’s photo capture. Take a photo of a painting on a wall; it finds the edges, squares it up,
        corrects white balance and light from the wall around it, and gives you the image to download.
        Nothing is uploaded.
      </p>
      <ol className="mb-6 list-decimal space-y-1 pl-5 text-sm text-stone-600">
        <li>Light the painting evenly; avoid a lamp or window reflecting in it.</li>
        <li>Stand square to it, with a little wall showing all round.</li>
        <li>Wait for the green outline, then take the photo.</li>
      </ol>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <label><span className="label">Width (optional)</span><input className="input" inputMode="decimal" value={size.w} onChange={(e) => setSize({ ...size, w: e.target.value })} /></label>
        <label><span className="label">Height (optional)</span><input className="input" inputMode="decimal" value={size.h} onChange={(e) => setSize({ ...size, h: e.target.value })} /></label>
        <p className="col-span-2 text-xs text-stone-500">With the real size the proportions are exact.</p>
      </div>
      <button className="btn-primary w-full py-3" onClick={() => setStage('camera')}>Open the camera</button>
    </div>
  );
}
