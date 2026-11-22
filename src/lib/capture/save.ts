import { supabase, BUCKET } from '../supabase';
import { canvasToJpeg, type CorrectOptions, type CorrectResult } from './process';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 25 * 1024 * 1024; // bucket limit

export type CaptureMeta = {
  version: string;
  captured_at: string;
  source: { width: number; height: number; via: 'guided' | 'phone-camera' | 'library' };
  corners: { x: number; y: number }[];
  options: Omit<CorrectOptions, 'quad'>;
  result: Pick<CorrectResult, 'measuredAspect' | 'usedAspect' | 'aspectSource' | 'gains' | 'exposureGain' | 'lightingGradient' | 'lightingCorrected' | 'sharpness' | 'glare'>;
  device: string;
};

function scaled(c: HTMLCanvasElement, max: number): HTMLCanvasElement {
  const s = Math.min(1, max / Math.max(c.width, c.height));
  const o = document.createElement('canvas');
  o.width = Math.round(c.width * s);
  o.height = Math.round(c.height * s);
  const ctx = o.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, o.width, o.height);
  return o;
}

/**
 * Uploads the corrected image, its thumbnail and the untouched original, and
 * records the image. Existing images are never touched, except that with
 * `makeMain` they move down one position so the new one shows on the website.
 */
export async function saveCapture(args: {
  artistId: string;
  pieceId: string;
  result: CorrectResult;
  original: Blob;
  sourceCanvas: HTMLCanvasElement;
  meta: CaptureMeta;
  makeMain: boolean;
  onStep?: (s: string) => void;
}): Promise<{ id: string; storage_path: string }> {
  const { artistId, pieceId, result, meta, makeMain, onStep } = args;
  const step = onStep ?? (() => {});
  const id = crypto.randomUUID();
  const base = `${artistId}/${pieceId}/${id}`;
  const storage_path = `${base}.jpg`;
  const thumb_path = `${base}_thumb.jpg`;
  const original_path = `${base}_original.jpg`;

  step('Preparing…');
  const full = await canvasToJpeg(result.canvas, 0.92);
  const thumb = await canvasToJpeg(scaled(result.canvas, 640), 0.8);
  let original = args.original;
  if (!ALLOWED.includes(original.type) || original.size > MAX_BYTES || original.type !== 'image/jpeg') {
    original = await canvasToJpeg(args.sourceCanvas, 0.95);
  }

  const bucket = supabase.storage.from(BUCKET);
  const uploaded: string[] = [];
  const put = async (path: string, blob: Blob) => {
    const { error } = await bucket.upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw error;
    uploaded.push(path);
  };
  try {
    step('Uploading original…');
    await put(original_path, original);
    step('Uploading photo…');
    await put(storage_path, full);
    await put(thumb_path, thumb);

    step('Saving…');
    const { data: existing, error: e1 } = await supabase
      .from('piece_images').select('id, position').eq('piece_id', pieceId).order('position');
    if (e1) throw e1;
    const position = existing.length ? Math.max(...existing.map((i) => i.position)) + 1 : 0;
    const row = { id, piece_id: pieceId, artist_id: artistId, storage_path, thumb_path, position, width: result.width, height: result.height };
    // original_path / capture need migration 20261122000000; without it the
    // original is still stored next to the image (<id>_original.jpg).
    let ins = await supabase.from('piece_images').insert({ ...row, original_path, capture: meta } as typeof row);
    if (ins.error && (ins.error.code === 'PGRST204' || ins.error.code === '42703')) {
      ins = await supabase.from('piece_images').insert(row);
    }
    if (ins.error) throw ins.error;
  } catch (e) {
    if (uploaded.length) await bucket.remove(uploaded);
    throw e;
  }

  if (makeMain) {
    step('Making it the main image…');
    const { data: imgs } = await supabase.from('piece_images').select('id, position').eq('piece_id', pieceId).order('position');
    const ordered = [...(imgs ?? []).filter((i) => i.id === id), ...(imgs ?? []).filter((i) => i.id !== id)];
    for (const [position, i] of ordered.entries()) {
      if (i.position !== position) {
        const { error } = await supabase.from('piece_images').update({ position }).eq('id', i.id);
        if (error) throw error;
      }
    }
  }
  return { id, storage_path };
}

export function downloadCanvas(c: HTMLCanvasElement, name: string) {
  return canvasToJpeg(c, 0.92).then((b) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
}
