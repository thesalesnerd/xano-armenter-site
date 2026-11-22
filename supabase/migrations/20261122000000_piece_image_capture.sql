-- Photo capture (branch claude/artfolio-photo-capture). NOT APPLIED: needs Mike's OK.
--
-- Photographed images keep the untouched phone original next to the corrected
-- master, plus the settings used to correct it, so a correction can be redone
-- later without re-photographing the work.
--
--   original_path  storage path of the original, '<artist>/<piece>/<id>_original.jpg'
--   capture        corners, output size, colour gains, exposure, lighting,
--                  proportions used, device, pipeline version
--
-- Both are nullable: uploaded (non-photographed) images leave them empty.
-- No RLS change: piece_images policies are per row and already cover new
-- columns. No storage-policy change: originals live in the same
-- '<artist_id>/<piece_id>/' folder the existing policies govern.
--
-- The app works before this is applied: it stores the original at the same
-- path regardless and retries the insert without these columns.

alter table public.piece_images
  add column if not exists original_path text,
  add column if not exists capture jsonb;

comment on column public.piece_images.original_path is 'Untouched phone original of a photographed image (storage path in bucket artwork).';
comment on column public.piece_images.capture is 'How the photographed image was corrected: corners, colour gains, exposure, version.';
