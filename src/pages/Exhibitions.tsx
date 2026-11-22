import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../workspace';
import { supabase, imageUrl } from '../lib/supabase';
import { usePieces } from '../lib/queries';
import { cap, clean, EXHIBITION_KINDS, useContacts, useExhibitions, useRefresh, type Exhibition } from '../lib/parity';
import { Empty, ErrorNote, PageHeader, Spinner, Thumb } from '../components/ui';
import { Check, Field, PublicBadge } from '../components/form';

const range = (e: Pick<Exhibition, 'start_date' | 'end_date'>) => [e.start_date, e.end_date].filter(Boolean).join(' – ');

export default function Exhibitions() {
  const { artist, canEdit } = useWorkspace();
  const { data: exhibitions = [], isLoading } = useExhibitions(artist.id);
  const refresh = useRefresh(artist.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<unknown>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.from('exhibitions').insert({ artist_id: artist.id, title: title.trim() }).select('id').single();
    if (error) return setError(error);
    await refresh('exhibitions');
    navigate(data.id);
  }

  if (isLoading) return <Spinner />;
  return (
    <div className="max-w-5xl">
      <PageHeader title="Exhibitions" count={exhibitions.length}>
        <p className="mt-1 text-sm text-stone-500">Shows, fairs and residencies, and which works were in them. Public exhibitions appear in the website catalogue.</p>
      </PageHeader>
      {canEdit && (
        <form onSubmit={create} className="mb-6 flex max-w-md gap-2">
          <input className="input" placeholder="New exhibition title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={!title.trim()}>Create</button>
        </form>
      )}
      <ErrorNote error={error} />
      {!exhibitions.length ? (
        <Empty title="No exhibitions yet">Create one above, or bring them over from your Artwork Archive export.</Empty>
      ) : (
        <ul className="card divide-y divide-stone-100">
          {exhibitions.map((e) => (
            <li key={e.id}>
              <Link to={e.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-stone-50">
                <span>
                  <span className="font-serif text-lg">{e.title}</span>
                  <span className="block text-sm text-stone-500">{[e.venue, e.city, range(e)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex items-center gap-3 text-sm text-stone-500">
                  {e.exhibition_pieces.length} works <PublicBadge on={e.is_public} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Form = { title: string; kind: string; venue: string; venue_contact_id: string; city: string; country: string; start_date: string; end_date: string; url: string; description: string; is_public: boolean };

export function ExhibitionDetail() {
  const { exhibitionId } = useParams();
  const { artist, canEdit, isOwner } = useWorkspace();
  const { data: exhibitions = [], isLoading } = useExhibitions(artist.id);
  const { data: pieces = [] } = usePieces(artist.id);
  const { data: contacts = [] } = useContacts(artist.id, isOwner);
  const refresh = useRefresh(artist.id);
  const navigate = useNavigate();
  const ex = exhibitions.find((e) => e.id === exhibitionId);
  const [f, setF] = useState<Form | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (ex) {
      const s = (v: string | null) => v ?? '';
      setF({ title: ex.title, kind: ex.kind, venue: s(ex.venue), venue_contact_id: s(ex.venue_contact_id), city: s(ex.city), country: s(ex.country), start_date: s(ex.start_date), end_date: s(ex.end_date), url: s(ex.url), description: s(ex.description), is_public: ex.is_public });
    }
  }, [ex]);

  const inShow = useMemo(() => new Set(ex?.exhibition_pieces.map((x) => x.piece_id)), [ex]);
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return pieces.filter((p) => !inShow.has(p.id) && `${p.inventory_number} ${p.title}`.toLowerCase().includes(n)).slice(0, 8);
  }, [q, pieces, inShow]);

  if (isLoading || (ex && !f)) return <Spinner />;
  if (!ex || !f) return <p className="p-8 text-stone-500">Exhibition not found. <Link className="underline" to="../exhibitions">Back</Link></p>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setSaved(false); setF((x) => ({ ...x!, [k]: v })); };

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = clean({ ...f!, ...(isOwner ? {} : { venue_contact_id: undefined }) });
    const { error } = await supabase.from('exhibitions').update(v as never).eq('id', ex!.id);
    if (error) return setError(error);
    setSaved(true);
    await refresh('exhibitions');
  }

  async function toggle(pieceId: string, on: boolean) {
    const { error } = on
      ? await supabase.from('exhibition_pieces').insert({ exhibition_id: ex!.id, piece_id: pieceId, artist_id: artist.id })
      : await supabase.from('exhibition_pieces').delete().eq('exhibition_id', ex!.id).eq('piece_id', pieceId);
    if (error) return setError(error);
    setQ('');
    await refresh('exhibitions');
  }

  async function remove() {
    if (!confirm(`Delete “${ex!.title}”? The works themselves are not affected.`)) return;
    const { error } = await supabase.from('exhibitions').delete().eq('id', ex!.id);
    if (error) return setError(error);
    await refresh('exhibitions');
    navigate('../exhibitions');
  }

  const shown = pieces.filter((p) => inShow.has(p.id));

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="../exhibitions" className="text-sm text-stone-500 hover:text-stone-900">← Exhibitions</Link>
      <h1 className="mb-6 mt-1 font-serif text-3xl">{f.title || 'Untitled'}</h1>
      <ErrorNote error={error} />
      <fieldset disabled={!canEdit} className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-6" aria-label="Exhibition form">
          <Field label="Title" className="sm:col-span-4"><input className="input" required value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Type" className="sm:col-span-2">
            <select className="input" value={f.kind} onChange={(e) => set('kind', e.target.value)}>
              {EXHIBITION_KINDS.map((k) => <option key={k} value={k}>{cap(k)}</option>)}
            </select>
          </Field>
          <Field label="Venue" className="sm:col-span-3"><input className="input" value={f.venue} onChange={(e) => set('venue', e.target.value)} /></Field>
          {isOwner ? (
            <Field label="Venue contact" className="sm:col-span-3">
              <select className="input" value={f.venue_contact_id} onChange={(e) => set('venue_contact_id', e.target.value)}>
                <option value="">—</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          ) : <div className="sm:col-span-3" />}
          <Field label="City" className="sm:col-span-3"><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Country" className="sm:col-span-3"><input className="input" value={f.country} onChange={(e) => set('country', e.target.value)} /></Field>
          <Field label="Opens" className="sm:col-span-3"><input type="date" className="input" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
          <Field label="Closes" className="sm:col-span-3"><input type="date" className="input" value={f.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
          <Field label="Website" className="sm:col-span-6"><input className="input" value={f.url} onChange={(e) => set('url', e.target.value)} /></Field>
          <Field label="Description (public when the exhibition is public)" className="sm:col-span-6"><textarea className="input min-h-20" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <div className="sm:col-span-6"><Check label="Public (listed in the website catalogue)" checked={f.is_public} onChange={(v) => set('is_public', v)} /></div>
          {canEdit && (
            <div className="flex items-center gap-2 sm:col-span-6">
              <button className="btn-primary">Save</button>
              <button type="button" className="btn-danger" onClick={remove}>Delete</button>
              {saved && <span className="text-xs text-emerald-700">Saved</span>}
            </div>
          )}
        </form>

        <section className="card p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Works in this exhibition ({shown.length})</h2>
          {canEdit && (
            <div className="relative mb-4">
              <input className="input" placeholder="Add a work: type a title or inventory #" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Add a work" />
              {matches.length > 0 && (
                <ul className="card absolute z-10 mt-1 w-full divide-y divide-stone-100 shadow-lg">
                  {matches.map((p) => (
                    <li key={p.id}><button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-stone-50" onClick={() => toggle(p.id, true)}><span className="font-mono text-xs">{p.inventory_number}</span> {p.title}</button></li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <ul className="grid grid-cols-3 gap-3">
            {shown.map((p) => (
              <li key={p.id} className="group relative">
                <Link to={`../pieces/${p.id}`}>
                  <Thumb src={imageUrl(p.piece_images[0]?.thumb_path ?? p.piece_images[0]?.storage_path)} alt={p.title} className="aspect-square w-full rounded" />
                  <div className="mt-1 truncate text-xs">{p.title}</div>
                </Link>
                {canEdit && <button type="button" className="absolute right-1 top-1 hidden rounded bg-white/90 px-1 text-xs text-rose-700 group-hover:block" onClick={() => toggle(p.id, false)} title="Remove from exhibition">✕</button>}
              </li>
            ))}
          </ul>
        </section>
      </fieldset>
    </div>
  );
}
