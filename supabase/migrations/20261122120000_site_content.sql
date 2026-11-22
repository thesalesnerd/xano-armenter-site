-- Website content: what an artist's website says and shows, edited in
-- Artfolio → Website. Additive only: two new tables, their policies and
-- triggers, and five new functions. Nothing existing is altered or dropped,
-- and no catalogue table is touched.
--
--   site_content           one row per artist: the draft being edited, the
--                          published copy visitors see, and who/when
--   site_content_versions  every published copy, for "Earlier versions"
--
-- The content is a JSON object (see docs/xano-website-user-stories.md in the
-- site repo). Text is stored per language ({"en": "...", "es": "..."}), works
-- by their site slug; anything missing falls back to the site's built-in text.
--
-- Access
--   - members of the artist workspace read the draft and the history;
--   - owners and editors (can_edit) write the draft, and only the draft column;
--   - publishing, discarding and restoring go through the functions below,
--     which check can_edit and keep the history consistent;
--   - visitors (anon) never read the tables: site_content_v1(slug) returns the
--     published copy only, and only while the artist's public profile is on.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.site_content (
  artist_id          uuid primary key references public.artists (id) on delete cascade,
  draft              jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) < 262144),
  draft_updated_at   timestamptz not null default now(),
  draft_updated_by   uuid references auth.users (id) on delete set null,
  published          jsonb check (published is null or jsonb_typeof(published) = 'object'),
  published_at       timestamptz,
  published_by       uuid references auth.users (id) on delete set null,
  published_version  uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.site_content_versions (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid not null references public.artists (id) on delete cascade,
  content       jsonb not null check (jsonb_typeof(content) = 'object'),
  published_at  timestamptz not null default now(),
  published_by  uuid references auth.users (id) on delete set null
);

create index site_content_versions_artist_idx
  on public.site_content_versions (artist_id, published_at desc);

-- Who changed the draft, and when (set here so the browser can't fake it).
create function public.site_content_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' or new.draft is distinct from old.draft then
    new.draft_updated_at = now();
    new.draft_updated_by = auth.uid();
  end if;
  return new;
end $$;

create trigger site_content_touch
  before insert or update on public.site_content
  for each row execute function public.site_content_touch();

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------
alter table public.site_content          enable row level security;
alter table public.site_content_versions enable row level security;

create policy "site_content: members read" on public.site_content
  for select to authenticated using (public.is_member(artist_id));
create policy "site_content: editors create" on public.site_content
  for insert to authenticated with check (public.can_edit(artist_id));
create policy "site_content: editors edit draft" on public.site_content
  for update to authenticated using (public.can_edit(artist_id)) with check (public.can_edit(artist_id));

create policy "site_content_versions: members read" on public.site_content_versions
  for select to authenticated using (public.is_member(artist_id));

-- Column grants: the browser may only create a row and change its draft.
-- The published copy and the history are written by the functions below.
revoke all on public.site_content, public.site_content_versions from anon, authenticated;
grant select on public.site_content, public.site_content_versions to authenticated;
grant insert (artist_id, draft) on public.site_content to authenticated;
grant update (draft) on public.site_content to authenticated;

-- ---------------------------------------------------------------------------
-- Publish, discard, restore
-- ---------------------------------------------------------------------------

-- Make the draft live and keep a copy in the history. Returns the version id.
create function public.publish_site_content(p_artist_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_draft jsonb;
  v_id uuid;
begin
  if not public.can_edit(p_artist_id) then
    raise exception 'Only the artist''s owners and editors can publish' using errcode = '42501';
  end if;
  select draft into v_draft from public.site_content where artist_id = p_artist_id for update;
  if v_draft is null then
    raise exception 'Nothing to publish yet' using errcode = 'P0002';
  end if;
  insert into public.site_content_versions (artist_id, content, published_by)
    values (p_artist_id, v_draft, auth.uid())
    returning id into v_id;
  update public.site_content
     set published = v_draft, published_at = now(), published_by = auth.uid(), published_version = v_id
   where artist_id = p_artist_id;
  return v_id;
end $$;

-- Throw away unpublished changes: the draft becomes the published copy again.
create function public.discard_site_draft(p_artist_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.can_edit(p_artist_id) then
    raise exception 'Only the artist''s owners and editors can change the website' using errcode = '42501';
  end if;
  update public.site_content
     set draft = coalesce(published, '{}'::jsonb)
   where artist_id = p_artist_id
  returning draft into v;
  return coalesce(v, '{}'::jsonb);
end $$;

-- Load an earlier published copy into the draft, to preview and then publish.
create function public.restore_site_version(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_artist uuid;
  v_content jsonb;
begin
  select artist_id, content into v_artist, v_content
    from public.site_content_versions where id = p_version_id;
  if v_artist is null or not public.can_edit(v_artist) then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;
  insert into public.site_content (artist_id, draft) values (v_artist, v_content)
    on conflict (artist_id) do update set draft = excluded.draft;
  return v_content;
end $$;

-- ---------------------------------------------------------------------------
-- Public read for the website (anon key), like catalogue_v1
-- ---------------------------------------------------------------------------
create function public.site_content_v1(p_artist_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'version', 1,
    'artist', a.slug,
    'published_at', to_char(s.published_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'content', coalesce(s.published, '{}'::jsonb)
  )
  from public.artists a
  left join public.site_content s on s.artist_id = a.id
  where a.slug = p_artist_slug and a.public_profile
$$;

revoke all on function public.site_content_touch() from public, anon, authenticated;
revoke all on function public.publish_site_content(uuid) from public, anon;
revoke all on function public.discard_site_draft(uuid) from public, anon;
revoke all on function public.restore_site_version(uuid) from public, anon;
grant execute on function public.publish_site_content(uuid) to authenticated;
grant execute on function public.discard_site_draft(uuid) to authenticated;
grant execute on function public.restore_site_version(uuid) to authenticated;
revoke all on function public.site_content_v1(text) from public;
grant execute on function public.site_content_v1(text) to anon, authenticated;
