import { useState } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../workspace';
import { supabase } from '../lib/supabase';
import { uploadPieceImage } from '../lib/images';
import { downloadText } from '../lib/reports';
import { autoMapFields, classifySheet, ENTITY_LABEL, FIELDS, type Entity } from '../lib/aa/fields';
import { readSpreadsheet } from '../lib/aa/sheets';
import { buildPlan, DEFAULT_OPTIONS, isNoop, summarize, type Change, type Options, type Plan, type SheetInput } from '../lib/aa/plan';
import { applyPlan, loadExisting, type ApplyResult } from '../lib/aa/apply';
import { ErrorNote, PageHeader } from '../components/ui';
import { Check, PrivateBadge } from '../components/form';
import { OwnerOnly } from './Contacts';

const show = (v: unknown) => (v == null || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : String(v));
const changeText = (c: Change) => `${c.field}: ${show(c.from)} → ${show(c.to)}`;

export default function ImportAA() {
  const { artist, isOwner } = useWorkspace();
  const qc = useQueryClient();
  const [inputs, setInputs] = useState<SheetInput[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTIONS);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [openMap, setOpenMap] = useState<number | null>(null);

  if (!isOwner) return <OwnerOnly />;

  async function addFiles(files: File[]) {
    setError(null);
    setPlan(null);
    setResult(null);
    try {
      const sheets = (await Promise.all(files.map((f) => readSpreadsheet(f)))).flat();
      const next = sheets.map((sheet) => {
        const entity = classifySheet(sheet.name, sheet.headers);
        return { sheet, entity, mapping: autoMapFields(entity, sheet.headers) } as SheetInput;
      });
      setInputs((cur) => [...cur, ...next]);
      setFileNames((cur) => [...cur, ...files.map((f) => f.name)]);
    } catch (e) {
      setError(e);
    }
  }

  function setEntity(i: number, entity: Entity | 'ignore') {
    setPlan(null);
    setInputs((cur) => cur.map((x, j) => (j === i ? { ...x, entity, mapping: entity === 'ignore' ? {} : autoMapFields(entity, x.sheet.headers) } : x)));
  }
  function setMap(i: number, header: string, key: string) {
    setPlan(null);
    setInputs((cur) => cur.map((x, j) => (j === i ? { ...x, mapping: { ...x.mapping, [header]: key } } : x)));
  }

  async function dryRun() {
    setBusy('Reading what is already in Artfolio…');
    setError(null);
    try {
      const existing = await loadExisting(supabase, artist);
      setPlan(buildPlan(inputs, existing, opts));
    } catch (e) {
      setError(e);
    }
    setBusy('');
  }

  async function apply() {
    if (!plan) return;
    const s = summarize(plan);
    if (!confirm(`Write ${s.pieces.create} new and ${s.pieces.update} updated pieces, ${s.contacts.create} contacts, ${s.sales.create} sales, ${s.exhibitions.create} exhibitions, ${s.locations.create} locations and ${s.images} images?`)) return;
    setError(null);
    try {
      const res = await applyPlan(supabase, artist.id, plan, {
        fileNames,
        onProgress: setBusy,
        fetchImage: async (url, pieceId, position) => {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          await uploadPieceImage(artist.id, pieceId, await resp.blob(), position, url);
        },
      });
      setResult(res);
      await qc.invalidateQueries();
      setBusy('Checking the result…');
      setPlan(buildPlan(inputs, await loadExisting(supabase, artist), opts));
    } catch (e) {
      setError(e);
    }
    setBusy('');
  }

  function downloadReport() {
    if (!plan) return;
    const rows = [
      ...plan.pieces.map((p) => ({ area: 'piece', ...p })),
      ...plan.locations.map((p) => ({ area: 'location', ...p })),
      ...plan.contacts.map((p) => ({ area: 'contact', ...p })),
      ...plan.invoices.map((p) => ({ area: 'invoice', ...p })),
      ...plan.sales.map((p) => ({ area: 'sale', ...p })),
      ...plan.exhibitions.map((p) => ({ area: 'exhibition', ...p })),
      ...plan.collections.map((p) => ({ area: 'collection', ...p })),
    ].map((r) => ({
      area: r.area, file: r.sheet, row: r.row, action: r.action, item: r.label, matched_by: 'matchedBy' in r ? r.matchedBy ?? '' : '',
      changes: r.changes.map(changeText).join(' | '), not_changed_conflicts: r.conflicts.map(changeText).join(' | '), reason: r.reason ?? '',
    }));
    const extra = plan.unmapped.map((u) => ({ area: 'column not imported', file: u.sheet, row: '', action: 'skip', item: u.column, matched_by: '', changes: `${u.filled} cells with data, e.g. “${u.sample}”`, not_changed_conflicts: '', reason: '' }));
    downloadText(`${artist.slug}-aa-import-dry-run-${new Date().toISOString().slice(0, 10)}.csv`, Papa.unparse([...rows, ...extra]));
  }

  const s = plan && summarize(plan);
  const noop = plan && isNoop(plan);

  return (
    <div className="max-w-6xl">
      <PageHeader title="Import from Artwork Archive" actions={<PrivateBadge />}>
        <p className="mt-1 max-w-3xl text-sm text-stone-500">
          Upload the files from Artwork Archive's data export (CSV or Excel: pieces, contacts, sales, exhibitions, locations). Nothing is
          written until you have read the dry-run report and pressed Apply. Running it again with the same files changes nothing.
          {' '}<Link className="underline" to="../import">Plain CSV import</Link>
        </p>
      </PageHeader>
      <ErrorNote error={error} />

      <label className="card flex cursor-pointer flex-col items-center gap-1 border-2 border-dashed border-stone-300 px-6 py-8 text-center text-sm text-stone-600 hover:border-stone-500">
        <span className="font-medium">Choose export files</span>
        <span className="text-xs text-stone-400">.csv or .xlsx, several at once</span>
        <input type="file" multiple accept=".csv,.tsv,.txt,.xlsx" className="sr-only" data-testid="aa-files" onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </label>

      {inputs.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Sheets</h2>
          <ul className="card divide-y divide-stone-100">
            {inputs.map((x, i) => {
              const mapped = Object.values(x.mapping).filter(Boolean).length;
              return (
                <li key={i} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{x.sheet.name}</span>
                    <span className="text-stone-500">{x.sheet.rows.length} rows</span>
                    <select className="input w-auto" value={x.entity} onChange={(e) => setEntity(i, e.target.value as Entity | 'ignore')} aria-label={`Contents of ${x.sheet.name}`}>
                      {(Object.keys(ENTITY_LABEL) as Entity[]).map((k) => <option key={k} value={k}>{ENTITY_LABEL[k]}</option>)}
                      <option value="ignore">Ignore this sheet</option>
                    </select>
                    {x.entity !== 'ignore' && (
                      <button className="btn-ghost" onClick={() => setOpenMap(openMap === i ? null : i)}>
                        {mapped} of {x.sheet.headers.length} columns matched · {openMap === i ? 'hide' : 'review'}
                      </button>
                    )}
                    <button className="btn-ghost ml-auto text-rose-700" onClick={() => { setPlan(null); setInputs((c) => c.filter((_, j) => j !== i)); }}>Remove</button>
                  </div>
                  {openMap === i && x.entity !== 'ignore' && (
                    <table className="mt-3 w-full text-xs">
                      <thead className="text-left text-stone-500"><tr><th className="py-1">Column in file</th><th>Example</th><th>Imports as</th></tr></thead>
                      <tbody className="divide-y divide-stone-100">
                        {x.sheet.headers.map((h) => (
                          <tr key={h}>
                            <td className="py-1 pr-2 font-medium">{h}</td>
                            <td className="max-w-64 truncate pr-2 text-stone-500">{x.sheet.rows.find((r) => r[h])?.[h] ?? ''}</td>
                            <td>
                              <select className="input py-0.5 text-xs" value={x.mapping[h] ?? ''} onChange={(e) => setMap(i, h, e.target.value)} aria-label={`Map ${h}`}>
                                <option value="">— don't import —</option>
                                {FIELDS[x.entity as Entity].map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <Check label="Replace existing values that differ (off: only fill empty fields)" checked={opts.overwrite} onChange={(v) => { setPlan(null); setOpts({ ...opts, overwrite: v }); }} />
            <Check label="Create pieces whose only match is a same-titled piece" checked={opts.createTitleMatches} onChange={(v) => { setPlan(null); setOpts({ ...opts, createTitleMatches: v }); }} />
            <Check label="Make new pieces public" checked={opts.defaultPublic} onChange={(v) => { setPlan(null); setOpts({ ...opts, defaultPublic: v }); }} />
            <label className="flex items-center gap-2 text-sm">
              Dates like 03/04/2021 are
              <select className="input w-auto py-0.5" value={opts.dateOrder} onChange={(e) => { setPlan(null); setOpts({ ...opts, dateOrder: e.target.value as Options['dateOrder'] }); }} aria-label="Date order">
                <option value="mdy">month/day (US)</option>
                <option value="dmy">day/month</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button className="btn-primary" disabled={!!busy} onClick={dryRun}>{busy && !plan ? busy : 'Run dry run'}</button>
          </div>
        </section>
      )}

      {plan && s && (
        <section className="mt-8 space-y-6" aria-label="Dry-run report">
          <div className={`card p-4 ${noop ? 'ring-emerald-300' : ''}`}>
            <h2 className="font-serif text-xl">{noop ? 'Nothing to change: Artfolio already has everything in these files.' : 'Dry-run report'}</h2>
            <table className="mt-3 text-sm">
              <thead className="text-left text-xs text-stone-500"><tr><th className="pr-6">Area</th><th className="pr-4">New</th><th className="pr-4">Updated</th><th className="pr-4">Unchanged</th><th>Skipped</th></tr></thead>
              <tbody>
                {(['pieces', 'locations', 'contacts', 'sales', 'invoices', 'exhibitions', 'collections'] as const).map((k) => (
                  <tr key={k} data-testid={`summary-${k}`}><td className="pr-6 capitalize">{k}</td><td>{s[k].create}</td><td>{s[k].update}</td><td>{s[k].unchanged}</td><td>{s[k].skip}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-sm text-stone-600">
              {s.images} images to download · {s.links} collection/exhibition links · {s.provenance} provenance entries · {s.conflicts} differing values left as they are · {s.unmapped} columns not imported
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={downloadReport}>Download report (CSV)</button>
              {!noop && <button className="btn-primary" disabled={!!busy} onClick={apply}>{busy || 'Apply'}</button>}
            </div>
            {result && (
              <div className="mt-3 text-sm">
                <p className="text-emerald-800">Written: {Object.entries(result.written).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing'}.</p>
                {result.errors.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-rose-800">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                )}
              </div>
            )}
          </div>

          {plan.unmapped.length > 0 && (
            <Block title={`Columns not imported (${plan.unmapped.length})`} note="These columns have data but no place in Artfolio, or you chose not to import them. Map them above if they belong somewhere.">
              <ul className="text-sm">{plan.unmapped.map((u, i) => <li key={i}><strong>{u.column}</strong> <span className="text-stone-500">({u.sheet}, {u.filled} filled, e.g. “{u.sample}”)</span></li>)}</ul>
            </Block>
          )}
          {plan.warnings.length > 0 && (
            <Block title={`Warnings (${plan.warnings.length})`}><ul className="list-disc pl-5 text-sm">{plan.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></Block>
          )}
          <OpsTable title="Pieces" ops={plan.pieces} />
          <OpsTable title="Locations" ops={plan.locations} />
          <OpsTable title="Contacts" ops={plan.contacts} />
          <OpsTable title="Sales" ops={plan.sales} />
          <OpsTable title="Invoices" ops={plan.invoices} />
          <OpsTable title="Exhibitions" ops={plan.exhibitions} />
          <OpsTable title="Collections" ops={plan.collections} />
        </section>
      )}
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="font-medium">{title}</h3>
      {note && <p className="mb-2 text-xs text-stone-500">{note}</p>}
      {children}
    </div>
  );
}

const TONE: Record<string, string> = { create: 'text-emerald-700', update: 'text-sky-700', unchanged: 'text-stone-400', skip: 'text-amber-700' };

function OpsTable({ title, ops }: { title: string; ops: Plan['pieces'] | Plan['contacts'] }) {
  const [all, setAll] = useState(false);
  if (!ops.length) return null;
  const interesting = ops.filter((o) => o.action !== 'unchanged' || o.conflicts.length);
  const rows = all ? ops : interesting;
  return (
    <Block title={`${title} (${ops.length})`}>
      {interesting.length < ops.length && (
        <button className="btn-ghost mb-2" onClick={() => setAll(!all)}>{all ? 'Hide unchanged' : `Show ${ops.length - interesting.length} unchanged`}</button>
      )}
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white text-left text-stone-500"><tr><th className="py-1">Row</th><th>Action</th><th>Item</th><th>What changes</th><th>Left as is / why</th></tr></thead>
          <tbody className="divide-y divide-stone-100 align-top">
            {rows.map((o, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap py-1 pr-2 text-stone-500">{o.row}</td>
                <td className={`pr-2 font-medium ${TONE[o.action]}`}>{o.action}</td>
                <td className="pr-2">{o.label}{'matchedBy' in o && o.matchedBy ? <span className="block text-stone-400">matched by {String(o.matchedBy)}</span> : null}</td>
                <td className="pr-2">{o.action === 'create' ? Object.entries(o.values).filter(([k, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length) && k !== 'location_ref').map(([k, v]) => `${k}: ${show(v)}`).join(' · ') : o.changes.map(changeText).join(' · ')}</td>
                <td className="text-amber-800">{[...o.conflicts.map((c) => `${c.field}: Artfolio has ${show(c.from)}, file has ${show(c.to)}`), o.reason].filter(Boolean).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}
