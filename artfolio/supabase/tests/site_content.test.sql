-- Access rules for site_content (run by run-local.sh after the migrations).
\set ON_ERROR_STOP 1
\set QUIET 1

-- People: an owner, an editor, a viewer, someone from another workspace.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test'),
  ('00000000-0000-0000-0000-00000000000b', 'editor@test'),
  ('00000000-0000-0000-0000-00000000000c', 'viewer@test'),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@test');
insert into public.profiles (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test'),
  ('00000000-0000-0000-0000-00000000000b', 'editor@test'),
  ('00000000-0000-0000-0000-00000000000c', 'viewer@test'),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@test') on conflict do nothing;
insert into public.artists (id, slug, name, public_profile) values
  ('10000000-0000-0000-0000-000000000001', 'xano-armenter', 'Xano Armenter', true),
  ('10000000-0000-0000-0000-000000000002', 'someone-else', 'Someone Else', true),
  ('10000000-0000-0000-0000-000000000003', 'private-one', 'Private', false);
insert into public.artist_members (artist_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'editor'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'viewer'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'owner'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'owner');

create function public.t_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false)
$$;
grant execute on function public.t_as(text) to anon, authenticated;

\echo '1. anon: no table access, public function returns {} before anything is published'
set role anon;
do $$ begin
  begin perform * from public.site_content; raise exception 'FAIL anon read site_content'; exception when insufficient_privilege then null; end;
  begin perform * from public.site_content_versions; raise exception 'FAIL anon read versions'; exception when insufficient_privilege then null; end;
  begin perform public.publish_site_content('10000000-0000-0000-0000-000000000001'); raise exception 'FAIL anon publish'; exception when insufficient_privilege then null; end;
  if public.site_content_v1('xano-armenter') -> 'content' <> '{}'::jsonb then raise exception 'FAIL expected empty content'; end if;
  if public.site_content_v1('private-one') is not null then raise exception 'FAIL private artist visible'; end if;
  if public.site_content_v1('nobody') is not null then raise exception 'FAIL unknown artist'; end if;
end $$;
reset role;

\echo '2. editor: creates the draft, may change only the draft'
set role authenticated;
do $$ begin perform public.t_as('00000000-0000-0000-0000-00000000000b'); end $$;
insert into public.site_content (artist_id, draft)
  values ('10000000-0000-0000-0000-000000000001', '{"about":{"statement":{"en":"Draft one"}}}');
do $$ begin
  if (select draft_updated_by from public.site_content where artist_id = '10000000-0000-0000-0000-000000000001') <> '00000000-0000-0000-0000-00000000000b'
    then raise exception 'FAIL draft_updated_by'; end if;
  begin update public.site_content set published = '{"x":1}'; raise exception 'FAIL editor wrote published'; exception when insufficient_privilege then null; end;
  begin update public.site_content set draft_updated_by = null; raise exception 'FAIL editor wrote draft_updated_by'; exception when insufficient_privilege then null; end;
  begin insert into public.site_content_versions (artist_id, content) values ('10000000-0000-0000-0000-000000000001', '{}'); raise exception 'FAIL editor wrote history'; exception when insufficient_privilege then null; end;
  begin delete from public.site_content; raise exception 'FAIL editor deleted'; exception when insufficient_privilege then null; end;
  begin update public.site_content set draft = '[]'; raise exception 'FAIL non-object draft'; exception when check_violation then null; end;
  -- Not published yet: visitors still see nothing.
  if public.site_content_v1('xano-armenter') -> 'content' <> '{}'::jsonb then raise exception 'FAIL draft leaked before publish'; end if;
end $$;

\echo '3. editor publishes; visitors see the published copy, never the draft'
do $$ begin perform public.publish_site_content('10000000-0000-0000-0000-000000000001'); end $$;
update public.site_content set draft = '{"about":{"statement":{"en":"Draft two"}}}' where artist_id = '10000000-0000-0000-0000-000000000001';
reset role;
set role anon;
do $$ declare c jsonb; begin
  c := public.site_content_v1('xano-armenter');
  if c #>> '{content,about,statement,en}' <> 'Draft one' then raise exception 'FAIL anon sees %', c; end if;
  if c ->> 'published_at' is null then raise exception 'FAIL no published_at'; end if;
