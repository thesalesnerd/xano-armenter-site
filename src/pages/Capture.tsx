import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../workspace';
import { usePieces } from '../lib/queries';
import { imageUrl, supabase } from '../lib/supabase';
import { dimensions } from '../lib/format';
import type { PieceWithImages } from '../lib/types';
import { ErrorNote, PageHeader, Spinner, Thumb } from '../components/ui';
import CameraView, { type Shot } from '../capture/CameraView';
import Editor, { type Accepted } from '../capture/Editor';
import QrScanner from '../capture/QrScanner';
import { nextInventory, normalizeInventory, parseLabel } from '../lib/capture/labels';
import { saveCapture, type CaptureMeta } from '../lib/capture/save';
import { PIPELINE_VERSION } from '../lib/capture/process';

type Target = { kind: 'existing'; piece: PieceWithImages } | { kind: 'new' };
type Stage = 'pick' | 'scan' | 'camera' | 'edit' | 'save' | 'done';

function recordedAspect(p: PieceWithImages): number | null {
  const w = Number(p.width), h = Number(p.height);
  return w > 0 && h > 0 ? w / h : null;
}

export default function Capture() {
  const { artist, canEdit } = useWorkspace();
  const { data: pieces, isLoading, error } = usePieces(artist.id);
  const [sp, setSp] = useSearchParams();
  const [stage, setStage] = useState<Stage>('pick');
  const [target, setTarget] = useState<Target | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [accepted, setAccepted] = useState<Accepted | null>(null);
  const [saved, setSaved] = useState<{ pieceId: string; url: string; isPublic: boolean; title: string } | null>(null);
  const [scanMsg, setScanMsg] = useState('');

  // Deep link from a work's page: /capture?piece=<id>
  useEffect(() => {
    const id = sp.get('piece');
    if (!id || !pieces || target) return;
    const p = pieces.find((x) => x.id === id);
    if (p) { setTarget({ kind: 'existing', piece: p }); setStage('camera'); }
  }, [sp, pieces, target]);

  const start = (t: Target) => { setTarget(t); setShot(null); setAccepted(null); setStage('camera'); };
  const backToList = () => {
    setStage('pick'); setTarget(null); setShot(null); setAccepted(null);
    if (sp.get('piece')) { sp.delete('piece'); setSp(sp, { replace: true }); }
  };

  const onScan = useCallback((text: string) => {
    const t = parseLabel(text);
    const all = pieces ?? [];
    const p = t?.pieceId ? all.find((x) => x.id === t.pieceId)
      : t?.inventory ? all.find((x) => x.inventory_number && normalizeInventory(x.inventory_number) === t.inventory)
        : t?.slug ? all.find((x) => x.slug === t.slug) : undefined;
    if (p) { setScanMsg(''); start({ kind: 'existing', piece: p }); }
    else { setScanMsg(`No work found for “${text}”.`); setStage('pick'); }
  }, [pieces]);

  if (!canEdit) return <p className="text-stone-600">You need editor access to add photos.</p>;
  if (isLoading) return <Spinner />;
  if (error) return <ErrorNote error={error} />;

  const title = target?.kind === 'existing'
    ? `${target.piece.inventory_number ? target.piece.inventory_number + ' · ' : ''}${target.piece.title}`
    : 'New work';

  if (stage === 'scan') return <QrScanner onResult={onScan} onClose={() => setStage('pick')} />;
  if (stage === 'camera') {
    return <CameraView title={title} onClose={backToList} onShot={(s) => { setShot(s); setStage('edit'); }} />;
  }
  if (stage === 'edit' && shot) {
    return (
      <Editor
        shot={shot}
        title={title}
        recordedAspect={target?.kind === 'existing' ? recordedAspect(target.piece) : null}
        acceptLabel="Next →"
        onRetake={() => setStage('camera')}
        onAccept={(a) => { setAccepted(a); setStage('save'); }}
      />
    );
  }
  if (stage === 'save' && accepted && target) {
    return (
      <SaveSheet
        target={target}
        accepted={accepted}
        pieces={pieces ?? []}
        onBack={() => setStage('edit')}
        onSaved={(s) => { setSaved(s); setStage('done'); }}
      />
    );
  }
  if (stage === 'done' && saved) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="mb-3 font-serif text-2xl">Saved ✓</p>
        <img src={saved.url} alt="" className="mx-auto mb-4 max-h-[50vh] rounded shadow" />
        <p className="mb-6 text-sm text-stone-600">
          {saved.title}.{' '}
          {saved.isPublic ? 'It shows on xanoarmenter.com within a minute.' : 'This work is private, so it isn’t on the website.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={backToList}>Photograph the next work</button>
          <Link className="btn-secondary" to={`../pieces/${saved.pieceId}`}>Open the work</Link>
        </div>
      </div>
    );
  }

  return <Picker pieces={pieces ?? []} onPick={start} onScan={() => setStage('scan')} scanMsg={scanMsg} />;
}

