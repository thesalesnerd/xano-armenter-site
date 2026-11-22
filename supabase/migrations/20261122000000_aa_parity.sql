-- Artwork Archive parity: everything Artfolio needs so an artist can move
-- their whole inventory over and cancel Artwork Archive.
--
-- ADDITIVE ONLY. New tables, new nullable/defaulted columns, new functions,
-- new storage bucket, and a replaced catalogue_v1 / public_pieces that only
-- ADD fields (and skip images marked private, which none are by default).
-- Nothing is dropped, renamed or retyped, and no existing row is changed.
--
-- Access model for the new tables:
--   * inventory data (locations, exhibitions)    members read, editors write
--   * private business data (contacts, sales,    owners only, read and write
--     invoices, provenance, piece notes,
--     documents, import runs)
-- Anonymous visitors read nothing directly. What is public (public
-- exhibitions, public provenance entries) is published only through
-- catalogue_v1 and the public_* views.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Generic "child row takes artist_id from its piece" already exists
-- (copy_artist_from_piece). For rows whose piece is optional we need a
-- variant that keeps artist_id when piece_id is null, and checks every
-- referenced row belongs to the same artist.
create or replace function public.check_same_artist()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  j jsonb := to_jsonb(new);
  ref record;
  a uuid;
begin
  if j ? 'piece_id' and (j ->> 'piece_id') is not null then
    select artist_id into a from public.pieces where id = (j ->> 'piece_id')::uuid;
    if a is null then raise exception 'Piece not found'; end if;
    new.artist_id := a;
  end if;
  if new.artist_id is null then
    raise exception 'artist_id is required';
  end if;
  for ref in
    select * from (values
      ('location_id', 'locations'), ('contact_id', 'contacts'), ('via_contact_id', 'contacts'),
      ('buyer_contact_id', 'contacts'), ('venue_contact_id', 'contacts'), ('sale_id', 'sales'),
      ('invoice_id', 'invoices'), ('exhibition_id', 'exhibitions'), ('edition_id', 'piece_editions')
    ) v(col, tbl)
  loop
    if j ? ref.col and (j ->> ref.col) is not null then
      execute format('select artist_id from public.%I where id = $1', ref.tbl)
        into a using (j ->> ref.col)::uuid;
      if a is distinct from new.artist_id then
        raise exception '% belongs to a different artist', ref.col;
      end if;
    end if;
  end loop;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Storage locations
-- ---------------------------------------------------------------------------
create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  kind        text not null default 'storage'
                check (kind in ('studio', 'storage', 'gallery', 'collector', 'exhibition', 'other')),
  address     text,
  notes       text,
  contact_id  uuid,               -- FK added below, after contacts exists
  is_public   boolean not null default false,  -- may the location name be shown publicly
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (artist_id, name)
);

alter table public.pieces add column location_id uuid references public.locations (id) on delete set null;
create index pieces_location_idx on public.pieces (location_id);

-- A piece's location must belong to the same artist.
create or replace function public.check_piece_location()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.location_id and l.artist_id = new.artist_id
  ) then
    raise exception 'Location belongs to a different artist';
  end if;
  return new;
end $$;

create trigger pieces_location_check before insert or update of location_id on public.pieces
  for each row execute function public.check_piece_location();

