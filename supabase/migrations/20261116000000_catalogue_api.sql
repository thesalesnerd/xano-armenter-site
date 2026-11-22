-- Catalogue API v1: one versioned, read-only JSON document per artist that any
-- website can consume with the anon key:
--
--   POST /rest/v1/rpc/catalogue_v1   {"p_artist_slug": "<artist>"}
--
-- Adds what a website needs for stable URLs and honest dates:
--   pieces.slug        URL-safe, unique per artist, never changes on its own
--   pieces.year_circa  the year is approximate ("c. 1978")

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Slugs
-- ---------------------------------------------------------------------------
-- "Luz blanca /White Ligth" -> "luz-blanca-white-ligth". Returns '' when the
-- text has no ASCII letters or digits left after folding.
create or replace function public.slugify(p_text text)
returns text language sql stable set search_path = '' as $$
  select trim(both '-' from left(
    trim(both '-' from regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, ''))),
      '[^a-z0-9]+', '-', 'g')),
    80))
$$;

-- First free slug for an artist: base, base-2, base-3, …
create or replace function public.free_piece_slug(p_artist_id uuid, p_base text, p_exclude uuid default null)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  base text := coalesce(nullif(p_base, ''), 'untitled');
  candidate text := base;
  n integer := 1;
begin
  while exists (
    select 1 from public.pieces
    where artist_id = p_artist_id and slug = candidate
      and (p_exclude is null or id <> p_exclude)
  ) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end $$;

-- The '' default only marks "not given": the trigger below always replaces it,
-- and the format check rejects it. It keeps slug optional for API clients and
-- in the generated TypeScript types.
alter table public.pieces
  add column slug text not null default '',
  add column year_circa boolean not null default false;

-- Backfill. Pieces imported from Artwork Archive keep the slug they had there
-- (last segment of ".../artwork/<slug>" in source_ref) so existing links carry
-- over; everything else is slugified from the title. updated_at is left alone.
alter table public.pieces disable trigger pieces_updated_at;

do $$
declare
  r record;
begin
  for r in select id, artist_id, title, source_ref from public.pieces order by created_at, id loop
    update public.pieces
       set slug = public.free_piece_slug(
             r.artist_id,
             coalesce(
               nullif(public.slugify(substring(r.source_ref from '^https?://[^?#]*/artwork/([^/?#]+)/?(?:[?#].*)?$')), ''),
               public.slugify(r.title)),
             r.id)
     where id = r.id;
  end loop;
end $$;

alter table public.pieces enable trigger pieces_updated_at;

alter table public.pieces
  add constraint pieces_artist_slug_key unique (artist_id, slug),
  add constraint pieces_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Insert: no slug -> from the title; a given slug is normalised. Either way it
-- is made unique with -2, -3, …
-- Update: the slug only changes when an editor changes it. It is normalised;
-- clearing it keeps the current one; a clash is an error (unique constraint)
-- rather than a silent rename.
create or replace function public.assign_piece_slug()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  wanted text;
begin
  if tg_op = 'INSERT' then
    wanted := public.slugify(new.slug);
    if wanted = '' then
      wanted := public.slugify(new.title);
    end if;
    new.slug := public.free_piece_slug(new.artist_id, wanted, new.id);
  elsif new.slug is distinct from old.slug then
    if new.slug is null or trim(new.slug) = '' then
      new.slug := old.slug;
    else
      wanted := public.slugify(new.slug);
      if wanted = '' then
        raise exception 'A slug needs at least one letter or digit';
      end if;
      new.slug := wanted;
    end if;
  end if;
  return new;
end $$;

create trigger pieces_slug before insert or update on public.pieces
  for each row execute function public.assign_piece_slug();

