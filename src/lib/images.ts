import { supabase, BUCKET } from './supabase';

type Resized = { blob: Blob; width: number; height: number };

async function resize(file: Blob, max: number, quality: number): Promise<Resized> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  );
  return { blob, width, height };
}

/** Resizes in the browser (2400px master + 640px thumbnail), uploads both and records the image. */
export async function uploadPieceImage(artistId: string, pieceId: string, file: Blob, position: number) {
  const [full, thumb] = await Promise.all([resize(file, 2400, 0.88), resize(file, 640, 0.8)]);
  const id = crypto.randomUUID();
  const storage_path = `${artistId}/${pieceId}/${id}.jpg`;
  const thumb_path = `${artistId}/${pieceId}/${id}_thumb.jpg`;
  const bucket = supabase.storage.from(BUCKET);
  const up1 = await bucket.upload(storage_path, full.blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (up1.error) throw up1.error;
  const up2 = await bucket.upload(thumb_path, thumb.blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (up2.error) throw up2.error;
  const { error } = await supabase.from('piece_images').insert({
    piece_id: pieceId,
    artist_id: artistId,
    storage_path,
    thumb_path,
    position,
    width: full.width,
    height: full.height,
  });
  if (error) {
    await bucket.remove([storage_path, thumb_path]);
    throw error;
  }
}

export async function deletePieceImage(img: { id: string; storage_path: string; thumb_path: string | null }) {
  const { error } = await supabase.from('piece_images').delete().eq('id', img.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove(imageFiles(img));
}

/** Every stored file of an image: master, thumbnail and (for photographed ones) the untouched original. */
export function imageFiles(img: { storage_path: string; thumb_path: string | null }): string[] {
  return [img.storage_path, img.thumb_path, originalPathFor(img.storage_path)].filter(Boolean) as string[];
}

/** Photographed images keep the phone original next to the master as <id>_original.jpg. */
export function originalPathFor(storagePath: string): string {
  return storagePath.replace(/\.jpg$/, '_original.jpg');
}
