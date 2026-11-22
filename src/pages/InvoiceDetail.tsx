import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../workspace';
import { supabase, imageUrl } from '../lib/supabase';
import { dimensions, money } from '../lib/format';
import { usePieces } from '../lib/queries';
import { cap, clean, INVOICE_STATUSES, invoiceTotals, useContacts, useInvoices, useRefresh, useSales, type Invoice } from '../lib/parity';
import { ErrorNote, Spinner } from '../components/ui';
import { Field } from '../components/form';
import { OwnerOnly } from './Contacts';

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const { artist, isOwner } = useWorkspace();
  const { data: invoices = [], isLoading } = useInvoices(artist.id, isOwner);
  const { data: sales = [] } = useSales(artist.id, isOwner);
  const { data: contacts = [] } = useContacts(artist.id, isOwner);
  const { data: pieces = [] } = usePieces(artist.id);
  const refresh = useRefresh(artist.id);
  const navigate = useNavigate();
  const inv = invoices.find((i) => i.id === invoiceId);
  const [f, setF] = useState<Partial<Invoice>>({});
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (inv) setF(inv);
  }, [inv]);

  if (!isOwner) return <OwnerOnly />;
  if (isLoading) return <Spinner />;
  if (!inv) return <p className="p-8 text-stone-500">Invoice not found. <Link className="underline" to="../sales?tab=invoices">Back</Link></p>;

  const lines = sales.filter((s) => s.invoice_id === inv.id);
  const candidates = sales.filter((s) => !s.invoice_id && s.status !== 'cancelled' && (!f.contact_id || s.buyer_contact_id === f.contact_id));
  const totals = invoiceTotals(lines, { tax_rate: f.tax_rate ?? null, shipping: f.shipping ?? null, discount: f.discount ?? null });
  const contact = contacts.find((c) => c.id === f.contact_id);
  const cur = f.currency || artist.currency;
  const set = <K extends keyof Invoice>(k: K, v: Invoice[K]) => { setSaved(false); setF((x) => ({ ...x, [k]: v })); };
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function save() {
    setError(null);
    const { number, contact_id, issue_date, due_date, status, paid_date, currency, tax_rate, shipping, discount, notes } = f;
    const { error } = await supabase.from('invoices').update(clean({ number, contact_id, issue_date, due_date, status, paid_date, currency, tax_rate, shipping, discount, notes }) as never).eq('id', inv!.id);
    if (error) return setError(error.code === '23505' ? new Error('That invoice number is already used.') : error);
    setSaved(true);
    await refresh('invoices');
  }

  async function link(saleId: string, on: boolean) {
    const { error } = await supabase.from('sales').update({ invoice_id: on ? inv!.id : null }).eq('id', saleId);
    if (error) return setError(error);
    await refresh('sales');
  }

  async function remove() {
    if (!confirm(`Delete invoice ${inv!.number}? Its sales are kept.`)) return;
    const { error } = await supabase.from('invoices').delete().eq('id', inv!.id);
    if (error) return setError(error);
    await refresh('invoices', 'sales');
    navigate('../sales?tab=invoices');
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link to="../sales?tab=invoices" className="text-sm text-stone-500 hover:text-stone-900">← Invoices</Link>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-700">Saved</span>}
            <button className="btn-danger" onClick={remove}>Delete</button>
            <button className="btn-secondary" onClick={save}>Save</button>
            <button className="btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
          </div>
        </div>
        <ErrorNote error={error} />
        <div className="card grid gap-4 p-5 sm:grid-cols-6" aria-label="Invoice details">
          <Field label="Number" className="sm:col-span-2"><input className="input font-mono" value={f.number ?? ''} onChange={(e) => set('number', e.target.value)} /></Field>
          <Field label="Bill to" className="sm:col-span-2">
            <select className="input" value={f.contact_id ?? ''} onChange={(e) => set('contact_id', e.target.value || null)}>
              <option value="">—</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Status" className="sm:col-span-2">
            <select className="input" value={f.status ?? 'draft'} onChange={(e) => set('status', e.target.value)}>
              {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </select>
          </Field>
          <Field label="Issue date" className="sm:col-span-2"><input type="date" className="input" value={f.issue_date ?? ''} onChange={(e) => set('issue_date', e.target.value)} /></Field>
          <Field label="Due date" className="sm:col-span-2"><input type="date" className="input" value={f.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} /></Field>
          <Field label="Paid on" className="sm:col-span-2"><input type="date" className="input" value={f.paid_date ?? ''} onChange={(e) => set('paid_date', e.target.value || null)} /></Field>
          <Field label="Currency" className="sm:col-span-1"><input className="input uppercase" maxLength={3} value={f.currency ?? ''} onChange={(e) => set('currency', e.target.value.toUpperCase() || null)} /></Field>
          <Field label="Tax rate %" className="sm:col-span-1"><input className="input" inputMode="decimal" value={f.tax_rate ?? ''} onChange={(e) => set('tax_rate', num(e.target.value))} /></Field>
          <Field label="Discount" className="sm:col-span-2"><input className="input" inputMode="decimal" value={f.discount ?? ''} onChange={(e) => set('discount', num(e.target.value))} /></Field>
          <Field label="Shipping" className="sm:col-span-2"><input className="input" inputMode="decimal" value={f.shipping ?? ''} onChange={(e) => set('shipping', num(e.target.value))} /></Field>
          <Field label="Notes (printed)" className="sm:col-span-6"><textarea className="input min-h-16" value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        {candidates.length > 0 && (
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-medium">Add sales to this invoice{contact ? ` (sales to ${contact.name})` : ''}</h2>
            <ul className="text-sm">
              {candidates.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-1">
                  <span>{s.sale_date} · {s.pieces?.title} · {money(s.price, s.currency)}</span>
                  <button className="btn-secondary" onClick={() => link(s.id, true)}>Add</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Printable invoice */}
      <article className="card p-10 print:p-0 print:ring-0">
        <header className="flex justify-between gap-6">
          <div>
            <div className="font-serif text-2xl">{artist.name}</div>
            <div className="whitespace-pre-line text-sm text-stone-600">{[artist.location, artist.contact_email, artist.website].filter(Boolean).join('\n')}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Invoice</div>
            <div className="font-mono text-lg">{f.number}</div>
            <div className="text-sm text-stone-600">Date: {f.issue_date}{f.due_date ? <><br />Due: {f.due_date}</> : null}</div>
            {f.status === 'paid' && <div className="mt-1 text-sm font-medium text-emerald-700">Paid{f.paid_date ? ` ${f.paid_date}` : ''}</div>}
          </div>
        </header>
        {contact && (
          <div className="mt-8 text-sm">
            <div className="text-xs uppercase tracking-wide text-stone-500">Bill to</div>
            <div className="font-medium">{contact.name}</div>
            <div className="whitespace-pre-line text-stone-600">{[contact.company !== contact.name ? contact.company : null, contact.address, [contact.city, contact.country].filter(Boolean).join(', '), contact.email].filter(Boolean).join('\n')}</div>
          </div>
        )}
        <table className="mt-8 w-full text-sm">
          <thead className="border-b-2 border-stone-800 text-left text-xs uppercase tracking-wide text-stone-600">
            <tr><th className="py-2" /><th>Work</th><th className="text-right">Amount</th><th className="no-print" /></tr>
          </thead>
          <tbody>
            {lines.map((s) => {
              const p = pieces.find((x) => x.id === s.piece_id);
              const img = p?.piece_images[0];
              return (
                <tr key={s.id} className="border-b border-stone-200 align-top">
                  <td className="w-20 py-3">{img && <img src={imageUrl(img.thumb_path ?? img.storage_path)} alt="" className="h-16 w-16 object-contain" />}</td>
                  <td className="py-3">
                    <div className="font-serif italic">{p?.title ?? s.pieces?.title}{p?.year ? `, ${p.year}` : ''}</div>
                    <div className="text-stone-600">{[p?.medium, p ? dimensions(p) : ''].filter(Boolean).join(' · ')}</div>
                    <div className="font-mono text-xs text-stone-500">{p?.inventory_number}</div>
                  </td>
                  <td className="whitespace-nowrap py-3 text-right">{money(s.price, s.currency ?? cur)}</td>
                  <td className="no-print pl-2 text-right"><button className="text-xs text-rose-700" onClick={() => link(s.id, false)}>Remove</button></td>
                </tr>
              );
            })}
            {!lines.length && <tr><td colSpan={4} className="py-6 text-center text-stone-400">No sales on this invoice yet.</td></tr>}
          </tbody>
        </table>
        <dl className="ml-auto mt-4 w-64 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(totals.subtotal, cur)}</dd></div>
          {totals.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{money(totals.discount, cur)}</dd></div>}
          {totals.tax > 0 && <div className="flex justify-between"><dt>Tax{f.tax_rate ? ` (${Number(f.tax_rate)}%)` : ''}</dt><dd>{money(totals.tax, cur)}</dd></div>}
          {totals.shipping > 0 && <div className="flex justify-between"><dt>Shipping</dt><dd>{money(totals.shipping, cur)}</dd></div>}
          <div className="flex justify-between border-t border-stone-800 pt-1 font-semibold"><dt>Total</dt><dd>{money(totals.total, cur)}</dd></div>
        </dl>
        {f.notes && <p className="mt-8 whitespace-pre-line text-sm text-stone-700">{f.notes}</p>}
      </article>
    </div>
  );
}
