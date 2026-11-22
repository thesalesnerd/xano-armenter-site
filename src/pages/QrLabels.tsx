import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../workspace';
import { usePieces } from '../lib/queries';
import { dimensions } from '../lib/format';
import { qrBase, qrSvg, qrUrl } from '../lib/qr';
import type { PieceWithImages } from '../lib/types';
import { PageHeader, Spinner } from '../components/ui';

/**
 * Printable sheet of QR labels for the back of the works (Reports → QR labels).
 * Each code encodes the permanent <website>/qr/<inventory #> link.
 * Sizes are real millimetres; print at 100% ("Actual size"), not "Fit to page".
 */

type Size = { key: string; label: string; w: number; h: number };
const SIZES: Size[] = [
  { key: 's', label: 'Small · 38 × 21 mm', w: 38.1, h: 21.2 },
  { key: 'm', label: 'Medium · 50 × 30 mm', w: 50, h: 30 },
  { key: 'l', label: 'Large · 63.5 × 38 mm', w: 63.5, h: 38.1 },
  { key: 'xl', label: 'Wide · 99 × 38 mm', w: 99.1, h: 38.1 },
  { key: 'custom', label: 'Custom size', w: 60, h: 40 },
];

type Show = { title: boolean; inventory: boolean; artist: boolean; details: boolean; url: boolean };