function Picker({ pieces, onPick, onScan, scanMsg }: { pieces: PieceWithImages[]; onPick: (t: Target) => void; onScan: () => void; scanMsg: string }) {
  const [q, setQ] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const missing = pieces.filter((p) => !p.piece_images.length).length;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pieces
      .filter((p) => !onlyMissing || !p.piece_images.length)
      .filter((p) => !s || `${p.title} ${p.inventory_number ?? ''} ${p.year ?? ''}`.toLowerCase().includes(s))
      .sort((a, b) => (a.piece_images.length ? 1 : 0) - (b.piece_images.length ? 1 : 0)
        || (a.inventory_number ?? '').localeCompare(b.inventory_number ?? '', undefined, { numeric: true }));
  }, [pieces, q, onlyMissing]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Photograph" />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button className="card flex flex-col items-center gap-1 px-3 py-5 text-sm hover:bg-stone-50" onClick={onScan}>
          <span className="text-2xl">▣</span>Scan the label
        </button>
        <button className="card flex flex-col items-center gap-1 px-3 py-5 text-sm hover:bg-stone-50" onClick={() => onPick({ kind: 'new' })}>
          <span className="text-2xl">＋</span>New work from a photo
        </button>
      </div>
      {scanMsg && <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{scanMsg}</p>}
      <div className="mb-3 flex items-center gap-2">
        <input className="input flex-1" placeholder="Search title or number" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex shrink-0 items-center gap-1.5 text-sm text-stone-600">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          No photo ({missing})
        </label>
      </div>
      <ul className="card divide-y divide-stone-100">
        {shown.map((p) => (
          <li key={p.id}>
            <button className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-stone-50" onClick={() => onPick({ kind: 'existing', piece: p })}>
              <Thumb src={imageUrl(p.piece_images[0]?.thumb_path ?? p.piece_images[0]?.storage_path)} alt="" className="h-12 w-12 shrink-0 rounded" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-stone-900">{p.title}</span>
                <span className="block truncate text-xs text-stone-500">
                  {[p.inventory_number, p.year, dimensions(p)].filter(Boolean).join(' · ')}
                </span>
              </span>
              {!p.piece_images.length && <span className="chip bg-amber-100 text-amber-900">No photo</span>}
              <span className="text-stone-400">📷</span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="px-3 py-6 text-center text-sm text-stone-500">Nothing matches.</li>}
      </ul>
    </div>
  );
}

