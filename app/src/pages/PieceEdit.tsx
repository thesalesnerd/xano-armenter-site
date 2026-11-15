import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../workspace';
import { supabase, imageUrl, BUCKET } from '../lib/supabase';
import { useCollections } from '../lib/queries';
import { deletePieceImage, uploadPieceImage } from '../lib/images';
import { STATUSES } from '../lib/format';
import type { Piece, PieceEdition, PieceImage, PieceInsert, PieceStatus } from '../lib/types';
import { ErrorNote, Spinner, StatusBadge } from '../components/ui';

type Form = {
  title: string; slug: string; inventory_number: string; kind: 'original' | 'edition'; year: string; year_circa: boolean; creation_date: string;
  medium: string; subject: string; style: string;
  height: string; width: string; depth: string; dimension_unit: string;
  framed: boolean; framed_height: string; framed_width: string; framed_depth: string;
  price: string; currency: string; show_price: boolean; status: PieceStatus; is_public: boolean;
  description: string; notes: string; signature: string; location: string; edition_size: string; tags: string;
};

function toForm(p: Piece | null, defaults: { currency: string; unit: string }): Form {
  const s = (v: unknown) => (v == null ? '' : String(v));
  return {
    title: s(p?.title), slug: s(p?.slug), inventory_number: s(p?.inventory_number), kind: p?.kind ?? 'original',
    year: s(p?.year), year_circa: p?.year_circa ?? false, creation_date: s(p?.creation_date), medium: s(p?.medium), subject: s(p?.subject), style: s(p?.style),
    height: s(p?.height), width: s(p?.width), depth: s(p?.depth), dimension_unit: p?.dimension_unit ?? defaults.unit,
    framed: p?.framed ?? false, framed_height: s(p?.framed_height), framed_width: s(p?.framed_width), framed_depth: s(p?.framed_depth),
    price: s(p?.price), currency: p?.currency ?? defaults.currency, show_price: p?.show_price ?? true,
    status: p?.status ?? 'available', is_public: p?.is_public ?? false,
    description: s(p?.description), notes: s(p?.notes), signature: s(p?.signature), location: s(p?.location),
    edition_size: s(p?.edition_size), tags: (p?.tags ?? []).join(', '),
  };
}

function fromForm(f: Form): Omit<PieceInsert, 'artist_id'> {
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const str = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    title: f.title.trim(), inventory_number: str(f.inventory_number), kind: f.kind,
    // Blank slug: the database builds one from the title (new piece) or keeps the current one.
    ...(str(f.slug) ? { slug: str(f.slug)! } : {}),
    year: num(f.year), year_circa: f.year_circa && num(f.year) != null, creation_date: str(f.creation_date), medium: str(f.medium), subject: str(f.subject), style: str(f.style),
    height: num(f.height), width: num(f.width), depth: num(f.depth), dimension_unit: f.dimension_unit,
    framed: f.framed, framed_height: f.framed ? num(f.framed_height) : null, framed_width: f.framed ? num(f.framed_width) : null,
    framed_depth: f.framed ? num(f.framed_depth) : null,
    price: num(f.price), currency: f.currency || null, show_price: f.show_price, status: f.status, is_public: f.is_public,
    description: str(f.description), notes: str(f.notes), signature: str(f.signature), location: str(f.location),
    edition_size: f.kind === 'edition' ? num(f.edition_size) : null,
    tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
  };
}

