-- Quick update: record when a work was last checked by the artist.
--
-- OPTIONAL and NOT YET APPLIED to the live project. Quick update works without it
-- (progress is kept in the browser). Once this column exists, every answer in Quick
-- update also stamps `checked_at`, so the inventory has a server-side record of which
-- works the artist has confirmed (e.g. for the sold/available clean-up), on any device.
--
-- Not exposed in public_pieces: it is internal bookkeeping.

alter table public.pieces
  add column if not exists checked_at timestamptz;

comment on column public.pieces.checked_at is
  'When the artist last confirmed this record in Quick update (/a/:slug/play). Null = never.';
