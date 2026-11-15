-- Artfolio: artwork inventory for multiple artists.
--
-- Tenancy model: every row belongs to an `artist` (a workspace). Users get
-- access through `artist_members` with a role (owner / editor / viewer).
-- The public catalogue is served through the `public_*` views, which expose
-- only public-safe columns of pieces the artist has marked public.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'editor', 'viewer');

create type public.piece_status as enum (
  'available', 'on_hold', 'sold', 'on_loan', 'consigned',
  'not_for_sale', 'gifted', 'donated', 'destroyed', 'archived'
);

create type public.piece_kind as enum ('original', 'edition');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Artists (workspaces) and membership
-- ---------------------------------------------------------------------------
create table public.artists (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique
                           check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  name                   text not null check (length(trim(name)) > 0),
  bio                    text,
  location               text,
  website                text,
  contact_email          text,
  currency               text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  dimension_unit         text not null default 'cm' check (dimension_unit in ('cm', 'in')),
  inventory_prefix       text not null default '',
  next_inventory_number  integer not null default 1,
  public_profile         boolean not null default false,
  created_by             uuid references auth.users (id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger artists_updated_at before update on public.artists
  for each row execute function public.set_updated_at();

create table public.artist_members (
  artist_id   uuid not null references public.artists (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null default 'editor',
  created_at  timestamptz not null default now(),
  primary key (artist_id, user_id)
);

create index artist_members_user_idx on public.artist_members (user_id);

-- Role checks. SECURITY DEFINER so they can read artist_members without
-- recursing through its own RLS policies.
create or replace function public.member_role_of(a uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select role from public.artist_members where artist_id = a and user_id = auth.uid()
$$;

create or replace function public.is_member(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.artist_members where artist_id = a and user_id = auth.uid())
$$;

create or replace function public.can_edit(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.artist_members
    where artist_id = a and user_id = auth.uid() and role in ('owner', 'editor')
  )
$$;

create or replace function public.is_owner(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.artist_members
    where artist_id = a and user_id = auth.uid() and role = 'owner'
  )
$$;

-- The creator of an artist workspace becomes its owner.
create or replace function public.add_creator_as_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    insert into public.artist_members (artist_id, user_id, role)
    values (new.id, auth.uid(), 'owner')
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger artists_add_owner after insert on public.artists
  for each row execute function public.add_creator_as_owner();

-- Never leave a workspace without an owner.
create or replace function public.keep_one_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  remaining integer;
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    -- Cascading delete of the whole artist is fine.
    if not exists (select 1 from public.artists where id = old.artist_id) then
      return coalesce(new, old);
    end if;
    select count(*) into remaining from public.artist_members
      where artist_id = old.artist_id and role = 'owner' and user_id <> old.user_id;
    if remaining = 0 then
      raise exception 'An artist must keep at least one owner';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger artist_members_keep_owner
  before update or delete on public.artist_members
  for each row execute function public.keep_one_owner();

-- Invite an existing user (by email) to a workspace. Owners only.
create or replace function public.add_member_by_email(
  p_artist_id uuid, p_email text, p_role public.member_role default 'editor'
) returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
begin
  if not public.is_owner(p_artist_id) then
    raise exception 'Only owners can add members';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'No account found for %. Ask them to sign up first.', p_email;
  end if;
  insert into public.artist_members (artist_id, user_id, role)
  values (p_artist_id, uid, p_role)
  on conflict (artist_id, user_id) do update set role = excluded.role;
end $$;

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------
create table public.collections (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.artists (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  description  text,
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (artist_id, name)
);

create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Pieces
-- ---------------------------------------------------------------------------
create table public.pieces (
  id                uuid primary key default gen_random_uuid(),
  artist_id         uuid not null references public.artists (id) on delete cascade,
  inventory_number  text,
  title             text not null check (length(trim(title)) > 0),
  kind              public.piece_kind not null default 'original',
  year              integer check (year between 1000 and 3000),
  creation_date     date,
  medium            text,
  subject           text,
  style             text,
  height            numeric(10, 2) check (height >= 0),
  width             numeric(10, 2) check (width >= 0),
  depth             numeric(10, 2) check (depth >= 0),
  dimension_unit    text not null default 'cm' check (dimension_unit in ('cm', 'in')),
  framed            boolean not null default false,
  framed_height     numeric(10, 2) check (framed_height >= 0),
  framed_width      numeric(10, 2) check (framed_width >= 0),
  framed_depth      numeric(10, 2) check (framed_depth >= 0),
  price             numeric(12, 2) check (price >= 0),
  currency          text check (currency ~ '^[A-Z]{3}$'),
  status            public.piece_status not null default 'available',
  is_public         boolean not null default false,
  show_price        boolean not null default true,
  description       text,     -- public
  notes             text,     -- private, never exposed publicly
  signature         text,
  location          text,
  edition_size      integer check (edition_size > 0),
  tags              text[] not null default '{}',
  source_ref        text,     -- id / URL in the system it was imported from
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (artist_id, inventory_number)
);

create index pieces_artist_idx on public.pieces (artist_id, created_at desc);
create index pieces_status_idx on public.pieces (artist_id, status);

create trigger pieces_updated_at before update on public.pieces
  for each row execute function public.set_updated_at();

-- Assign the next inventory number (prefix + zero-padded counter) on insert.
create or replace function public.assign_inventory_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  prefix text;
begin
  if new.inventory_number is null or trim(new.inventory_number) = '' then
    loop
      update public.artists
         set next_inventory_number = next_inventory_number + 1
       where id = new.artist_id
       returning next_inventory_number - 1, inventory_prefix into n, prefix;
      new.inventory_number := prefix || lpad(n::text, 4, '0');
      exit when not exists (
        select 1 from public.pieces
        where artist_id = new.artist_id and inventory_number = new.inventory_number
      );
    end loop;
  end if;
  if new.currency is null then
    select currency into new.currency from public.artists where id = new.artist_id;
  end if;
  return new;
end $$;

create trigger pieces_inventory_number before insert on public.pieces
  for each row execute function public.assign_inventory_number();

-- A piece cannot move between artists.
create or replace function public.lock_artist_id()
returns trigger language plpgsql as $$
begin
  if new.artist_id <> old.artist_id then
    raise exception 'artist_id cannot be changed';
  end if;
  return new;
end $$;

create trigger pieces_lock_artist before update on public.pieces
  for each row execute function public.lock_artist_id();
create trigger collections_lock_artist before update on public.collections
  for each row execute function public.lock_artist_id();

-- ---------------------------------------------------------------------------
-- Child tables (images, editions, collection membership)
-- artist_id is denormalised for RLS and always copied from the parent piece.
-- ---------------------------------------------------------------------------
create table public.piece_images (
  id            uuid primary key default gen_random_uuid(),
  piece_id      uuid not null references public.pieces (id) on delete cascade,
  artist_id     uuid not null references public.artists (id) on delete cascade,
  storage_path  text not null,
  thumb_path    text,
  position      integer not null default 0,
  caption       text,
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);

create index piece_images_piece_idx on public.piece_images (piece_id, position);

create table public.piece_editions (
  id              uuid primary key default gen_random_uuid(),
  piece_id        uuid not null references public.pieces (id) on delete cascade,
  artist_id       uuid not null references public.artists (id) on delete cascade,
  edition_number  text not null,
  status          public.piece_status not null default 'available',
  price           numeric(12, 2) check (price >= 0),
  location        text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (piece_id, edition_number)
);

create trigger piece_editions_updated_at before update on public.piece_editions
  for each row execute function public.set_updated_at();

create table public.collection_pieces (
  collection_id  uuid not null references public.collections (id) on delete cascade,
  piece_id       uuid not null references public.pieces (id) on delete cascade,
  artist_id      uuid not null references public.artists (id) on delete cascade,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  primary key (collection_id, piece_id)
);

create index collection_pieces_piece_idx on public.collection_pieces (piece_id);

create or replace function public.copy_artist_from_piece()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select artist_id into new.artist_id from public.pieces where id = new.piece_id;
  if new.artist_id is null then
    raise exception 'Piece % not found', new.piece_id;
  end if;
  return new;
end $$;

-- Separate function: PL/pgSQL resolves NEW.<field> per table, so the
-- collection check can't live in the shared trigger above.
create or replace function public.check_collection_piece()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.collections c
    where c.id = new.collection_id and c.artist_id = new.artist_id
  ) then
    raise exception 'Collection and piece belong to different artists';
  end if;
  return new;
end $$;

create trigger piece_images_artist before insert or update on public.piece_images
  for each row execute function public.copy_artist_from_piece();
create trigger piece_editions_artist before insert or update on public.piece_editions
  for each row execute function public.copy_artist_from_piece();
create trigger collection_pieces_artist before insert or update on public.collection_pieces
  for each row execute function public.copy_artist_from_piece();
create trigger collection_pieces_check before insert or update on public.collection_pieces
  for each row execute function public.check_collection_piece();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.artists           enable row level security;
alter table public.artist_members    enable row level security;
alter table public.collections       enable row level security;
alter table public.pieces            enable row level security;
alter table public.piece_images      enable row level security;
alter table public.piece_editions    enable row level security;
alter table public.collection_pieces enable row level security;

-- Profiles: yourself, and people you share a workspace with.
create policy "profiles: read self and teammates" on public.profiles
  for select to authenticated using (
    id = auth.uid() or exists (
      select 1 from public.artist_members mine
      join public.artist_members theirs on theirs.artist_id = mine.artist_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Artists
create policy "artists: members read" on public.artists
  for select to authenticated using (public.is_member(id) or created_by = auth.uid());
create policy "artists: signed-in users create" on public.artists
  for insert to authenticated with check (created_by = auth.uid());
create policy "artists: owners update" on public.artists
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));
create policy "artists: owners delete" on public.artists
  for delete to authenticated using (public.is_owner(id));

-- Members
create policy "members: members read" on public.artist_members
  for select to authenticated using (public.is_member(artist_id));
create policy "members: owners manage" on public.artist_members
  for all to authenticated using (public.is_owner(artist_id)) with check (public.is_owner(artist_id));
create policy "members: leave workspace" on public.artist_members
  for delete to authenticated using (user_id = auth.uid());

-- Workspace content: members read, owners/editors write.
do $$
declare t text;
begin
  foreach t in array array['collections', 'pieces', 'piece_images', 'piece_editions', 'collection_pieces'] loop
    execute format(
      'create policy "%1$s: members read" on public.%1$I for select to authenticated using (public.is_member(artist_id))', t);
    execute format(
      'create policy "%1$s: editors insert" on public.%1$I for insert to authenticated with check (public.can_edit(artist_id))', t);
    execute format(
      'create policy "%1$s: editors update" on public.%1$I for update to authenticated using (public.can_edit(artist_id)) with check (public.can_edit(artist_id))', t);
    execute format(
      'create policy "%1$s: editors delete" on public.%1$I for delete to authenticated using (public.can_edit(artist_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Public catalogue (read-only views, safe columns only)
-- These run with the view owner's rights so anonymous visitors never touch
-- the underlying tables; the WHERE clauses are the access rule.
-- ---------------------------------------------------------------------------
create view public.public_artists with (security_invoker = false) as
  select id, slug, name, bio, location, website, contact_email, currency, dimension_unit
  from public.artists
  where public_profile;

create view public.public_pieces with (security_invoker = false) as
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
            from public.piece_images i where i.piece_id = p.id) as images
  from public.pieces p
  join public.artists a on a.id = p.artist_id
  where a.public_profile and p.is_public;

create view public.public_collections with (security_invoker = false) as
  select c.id, c.artist_id, a.slug as artist_slug, c.name, c.description,
         (select array_agg(cp.piece_id order by cp.position, cp.created_at)
            from public.collection_pieces cp
            join public.pieces p on p.id = cp.piece_id and p.is_public
           where cp.collection_id = c.id) as piece_ids
  from public.collections c
  join public.artists a on a.id = c.artist_id
  where a.public_profile and c.is_public;

revoke all on public.public_artists, public.public_pieces, public.public_collections from anon, authenticated;
grant select on public.public_artists, public.public_pieces, public.public_collections to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one bucket, objects stored under {artist_id}/{piece_id}/...
-- Public-read with unguessable paths (like most image CDNs); writes need
-- editor rights on the artist that owns the folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artwork', 'artwork', true, 26214400, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.storage_artist_id(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end $$;

create policy "artwork: editors upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artwork' and public.can_edit(public.storage_artist_id(name)));
create policy "artwork: editors update" on storage.objects
  for update to authenticated
  using (bucket_id = 'artwork' and public.can_edit(public.storage_artist_id(name)));
create policy "artwork: editors delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'artwork' and public.can_edit(public.storage_artist_id(name)));
create policy "artwork: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'artwork' and public.is_member(public.storage_artist_id(name)));