function SaveSheet({ target, accepted, pieces, onBack, onSaved }: {
  target: Target;
  accepted: Accepted;
  pieces: PieceWithImages[];
  onBack: () => void;
  onSaved: (s: { pieceId: string; url: string; isPublic: boolean; title: string }) => void;
}) {
  const { artist } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { result } = accepted;
  const previewUrl = useMemo(() => result.canvas.toDataURL('image/jpeg', 0.8), [result]);
  const [makeMain, setMakeMain] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [f, setF] = useState({
    title: '', inventory: nextInventory(pieces.map((p) => p.inventory_number)), year: String(new Date().getFullYear()),
    width: '', height: '', unit: artist.dimension_unit, medium: '', isPublic: false,
  });
  const existing = target.kind === 'existing' ? target.piece : null;
  const aspect = result.usedAspect;
  const suggestedHeight = f.width && !f.height ? (Number(f.width) / aspect).toFixed(1).replace(/\.0$/, '') : '';

  async function save() {
    setErr(null);
    try {
      let pieceId = existing?.id;
      let isPublic = existing?.is_public ?? false;
      let title = existing?.title ?? f.title.trim();
      if (!existing) {
        if (!title) throw new Error('Give the work a title.');
        setBusy('Creating the work…');
        const num = (v: string) => (v.trim() === '' ? null : Number(v));
        const { data, error } = await supabase.from('pieces').insert({
          artist_id: artist.id, title, inventory_number: f.inventory.trim() || null, year: num(f.year),
          width: num(f.width), height: num(f.height || suggestedHeight), dimension_unit: f.unit,
          medium: f.medium.trim() || null, is_public: f.isPublic, status: 'available',
        }).select('id, title, is_public').single();
        if (error) throw error;
        pieceId = data.id; isPublic = data.is_public; title = data.title;
      }
      const meta: CaptureMeta = {
        version: PIPELINE_VERSION,
        captured_at: new Date().toISOString(),
        source: { width: accepted.src.width, height: accepted.src.height, via: accepted.shot.via },
        corners: accepted.options.quad.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        options: { ...accepted.options, quad: undefined } as CaptureMeta['options'],
        result: {
          measuredAspect: result.measuredAspect, usedAspect: result.usedAspect, aspectSource: result.aspectSource, gains: result.gains,
          exposureGain: result.exposureGain, lightingGradient: result.lightingGradient, lightingCorrected: result.lightingCorrected,
          sharpness: result.sharpness, glare: result.glare,
        },
        device: navigator.userAgent.slice(0, 200),
      };
      const { storage_path } = await saveCapture({
        artistId: artist.id, pieceId: pieceId!, result, original: accepted.shot.blob, sourceCanvas: accepted.src.canvas,
        meta, makeMain: existing ? makeMain : true, onStep: setBusy,
      });
      await qc.invalidateQueries({ queryKey: ['pieces', artist.id] });
      await qc.invalidateQueries({ queryKey: ['piece', pieceId] });
      onSaved({ pieceId: pieceId!, url: imageUrl(storage_path)!, isPublic, title });
    } catch (e) {
      setErr(e);
    }
    setBusy('');
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="mx-auto max-w-lg">
      <button className="btn-ghost mb-3" onClick={onBack}>← Back to the photo</button>
      <img src={previewUrl} alt="" className="mx-auto mb-2 max-h-[45vh] rounded shadow" />
      <p className="mb-5 text-center text-xs text-stone-500">{result.width} × {result.height} px · the original photo is kept too</p>

      {existing ? (
        <div className="card space-y-3 p-4">
          <p className="font-serif text-lg">{existing.title}</p>
          <p className="text-xs text-stone-500">{[existing.inventory_number, existing.year, dimensions(existing)].filter(Boolean).join(' · ')}</p>
          {existing.piece_images.length > 0 && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={makeMain} onChange={(e) => setMakeMain(e.target.checked)} />
              <span>
                Make this the main image{existing.is_public ? ' (the one on xanoarmenter.com)' : ''}.
                <span className="block text-xs text-stone-500">The {existing.piece_images.length} existing image{existing.piece_images.length > 1 ? 's are' : ' is'} kept.</span>
              </span>
            </label>
          )}
        </div>
      ) : (
        <div className="card grid grid-cols-2 gap-3 p-4">
          <label className="col-span-2"><span className="label">Title</span><input className="input" value={f.title} onChange={set('title')} autoFocus /></label>
          <label><span className="label">Inventory #</span><input className="input" value={f.inventory} onChange={set('inventory')} /></label>
          <label><span className="label">Year</span><input className="input" inputMode="numeric" value={f.year} onChange={set('year')} /></label>
          <label><span className="label">Width ({f.unit})</span><input className="input" inputMode="decimal" value={f.width} onChange={set('width')} /></label>
          <label>
            <span className="label">Height ({f.unit})</span>
            <input className="input" inputMode="decimal" value={f.height} onChange={set('height')} placeholder={suggestedHeight ? `≈ ${suggestedHeight} from photo` : ''} />
          </label>
          <label className="col-span-2"><span className="label">Medium</span><input className="input" value={f.medium} onChange={set('medium')} placeholder="e.g. Acrylic on canvas" /></label>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isPublic} onChange={set('isPublic')} /> Show on the website</label>
          <p className="col-span-2 text-xs text-stone-500">Measured proportions: {aspect.toFixed(3)} (width ÷ height). Type the width and the height is suggested.</p>
        </div>
      )}
      <div className="mt-4"><ErrorNote error={err} /></div>
      <div className="mt-4 flex gap-2">
        <button className="btn-primary flex-1" disabled={!!busy} onClick={save}>{busy || 'Save'}</button>
        <button className="btn-secondary" disabled={!!busy} onClick={() => navigate('..')}>Cancel</button>
      </div>
    </div>
  );
}
