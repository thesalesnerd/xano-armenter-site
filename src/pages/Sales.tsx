import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../workspace';
import { supabase } from '../lib/supabase';
import { money } from '../lib/format';
import { cap, useContacts, useInvoices, useRefresh, useSales, type SaleWithRefs } from '../lib/parity';
import { downloadText } from '../lib/reports';
import Papa from 'papaparse';
import { Empty, ErrorNote, PageHeader, Spinner } from '../components/ui';
import { PrivateBadge } from '../components/form';
import SaleForm from '../components/SaleForm';
import { OwnerOnly } from './Contacts';

export default function Sales() {
  const { artist, isOwner } = useWorkspace();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'invoices' ? 'invoices' : 'sales';
  const { data: sales = [], isLoading } = useSales(artist.id, isOwner);
  const { data: invoices = [] } = useInvoices(artist.id, isOwner);
  const { data: contacts = [] } = useContacts(artist.id, isOwner);
  const refresh = useRefresh(artist.id);
  const navigate = useNavigate();
  const [editing, setEditing] = useState<SaleWithRefs | 'new' | null>(sp.get('new') ? 'new' : null);
  const [error, setError] = useState<unknown>(null);
  const [year, setYear] = useState('');

  if (!isOwner) return <OwnerOnly />;
  if (isLoading) return <Spinner />;

  const years = [...new Set(sales.map((s) => s.sale_date?.slice(0, 4)).filter(Boolean))].sort().reverse() as string[];
  const shown = sales.filter((s) => !year || s.sale_date?.startsWith(year));
  const live = shown.filter((s) => s.status !== 'cancelled');
  const byCur = new Map<string, { gross: number; net: number }>();
  for (const s of live) {
    const c = s.currency ?? artist.currency;
    const t = byCur.get(c) ?? { gross: 0, net: 0 };
    const p = Number(s.price ?? 0);
    t.gross += p;
    t.net += p * (1 - Number(s.commission_pct ?? 0) / 100);
    byCur.set(c, t);
  }

  async function removeSale(s: SaleWithRefs) {
    if (!confirm(`Delete the sale of “${s.pieces?.title}”? The piece's status is not changed.`)) return;
    const { error } = await supabase.from('sales').delete().eq('id', s.id);
    if (error) return setError(error);
    await refresh('sales');
  }

  async function newInvoice(contactId?: string) {
    setError(null);
    const { data: number, error: e1 } = await supabase.rpc('next_invoice_number', { p_artist_id: artist.id });
    if (e1) return setError(e1);
    const { data, error } = await supabase.from('invoices').insert({ artist_id: artist.id, number, contact_id: contactId ?? null, currency: artist.currency }).select('id').single();
    if (error) return setError(error);
    await refresh('invoices');
    navigate(`invoices/${data.id}`);
  }

  function exportCsv() {
    const rows = shown.map((s) => ({
      date: s.sale_date ?? '', inventory_number: s.pieces?.inventory_number ?? '', title: s.pieces?.title ?? '', buyer: s.buyer?.name ?? '', via: s.via?.name ?? '',
      price: s.price ?? '', currency: s.currency ?? '', commission_pct: s.commission_pct ?? '', net: s.price == null ? '' : Number(s.price) * (1 - Number(s.commission_pct ?? 0) / 100),
      tax: s.tax_amount ?? '', status: s.status, invoice: s.invoices?.number ?? '', notes: s.notes ?? '',
    }));
    downloadText(`${artist.slug}-sales-${new Date().toISOString().slice(0, 10)}.csv`, Papa.unparse(rows));
  }

  return (
    <div>
      <PageHeader title="Sales" count={sales.length} actions={<PrivateBadge />}>
        <div className="mt-4 flex gap-1 border-b border-stone-200 text-sm">
          {(['sales', 'invoices'] as const).map((t) => (
            <button key={t} className={`-mb-px border-b-2 px-3 py-1.5 ${tab === t ? 'border-stone-900 font-medium' : 'border-transparent text-stone-500 hover:text-stone-900'}`} onClick={() => setSp(t === 'sales' ? {} : { tab: t })}>
              {t === 'sales' ? 'Sales' : `Invoices (${invoices.length})`}
            </button>
          ))}
        </div>
      </PageHeader>
      <ErrorNote error={error} />

      {tab === 'sales' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={() => setEditing('new')}>+ Record sale</button>
            <select className="input w-auto" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
              <option value="">All years</option>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
            <button className="btn-secondary" disabled={!shown.length} onClick={exportCsv}>Export CSV</button>
            <span className="ml-auto text-sm text-stone-600">
              {[...byCur.entries()].map(([c, t]) => `${money(t.gross, c)} gross · ${money(t.net, c)} after commission`).join(' — ')}
            </span>
          </div>
          {editing && (
            <div className="card mb-6 p-5">
              <SaleForm key={editing === 'new' ? 'new' : editing.id} sale={editing === 'new' ? undefined : editing} buyerId={sp.get('buyer') ?? undefined} onDone={() => setEditing(null)} />
            </div>
          )}
          {!shown.length ? (
            <Empty title="No sales recorded">Record a sale here or from a piece's page. Sales from your Artwork Archive export come in through Import.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="card w-full text-sm">
                <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr><th className="px-4 py-2">Date</th><th>Piece</th><th>Buyer</th><th>Via</th><th className="text-right">Price</th><th className="text-right">Comm.</th><th>Invoice</th><th>Status</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {shown.map((s) => (
                    <tr key={s.id} className={s.status === 'cancelled' ? 'text-stone-400 line-through' : ''}>
                      <td className="whitespace-nowrap px-4 py-2">{s.sale_date ?? '—'}</td>
                      <td><Link className="underline" to={`../pieces/${s.piece_id}`}><span className="font-mono text-xs">{s.pieces?.inventory_number}</span> {s.pieces?.title}</Link></td>
                      <td>{s.buyer?.name}</td>
                      <td>{s.via?.name}</td>
                      <td className="whitespace-nowrap text-right">{money(s.price, s.currency)}</td>
                      <td className="text-right">{s.commission_pct != null ? `${Number(s.commission_pct)}%` : ''}</td>
                      <td className="pl-3">{s.invoices && <Link className="underline" to={`invoices/${s.invoices.id}`}>{s.invoices.number}</Link>}</td>
                      <td>{cap(s.status)}</td>
                      <td className="whitespace-nowrap pr-3 text-right">
                        <button className="btn-ghost" onClick={() => setEditing(s)}>Edit</button>
                        <button className="btn-ghost text-rose-700" onClick={() => removeSale(s)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'invoices' && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <button className="btn-primary" onClick={() => newInvoice()}>+ New invoice</button>
            <select className="input w-auto" defaultValue="" onChange={(e) => e.target.value && newInvoice(e.target.value)} aria-label="New invoice for">
              <option value="">New invoice for…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {!invoices.length ? (
            <Empty title="No invoices yet">Create one, then add the sales it covers.</Empty>
          ) : (
            <table className="card w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr><th className="px-4 py-2">Number</th><th>Date</th><th>Bill to</th><th className="text-right">Sales</th><th>Status</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-2"><Link className="font-mono underline" to={`invoices/${i.id}`}>{i.number}</Link></td>
                    <td>{i.issue_date}</td>
                    <td>{i.contacts?.name}</td>
                    <td className="text-right">{sales.filter((s) => s.invoice_id === i.id).length}</td>
                    <td className="pl-4">{cap(i.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
