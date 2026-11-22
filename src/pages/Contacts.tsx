import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../workspace';
import { supabase } from '../lib/supabase';
import { money } from '../lib/format';
import { cap, clean, CONTACT_KINDS, useContacts, useRefresh, useSales, type Contact } from '../lib/parity';
import { Empty, ErrorNote, PageHeader, Spinner } from '../components/ui';
import { Check, Field, PrivateBadge } from '../components/form';

type Form = {
  name: string; kind: string; company: string; email: string; phone: string; address: string; city: string;
  country: string; website: string; notes: string; tags: string; represents_artist: boolean;
};
const blank: Form = { name: '', kind: 'collector', company: '', email: '', phone: '', address: '', city: '', country: '', website: '', notes: '', tags: '', represents_artist: false };

export function OwnerOnly() {
  return (
    <Empty title="Owners only">
      Contacts, sales, invoices and other private business records are visible only to the workspace owner.
    </Empty>
  );
}

export default function Contacts() {
  const { artist, isOwner } = useWorkspace();
  const { data: contacts = [], isLoading } = useContacts(artist.id, isOwner);
  const { data: sales = [] } = useSales(artist.id, isOwner);
  const refresh = useRefresh(artist.id);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState<unknown>(null);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return contacts.filter((c) => (!kind || c.kind === kind) && (!n || [c.name, c.company, c.email, c.city, ...(c.tags ?? [])].join(' ').toLowerCase().includes(n)));
  }, [contacts, q, kind]);

  if (!isOwner) return <OwnerOnly />;
  if (isLoading) return <Spinner />;

  const current = contacts.find((c) => c.id === selected);
  const theirSales = current ? sales.filter((s) => s.buyer_contact_id === current.id || s.via_contact_id === current.id) : [];

  function open(c: Contact | null) {
    setError(null);
    setSelected(c ? c.id : 'new');
    const s = (v: string | null) => v ?? '';
    setForm(c ? { name: c.name, kind: c.kind, company: s(c.company), email: s(c.email), phone: s(c.phone), address: s(c.address), city: s(c.city), country: s(c.country), website: s(c.website), notes: s(c.notes), tags: (c.tags ?? []).join(', '), represents_artist: c.represents_artist } : blank);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const v = clean({ ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) });
    const res =
      selected === 'new'
        ? await supabase.from('contacts').insert({ ...v, artist_id: artist.id } as never).select('id').single()
        : await supabase.from('contacts').update(v as never).eq('id', selected!).select('id').single();
    if (res.error) return setError(res.error);
    setSelected(res.data.id);
    await refresh('contacts');
  }

  async function remove() {
    if (!current || !confirm(`Delete ${current.name}? Their sales stay, without a buyer.`)) return;
    const { error } = await supabase.from('contacts').delete().eq('id', current.id);
    if (error) return setError(error);
    setSelected(null);
    await refresh('contacts', 'sales');
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof Form, label: string, cls = 'sm:col-span-3', type = 'text') => (
    <Field label={label} className={cls}><input type={type} className="input" value={form[k] as string} onChange={(e) => set(k, e.target.value as never)} /></Field>
  );

  return (
    <div>
      <PageHeader title="Contacts" count={contacts.length} actions={<><PrivateBadge /><button className="btn-primary" onClick={() => open(null)}>+ New contact</button></>}>
        <p className="mt-1 text-sm text-stone-500">Collectors, galleries and institutions. Link them to sales, locations and provenance.</p>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <div className="mb-3 flex gap-2">
            <input className="input" placeholder="Search name, company, email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
            <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Contact type">
              <option value="">All types</option>
              {CONTACT_KINDS.map((k) => <option key={k} value={k}>{cap(k)}</option>)}
            </select>
          </div>
          {!shown.length ? (
            <Empty title={contacts.length ? 'No matches' : 'No contacts yet'}>Add collectors and galleries, or import them from your Artwork Archive export.</Empty>
          ) : (
            <ul className="card divide-y divide-stone-100">
              {shown.map((c) => (
                <li key={c.id}>
                  <button className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${selected === c.id ? 'bg-stone-100' : 'hover:bg-stone-50'}`} onClick={() => open(c)}>
                    <span>
                      <span className="font-medium">{c.name}</span>
                      {c.company && c.company !== c.name && <span className="text-stone-500"> · {c.company}</span>}
                      {c.represents_artist && <span className="chip ml-2 bg-indigo-50 text-indigo-800 ring-indigo-200">Represents {artist.name}</span>}
                    </span>
                    <span className="text-xs text-stone-500">{cap(c.kind)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <div className="space-y-6">
            <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-6" aria-label="Contact form">
              {text('name', 'Name', 'sm:col-span-4')}
              <Field label="Type" className="sm:col-span-2">
                <select className="input" value={form.kind} onChange={(e) => set('kind', e.target.value)}>
                  {CONTACT_KINDS.map((k) => <option key={k} value={k}>{cap(k)}</option>)}
                </select>
              </Field>
              {text('company', 'Company / organisation')}
              {text('email', 'Email', 'sm:col-span-3', 'email')}
              {text('phone', 'Phone')}
              {text('website', 'Website')}
              <Field label="Address" className="sm:col-span-6"><textarea className="input min-h-16" value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
              {text('city', 'City')}
              {text('country', 'Country')}
              {text('tags', 'Tags (comma separated)', 'sm:col-span-6')}
              <Field label="Notes" className="sm:col-span-6"><textarea className="input min-h-20 bg-amber-50/40" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
              <div className="sm:col-span-6"><Check label={`Represents ${artist.name} (gallery / agent)`} checked={form.represents_artist} onChange={(v) => set('represents_artist', v)} /></div>
              <div className="flex gap-2 sm:col-span-6">
                <button className="btn-primary" disabled={!form.name.trim()}>{selected === 'new' ? 'Add contact' : 'Save'}</button>
                {current && <button type="button" className="btn-danger" onClick={remove}>Delete</button>}
                <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Close</button>
              </div>
              <div className="sm:col-span-6"><ErrorNote error={error} /></div>
            </form>
            {current && (
              <section className="card p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Sales</h2>
                {!theirSales.length ? (
                  <p className="text-sm text-stone-500">No sales linked. <Link className="underline" to={`../sales?new=1&buyer=${current.id}`}>Record one</Link>.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-stone-100">
                      {theirSales.map((s) => (
                        <tr key={s.id}>
                          <td className="py-1.5">{s.sale_date ?? '—'}</td>
                          <td><Link className="underline" to={`../pieces/${s.piece_id}`}>{s.pieces?.title}</Link></td>
                          <td className="text-stone-500">{s.buyer_contact_id === current.id ? 'Bought' : 'Sold via'}</td>
                          <td className="text-right">{money(s.price, s.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
