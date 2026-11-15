import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../workspace';
import { useCollections, usePieces } from '../lib/queries';
import { applyFilters, filtersFromParams, filtersToParams, type Filters } from '../lib/filters';
import { DEFAULT_INVENTORY_FIELDS, downloadText, INVENTORY_FIELDS, piecesToCsv, REPORT_TYPES, type InventoryField, type ReportType } from '../lib/reports';
import FilterBar from '../components/FilterBar';
import { PageHeader, Spinner } from '../components/ui';

export default function Reports() {
  const { artist } = useWorkspace();
  const [sp, setSp] = useSearchParams();
  const filters = filtersFromParams(sp);
  const { data: pieces = [], isLoading } = usePieces(artist.id);
  const { data: collections = [] } = useCollections(artist.id);
  const [type, setType] = useState<ReportType>('inventory');
  const [fields, setFields] = useState<InventoryField[]>(DEFAULT_INVENTORY_FIELDS);
  const [title, setTitle] = useState('');

  const scoped = useMemo(() => applyFilters(pieces, filters), [pieces, sp]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Spinner />;

  const printParams = filtersToParams(filters);
  printParams.set('type', type);
  if (type === 'inventory') printParams.set('fields', fields.join(','));
  if (title) printParams.set('title', title);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Reports">
        <p className="mt-1 text-sm text-stone-500">Printable documents you can save as PDF, and a full spreadsheet export of your data.</p>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.value}
            onClick={() => setType(r.value)}
            className={`card p-4 text-left transition ${type === r.value ? 'ring-2 ring-stone-900' : 'hover:ring-stone-400'}`}
          >
            <div className="font-serif text-lg">{r.label}</div>
            <p className="mt-1 text-xs text-stone-500">{r.blurb}</p>
          </button>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wider text-stone-500">Which pieces</h2>
      <FilterBar filters={filters} onChange={(f: Filters) => setSp(filtersToParams(f, sp), { replace: true })} pieces={pieces} collections={collections} />
      <p className="mt-2 text-sm text-stone-600">{scoped.length} of {pieces.length} pieces included.</p>

      {type === 'inventory' && (
        <>
          <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wider text-stone-500">Columns</h2>
          <div className="flex flex-wrap gap-2">
            {INVENTORY_FIELDS.map((f) => {
              const on = fields.includes(f.key);
              return (
                <label key={f.key} className={`chip cursor-pointer px-2.5 py-1 ${on ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-700 ring-stone-300'}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => setFields(on ? fields.filter((x) => x !== f.key) : INVENTORY_FIELDS.map((x) => x.key).filter((k) => k === f.key || fields.includes(k)))}
                  />
                  {f.label}
                </label>
              );
            })}
          </div>
        </>
      )}

      <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wider text-stone-500">Title (optional)</h2>
      <input className="input max-w-md" placeholder={REPORT_TYPES.find((r) => r.value === type)!.label} value={title} onChange={(e) => setTitle(e.target.value)} />

      <div className="mt-8 flex flex-wrap gap-2">
        <Link to={`print?${printParams}`} className={`btn-primary ${scoped.length ? '' : 'pointer-events-none opacity-50'}`}>Open printable report</Link>
        <button
          className="btn-secondary"
          disabled={!scoped.length}
          onClick={() => downloadText(`${artist.slug}-inventory-${new Date().toISOString().slice(0, 10)}.csv`, piecesToCsv(scoped, collections))}
        >
          Export CSV ({scoped.length})
        </button>
      </div>
    </div>
  );
}
