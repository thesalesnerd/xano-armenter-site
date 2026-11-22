import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../workspace';
import { supabase } from '../lib/supabase';
import { usePieces, useCollections } from '../lib/queries';
import { autoMap, mapRow, TARGETS, type Mapping, type ParsedRow } from '../lib/importer';
import { uploadPieceImage } from '../lib/images';
import { STATUSES } from '../lib/format';
import type { PieceStatus } from '../lib/types';
import { ErrorNote, PageHeader } from '../components/ui';

type Result = { created: number; skipped: number; images: number; imageFailures: string[]; errors: string[] };

export default function Import() {
  const { artist, canEdit, isOwner } = useWorkspace();
  const qc = useQueryClient();
  const { data: existing = [] } = usePieces(artist.id);
  const { data: collections = [] } = useCollections(artist.id);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [defaultStatus, setDefaultStatus] = useState<PieceStatus>('available');
  const [defaultPublic, setDefaultPublic] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [withImages, setWithImages] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  function load(file: File) {
    setError(null);
    setResult(null);
    setFileName(file.name);
    const accept = (data: Record<string, unknown>[]) => {
      const hs = [...new Set(data.flatMap((r) => Object.keys(r)))];
      setRows(data);
      setHeaders(hs);
      setMapping(autoMap(hs));
    };
    if (file.name.toLowerCase().endsWith('.json')) {
      file.text().then((t) => {
        try {
          const parsed = JSON.parse(t);
          const arr = Array.isArray(parsed) ? parsed : parsed.pieces ?? parsed.artworks ?? parsed.data;
          if (!Array.isArray(arr)) throw new Error('Expected a JSON array of artworks');
          accept(arr.map((r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Array.isArray(v) ? v.join('; ') : v]))));
        } catch (e) {
          setError(e);
        }
      });
    } else {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (res) => {
          if (res.errors.length && !res.data.length) setError(new Error(res.errors[0].message));
          accept(res.data);
        },
      });
    }
  }

  const defaults = { currency: artist.currency, unit: artist.dimension_unit as 'cm' | 'in', status: defaultStatus, isPublic: defaultPublic };
  const parsed: ParsedRow[] = useMemo(() => rows.map((r) => mapRow(r, mapping, defaults)), [rows, mapping, defaultStatus, defaultPublic]); // eslint-disable-line react-hooks/exhaustive-deps

  const existingKeys = useMemo(() => {
    const inv = new Set(existing.map((p) => p.inventory_number?.toLowerCase()).filter(Boolean));
    const ty = new Set(existing.map((p) => `${p.title.toLowerCase()}|${p.year ?? ''}`));
    return { inv, ty };
  }, [existing]);
  const isDup = (p: ParsedRow) =>
    (p.piece.inventory_number && existingKeys.inv.has(p.piece.inventory_number.toLowerCase())) ||
    existingKeys.ty.has(`${p.piece.title.toLowerCase()}|${p.piece.year ?? ''}`);

  const dupCount = parsed.filter(isDup).length;
  const imageCount = parsed.reduce((n, p) => n + p.imageUrls.length, 0);
  const titleMapped = Object.values(mapping).includes('title');

  async function run() {
    setError(null);
    const res: Result = { created: 0, skipped: 0, images: 0, imageFailures: [], errors: [] };
    try {
      // Create any missing collections up front.
      const colIds = new Map(collections.map((c) => [c.name.toLowerCase(), c.id]));
      const needed = [...new Set(parsed.flatMap((p) => p.collections))].filter((c) => !colIds.has(c.toLowerCase()));
      if (needed.length) {
        const { data, error } = await supabase.from('collections').insert(needed.map((name) => ({ artist_id: artist.id, name }))).select('id, name');
        if (error) throw error;
        data.forEach((c) => colIds.set(c.name.toLowerCase(), c.id));
      }

      for (const [i, row] of parsed.entries()) {
        setProgress(`Importing ${i + 1} of ${parsed.length}: ${row.piece.title}`);
        if (skipDuplicates && isDup(row)) {
          res.skipped++;
          continue;
        }
        const { data: piece, error } = await supabase.from('pieces').insert({ ...row.piece, artist_id: artist.id }).select('id').single();
        if (error) {
          res.errors.push(`Row ${i + 2} (${row.piece.title}): ${error.code === '23505' ? 'inventory number already used' : error.message}`);
          continue;
        }
        res.created++;
        const cps = row.collections.map((c) => ({ collection_id: colIds.get(c.toLowerCase())!, piece_id: piece.id, artist_id: artist.id }));
        if (cps.length) await supabase.from('collection_pieces').insert(cps);
        if (withImages) {
          for (const [pos, url] of row.imageUrls.entries()) {
            try {
              const resp = await fetch(url);
              if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
              await uploadPieceImage(artist.id, piece.id, await resp.blob(), pos);
              res.images++;
            } catch (e) {
              const reason = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
              res.imageFailures.push(`${row.piece.title}: ${url} (${reason})`);
            }
          }
        }
      }
    } catch (e) {
      setError(e);
    }
    setProgress('');
    setResult(res);
    qc.invalidateQueries({ queryKey: ['pieces', artist.id] });
    qc.invalidateQueries({ queryKey: ['collections', artist.id] });
  }

  if (!canEdit) return <p className="text-stone-500">You need editor access to import.</p>;

  return (
    <div className="max-w-5xl">
      <PageHeader title="Import">
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          Bring your inventory across from another system or a spreadsheet. Upload a CSV (from Artwork Archive's export, Excel or Google Sheets) or a JSON
          array, match its columns to Artfolio fields, check the preview, and import.
        </p>
        {isOwner && (
          <Link to="aa" className="card mt-4 block max-w-2xl p-4 hover:ring-stone-400">
            <span className="font-medium">Moving from Artwork Archive?</span>
            <span className="block text-sm text-stone-500">Use the Artwork Archive importer: pieces, locations, contacts, sales, exhibitions and extra images, with a dry-run report and safe re-runs. →</span>
          </Link>
        )}
      </PageHeader>

      <label className="card flex cursor-pointer flex-col items-center gap-1 border-2 border-dashed border-stone-300 px-6 py-10 text-center hover:border-stone-500">
        <span className="font-medium">{fileName || 'Choose a CSV or JSON file'}</span>
        <span className="text-xs text-stone-500">{rows.length ? `${rows.length} rows · ${headers.length} columns` : 'Your file stays in your browser until you click Import.'}</span>
        <input type="file" accept=".csv,.tsv,.txt,.json,text/csv,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
      </label>
      <div className="mt-3"><ErrorNote error={error} /></div>

      {rows.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wider text-stone-500">Match columns</h2>
          <div className="card divide-y divide-stone-100">
            {headers.map((h) => (
              <div key={h} className="grid grid-cols-[1fr_1fr_1.4fr] items-center gap-3 px-4 py-2 text-sm">
                <span className="truncate font-medium">{h}</span>
                <select className="input" value={mapping[h] ?? ''} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as Mapping[string] })}>
                  <option value="">— Skip —</option>
                  {TARGETS.map((t) => (
                    <option key={t.key} value={t.key} disabled={mapping[h] !== t.key && Object.values(mapping).includes(t.key)}>{t.label}</option>
                  ))}
                </select>
                <span className="truncate text-xs text-stone-500">{String(rows.find((r) => r[h] != null && String(r[h]).trim())?.[h] ?? '')}</span>
              </div>
            ))}
          </div>

          <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wider text-stone-500">Options</h2>
          <div className="card grid gap-4 p-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="label">Status when the file doesn't say</span>
              <select className="input" value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value as PieceStatus)}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <div className="space-y-2 pt-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-stone-900" checked={defaultPublic} onChange={(e) => setDefaultPublic(e.target.checked)} /> Show imported pieces on public profile</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-stone-900" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} /> Skip pieces already in Artfolio ({dupCount} found)</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-stone-900" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} /> Download images from URLs ({imageCount})</label>
            </div>
          </div>

          <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wider text-stone-500">Preview (first 8)</h2>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-stone-50 text-stone-500">
                <tr>{['Title', 'Inv #', 'Year', 'Medium', 'Size', 'Price', 'Status', 'Images', ''].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {parsed.slice(0, 8).map((p, i) => (
                  <tr key={i} className={isDup(p) && skipDuplicates ? 'text-stone-400 line-through' : ''}>
                    <td className="px-3 py-1.5 font-medium">{p.piece.title}</td>
                    <td className="px-3 py-1.5 font-mono">{p.piece.inventory_number ?? 'auto'}</td>
                    <td className="px-3 py-1.5">{p.piece.year}</td>
                    <td className="px-3 py-1.5">{p.piece.medium}</td>
                    <td className="px-3 py-1.5">{[p.piece.height, p.piece.width, p.piece.depth].filter((x) => x != null).join(' × ')} {p.piece.height != null ? p.piece.dimension_unit : ''}</td>
                    <td className="px-3 py-1.5">{p.piece.price != null ? `${p.piece.price} ${p.piece.currency}` : ''}</td>
                    <td className="px-3 py-1.5">{p.piece.status}</td>
                    <td className="px-3 py-1.5">{p.imageUrls.length || ''}</td>
                    <td className="px-3 py-1.5 text-amber-700">{p.problems.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button className="btn-primary" disabled={!!progress || !titleMapped} onClick={run}>
              Import {skipDuplicates ? parsed.length - dupCount : parsed.length} pieces
            </button>
            {!titleMapped && <span className="text-sm text-amber-700">Map a column to Title first.</span>}
            {progress && <span className="text-sm text-stone-500">{progress}</span>}
          </div>
        </>
      )}

      {result && (
        <div className="card mt-6 space-y-2 p-5 text-sm">
          <p className="font-medium">
            Imported {result.created} pieces{result.skipped ? `, skipped ${result.skipped} duplicates` : ''}{result.images ? `, ${result.images} images` : ''}.
          </p>
          {result.errors.length > 0 && (
            <details open><summary className="cursor-pointer text-rose-700">{result.errors.length} rows failed</summary>
              <ul className="mt-1 list-disc pl-5 text-xs text-stone-600">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </details>
          )}
          {result.imageFailures.length > 0 && (
            <details><summary className="cursor-pointer text-amber-700">{result.imageFailures.length} images couldn't be downloaded</summary>
              <p className="mt-1 text-xs text-stone-500">Some sites block downloads from other websites. Download these and add them on each piece's page, or use the command-line importer (see README).</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-stone-600">{result.imageFailures.map((e) => <li key={e} className="break-all">{e}</li>)}</ul>
            </details>
          )}
          <Link to="../pieces" className="btn-secondary mt-2">View pieces</Link>
        </div>
      )}
    </div>
  );
}
