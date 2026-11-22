import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../workspace';
import { usePieces } from '../lib/queries';
import { supabase } from '../lib/supabase';
import { cap, clean, LOCATION_KINDS, useContacts, useLocations, useRefresh, type Location } from '../lib/parity';
import { Empty, ErrorNote, PageHeader, Spinner } from '../components/ui';
import { Check, Field } from '../components/form';

type Form = { name: string; kind: string; address: string; notes: string; contact_id: string; is_public: boolean };
const blank: Form = { name: '', kind: 'storage', address: '', notes: '', contact_id: '', is_public: false };

export default function Locations() {
  const { artist, canEdit, isOwner } = useWorkspace();
  const { data: locations = [], isLoading } = useLocations(artist.id);
  const { data: pieces = [] } = usePieces(artist.id);
  const { data: contacts = [] } = useContacts(artist.id, isOwner);
  const refresh = useRefresh(artist.id);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pieces) if (p.location_id) m.set(p.location_id, (m.get(p.location_id) ?? 0) + 1);
    return m;
  }, [pieces]);

  // Text locations on pieces that aren't linked to a location record yet.
  const unlinked = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of pieces) {
      const t = p.location?.trim();
      if (t && !p.location_id) m.set(t, [...(m.get(t) ?? []), p.id]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [pieces]);

  if (isLoading) return <Spinner />;

  function edit(l: Location | null) {
    setError(null);
    setEditing(l ? l.id : 'new');
    setForm(l ? { name: l.name, kind: l.kind, address: l.address ?? '', notes: l.notes ?? '', contact_id: l.contact_id ?? '', is_public: l.is_public } : blank);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const v = clean({ ...form, ...(isOwner ? {} : { contact_id: undefined }) });
    const { error } =
      editing === 'new'
        ? await supabase.from('locations').insert({ ...v, artist_id: artist.id } as never)
        : await supabase.from('locations').update(v as never).eq('id', editing!);
    if (error) return setError(error.code === '23505' ? new Error('A location with that name already exists.') : error);
    setEditing(null);
    await refresh('locations');
  }

  async function remove(l: Location) {
    const n = counts.get(l.id) ?? 0;
    if (!confirm(`Delete “${l.name}”?${n ? ` ${n} pieces will have no location record (their location text stays).` : ''}`)) return;
    const { error } = await supabase.from('locations').delete().eq('id', l.id);
    if (error) return setError(error);
    await refresh('locations', 'pieces');
  }

  /** Creates a location for a text value used on pieces and links those pieces. */
  async function adopt(name: string, ids: string[]) {
    setBusy(name);
    setError(null);
    try {
      let loc = locations.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (!loc) {
        const { data, error } = await supabase.from('locations').insert({ artist_id: artist.id, name, kind: /studio/i.test(name) ? 'studio' : 'storage' }).select().single();
        if (error) throw error;
        loc = data;
      }
      const { error } = await supabase.from('pieces').update({ location_id: loc.id }).in('id', ids).is('location_id', null);
      if (error) throw error;
    } catch (e) {
      setError(e);
    }
    setBusy('');
    await refresh('locations', 'pieces');
  }

  const formEl = (
    <form onSubmit={save} className="card mb-6 grid gap-4 p-5 sm:grid-cols-6" aria-label="Location form">
      <Field label="Name" className="sm:col-span-3"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Type" className="sm:col-span-3">
        <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          {LOCATION_KINDS.map((k) => <option key={k} value={k}>{cap(k)}</option>)}
        </select>
      </Field>
      <Field label="Address" className="sm:col-span-6"><textarea className="input min-h-16" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
      {isOwner && (
        <Field label="Contact (gallery, collector…)" className="sm:col-span-3">
          <select className="input" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
            <option value="">—</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Notes" className="sm:col-span-6"><textarea className="input min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      <div className="sm:col-span-6"><Check label="May be shown publicly (e.g. “at KBH Fine Arts Gallery”)" checked={form.is_public} onChange={(v) => setForm({ ...form, is_public: v })} /></div>
      <div className="flex gap-2 sm:col-span-6">
        <button className="btn-primary" disabled={!form.name.trim()}>{editing === 'new' ? 'Add location' : 'Save'}</button>
        <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </form>
  );

  return (
    <div className="max-w-5xl">
      <PageHeader title="Locations" count={locations.length} actions={canEdit && editing === null && <button className="btn-primary" onClick={() => edit(null)}>+ New location</button>}>
        <p className="mt-1 text-sm text-stone-500">Where each work is kept: studio, storage, galleries, collectors on loan. Set a piece's location on its page.</p>
      </PageHeader>
      <ErrorNote error={error} />
      {editing && formEl}

      {canEdit && unlinked.length > 0 && (
        <div className="card mb-6 p-4">
          <h2 className="text-sm font-medium">Locations typed on pieces, not yet a location record</h2>
          <p className="mb-3 text-xs text-stone-500">Turning one into a record links its pieces to it. The text on each piece stays as it is.</p>
          <ul className="divide-y divide-stone-100 text-sm">
            {unlinked.map(([name, ids]) => (
              <li key={name} className="flex items-center justify-between py-1.5">
                <span>{name} <span className="text-stone-500">· {ids.length} pieces</span></span>
                <button className="btn-secondary" disabled={!!busy} onClick={() => adopt(name, ids)}>{busy === name ? 'Linking…' : 'Create & link'}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!locations.length ? (
        <Empty title="No locations yet">Add where your work is stored, or import your Artwork Archive locations from the Import page.</Empty>
      ) : (
        <table className="card w-full overflow-hidden text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr><th className="px-4 py-2">Name</th><th>Type</th><th>Address</th><th className="text-right">Pieces</th><th>Public</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {locations.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 font-medium">{l.name}</td>
                <td>{cap(l.kind)}</td>
                <td className="max-w-64 truncate text-stone-600">{l.address}</td>
                <td className="text-right">
                  <Link className="underline" to={`../pieces?location=${l.id}`}>{counts.get(l.id) ?? 0}</Link>
                </td>
                <td className="pl-4">{l.is_public ? 'Yes' : 'No'}</td>
                <td className="whitespace-nowrap pr-4 text-right">
                  {canEdit && (
                    <>
                      <button className="btn-ghost" onClick={() => edit(l)}>Edit</button>
                      <button className="btn-ghost text-rose-700" onClick={() => remove(l)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
