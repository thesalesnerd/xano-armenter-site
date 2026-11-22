import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../workspace';
import { supabase } from '../lib/supabase';
import { usePieces } from '../lib/queries';
import { cap, clean, SALE_STATUSES, useContacts, useInvoices, useRefresh, type Sale } from '../lib/parity';
import { Check, Field } from './form';
import { ErrorNote } from './ui';

type Form = {
  piece_id: string; buyer_contact_id: string; new_buyer: string; via_contact_id: string; invoice_id: string;
  sale_date: string; price: string; currency: string; commission_pct: string; tax_amount: string; status: string; notes: string;
  mark_sold: boolean;
};

/** Records or edits a sale. With `pieceId` the piece is fixed (piece page). */
export default function SaleForm({ sale, pieceId, buyerId, onDone }: { sale?: Sale; pieceId?: string; buyerId?: string; onDone: () => void }) {
  const { artist } = useWorkspace();
  const { data: pieces = [] } = usePieces(artist.id);
  const { data: contacts = [] } = useContacts(artist.id);
  const { data: invoices = [] } = useInvoices(artist.id);
  const refresh = useRefresh(artist.id);
  const s = (v: unknown) => (v == null ? '' : String(v));
  const [f, setF] = useState<Form>({
    piece_id: sale?.piece_id ?? pieceId ?? '', buyer_contact_id: sale?.buyer_contact_id ?? buyerId ?? '', new_buyer: '',
    via_contact_id: sale?.via_contact_id ?? contacts.find((c) => c.represents_artist)?.id ?? '', invoice_id: s(sale?.invoice_id),
    sale_date: sale?.sale_date ?? new Date().toISOString().slice(0, 10), price: s(sale?.price ?? pieces.find((p) => p.id === pieceId)?.price),
    currency: sale?.currency ?? artist.currency, commission_pct: s(sale?.commission_pct), tax_amount: s(sale?.tax_amount),
    status: sale?.status ?? 'completed', notes: s(sale?.notes), mark_sold: !sale,
  });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const piece = pieces.find((p) => p.id === f.piece_id);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let buyer = f.buyer_contact_id || null;
      if (!buyer && f.new_buyer.trim()) {
        const { data, error } = await supabase.from('contacts').insert({ artist_id: artist.id, name: f.new_buyer.trim(), kind: 'collector' }).select('id').single();
        if (error) throw error;
        buyer = data.id;
      }
      const num = (v: string) => (v.trim() === '' ? null : Number(v));
      const values = clean({
        piece_id: f.piece_id, buyer_contact_id: buyer, via_contact_id: f.via_contact_id || null, invoice_id: f.invoice_id || null,
        sale_date: f.sale_date || null, price: num(f.price), currency: f.currency.toUpperCase() || null,
        commission_pct: num(f.commission_pct), tax_amount: num(f.tax_amount), status: f.status, notes: f.notes,
      });
      const { error } = sale
        ? await supabase.from('sales').update(values).eq('id', sale.id)
        : await supabase.from('sales').insert({ ...values, artist_id: artist.id });
      if (error) throw error;
      if (f.mark_sold && f.status !== 'cancelled') {
        const { error } = await supabase.from('pieces').update({ status: 'sold' }).eq('id', f.piece_id);
        if (error) throw error;
      }
      await refresh('sales', 'contacts', 'pieces', 'invoices');
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-6" aria-label="Sale form">
      {!pieceId && (
        <Field label="Piece" className="sm:col-span-6">
          <select className="input" required value={f.piece_id} onChange={(e) => { set('piece_id', e.target.value); const p = pieces.find((x) => x.id === e.target.value); if (p?.price != null && !f.price) set('price', String(p.price)); }}>
            <option value="">Choose a piece…</option>
            {[...pieces].sort((a, b) => (a.inventory_number ?? '').localeCompare(b.inventory_number ?? '', undefined, { numeric: true })).map((p) => (
              <option key={p.id} value={p.id}>{p.inventory_number} · {p.title}{p.status === 'sold' ? ' (sold)' : ''}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Buyer" className="sm:col-span-3">
        <select className="input" value={f.buyer_contact_id} onChange={(e) => set('buyer_contact_id', e.target.value)}>
          <option value="">— new or unknown —</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {!f.buyer_contact_id && (
        <Field label="New buyer name (optional)" className="sm:col-span-3"><input className="input" value={f.new_buyer} onChange={(e) => set('new_buyer', e.target.value)} /></Field>
      )}
      <Field label="Sold via (gallery / agent)" className="sm:col-span-3">
        <select className="input" value={f.via_contact_id} onChange={(e) => set('via_contact_id', e.target.value)}>
          <option value="">— direct —</option>
          {contacts.filter((c) => c.kind !== 'collector' || c.id === f.via_contact_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Date" className="sm:col-span-2"><input type="date" className="input" value={f.sale_date} onChange={(e) => set('sale_date', e.target.value)} /></Field>
      <Field label="Price" className="sm:col-span-2"><input className="input" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
      <Field label="Currency" className="sm:col-span-2"><input className="input uppercase" maxLength={3} value={f.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} /></Field>
      <Field label="Commission %" className="sm:col-span-2"><input className="input" inputMode="decimal" value={f.commission_pct} onChange={(e) => set('commission_pct', e.target.value)} /></Field>
      <Field label="Tax amount" className="sm:col-span-2"><input className="input" inputMode="decimal" value={f.tax_amount} onChange={(e) => set('tax_amount', e.target.value)} /></Field>
      <Field label="Status" className="sm:col-span-2">
        <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
          {SALE_STATUSES.map((x) => <option key={x} value={x}>{cap(x)}</option>)}
        </select>
      </Field>
      <Field label="Invoice" className="sm:col-span-3">
        <select className="input" value={f.invoice_id} onChange={(e) => set('invoice_id', e.target.value)}>
          <option value="">— none —</option>
          {invoices.filter((i) => i.status !== 'void').map((i) => <option key={i.id} value={i.id}>{i.number}{i.contacts ? ` · ${i.contacts.name}` : ''}</option>)}
        </select>
      </Field>
      <Field label="Notes (private)" className="sm:col-span-6"><textarea className="input min-h-16 bg-amber-50/40" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      {piece && piece.status !== 'sold' && (
        <div className="sm:col-span-6"><Check label={`Mark “${piece.title}” as sold`} checked={f.mark_sold} onChange={(v) => set('mark_sold', v)} /></div>
      )}
      <div className="flex gap-2 sm:col-span-6">
        <button className="btn-primary" disabled={saving || !f.piece_id}>{saving ? 'Saving…' : sale ? 'Save sale' : 'Record sale'}</button>
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
      </div>
      <div className="sm:col-span-6"><ErrorNote error={error} /></div>
    </form>
  );
}