-- ---------------------------------------------------------------------------
-- 2. Contacts, sales and invoices
-- ---------------------------------------------------------------------------
create table public.contacts (
  id               uuid primary key default gen_random_uuid(),
  artist_id        uuid not null references public.artists (id) on delete cascade,
  kind             text not null default 'collector'
                     check (kind in ('collector', 'gallery', 'institution', 'dealer', 'press', 'other')),
  name             text not null check (length(trim(name)) > 0),
  company          text,
  email            text,
  phone            text,
  address          text,
  city             text,
  country          text,
  website          text,
  notes            text,
  tags             text[] not null default '{}',
  represents_artist boolean not null default false,  -- e.g. the artist's gallery
  source_ref       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index contacts_artist_idx on public.contacts (artist_id, name);
create unique index contacts_source_ref_key on public.contacts (artist_id, source_ref) where source_ref is not null;

alter table public.locations
  add constraint locations_contact_fk foreign key (contact_id) references public.contacts (id) on delete set null;

create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid not null references public.artists (id) on delete cascade,
  number        text not null check (length(trim(number)) > 0),
  contact_id    uuid references public.contacts (id) on delete set null,
  issue_date    date not null default current_date,
  due_date      date,
  status        text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  paid_date     date,
  currency      text check (currency ~ '^[A-Z]{3}$'),
  tax_rate      numeric(6, 3) check (tax_rate >= 0),
  shipping      numeric(12, 2) check (shipping >= 0),
  discount      numeric(12, 2) check (discount >= 0),
  notes         text,
  source_ref    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (artist_id, number)
);
create unique index invoices_source_ref_key on public.invoices (artist_id, source_ref) where source_ref is not null;

