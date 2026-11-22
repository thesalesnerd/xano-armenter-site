import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../workspace';
import { useCollections, usePieces } from '../lib/queries';
import { applyFilters, filtersFromParams, filtersToParams, type Filters } from '../lib/filters';
import { dimensions, money, STATUSES } from '../lib/format';
import { imageUrl, supabase, BUCKET } from '../lib/supabase';
import { imageFiles } from '../lib/images';
import type { PieceStatus, PieceWithImages } from '../lib/types';
import FilterBar from '../components/FilterBar';
import { Empty, ErrorNote, PageHeader, Spinner, StatusBadge, Thumb } from '../components/ui';

type View = 'grid' | 'list' | 'table';

const VIEW_ICONS: Record<View, string> = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M4 6h16M4 12h16M4 18h16',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
};

export default function Pieces() {
  const { artist, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const filters = filtersFromParams(sp);
  const view = (sp.get('view') ?? 'grid') as View;
  const { data: pieces, isLoading, error } = usePieces(artist.id);
  const { data: collections = [] } = useCollections(artist.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => applyFilters(pieces ?? [], filters), [pieces, sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilters = (f: Filters) => setSp(filtersToParams(f, sp), { replace: true });
  const setView = (v: View) => {
    const next = new URLSearchParams(sp);
    if (v === 'grid') next.delete('view');
    else next.set('view', v);
    setSp(next, { replace: true });
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));

  async function bulk(fn: (ids: string[]) => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setBulkError(null);
    const ids = [...selected];
    const { error } = await fn(ids);
    setBusy(false);
    if (error) return setBulkError(error);
    await qc.invalidateQueries({ queryKey: ['pieces', artist.id] });
    await qc.invalidateQueries({ queryKey: ['collections', artist.id] });
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (!confirm(`Delete ${ids.length} piece${ids.length > 1 ? 's' : ''} and their images? This can't be undone.`)) return;
    const paths = (pieces ?? [])
      .filter((p) => selected.has(p.id))
      .flatMap((p) => p.piece_images.flatMap(imageFiles));
    await bulk(async (ids) => {
      const res = await supabase.from('pieces').delete().in('id', ids);
      if (!res.error && paths.length) await supabase.storage.from(BUCKET).remove(paths);
      return res;
    });
    setSelected(new Set());
  }

  if (isLoading) return <Spinner />;
  if (error) return <ErrorNote error={error} />;

  return (
    <div>
      <PageHeader
        title="Pieces"
        count={pieces?.length}
        actions={
          <>
            <div className="flex rounded-md ring-1 ring-stone-300">
              {(['grid', 'list', 'table'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-2.5 py-1.5 first:rounded-l-md last:rounded-r-md ${view === v ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 hover:bg-stone-100'}`}
                  aria-label={`${v} view`}
                  aria-pressed={view === v}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d={VIEW_ICONS[v]} />
                  </svg>
                </button>
              ))}
            </div>
            {canEdit && <Link to="new" className="btn-primary">+ New piece</Link>}
          </>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} pieces={pieces ?? []} collections={collections} />

      {canEdit && selected.size > 0 && (
        <div className="sticky top-0 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-sm text-white shadow-lg">
          <span className="mr-1 font-medium">{selected.size} selected</span>
          <select
            className="rounded bg-stone-800 px-2 py-1 text-sm"
            value=""
            disabled={busy}
            onChange={(e) => bulk((ids) => supabase.from('pieces').update({ status: e.target.value as PieceStatus }).in('id', ids))}
            aria-label="Set status"
          >
            <option value="" disabled>Set status…</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            className="rounded bg-stone-800 px-2 py-1 text-sm"
            value=""
            disabled={busy}
            onChange={(e) => bulk((ids) => supabase.from('pieces').update({ is_public: e.target.value === 'public' }).in('id', ids))}
            aria-label="Set visibility"
          >
            <option value="" disabled>Visibility…</option>
            <option value="public">Show on public profile</option>
            <option value="private">Make private</option>
          </select>
          {collections.length > 0 && (
            <select
              className="rounded bg-stone-800 px-2 py-1 text-sm"
              value=""
              disabled={busy}
              onChange={(e) =>
                bulk((ids) =>
                  supabase
                    .from('collection_pieces')
                    .upsert(ids.map((piece_id) => ({ collection_id: e.target.value, piece_id, artist_id: artist.id })), { ignoreDuplicates: true }),
                )
              }
              aria-label="Add to collection"
            >
              <option value="" disabled>Add to collection…</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <Link className="rounded px-2 py-1 hover:bg-stone-700" to={`../reports/print?type=inventory&ids=${[...selected].join(',')}`}>
            Report
          </Link>
          <button className="rounded px-2 py-1 text-rose-300 hover:bg-stone-700" onClick={bulkDelete} disabled={busy}>Delete</button>
          <button className="ml-auto rounded px-2 py-1 hover:bg-stone-700" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
      {bulkError != null && <div className="mt-3"><ErrorNote error={bulkError} /></div>}

      <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
        <span>{shown.length === pieces?.length ? `${shown.length} pieces` : `${shown.length} of ${pieces?.length} pieces`}</span>
        {canEdit && shown.length > 0 && (
          <button
            className="underline"
            onClick={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((p) => p.id)))}
          >
            {allShownSelected ? 'Deselect all' : 'Select all shown'}
          </button>
        )}
      </div>

      <div className="mt-3">
        {!pieces?.length ? (
          <Empty title="No pieces yet">
            Add your first piece, or bring your whole inventory across from a spreadsheet export.
            <div className="mt-4 flex justify-center gap-2">
              {canEdit && <Link to="new" className="btn-primary">+ New piece</Link>}
              {canEdit && <Link to="../import" className="btn-secondary">Import</Link>}
            </div>
          </Empty>
        ) : !shown.length ? (
          <Empty title="No pieces match">Try a different search or clear the filters.</Empty>
        ) : view === 'grid' ? (
          <Grid pieces={shown} selected={selected} toggle={canEdit ? toggle : undefined} />
        ) : view === 'list' ? (
          <List pieces={shown} selected={selected} toggle={canEdit ? toggle : undefined} />
        ) : (
          <Table pieces={shown} selected={selected} toggle={canEdit ? toggle : undefined} />
        )}
      </div>
    </div>
  );
}

type ViewProps = { pieces: PieceWithImages[]; selected: Set<string>; toggle?: (id: string) => void };

function SelectBox({ id, selected, toggle, className = '' }: { id: string; selected: Set<string>; toggle?: (id: string) => void; className?: string }) {
  if (!toggle) return null;
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 cursor-pointer accent-stone-900 ${className}`}
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Select piece"
    />
  );
}

function Grid({ pieces, selected, toggle }: ViewProps) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {pieces.map((p) => {
        const img = p.piece_images[0];
        return (
          <div key={p.id} className="group relative">
            <Link to={p.id} className="block">
              <div className={`relative aspect-square overflow-hidden rounded-md bg-stone-100 ${selected.has(p.id) ? 'ring-2 ring-stone-900 ring-offset-2' : ''}`}>
                <Thumb src={imageUrl(img?.thumb_path ?? img?.storage_path)} alt={p.title} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
              </div>
              <div className="mt-2 text-center">
                <div className="truncate font-serif text-[15px] text-stone-900">{p.title}</div>
                <div className="truncate text-xs text-stone-500">{[p.year, p.medium].filter(Boolean).join(', ')}</div>
                <div className="truncate text-xs text-stone-500">{dimensions(p)}</div>
              </div>
            </Link>
            <div className="absolute left-2 top-2 flex gap-1">
              <SelectBox id={p.id} selected={selected} toggle={toggle} className={selected.size ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'} />
            </div>
            <div className="absolute right-2 top-2 flex gap-1">
              {p.status !== 'available' && <StatusBadge status={p.status} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function List({ pieces, selected, toggle }: ViewProps) {
  return (
    <ul className="card divide-y divide-stone-200">
      {pieces.map((p) => {
        const img = p.piece_images[0];
        return (
          <li key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-stone-50">
            <SelectBox id={p.id} selected={selected} toggle={toggle} />
            <Link to={p.id} className="flex min-w-0 flex-1 items-center gap-4">
              <Thumb src={imageUrl(img?.thumb_path ?? img?.storage_path)} alt={p.title} className="h-16 w-16 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-base">{p.title}</div>
                <div className="truncate text-xs text-stone-500">
                  {[p.inventory_number, p.year, p.medium, dimensions(p)].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="hidden text-right text-sm sm:block">
                <div>{money(p.price, p.currency)}</div>
                <div className="text-xs text-stone-500">{p.is_public ? 'Public' : 'Private'}</div>
              </div>
              <StatusBadge status={p.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Table({ pieces, selected, toggle }: ViewProps) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            {toggle && <th className="w-8 px-3 py-2" />}
            <th className="px-3 py-2">Inv #</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2">Medium</th>
            <th className="px-3 py-2">Dimensions</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Public</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {pieces.map((p) => (
            <tr key={p.id} className={`hover:bg-stone-50 ${selected.has(p.id) ? 'bg-amber-50/60' : ''}`}>
              {toggle && <td className="px-3 py-2"><SelectBox id={p.id} selected={selected} toggle={toggle} /></td>}
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-stone-500">{p.inventory_number}</td>
              <td className="px-3 py-2"><Link to={p.id} className="font-medium hover:underline">{p.title}</Link></td>
              <td className="px-3 py-2">{p.year}</td>
              <td className="px-3 py-2">{p.medium}</td>
              <td className="whitespace-nowrap px-3 py-2">{dimensions(p)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{money(p.price, p.currency)}</td>
              <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
              <td className="px-3 py-2">{p.location}</td>
              <td className="px-3 py-2">{p.is_public ? 'Yes' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