export default function QrLabels() {
  const { artist } = useWorkspace();
  const [sp, setSp] = useSearchParams();
  const { data: pieces = [], isLoading } = usePieces(artist.id);
  const [base, setBase] = useState(() => qrBase(artist) ?? '');
  const [sizeKey, setSizeKey] = useState(sp.get('size') ?? 'm');
  const [custom, setCustom] = useState({ w: 60, h: 40 });
  const [paper, setPaper] = useState<'A4' | 'letter'>('A4');
  const [gap, setGap] = useState(3);
  const [cutLines, setCutLines] = useState(true);
  const [show, setShow] = useState<Show>({ title: true, inventory: true, artist: true, details: false, url: true });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(sp.get('ids')?.split(',').filter(Boolean) ?? []));
  const [svgs, setSvgs] = useState<Record<string, string>>({});

  const numbered = useMemo(
    () => pieces.filter((p) => p.inventory_number?.trim()).sort((a, b) => a.inventory_number!.localeCompare(b.inventory_number!, undefined, { numeric: true })),
    [pieces],
  );
  // Nothing chosen via ?ids=: start with every public numbered piece.
  useEffect(() => {
    if (!isLoading && !sp.get('ids') && selected.size === 0) setSelected(new Set(numbered.filter((p) => p.is_public).map((p) => p.id)));
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = numbered.filter((p) => selected.has(p.id));
  const size = sizeKey === 'custom' ? { ...SIZES[4], ...custom } : SIZES.find((s) => s.key === sizeKey) ?? SIZES[1];
  const cleanBase = base.trim().replace(/\/+$/, '');

  useEffect(() => {
    if (!cleanBase) return;
    let live = true;
    Promise.all(rows.map(async (p) => [p.id, await qrSvg(qrUrl(cleanBase, p.inventory_number!), 0)] as const)).then((pairs) => {
      if (live) setSvgs(Object.fromEntries(pairs));
    });
    return () => { live = false; };
  }, [cleanBase, rows.map((p) => p.id + p.inventory_number).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Spinner />;

  const q = query.trim().toLowerCase();
  const listed = q ? numbered.filter((p) => `${p.inventory_number} ${p.title}`.toLowerCase().includes(q)) : numbered;
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setAll = (ids: string[], on: boolean) => setSelected((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const missing = pieces.length - numbered.length;

  // Text scales with the label: the shorter side drives the type size.
  const qr = Math.min(size.h - 4, size.w * 0.5);
  const pt = Math.max(5, Math.min(11, size.h / 4.2));

  return (
    <div className="max-w-6xl print:max-w-none">
      <style>{`
        @page { size: ${paper === 'A4' ? 'A4' : 'letter'}; margin: 10mm; }
        @media print { main { padding: 0 !important; } div:has(> aside + div + main), div:has(> aside ~ main) { display: block !important; } body { background: #fff !important; } }
        .qr-sheet { display: grid; grid-template-columns: repeat(auto-fill, ${size.w}mm); gap: ${gap}mm; }
        .qr-label { width: ${size.w}mm; height: ${size.h}mm; box-sizing: border-box; padding: 2mm; display: flex; gap: 2mm;
          align-items: center; overflow: hidden; break-inside: avoid; background: #fff; color: #000; font-family: ui-sans-serif, system-ui, sans-serif; }
        .qr-label.cut { outline: 0.2mm dashed #999; }
        .qr-label .qr { width: ${qr}mm; height: ${qr}mm; flex: none; }
        .qr-label .qr svg { width: 100%; height: 100%; display: block; }
        .qr-label .txt { display: flex; flex-direction: column; gap: 0.4mm; min-width: 0; font-size: ${pt * 0.8}pt; line-height: 1.15; }
        .qr-label .txt b { font-size: ${pt}pt; font-weight: 600; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .qr-label .txt .inv { font-family: ui-monospace, monospace; }
        .qr-label .txt small { font-size: ${Math.max(4.5, pt * 0.6)}pt; word-break: break-all; color: #333; }
      `}</style>

      <div className="no-print">
        <Link to="../reports" className="text-sm text-stone-500 hover:text-stone-900">← Reports</Link>
        <PageHeader title="QR labels" count={rows.length} actions={
          <button className="btn-primary" disabled={!rows.length || !cleanBase} onClick={() => window.print()}>Print / Save as PDF</button>
        }>
          <p className="mt-1 text-sm text-stone-500">
            Each code opens <span className="font-mono">{cleanBase || 'yoursite'}/qr/&lt;inventory #&gt;</span>, which your website forwards to the work's page.
            The link never changes, so labels survive renamed works and site redesigns. Print at 100% (actual size); for pre-cut sticker sheets, test on plain paper first.
          </p>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section className="card space-y-4 p-5">
            <label className="block">
              <span className="label">Website (where the codes point)</span>
              <input className="input font-mono" placeholder="https://xanoarmenter.com" value={base} onChange={(e) => setBase(e.target.value)} />
              {!qrBase(artist) && <span className="mt-1 block text-xs text-amber-700">Tip: save your website in <Link className="underline" to="../settings">Settings</Link> so it's filled in here and on each piece.</span>}
            </label>
            <label className="block">
              <span className="label">Label size</span>
              <select className="input" value={sizeKey} onChange={(e) => { setSizeKey(e.target.value); setSp((p) => { p.set('size', e.target.value); return p; }, { replace: true }); }}>
                {SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            {sizeKey === 'custom' && (
              <div className="flex gap-3">
                <label className="block flex-1"><span className="label">Width (mm)</span>
                  <input className="input" type="number" min={20} max={200} value={custom.w} onChange={(e) => setCustom({ ...custom, w: Number(e.target.value) || 20 })} /></label>
                <label className="block flex-1"><span className="label">Height (mm)</span>
                  <input className="input" type="number" min={15} max={200} value={custom.h} onChange={(e) => setCustom({ ...custom, h: Number(e.target.value) || 15 })} /></label>
              </div>
            )}
            <div className="flex gap-3">
              <label className="block flex-1"><span className="label">Paper</span>
                <select className="input" value={paper} onChange={(e) => setPaper(e.target.value as 'A4' | 'letter')}><option value="A4">A4</option><option value="letter">US Letter</option></select></label>
              <label className="block flex-1"><span className="label">Gap between labels (mm)</span>
                <input className="input" type="number" min={0} max={20} value={gap} onChange={(e) => setGap(Number(e.target.value) || 0)} /></label>
            </div>
            <div>
              <span className="label">On each label</span>
              <div className="flex flex-wrap gap-2">
                {([['title', 'Title'], ['inventory', 'Inventory #'], ['artist', 'Artist'], ['details', 'Year · medium · size'], ['url', 'Link text']] as [keyof Show, string][]).map(([k, l]) => (
                  <label key={k} className={`chip cursor-pointer px-2.5 py-1 ${show[k] ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-700 ring-stone-300'}`}>
                    <input type="checkbox" className="sr-only" checked={show[k]} onChange={() => setShow({ ...show, [k]: !show[k] })} />{l}
                  </label>
                ))}
                <label className={`chip cursor-pointer px-2.5 py-1 ${cutLines ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-700 ring-stone-300'}`}>
                  <input type="checkbox" className="sr-only" checked={cutLines} onChange={() => setCutLines(!cutLines)} />Cut lines
                </label>
              </div>
            </div>
          </section>

          <section className="card flex max-h-[28rem] flex-col p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input className="input max-w-56" placeholder="Search title or inventory #" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button type="button" className="btn-ghost" onClick={() => setAll(listed.map((p) => p.id), true)}>Select all{q ? ' shown' : ''}</button>
              <button type="button" className="btn-ghost" onClick={() => setAll(listed.map((p) => p.id), false)}>Clear{q ? ' shown' : ''}</button>
              <span className="ml-auto text-xs text-stone-500">{rows.length} selected</span>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-stone-100 overflow-auto text-sm">
              {listed.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-1.5">
                    <input type="checkbox" className="accent-stone-900" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    <span className="w-20 shrink-0 font-mono text-xs text-stone-500">{p.inventory_number}</span>
                    <span className="truncate">{p.title}</span>
                    {!p.is_public && <span className="chip ml-auto bg-stone-100 text-stone-500 ring-stone-200">private</span>}
                  </label>
                </li>
              ))}
            </ul>
            {missing > 0 && <p className="mt-2 text-xs text-stone-500">{missing} piece{missing === 1 ? ' has' : 's have'} no inventory number and can't get a label.</p>}
          </section>
        </div>
        <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wider text-stone-500">Preview</h2>
      </div>

      {!cleanBase ? (
        <p className="text-sm text-stone-500">Enter the website the codes should point to.</p>
      ) : (
        <div className="qr-sheet" data-testid="qr-sheet">
          {rows.map((p) => <Label key={p.id} piece={p} url={qrUrl(cleanBase, p.inventory_number!)} svg={svgs[p.id]} show={show} artistName={artist.name} cut={cutLines} />)}
        </div>
      )}
    </div>
  );
}

function Label({ piece, url, svg, show, artistName, cut }: { piece: PieceWithImages; url: string; svg?: string; show: Show; artistName: string; cut: boolean }) {
  const details = [piece.year ? `${piece.year_circa ? 'c. ' : ''}${piece.year}` : '', piece.medium ?? '', dimensions(piece)].filter(Boolean).join(' · ');
  return (
    <div className={`qr-label${cut ? ' cut' : ''}`} data-inv={piece.inventory_number ?? ''}>
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg ?? '' }} />
      <div className="txt">
        {show.title && <b>{piece.title}</b>}
        {show.artist && <span>{artistName}</span>}
        {show.details && details && <span>{details}</span>}
        {show.inventory && <span className="inv">{piece.inventory_number}</span>}
        {show.url && <small>{url.replace(/^https?:\/\//, '')}</small>}
      </div>
    </div>
  );
}