create table public.sales (
  id                 uuid primary key default gen_random_uuid(),
  artist_id          uuid not null references public.artists (id) on delete cascade,
  piece_id           uuid not null references public.pieces (id) on delete cascade,
  edition_id         uuid references public.piece_editions (id) on delete set null,
  buyer_contact_id   uuid references public.contacts (id) on delete set null,
  via_contact_id     uuid references public.contacts (id) on delete set null,  -- gallery / agent
  invoice_id         uuid references public.invoices (id) on delete set null,
  sale_date          date,
  price              numeric(12, 2) check (price >= 0),
  currency           text check (currency ~ '^[A-Z]{3}$'),
  commission_pct     numeric(6, 3) check (commission_pct >= 0 and commission_pct <= 100),
  tax_amount         numeric(12, 2) check (tax_amount >= 0),
  status             text not null default 'completed' check (status in ('pending', 'completed', 'cancelled')),
  notes              text,
  source_ref         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index sales_piece_idx on public.sales (piece_id);
create index sales_artist_idx on public.sales (artist_id, sale_date desc);
create unique index sales_source_ref_key on public.sales (artist_id, source_ref) where source_ref is not null;

-- Next invoice number for an artist: INV-0001, INV-0002, …  (owners only)
create or replace function public.next_invoice_number(p_artist_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  n integer;
begin
  if not public.is_owner(p_artist_id) then
    raise exception 'Only owners can create invoices';
  end if;
  select coalesce(max((regexp_match(number, '(\d+)$'))[1]::integer), 0) + 1 into n
    from public.invoices where artist_id = p_artist_id;
  return 'INV-' || lpad(n::text, 4, '0');
end $$;

-- ---------------------------------------------------------------------------
-- 3. Images: public/private flag and where an image came from
-- ---------------------------------------------------------------------------
alter table public.piece_images
  add column is_public boolean not null default true,
  add column source_url text;

-- ---------------------------------------------------------------------------
-- 4. Exhibitions, provenance, private notes, documents
-- ---------------------------------------------------------------------------
create table public.exhibitions (
  id                uuid primary key default gen_random_uuid(),
  artist_id         uuid not null references public.artists (id) on delete cascade,
  title             text not null check (length(trim(title)) > 0),
  kind              text not null default 'group'
                      check (kind in ('solo', 'group', 'fair', 'online', 'residency', 'other')),
  venue             text,
  venue_contact_id  uuid references public.contacts (id) on delete set null,
  city              text,
  country           text,
  start_date        date,
  end_date          date,
  url               text,
  description       text,
  is_public         boolean not null default false,
  source_ref        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index exhibitions_artist_idx on public.exhibitions (artist_id, start_date desc);
create unique index exhibitions_source_ref_key on public.exhibitions (artist_id, source_ref) where source_ref is not null;

create table public.exhibition_pieces (
  exhibition_id  uuid not null references public.exhibitions (id) on delete cascade,
  piece_id       uuid not null references public.pieces (id) on delete cascade,
  artist_id      uuid not null references public.artists (id) on delete cascade,
  notes          text,
  created_at     timestamptz not null default now(),
  primary key (exhibition_id, piece_id)
);
create index exhibition_pieces_piece_idx on public.exhibition_pieces (piece_id);

create table public.provenance (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.artists (id) on delete cascade,
  piece_id     uuid not null references public.pieces (id) on delete cascade,
  position     integer not null default 0,
  date_text    text,     -- free text: "1998", "2003–2010", "spring 2021"
  event        text not null default 'owned'
                 check (event in ('created', 'owned', 'sold', 'gifted', 'loaned', 'consigned', 'inherited', 'exhibited', 'other')),
  party        text,     -- owner / institution name as it should read
  contact_id   uuid references public.contacts (id) on delete set null,
  description  text,
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index provenance_piece_idx on public.provenance (piece_id, position);

create table public.piece_notes (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists (id) on delete cascade,
  piece_id    uuid not null references public.pieces (id) on delete cascade,
  body        text not null check (length(trim(body)) > 0),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  source_ref  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index piece_notes_piece_idx on public.piece_notes (piece_id, created_at desc);
create unique index piece_notes_source_ref_key on public.piece_notes (artist_id, source_ref) where source_ref is not null;

create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  artist_id      uuid not null references public.artists (id) on delete cascade,
  piece_id       uuid references public.pieces (id) on delete cascade,
  contact_id     uuid references public.contacts (id) on delete set null,
  sale_id        uuid references public.sales (id) on delete set null,
  exhibition_id  uuid references public.exhibitions (id) on delete set null,
  title          text not null check (length(trim(title)) > 0),
  storage_path   text not null unique,
  mime_type      text,
  size_bytes     bigint,
  source_url     text,
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index documents_piece_idx on public.documents (piece_id);

create table public.import_runs (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists (id) on delete cascade,
  source      text not null,
  file_names  text[] not null default '{}',
  summary     jsonb not null default '{}',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, artist locking, same-artist checks
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['locations', 'contacts', 'invoices', 'sales', 'exhibitions', 'provenance', 'piece_notes', 'documents'] loop
    execute format('create trigger %1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', t);
    execute format('create trigger %1$s_lock_artist before update on public.%1$I for each row execute function public.lock_artist_id()', t);
  end loop;
  foreach t in array array['locations', 'invoices', 'sales', 'exhibitions', 'exhibition_pieces', 'provenance', 'piece_notes', 'documents'] loop
    execute format('create trigger %1$s_same_artist before insert or update on public.%1$I for each row execute function public.check_same_artist()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.locations         enable row level security;
alter table public.contacts          enable row level security;
alter table public.invoices          enable row level security;
alter table public.sales             enable row level security;
alter table public.exhibitions       enable row level security;
alter table public.exhibition_pieces enable row level security;
alter table public.provenance        enable row level security;
alter table public.piece_notes       enable row level security;
alter table public.documents         enable row level security;
alter table public.import_runs       enable row level security;

do $$
declare t text;
begin
  -- Inventory data: members read, editors write.
  foreach t in array array['locations', 'exhibitions', 'exhibition_pieces'] loop
    execute format('create policy "%1$s: members read" on public.%1$I for select to authenticated using (public.is_member(artist_id))', t);
    execute format('create policy "%1$s: editors insert" on public.%1$I for insert to authenticated with check (public.can_edit(artist_id))', t);
    execute format('create policy "%1$s: editors update" on public.%1$I for update to authenticated using (public.can_edit(artist_id)) with check (public.can_edit(artist_id))', t);
    execute format('create policy "%1$s: editors delete" on public.%1$I for delete to authenticated using (public.can_edit(artist_id))', t);
  end loop;
  -- Private business data: the workspace owner only.
  foreach t in array array['contacts', 'invoices', 'sales', 'provenance', 'piece_notes', 'documents', 'import_runs'] loop
    execute format('create policy "%1$s: owners read" on public.%1$I for select to authenticated using (public.is_owner(artist_id))', t);
    execute format('create policy "%1$s: owners insert" on public.%1$I for insert to authenticated with check (public.is_owner(artist_id))', t);
    execute format('create policy "%1$s: owners update" on public.%1$I for update to authenticated using (public.is_owner(artist_id)) with check (public.is_owner(artist_id))', t);
    execute format('create policy "%1$s: owners delete" on public.%1$I for delete to authenticated using (public.is_owner(artist_id))', t);
  end loop;
end $$;

revoke all on function public.check_same_artist() from public, anon, authenticated;
revoke all on function public.check_piece_location() from public, anon, authenticated;
revoke all on function public.next_invoice_number(uuid) from public, anon;
grant execute on function public.next_invoice_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for documents, objects under {artist_id}/...
-- Owners only. Downloads use short-lived signed URLs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

create policy "documents: owners upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.is_owner(public.storage_artist_id(name)));
create policy "documents: owners update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.is_owner(public.storage_artist_id(name)));
create policy "documents: owners delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_owner(public.storage_artist_id(name)));
create policy "documents: owners read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.is_owner(public.storage_artist_id(name)));

-- ---------------------------------------------------------------------------
-- Public catalogue. Same columns as before, in the same order; private
-- images are skipped; new columns appended at the end.
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
            from public.piece_images i where i.piece_id = p.id and i.is_public) as images,
         p.slug, p.year_circa
  from public.pieces p
  join public.artists a on a.id = p.artist_id
  where a.public_profile and p.is_public;

create view public.public_exhibitions with (security_invoker = false) as
  select e.id, e.artist_id, a.slug as artist_slug, e.title, e.kind, e.venue, e.city, e.country,
         e.start_date, e.end_date, e.url, e.description,
         (select array_agg(ep.piece_id order by p.title)
            from public.exhibition_pieces ep
            join public.pieces p on p.id = ep.piece_id and p.is_public
           where ep.exhibition_id = e.id) as piece_ids
  from public.exhibitions e
  join public.artists a on a.id = e.artist_id
  where a.public_profile and e.is_public;

revoke all on public.public_pieces, public.public_exhibitions from anon, authenticated;
grant select on public.public_pieces, public.public_exhibitions to anon, authenticated;

-- catalogue_v1: unchanged fields; added per piece `exhibition_ids` and
-- `provenance` (public entries only) and top-level `exhibitions` (public only).
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
            where i.piece_id = p.id and i.is_public
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
          'updated_at', p.updated_at,
          'exhibition_ids', coalesce((
            select jsonb_agg(e.id order by e.start_date desc nulls last, e.id)
            from public.exhibition_pieces ep
            join public.exhibitions e on e.id = ep.exhibition_id
            where ep.piece_id = p.id and e.is_public
          ), '[]'::jsonb),
          'provenance', coalesce((
            select jsonb_agg(
              jsonb_build_object('date', pv.date_text, 'event', pv.event, 'party', pv.party, 'description', pv.description)
              order by pv.position, pv.created_at, pv.id)
            from public.provenance pv
            where pv.piece_id = p.id and pv.is_public
          ), '[]'::jsonb)
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
    ), '[]'::jsonb),
    'exhibitions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'kind', e.kind,
          'venue', e.venue,
          'city', e.city,
          'country', e.country,
          'start_date', e.start_date,
          'end_date', e.end_date,
          'url', e.url,
          'description', e.description,
          'piece_ids', coalesce((
            select jsonb_agg(ep.piece_id order by p.title, p.id)
            from public.exhibition_pieces ep
            join public.pieces p on p.id = ep.piece_id
            where ep.exhibition_id = e.id and p.is_public
          ), '[]'::jsonb)
        ) order by e.start_date desc nulls last, e.title, e.id)
      from public.exhibitions e
      where e.artist_id = a.id and e.is_public
    ), '[]'::jsonb)
  )
  from public.artists a
  where a.slug = p_artist_slug and a.public_profile
$$;