export default function PieceEdit() {
  const { pieceId } = useParams();
  const isNew = !pieceId;
  const { artist, canEdit } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['piece', pieceId],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pieces')
        .select('*, piece_images(*), piece_editions(*), collection_pieces(collection_id)')
        .eq('id', pieceId!)
        .single();
      if (error) throw error;
      data.piece_images.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
      data.piece_editions.sort((a, b) => a.edition_number.localeCompare(b.edition_number, undefined, { numeric: true }));
      return data;
    },
  });
  const { data: collections = [] } = useCollections(artist.id);

  const [form, setForm] = useState<Form>(() => toForm(null, { currency: artist.currency, unit: artist.dimension_unit }));
  const [colIds, setColIds] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (data) {
      setForm(toForm(data, { currency: artist.currency, unit: artist.dimension_unit }));
      setColIds(new Set(data.collection_pieces.map((c) => c.collection_id)));
    }
  }, [data, artist.currency, artist.dimension_unit]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const values = fromForm(form);
      let id = pieceId;
      if (isNew) {
        const { data: created, error } = await supabase.from('pieces').insert({ ...values, artist_id: artist.id }).select('id').single();
        if (error) throw error;
        id = created.id;
        for (const [i, file] of pendingFiles.entries()) await uploadPieceImage(artist.id, id, file, i);
      } else {
        const { error } = await supabase.from('pieces').update(values).eq('id', id!);
        if (error) throw error;
      }
      // Sync collection membership.
      const before = new Set(data?.collection_pieces.map((c) => c.collection_id) ?? []);
      const add = [...colIds].filter((c) => !before.has(c));
      const remove = [...before].filter((c) => !colIds.has(c));
      if (add.length) {
        const { error } = await supabase.from('collection_pieces').insert(add.map((collection_id) => ({ collection_id, piece_id: id!, artist_id: artist.id })));
        if (error) throw error;
      }
      if (remove.length) {
        const { error } = await supabase.from('collection_pieces').delete().eq('piece_id', id!).in('collection_id', remove);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ['pieces', artist.id] });
      await qc.invalidateQueries({ queryKey: ['collections', artist.id] });
      await qc.invalidateQueries({ queryKey: ['piece', id] });
      if (isNew) navigate(`../pieces/${id}`, { replace: true });
      else setSavedAt(Date.now());
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(e.code !== '23505' ? err : new Error(/slug/.test(e.message ?? '') ? 'That web address (slug) is already used by another piece.' : 'That inventory number is already used by another piece.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!data || !confirm(`Delete “${data.title}” and its images? This can't be undone.`)) return;
    const paths = data.piece_images.flatMap((i) => [i.storage_path, i.thumb_path]).filter(Boolean) as string[];
    const { error } = await supabase.from('pieces').delete().eq('id', data.id);
    if (error) return setError(error);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    await qc.invalidateQueries({ queryKey: ['pieces', artist.id] });
    navigate('../pieces', { replace: true });
  }

  if (!isNew && isLoading) return <Spinner />;
  if (loadError) return <ErrorNote error={loadError} />;

  return (
    <form onSubmit={save} className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="../pieces" className="text-sm text-stone-500 hover:text-stone-900">← Pieces</Link>
          <h1 className="mt-1 font-serif text-3xl">{isNew ? 'New piece' : form.title || 'Untitled'}</h1>
          {!isNew && data && (
            <div className="mt-1 flex items-center gap-2 text-sm text-stone-500">
              <span className="font-mono">{data.inventory_number}</span>
              <StatusBadge status={data.status} />
              {data.is_public && artist.public_profile && (
                <a className="underline" href={`/p/${artist.slug}/w/${data.id}`} target="_blank" rel="noreferrer">View public page</a>
              )}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {savedAt && !saving && <span className="text-xs text-emerald-700">Saved</span>}
            {!isNew && <button type="button" className="btn-danger" onClick={remove}>Delete</button>}
            <button className="btn-primary" disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : isNew ? 'Create piece' : 'Save changes'}</button>
          </div>
        )}
      </div>
      <ErrorNote error={error} />

      <fieldset disabled={!canEdit} className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          {isNew ? (
            <PendingImages files={pendingFiles} setFiles={setPendingFiles} />
          ) : (
            <ImageManager images={data!.piece_images} pieceId={pieceId!} />
          )}
          <Section title="Collections">
            {collections.length === 0 ? (
              <p className="text-sm text-stone-500">No collections yet. <Link className="underline" to="../collections">Create one</Link>.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {collections.map((c) => (
                  <label key={c.id} className={`chip cursor-pointer gap-1.5 px-2.5 py-1 ${colIds.has(c.id) ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-700 ring-stone-300'}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={colIds.has(c.id)}
                      onChange={() => setColIds((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Details">
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Title" className="sm:col-span-4"><input className="input" required value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
              <Field label="Inventory #" className="sm:col-span-2"><input className="input font-mono" placeholder="Auto" value={form.inventory_number} onChange={(e) => set('inventory_number', e.target.value)} /></Field>
              <div className="sm:col-span-2">
                <Field label="Year"><input className="input" inputMode="numeric" value={form.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-stone-900" checked={form.year_circa} onChange={(e) => set('year_circa', e.target.checked)} /> Approximate (circa)
                </label>
              </div>
              <Field label="Creation date" className="sm:col-span-2"><input type="date" className="input" value={form.creation_date} onChange={(e) => set('creation_date', e.target.value)} /></Field>
              <Field label="Type" className="sm:col-span-2">
                <select className="input" value={form.kind} onChange={(e) => set('kind', e.target.value as Form['kind'])}>
                  <option value="original">Original</option>
                  <option value="edition">Edition / print run</option>
                </select>
              </Field>
              <Field label="Medium" className="sm:col-span-3"><input className="input" list="dl-medium" placeholder="Acrylic on canvas" value={form.medium} onChange={(e) => set('medium', e.target.value)} /></Field>
              <Field label="Subject" className="sm:col-span-3"><input className="input" placeholder="Marine, Still life…" value={form.subject} onChange={(e) => set('subject', e.target.value)} /></Field>
              <Field label="Style" className="sm:col-span-3"><input className="input" value={form.style} onChange={(e) => set('style', e.target.value)} /></Field>
              <Field label="Tags (comma separated)" className="sm:col-span-3"><input className="input" value={form.tags} onChange={(e) => set('tags', e.target.value)} /></Field>
              <Field label="Web address (slug)" className="sm:col-span-6">
                <input className="input font-mono" placeholder="Auto, from the title" value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))} />
                <span className="mt-1 block text-xs font-normal text-stone-500">Used in links to this piece on websites. It doesn't change when you rename the piece; changing it breaks existing links.</span>
              </Field>
            </div>
            <datalist id="dl-medium">
              {['Acrylic on canvas', 'Oil on canvas', 'Oil on linen', 'Watercolour on paper', 'Mixed media', 'Fresco', 'Monotype', 'Etching', 'Screenprint', 'Charcoal on paper'].map((m) => <option key={m} value={m} />)}
            </datalist>
          </Section>

          <Section title="Dimensions">
            <div className="grid grid-cols-4 gap-3">
              <Field label="Height"><input className="input" inputMode="decimal" value={form.height} onChange={(e) => set('height', e.target.value)} /></Field>
              <Field label="Width"><input className="input" inputMode="decimal" value={form.width} onChange={(e) => set('width', e.target.value)} /></Field>
              <Field label="Depth"><input className="input" inputMode="decimal" value={form.depth} onChange={(e) => set('depth', e.target.value)} /></Field>
              <Field label="Unit">
                <select className="input" value={form.dimension_unit} onChange={(e) => set('dimension_unit', e.target.value)}>
                  <option value="cm">cm</option>
                  <option value="in">in</option>
                </select>
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-stone-900" checked={form.framed} onChange={(e) => set('framed', e.target.checked)} /> Framed
            </label>
            {form.framed && (
              <div className="mt-3 grid grid-cols-4 gap-3">
                <Field label="Framed height"><input className="input" inputMode="decimal" value={form.framed_height} onChange={(e) => set('framed_height', e.target.value)} /></Field>
                <Field label="Framed width"><input className="input" inputMode="decimal" value={form.framed_width} onChange={(e) => set('framed_width', e.target.value)} /></Field>
                <Field label="Framed depth"><input className="input" inputMode="decimal" value={form.framed_depth} onChange={(e) => set('framed_depth', e.target.value)} /></Field>
              </div>
            )}
          </Section>

          <Section title="Status & price">
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Status" className="sm:col-span-2">
                <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as PieceStatus)}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Price" className="sm:col-span-2"><input className="input" inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} /></Field>
              <Field label="Currency" className="sm:col-span-2"><input className="input uppercase" maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} /></Field>
              <Field label="Location" className="sm:col-span-6"><input className="input" placeholder="Studio, Barcelona · Gallery X · Collector name" value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-stone-900" checked={form.is_public} onChange={(e) => set('is_public', e.target.checked)} /> Show on public profile
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-stone-900" checked={form.show_price} onChange={(e) => set('show_price', e.target.checked)} /> Show price publicly
              </label>
            </div>
          </Section>

          {form.kind === 'edition' && (
            <Section title="Edition">
              <Field label="Edition size" className="max-w-40">
                <input className="input" inputMode="numeric" value={form.edition_size} onChange={(e) => set('edition_size', e.target.value.replace(/\D/g, ''))} />
              </Field>
              {isNew ? (
                <p className="mt-3 text-sm text-stone-500">Save the piece to track individual prints.</p>
              ) : (
                <Editions editions={data!.piece_editions} pieceId={pieceId!} editionSize={Number(form.edition_size) || 0} />
              )}
            </Section>
          )}

          <Section title="Description & notes">
            <Field label="Description (public)">
              <textarea className="input min-h-28" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Signature / inscriptions" className="mt-4">
              <input className="input" placeholder="Signed lower right" value={form.signature} onChange={(e) => set('signature', e.target.value)} />
            </Field>
            <Field label="Private notes (never shown publicly)" className="mt-4">
              <textarea className="input min-h-24 bg-amber-50/40" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </Section>
        </div>
      </fieldset>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-stone-500">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function DropZone({ onFiles, label }: { onFiles: (f: File[]) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
      }}
      onClick={() => ref.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 text-center text-sm ${over ? 'border-stone-900 bg-stone-100' : 'border-stone-300 text-stone-500 hover:border-stone-400'}`}
    >
      {label}
      <span className="mt-1 text-xs text-stone-400">JPEG, PNG or WebP · drag & drop or click</span>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
    </div>
  );
}

function PendingImages({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [files]);
  return (
    <Section title="Images">
      {urls.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {urls.map((u, i) => (
            <div key={u} className="relative">
              <img src={u} alt="" className="aspect-square w-full rounded object-cover" />
              <button type="button" className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-xs" onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <DropZone onFiles={(f) => setFiles([...files, ...f])} label="Add images" />
      <p className="mt-2 text-xs text-stone-500">Images upload when you create the piece. The first image is the main one.</p>
    </Section>
  );
}

function ImageManager({ images, pieceId }: { images: PieceImage[]; pieceId: string }) {
  const { artist, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [active, setActive] = useState(0);
  const main = images[Math.min(active, images.length - 1)];

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['piece', pieceId] });
    await qc.invalidateQueries({ queryKey: ['pieces', artist.id] });
  };

  async function upload(files: File[]) {
    setError(null);
    try {
      let pos = images.length ? Math.max(...images.map((i) => i.position)) + 1 : 0;
      for (const [i, f] of files.entries()) {
        setBusy(`Uploading ${i + 1} of ${files.length}…`);
        await uploadPieceImage(artist.id, pieceId, f, pos++);
      }
    } catch (e) {
      setError(e);
    }
    setBusy('');
    await refresh();
  }

  async function makePrimary(img: PieceImage) {
    const ordered = [img, ...images.filter((i) => i.id !== img.id)];
    setBusy('Saving…');
    for (const [position, i] of ordered.entries()) {
      if (i.position !== position) await supabase.from('piece_images').update({ position }).eq('id', i.id);
    }
    setActive(0);
    setBusy('');
    await refresh();
  }

  async function remove(img: PieceImage) {
    if (!confirm('Delete this image?')) return;
    setBusy('Deleting…');
    try {
      await deletePieceImage(img);
    } catch (e) {
      setError(e);
    }
    setActive(0);
    setBusy('');
    await refresh();
  }

  return (
    <Section title="Images">
      {main ? (
        <a href={imageUrl(main.storage_path)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md bg-stone-100">
          <img src={imageUrl(main.storage_path)} alt="" className="mx-auto max-h-[520px] w-full object-contain" />
        </a>
      ) : (
        <div className="mb-3 rounded-md bg-stone-100 py-16 text-center text-sm text-stone-400">No images yet</div>
      )}
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <div key={img.id} className="group relative">
              <button type="button" onClick={() => setActive(i)} className={`block w-full overflow-hidden rounded ${i === active ? 'ring-2 ring-stone-900' : 'ring-1 ring-stone-200'}`}>
                <img src={imageUrl(img.thumb_path ?? img.storage_path)} alt="" className="aspect-square w-full object-cover" />
              </button>
              {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-stone-900/80 px-1 text-[10px] text-white">Main</span>}
              {canEdit && (
                <div className="absolute right-0.5 top-0.5 hidden gap-0.5 group-hover:flex">
                  {i !== 0 && <button type="button" title="Make main image" className="rounded bg-white/90 px-1 text-xs" onClick={() => makePrimary(img)}>★</button>}
                  <button type="button" title="Delete image" className="rounded bg-white/90 px-1 text-xs text-rose-700" onClick={() => remove(img)}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && <div className="mt-3"><DropZone onFiles={upload} label={busy || 'Add images'} /></div>}
      <div className="mt-2"><ErrorNote error={error} /></div>
    </Section>
  );
}

function Editions({ editions, pieceId, editionSize }: { editions: PieceEdition[]; pieceId: string; editionSize: number }) {
  const { artist, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['piece', pieceId] });

  async function generate() {
    const existing = new Set(editions.map((e) => e.edition_number));
    const rows = Array.from({ length: editionSize }, (_, i) => `${i + 1}/${editionSize}`)
      .filter((n) => !existing.has(n))
      .map((edition_number) => ({ piece_id: pieceId, artist_id: artist.id, edition_number }));
    if (!rows.length) return;
    const { error } = await supabase.from('piece_editions').insert(rows);
    setError(error);
    await refresh();
  }

  async function add() {
    const n = prompt('Edition number (e.g. 3/25 or AP 1)');
    if (!n?.trim()) return;
    const { error } = await supabase.from('piece_editions').insert({ piece_id: pieceId, artist_id: artist.id, edition_number: n.trim() });
    setError(error);
    await refresh();
  }

  async function update(id: string, patch: Partial<PieceEdition>) {
    const { error } = await supabase.from('piece_editions').update(patch).eq('id', id);
    setError(error);
    await refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from('piece_editions').delete().eq('id', id);
    setError(error);
    await refresh();
  }

  const sold = editions.filter((e) => e.status === 'sold').length;
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-stone-600">{editions.length} tracked · {sold} sold</span>
        {canEdit && (
          <div className="flex gap-2">
            {editionSize > 0 && editions.length < editionSize && (
              <button type="button" className="btn-secondary" onClick={generate}>Create 1–{editionSize}</button>
            )}
            <button type="button" className="btn-secondary" onClick={add}>+ Add</button>
          </div>
        )}
      </div>
      {editions.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-500">
            <tr><th className="py-1">#</th><th>Status</th><th>Price</th><th>Location</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {editions.map((e) => (
              <tr key={e.id}>
                <td className="py-1.5 pr-2 font-mono text-xs">{e.edition_number}</td>
                <td className="pr-2">
                  <select className="input py-1" value={e.status} onChange={(ev) => update(e.id, { status: ev.target.value as PieceStatus })}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td className="pr-2">
                  <input className="input py-1" defaultValue={e.price ?? ''} inputMode="decimal" onBlur={(ev) => ev.target.value !== String(e.price ?? '') && update(e.id, { price: ev.target.value ? Number(ev.target.value) : null })} />
                </td>
                <td className="pr-2">
                  <input className="input py-1" defaultValue={e.location ?? ''} onBlur={(ev) => ev.target.value !== (e.location ?? '') && update(e.id, { location: ev.target.value || null })} />
                </td>
                <td>{canEdit && <button type="button" className="text-xs text-rose-700" onClick={() => remove(e.id)}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ErrorNote error={error} />
    </div>
  );
}