revoke all on function public.free_piece_slug(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.assign_piece_slug() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Low-level view: expose the two new columns too (appended, so existing
-- consumers of public_pieces are unaffected).
-- ---------------------------------------------------------------------------
create or replace view public.public_pieces with (security_invoker = false) as
  select p.id, p.artist_id, a.slug as artist_slug, p.inventory_number, p.title, p.kind,
         p.year, p.medium, p.subject, p.style,
         p.height, p.width, p.depth, p.dimension_unit,
         p.framed, p.framed_height, p.framed_width, p.framed_depth,
         case when p.show_price then p.price end as price,
         p.currency, p.status, p.description, p.edition_size, p.tags, p.created_at,
         (select json_agg(json_build_object(
                    'storage_path', i.storage_path, 'thumb_path', i.thumb_path,
                    'caption', i.caption, 'width', i.width, 'height', i.height)
                  order by i.position, i.created_at)
            from public.piece_images i where i.piece_id = p.id) as images,
         p.slug, p.year_circa
  from public.pieces p
  join public.artists a on a.id = p.artist_id
  where a.public_profile and p.is_public;

-- ---------------------------------------------------------------------------
-- catalogue_v1
-- The shape below is a contract: fields may be added, never renamed, removed
-- or given a new meaning. Breaking changes go in catalogue_v2.
-- Private columns (notes, location, signature, source_ref, creation_date,
-- hidden prices, private pieces and collections) are never selected.
-- ---------------------------------------------------------------------------
create or replace function public.catalogue_v1(p_artist_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'version', 1,
    'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'artist', jsonb_build_object(
      'slug', a.slug,
      'name', a.name,
      'bio', a.bio,
      'location', a.location,
      'website', a.website,
      'contact_email', a.contact_email,
      'currency', a.currency,
      'dimension_unit', a.dimension_unit
    ),
    'pieces', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'slug', p.slug,
          'inventory_number', p.inventory_number,
          'title', p.title,
          'kind', p.kind,
          'year', p.year,
          'year_circa', p.year_circa,
          'medium', p.medium,
          'subject', p.subject,
          'style', p.style,
          'height', p.height,
          'width', p.width,
          'depth', p.depth,
          'dimension_unit', p.dimension_unit,
          'framed', p.framed,
          'framed_height', p.framed_height,
          'framed_width', p.framed_width,
          'framed_depth', p.framed_depth,
          'status', p.status,
          'description', p.description,
          'tags', to_jsonb(p.tags),
          'edition_size', p.edition_size,
          'price', case when p.show_price then p.price end,
          'currency', p.currency,
          'images', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'path', i.storage_path,
                'thumb_path', i.thumb_path,
                'width', i.width,
                'height', i.height,
                'caption', i.caption
              ) order by i.position, i.created_at, i.id)
            from public.piece_images i
            where i.piece_id = p.id
          ), '[]'::jsonb),
          'collections', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', c.id, 'name', c.name, 'position', cp.position)
              order by c.name, c.id)
            from public.collection_pieces cp
            join public.collections c on c.id = cp.collection_id
            where cp.piece_id = p.id and c.is_public
          ), '[]'::jsonb),
          'created_at', p.created_at,
          'updated_at', p.updated_at
        ) order by p.year desc nulls last, p.title, p.id)
      from public.pieces p
      where p.artist_id = a.id and p.is_public
    ), '[]'::jsonb),
    'collections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'description', c.description,
          'piece_ids', coalesce((
            select jsonb_agg(cp.piece_id order by cp.position, cp.created_at, cp.piece_id)
            from public.collection_pieces cp
            join public.pieces p on p.id = cp.piece_id
            where cp.collection_id = c.id and p.is_public
          ), '[]'::jsonb)
        ) order by c.name, c.id)
      from public.collections c
      where c.artist_id = a.id and c.is_public
    ), '[]'::jsonb)
  )
  from public.artists a
  where a.slug = p_artist_slug and a.public_profile
$$;

comment on function public.catalogue_v1(text) is
  'Public catalogue of one artist as a single JSON document (contract v1). NULL when the artist does not exist or the profile is not public.';

revoke all on function public.catalogue_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.catalogue_v1(text) to anon, authenticated;
