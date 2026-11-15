import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../workspace';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import type { Artist, MemberRole } from '../lib/types';
import { ErrorNote, PageHeader } from '../components/ui';

export default function Settings() {
  const { artist, isOwner } = useWorkspace();
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Settings" />
      <ProfileForm artist={artist} disabled={!isOwner} />
      <Members />
      {isOwner && <Danger />}
    </div>
  );
}

function ProfileForm({ artist, disabled }: { artist: Artist; disabled: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState(artist);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => setF(artist), [artist]);
  const set = <K extends keyof Artist>(k: K, v: Artist[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase
      .from('artists')
      .update({
        name: f.name, slug: f.slug, bio: f.bio || null, location: f.location || null, website: f.website || null,
        contact_email: f.contact_email || null, currency: f.currency, dimension_unit: f.dimension_unit,
        inventory_prefix: f.inventory_prefix, next_inventory_number: f.next_inventory_number, public_profile: f.public_profile,
      })
      .eq('id', artist.id);
    if (error) return setError(error.code === '23505' ? new Error('That profile address is taken.') : error);
    await qc.invalidateQueries({ queryKey: ['my-artists'] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (f.slug !== artist.slug) navigate(`/a/${f.slug}/settings`, { replace: true });
  }

  return (
    <form onSubmit={save}>
      <fieldset disabled={disabled} className="card space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Artist profile</h2>
        {disabled && <p className="text-sm text-stone-500">Only owners can change these settings.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Name</span><input className="input" required value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="block"><span className="label">Profile address (/p/…)</span><input className="input" required pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]" value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} /></label>
          <label className="block"><span className="label">Location</span><input className="input" value={f.location ?? ''} onChange={(e) => set('location', e.target.value)} /></label>
          <label className="block"><span className="label">Website</span><input className="input" type="url" value={f.website ?? ''} onChange={(e) => set('website', e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className="label">Contact email shown on public profile</span><input className="input" type="email" value={f.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className="label">Bio</span><textarea className="input min-h-28" value={f.bio ?? ''} onChange={(e) => set('bio', e.target.value)} /></label>
        </div>
        <label className="flex items-center gap-2 rounded-md bg-stone-50 p-3 text-sm">
          <input type="checkbox" className="accent-stone-900" checked={f.public_profile} onChange={(e) => set('public_profile', e.target.checked)} />
          <span><strong>Public profile is live</strong><br /><span className="text-stone-500">Shows pieces marked public at /p/{f.slug}. Your website can read the same catalogue.</span></span>
        </label>
        <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Inventory defaults</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="block"><span className="label">Currency</span><input className="input uppercase" maxLength={3} value={f.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} /></label>
          <label className="block"><span className="label">Units</span>
            <select className="input" value={f.dimension_unit} onChange={(e) => set('dimension_unit', e.target.value)}><option value="cm">cm</option><option value="in">in</option></select>
          </label>
          <label className="block"><span className="label">Inventory prefix</span><input className="input font-mono" placeholder="XA-" value={f.inventory_prefix} onChange={(e) => set('inventory_prefix', e.target.value)} /></label>
          <label className="block"><span className="label">Next number</span><input className="input" type="number" min={1} value={f.next_inventory_number} onChange={(e) => set('next_inventory_number', Number(e.target.value))} /></label>
        </div>
        <p className="text-xs text-stone-500">New pieces get <span className="font-mono">{f.inventory_prefix}{String(f.next_inventory_number).padStart(4, '0')}</span> unless you type your own number.</p>
        <ErrorNote error={error} />
        {!disabled && (
          <div className="flex items-center gap-3">
            <button className="btn-primary">Save settings</button>
            {saved && <span className="text-sm text-emerald-700">Saved</span>}
          </div>
        )}
      </fieldset>
    </form>
  );
}

function Members() {
  const { artist, isOwner } = useWorkspace();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('editor');
  const [error, setError] = useState<unknown>(null);
  const { data: members = [] } = useQuery({
    queryKey: ['members', artist.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('artist_members').select('user_id, role, created_at').eq('artist_id', artist.id).order('created_at');
      if (error) throw error;
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', data.map((m) => m.user_id));
      return data.map((m) => ({ ...m, profile: profiles?.find((p) => p.id === m.user_id) }));
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['members', artist.id] });

  async function invite(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('add_member_by_email', { p_artist_id: artist.id, p_email: email, p_role: role });
    setError(error);
    if (!error) setEmail('');
    refresh();
  }
  async function changeRole(user_id: string, r: MemberRole) {
    const { error } = await supabase.from('artist_members').update({ role: r }).eq('artist_id', artist.id).eq('user_id', user_id);
    setError(error);
    refresh();
  }
  async function remove(user_id: string) {
    if (!confirm('Remove this person from the workspace?')) return;
    const { error } = await supabase.from('artist_members').delete().eq('artist_id', artist.id).eq('user_id', user_id);
    setError(error);
    refresh();
    if (!error && user_id === session?.user.id) window.location.href = import.meta.env.BASE_URL;
  }

  return (
    <section className="card p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-stone-500">People</h2>
      <ul className="divide-y divide-stone-100">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{m.profile?.full_name || m.profile?.email}{m.user_id === session?.user.id ? ' (you)' : ''}</div>
              <div className="truncate text-xs text-stone-500">{m.profile?.email}</div>
            </div>
            {isOwner ? (
              <select className="input w-28" value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value as MemberRole)}>
                <option value="owner">Owner</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
              </select>
            ) : (
              <span className="capitalize text-stone-500">{m.role}</span>
            )}
            {(isOwner || m.user_id === session?.user.id) && (
              <button className="btn-ghost text-xs" onClick={() => remove(m.user_id)}>{m.user_id === session?.user.id ? 'Leave' : 'Remove'}</button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form onSubmit={invite} className="mt-4 flex flex-wrap gap-2">
          <input className="input min-w-56 flex-1" type="email" required placeholder="Email of someone with an Artfolio account" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="input w-28" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
            <option value="editor">Editor</option><option value="viewer">Viewer</option><option value="owner">Owner</option>
          </select>
          <button className="btn-primary">Add</button>
        </form>
      )}
      <p className="mt-2 text-xs text-stone-500">Owners manage settings and people. Editors add and edit pieces. Viewers can only look.</p>
      <div className="mt-2"><ErrorNote error={error} /></div>
    </section>
  );
}

function Danger() {
  const { artist } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  async function del() {
    if (prompt(`This permanently deletes ${artist.name} and every piece, image and collection. Type the profile address “${artist.slug}” to confirm.`) !== artist.slug) return;
    const paths: string[] = [];
    const { data: imgs } = await supabase.from('piece_images').select('storage_path, thumb_path').eq('artist_id', artist.id);
    imgs?.forEach((i) => { paths.push(i.storage_path); if (i.thumb_path) paths.push(i.thumb_path); });
    for (let i = 0; i < paths.length; i += 100) await supabase.storage.from('artwork').remove(paths.slice(i, i + 100));
    const { error } = await supabase.from('artists').delete().eq('id', artist.id);
    if (error) return setError(error);
    await qc.invalidateQueries({ queryKey: ['my-artists'] });
    navigate('/', { replace: true });
  }
  return (
    <section className="card p-5 ring-rose-200">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-700">Danger zone</h2>
      <p className="mb-3 text-sm text-stone-600">Export a CSV from Reports first if you want a copy.</p>
      <button className="btn-danger" onClick={del}>Delete this artist</button>
      <ErrorNote error={error} />
    </section>
  );
}