end $$;
reset role;

\echo '4. viewer reads but cannot write or publish'
set role authenticated;
do $$ begin perform public.t_as('00000000-0000-0000-0000-00000000000c'); end $$;
do $$ begin
  if (select count(*) from public.site_content) <> 1 then raise exception 'FAIL viewer cannot read'; end if;
  if (select count(*) from public.site_content_versions) <> 1 then raise exception 'FAIL viewer cannot read history'; end if;
  update public.site_content set draft = '{"hacked":true}';
  if (select draft ? 'hacked' from public.site_content) then raise exception 'FAIL viewer changed draft'; end if;
  begin perform public.publish_site_content('10000000-0000-0000-0000-000000000001'); raise exception 'FAIL viewer published'; exception when insufficient_privilege then null; end;
  begin perform public.discard_site_draft('10000000-0000-0000-0000-000000000001'); raise exception 'FAIL viewer discarded'; exception when insufficient_privilege then null; end;
end $$;

\echo '5. a member of another workspace sees nothing and changes nothing'
do $$ begin perform public.t_as('00000000-0000-0000-0000-00000000000d'); end $$;
do $$ declare v uuid; begin
  if (select count(*) from public.site_content) <> 0 then raise exception 'FAIL stranger reads draft'; end if;
  if (select count(*) from public.site_content_versions) <> 0 then raise exception 'FAIL stranger reads history'; end if;
  begin insert into public.site_content (artist_id, draft) values ('10000000-0000-0000-0000-000000000001', '{}'); raise exception 'FAIL stranger inserted'; exception when insufficient_privilege or unique_violation then null; end;
  begin perform public.publish_site_content('10000000-0000-0000-0000-000000000001'); raise exception 'FAIL stranger published'; exception when insufficient_privilege then null; end;
  reset role;
  select id into v from public.site_content_versions limit 1;
  set role authenticated;
  begin perform public.restore_site_version(v); raise exception 'FAIL stranger restored'; exception when no_data_found then null; end;
end $$;

\echo '6. owner: discard, restore an earlier version, publish again'
do $$ begin perform public.t_as('00000000-0000-0000-0000-00000000000a'); end $$;
do $$ declare v1 uuid; v2 uuid; d jsonb; begin
  d := public.discard_site_draft('10000000-0000-0000-0000-000000000001');
  if d #>> '{about,statement,en}' <> 'Draft one' then raise exception 'FAIL discard gave %', d; end if;
  select published_version into v1 from public.site_content;
  update public.site_content set draft = '{"about":{"statement":{"en":"Second"}}}';
  v2 := public.publish_site_content('10000000-0000-0000-0000-000000000001');
  if public.site_content_v1('xano-armenter') #>> '{content,about,statement,en}' <> 'Second' then raise exception 'FAIL second publish'; end if;
  d := public.restore_site_version(v1);
  if (select draft #>> '{about,statement,en}' from public.site_content) <> 'Draft one' then raise exception 'FAIL restore'; end if;
  -- Restoring only changes the draft; the site still shows the live version.
  if public.site_content_v1('xano-armenter') #>> '{content,about,statement,en}' <> 'Second' then raise exception 'FAIL restore went live'; end if;
  perform public.publish_site_content('10000000-0000-0000-0000-000000000001');
  if public.site_content_v1('xano-armenter') #>> '{content,about,statement,en}' <> 'Draft one' then raise exception 'FAIL republish'; end if;
  if (select count(*) from public.site_content_versions) <> 3 then raise exception 'FAIL history count'; end if;
end $$;
reset role;

\echo '7. deleting an artist removes its website content'
delete from public.artists where id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  if exists (select 1 from public.site_content) or exists (select 1 from public.site_content_versions) then raise exception 'FAIL cascade'; end if;
end $$;

\echo 'All site_content tests passed.'
