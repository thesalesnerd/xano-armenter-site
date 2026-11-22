// Data hooks for locations, contacts, sales, invoices, exhibitions.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Database } from './database.types';

type T = Database['public']['Tables'];
export type Location = T['locations']['Row'];
export type Contact = T['contacts']['Row'];
export type Sale = T['sales']['Row'];
export type Invoice = T['invoices']['Row'];
export type Exhibition = T['exhibitions']['Row'];
export type Provenance = T['provenance']['Row'];
export type PieceNote = T['piece_notes']['Row'];
export type DocumentRow = T['documents']['Row'];

export const LOCATION_KINDS = ['studio', 'storage', 'gallery', 'collector', 'exhibition', 'other'] as const;
export const CONTACT_KINDS = ['collector', 'gallery', 'institution', 'dealer', 'press', 'other'] as const;
export const EXHIBITION_KINDS = ['solo', 'group', 'fair', 'online', 'residency', 'other'] as const;
export const PROVENANCE_EVENTS = ['created', 'owned', 'sold', 'gifted', 'loaned', 'consigned', 'inherited', 'exhibited', 'other'] as const;
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'] as const;
export const SALE_STATUSES = ['completed', 'pending', 'cancelled'] as const;

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export function useLocations(artistId: string) {
  return useQuery({
    queryKey: ['locations', artistId],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('*').eq('artist_id', artistId).order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useContacts(artistId: string, enabled = true) {
  return useQuery({
    queryKey: ['contacts', artistId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('*').eq('artist_id', artistId).order('name');
      if (error) throw error;
      return data;
    },
  });
}

export type SaleWithRefs = Sale & {
  pieces: { id: string; title: string; inventory_number: string | null } | null;
  buyer: { id: string; name: string } | null;
  via: { id: string; name: string } | null;
  invoices: { id: string; number: string } | null;
};

export function useSales(artistId: string, enabled = true) {
  return useQuery({
    queryKey: ['sales', artistId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, pieces(id, title, inventory_number), buyer:contacts!sales_buyer_contact_id_fkey(id, name), via:contacts!sales_via_contact_id_fkey(id, name), invoices(id, number)')
        .eq('artist_id', artistId)
        .order('sale_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as unknown as SaleWithRefs[];
    },
  });
}

export function useInvoices(artistId: string, enabled = true) {
  return useQuery({
    queryKey: ['invoices', artistId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*, contacts(id, name)').eq('artist_id', artistId).order('issue_date', { ascending: false });
      if (error) throw error;
      return data as (Invoice & { contacts: { id: string; name: string } | null })[];
    },
  });
}

export function useExhibitions(artistId: string) {
  return useQuery({
    queryKey: ['exhibitions', artistId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exhibitions').select('*, exhibition_pieces(piece_id)').eq('artist_id', artistId).order('start_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as (Exhibition & { exhibition_pieces: { piece_id: string }[] })[];
    },
  });
}

/** Invalidates everything the parity screens show, after a write. */
export function useRefresh(artistId: string) {
  const qc = useQueryClient();
  return (...keys: string[]) =>
    Promise.all((keys.length ? keys : ['locations', 'contacts', 'sales', 'invoices', 'exhibitions', 'pieces']).map((k) => qc.invalidateQueries({ queryKey: [k, artistId] })));
}

/** Empty strings become null, so optional columns stay empty instead of ''. */
export function clean<V extends Record<string, unknown>>(v: V): V {
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' && x.trim() === '' ? null : typeof x === 'string' ? x.trim() : x])) as V;
}

export function invoiceTotals(sales: { price: number | null; tax_amount: number | null; status: string }[], inv: Pick<Invoice, 'tax_rate' | 'shipping' | 'discount'>) {
  const live = sales.filter((s) => s.status !== 'cancelled');
  const subtotal = live.reduce((n, s) => n + Number(s.price ?? 0), 0);
  const lineTax = live.reduce((n, s) => n + Number(s.tax_amount ?? 0), 0);
  const discount = Number(inv.discount ?? 0);
  const tax = lineTax + (inv.tax_rate ? ((subtotal - discount) * Number(inv.tax_rate)) / 100 : 0);
  const shipping = Number(inv.shipping ?? 0);
  return { subtotal, discount, tax, shipping, total: subtotal - discount + tax + shipping };
}
