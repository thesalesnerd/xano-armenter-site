import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../workspace';
import { useCollections, usePieces } from '../lib/queries';
import { applyFilters, filtersFromParams } from '../lib/filters';
import { dimensions, money, statusLabel } from '../lib/format';
import { imageUrl } from '../lib/supabase';
import { DEFAULT_INVENTORY_FIELDS, INVENTORY_FIELDS, REPORT_TYPES, type InventoryField, type ReportType } from '../lib/reports';
import type { PieceWithImages } from '../lib/types';
import { Spinner } from '../components/ui';

export default function ReportPrint() {
  const { artist } = useWorkspace();
  const [sp] = useSearchParams();
  const type = (sp.get('type') ?? 'inventory') as ReportType;
  const ids = sp.get('ids')?.split(',').filter(Boolean);
  const fields = (sp.get('fields')?.split(',') as InventoryField[] | undefined) ?? DEFAULT_INVENTORY_FIELDS;
  const { data: pieces = [], isLoading } = usePieces(artist.id);
  const { data: collections = [] } = useCollections(artist.id);

  const rows = useMemo(() => {
    const base = ids ? pieces.filter((p) => ids.includes(p.id)) : pieces;
    const f = filtersFromParams(sp);
    if (!sp.get('sort') && type !== 'inventory') f.sort = 'year_desc';
    if (!sp.get('sort') && type === 'inventory') f.sort = 'inventory';
    return applyFilters(base, f);
  }, [pieces, sp]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Spinner />;

  const collection = collections.find((c) => c.id === sp.get('collection'));
  const title = sp.get('title') || collection?.name || REPORT_TYPES.find((r) => r.value === type)!.label;
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const total = rows.reduce((s, p) => s + (p.price ? Number(p.price) : 0), 0);

  return (
    <div className="mx-auto max-w-5xl bg-white print:max-w-none">
      <div className="no-print mb-6 flex items-center justify-between rounded-lg bg-stone-100 px-4 py-3">
        <Link to={`../reports?${sp}`} className="text-sm text-stone-600 hover:text-stone-900">← Back to reports</Link>
        <div className="flex items-center gap-3 text-sm text-stone-500">
          {rows.length} pieces
          <button className="btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      <header className="mb-8 border-b border-stone-300 pb-4 print:mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-stone-500">{artist.name}</div>
        <h1 className="mt-1 font-serif text-3xl">{title}</h1>
        <div className="mt-1 text-sm text-stone-500">{today} · {rows.length} works</div>
      </header>

      {type === 'inventory' && <Inventory rows={rows} fields={fields} />}
      {type === 'price_list' && <PriceList rows={rows} />}
      {type === 'portfolio' && <Portfolio rows={rows} artistName={artist.name} />}

      {type === 'inventory' && fields.includes('price') && (
        <p className="mt-6 text-right text-sm">
          Total listed value: <strong>{money(total, artist.currency)}</strong>
          <span className="text-stone-500"> (pieces priced in {artist.currency})</span>
        </p>
      )}
      <footer className="mt-10 border-t border-stone-200 pt-3 text-xs text-stone-400">
        {artist.name}{artist.website ? ` · ${artist.website}` : ''}{artist.contact_email ? ` · ${artist.contact_email}` : ''}
      </footer>
    </div>
  );
}

function cell(p: PieceWithImages, key: InventoryField) {
  switch (key) {
    case 'image': {
      const img = p.piece_images[0];
      return img ? <img src={imageUrl(img.thumb_path ?? img.storage_path)} alt="" className="h-16 w-16 object-contain" /> : null;
    }
    case 'dimensions': return dimensions(p);
    case 'status': return statusLabel(p.status);
    case 'price': return money(p.price, p.currency);
    case 'title': return <span className="font-serif">{p.title}</span>;
    default: return (p[key] as string | number | null) ?? '';
  }
}

function Inventory({ rows, fields }: { rows: PieceWithImages[]; fields: InventoryField[] }) {
  const cols = INVENTORY_FIELDS.filter((f) => fields.includes(f.key));
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b-2 border-stone-800 text-left text-[11px] uppercase tracking-wide text-stone-600">
          {cols.map((c) => <th key={c.key} className={`px-2 py-2 ${c.key === 'price' ? 'text-right' : ''}`}>{c.key === 'image' ? '' : c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className="break-inside-avoid border-b border-stone-200 align-top">
            {cols.map((c) => (
              <td key={c.key} className={`px-2 py-2 ${c.key === 'price' ? 'whitespace-nowrap text-right' : ''} ${c.key === 'inventory_number' ? 'font-mono text-xs' : ''} ${c.key === 'notes' ? 'max-w-56 text-xs text-stone-600' : ''}`}>
                {cell(p, c.key)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PriceList({ rows }: { rows: PieceWithImages[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-6 print:grid-cols-2">
      {rows.map((p) => {
        const img = p.piece_images[0];
        return (
          <div key={p.id} className="flex break-inside-avoid gap-4">
            {img && <img src={imageUrl(img.thumb_path ?? img.storage_path)} alt="" className="h-28 w-28 shrink-0 object-contain" />}
            <div className="text-sm">
              <div className="font-serif text-base italic">{p.title}</div>
              <div className="text-stone-600">{[p.year, p.medium].filter(Boolean).join(', ')}</div>
              <div className="text-stone-600">{dimensions(p)}</div>
              <div className="mt-1 font-medium">
                {p.status === 'sold' ? <span className="text-rose-700">Sold</span> : p.price != null && p.show_price ? money(p.price, p.currency) : 'Price on request'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Portfolio({ rows, artistName }: { rows: PieceWithImages[]; artistName: string }) {
  return (
    <div>
      {rows.map((p, i) => {
        const img = p.piece_images[0];
        return (
          <section key={p.id} className={`flex min-h-[80vh] flex-col items-center justify-center py-8 ${i ? 'break-before-page' : ''}`}>
            {img && <img src={imageUrl(img.storage_path)} alt={p.title} className="max-h-[70vh] max-w-full object-contain" />}
            <div className="mt-6 text-center text-sm">
              <div className="text-stone-600">{artistName}</div>
              <div className="font-serif text-lg italic">{p.title}{p.year ? `, ${p.year}` : ''}</div>
              <div className="text-stone-600">{[p.medium, dimensions(p)].filter(Boolean).join(' · ')}</div>
              {p.description && <p className="mx-auto mt-3 max-w-xl text-left text-stone-700">{p.description}</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
