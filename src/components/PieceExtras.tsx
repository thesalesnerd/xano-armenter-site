// Panels under a piece's main form: exhibitions (everyone in the workspace),
// and for owners only: sales, provenance, private notes and documents.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../workspace';
import { supabase } from '../lib/supabase';
import { money } from '../lib/format';
import { cap, PROVENANCE_EVENTS, useContacts, useExhibitions, useRefresh, useSales, type Provenance, type SaleWithRefs } from '../lib/parity';
import { ErrorNote } from './ui';
import { PrivateBadge, Section } from './form';
import SaleForm from './SaleForm';

type P = { id: string; title: string; artist_id: string };

export default function PieceExtras({ piece }: { piece: P }) {
  const { isOwner } = useWorkspace();
  return (
    <div className="mx-auto mt-6 grid max-w-6xl gap-6 lg:grid-cols-2">
      <ExhibitionsPanel piece={piece} />
      {isOwner && (
        <>
          <SalesPanel piece={piece} />
          <ProvenancePanel piece={piece} />
          <NotesPanel piece={piece} />
          <DocumentsPanel piece={piece} />
        </>
      )}
    </div>
  );
}

function ExhibitionsPanel({ piece }: { piece: P }) {
  const { artist, canEdit } = useWorkspace();
  const { data: exhibitions = [] } = useExhibitions(artist.id);
  const refresh = useRefresh(artist.id);
  const [error, setError] = useState<unknown>(null);
  const mine = exhibitions.filter((e) => e.exhibition_pieces.some((x) => x.piece_id === piece.id));
  const others = exhibitions.filter((e) => !mine.includes(e));

  async function toggle(exhibitionId: string, on: boolean) {
    const { error } = on
      ? await supabase.from('exhibition_pieces').insert({ exhibition_id: exhibitionId, piece_id: piece.id, artist_id: artist.id })
      : await supabase.from('exhibition_pieces').delete().eq('exhibition_id', exhibitionId).eq('piece_id', piece.id);
    setError(error);
    await refresh('exhibitions');
  }

  return (
    <Section title="Exhibitions">
      {mine.length ? (
        <ul className="mb-3 divide-y divide-stone-100 text-sm">
          {mine.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-1.5">
              <Link className="underline" to={`../exhibitions/${e.id}`}>{e.title}</Link>
              <span className="flex items-center gap-2 text-stone-500">
                {[e.venue, e.start_date?.slice(0, 4)].filter(Boolean).join(', ')}
                {canEdit && <button type="button" className="text-xs text-rose-700" onClick={() => toggle(e.id, false)} aria-label={`Remove from ${e.title}`}>✕</button>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-stone-500">Not in any exhibition.</p>
      )}
      {canEdit && (
        <select className="input" value="" onChange={(e) => e.target.value && toggle(e.target.value, true)} aria-label="Add to exhibition">
          <option value="">Add to exhibition…</option>
          {others.map((e) => <option key={e.id} value={e.id}>{e.title}{e.start_date ? ` (${e.start_date.slice(0, 4)})` : ''}</option>)}
        </select>
      )}
      <ErrorNote error={error} />
    </Section>
  );
}

function SalesPanel({ piece }: { piece: P }) {
  const { artist } = useWorkspace();
  const { data: sales = [] } = useSales(artist.id);
  const [editing, setEditing] = useState<SaleWithRefs | 'new' | null>(null);
  const mine = sales.filter((s) => s.piece_id === piece.id);
  return (
    <Section title="Sales" actions={<span className="flex items-center gap-2"><PrivateBadge />{!editing && <button type="button" className="btn-secondary" onClick={() => setEditing('new')}>+ Record sale</button>}</span>}>
      {editing ? (
        <SaleForm key={editing === 'new' ? 'new' : editing.id} pieceId={piece.id} sale={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
      ) : mine.length ? (
        <ul className="divide-y divide-stone-100 text-sm">
          {mine.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-1.5">
              <span>{s.sale_date ?? '—'} · {s.buyer?.name ?? 'Unknown buyer'}{s.via ? ` via ${s.via.name}` : ''}{s.status !== 'completed' ? ` (${s.status})` : ''}</span>
              <span className="flex items-center gap-2">
                {money(s.price, s.currency)}
                {s.invoices && <Link className="font-mono text-xs underline" to={`../sales/invoices/${s.invoices.id}`}>{s.invoices.number}</Link>}
                <button type="button" className="btn-ghost" onClick={() => setEditing(s)}>Edit</button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">No sales recorded.</p>
      )}
    </Section>
  );
}

function ProvenancePanel({ piece }: { piece: P }) {
  const { artist } = useWorkspace();
  const { data: contacts = [] } = useContacts(artist.id);
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['provenance', piece.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('provenance').select('*').eq('piece_id', piece.id).order('position').order('created_at');
      if (error) throw error;
      return data;
    },
  });
  const rows = q.data ?? [];
  const refetch = () => q.refetch();

  async function add() {
    const position = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
    const { error } = await supabase.from('provenance').insert({ artist_id: artist.id, piece_id: piece.id, position, event: rows.length ? 'owned' : 'created', party: rows.length ? null : artist.name });
    setError(error);
    await refetch();
  }
  async function update(r: Provenance, patch: Partial<Provenance>) {
    qc.setQueryData(['provenance', piece.id], (d: Provenance[] | undefined) => d?.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('provenance').update(patch).eq('id', r.id);
    setError(error);
    await refetch();
  }
  async function remove(r: Provenance) {
    const { error } = await supabase.from('provenance').delete().eq('id', r.id);
    setError(error);
    await refetch();
  }
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    await supabase.from('provenance').update({ position: j }).eq('id', rows[i].id);
    await supabase.from('provenance').update({ position: i }).eq('id', rows[j].id);
    await refetch();
  }

  return (
    <Section title="Provenance" actions={<span className="flex items-center gap-2"><PrivateBadge /><button type="button" className="btn-secondary" onClick={add}>+ Add entry</button></span>}>
      <p className="mb-3 text-xs text-stone-500">Ownership history, oldest first. Entries marked public appear with the work in the website catalogue.</p>
      {!rows.length && <p className="text-sm text-stone-500">No provenance recorded.</p>}
      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-6 gap-2 rounded-md bg-stone-50 p-2 text-sm" aria-label={`Provenance entry ${i + 1}`}>
            <input className="input col-span-2" placeholder="When (e.g. 2019)" defaultValue={r.date_text ?? ''} onBlur={(e) => e.target.value !== (r.date_text ?? '') && update(r, { date_text: e.target.value || null })} aria-label="When" />
            <select className="input col-span-2" value={r.event} onChange={(e) => update(r, { event: e.target.value })} aria-label="Event">
              {PROVENANCE_EVENTS.map((x) => <option key={x} value={x}>{cap(x)}</option>)}
            </select>
            <select className="input col-span-2" value={r.contact_id ?? ''} onChange={(e) => update(r, { contact_id: e.target.value || null, party: contacts.find((c) => c.id === e.target.value)?.name ?? r.party })} aria-label="Contact">
              <option value="">— contact —</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="input col-span-3" placeholder="Name as it should read" defaultValue={r.party ?? ''} key={`p${r.party}`} onBlur={(e) => e.target.value !== (r.party ?? '') && update(r, { party: e.target.value || null })} aria-label="Party" />
            <input className="input col-span-3" placeholder="Details" defaultValue={r.description ?? ''} onBlur={(e) => e.target.value !== (r.description ?? '') && update(r, { description: e.target.value || null })} aria-label="Details" />
            <div className="col-span-6 flex items-center justify-between">
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-stone-900" checked={r.is_public} onChange={(e) => update(r, { is_public: e.target.checked })} /> Public</label>
              <span className="flex gap-1">
                <button type="button" className="btn-ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button type="button" className="btn-ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">↓</button>
                <button type="button" className="btn-ghost text-rose-700" onClick={() => remove(r)} aria-label="Delete entry">✕</button>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <ErrorNote error={error} />
    </Section>
  );
}

function NotesPanel({ piece }: { piece: P }) {
  const { artist } = useWorkspace();
  const [body, setBody] = useState('');
  const [error, setError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['piece_notes', piece.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('piece_notes').select('*').eq('piece_id', piece.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  async function add() {
    const { error } = await supabase.from('piece_notes').insert({ artist_id: artist.id, piece_id: piece.id, body: body.trim() });
    setError(error);
    if (!error) setBody('');
    await q.refetch();
  }
  async function remove(id: string) {
    if (!confirm('Delete this note?')) return;
    const { error } = await supabase.from('piece_notes').delete().eq('id', id);
    setError(error);
    await q.refetch();
  }
  return (
    <Section title="Private notes log" actions={<PrivateBadge />}>
      <div className="flex gap-2">
        <textarea className="input min-h-16 bg-amber-50/40" placeholder="Condition, conversations, framing, shipping…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="New note" />
        <button type="button" className="btn-primary self-end" disabled={!body.trim()} onClick={add}>Add</button>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {(q.data ?? []).map((n) => (
          <li key={n.id} className="rounded-md bg-stone-50 p-2">
            <div className="flex justify-between text-xs text-stone-500">
              <span>{new Date(n.created_at).toLocaleString()}</span>
              <button type="button" className="text-rose-700" onClick={() => remove(n.id)} aria-label="Delete note">✕</button>
            </div>
            <p className="whitespace-pre-line">{n.body}</p>
          </li>
        ))}
      </ul>
      <ErrorNote error={error} />
    </Section>
  );
}

const DOC_BUCKET = 'documents';

function DocumentsPanel({ piece }: { piece: P }) {
  const { artist } = useWorkspace();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['documents', piece.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('documents').select('*').eq('piece_id', piece.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function upload(files: File[]) {
    setError(null);
    for (const [i, file] of files.entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80);
      const path = `${artist.id}/${piece.id}/${crypto.randomUUID()}-${safe}`;
      const up = await supabase.storage.from(DOC_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (up.error) {
        setError(up.error);
        continue;
      }
      const { error } = await supabase.from('documents').insert({ artist_id: artist.id, piece_id: piece.id, title: file.name, storage_path: path, mime_type: file.type || null, size_bytes: file.size });
      if (error) {
        setError(error);
        await supabase.storage.from(DOC_BUCKET).remove([path]);
      }
    }
    setBusy('');
    await q.refetch();
  }

  async function open(path: string) {
    // Open the tab during the click (popup blockers allow that), then point it at the signed link.
    const tab = window.open('', '_blank');
    const { data, error } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(path, 300);
    if (error) {
      tab?.close();
      return setError(error);
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = data.signedUrl;
    } else window.location.assign(data.signedUrl);
  }

  async function remove(id: string, path: string) {
    if (!confirm('Delete this document?')) return;
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) return setError(error);
    await supabase.storage.from(DOC_BUCKET).remove([path]);
    await q.refetch();
  }

  const kb = (n: number | null) => (n == null ? '' : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

  return (
    <Section title="Documents" actions={<span className="flex items-center gap-2"><PrivateBadge /><button type="button" className="btn-secondary" disabled={!!busy} onClick={() => ref.current?.click()}>{busy || '+ Upload'}</button></span>}>
      <input ref={ref} type="file" multiple className="hidden" data-testid="document-input" onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ''; }} />
      <p className="mb-2 text-xs text-stone-500">Certificates of authenticity, invoices, condition reports, consignment agreements. Stored privately; links expire after 5 minutes.</p>
      {!(q.data ?? []).length ? (
        <p className="text-sm text-stone-500">No documents.</p>
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {(q.data ?? []).map((d) => (
            <li key={d.id} className="flex items-center justify-between py-1.5">
              <button type="button" className="truncate text-left underline" onClick={() => open(d.storage_path)}>{d.title}</button>
              <span className="flex items-center gap-2 text-xs text-stone-500">
                {kb(d.size_bytes)}
                <button type="button" className="text-rose-700" onClick={() => remove(d.id, d.storage_path)} aria-label={`Delete ${d.title}`}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <ErrorNote error={error} />
    </Section>
  );
}
