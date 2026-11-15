import type { PieceStatus, PieceWithImages } from './types';

export type Filters = {
  q: string;
  status: PieceStatus[];
  medium: string;
  subject: string;
  collection: string;
  visibility: '' | 'public' | 'private';
  yearFrom: string;
  yearTo: string;
  sort: 'newest' | 'oldest' | 'title' | 'year_desc' | 'year_asc' | 'inventory' | 'price_desc' | 'price_asc';
};

export const EMPTY_FILTERS: Filters = {
  q: '', status: [], medium: '', subject: '', collection: '', visibility: '', yearFrom: '', yearTo: '', sort: 'newest',
};

export function filtersFromParams(sp: URLSearchParams): Filters {
  return {
    q: sp.get('q') ?? '',
    status: (sp.get('status')?.split(',').filter(Boolean) ?? []) as PieceStatus[],
    medium: sp.get('medium') ?? '',
    subject: sp.get('subject') ?? '',
    collection: sp.get('collection') ?? '',
    visibility: (sp.get('visibility') ?? '') as Filters['visibility'],
    yearFrom: sp.get('yearFrom') ?? '',
    yearTo: sp.get('yearTo') ?? '',
    sort: (sp.get('sort') ?? 'newest') as Filters['sort'],
  };
}

export function filtersToParams(f: Filters, base?: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams(base);
  const set = (k: string, v: string) => (v ? sp.set(k, v) : sp.delete(k));
  set('q', f.q);
  set('status', f.status.join(','));
  set('medium', f.medium);
  set('subject', f.subject);
  set('collection', f.collection);
  set('visibility', f.visibility);
  set('yearFrom', f.yearFrom);
  set('yearTo', f.yearTo);
  set('sort', f.sort === 'newest' ? '' : f.sort);
  return sp;
}

export function applyFilters(pieces: PieceWithImages[], f: Filters): PieceWithImages[] {
  const q = f.q.trim().toLowerCase();
  const out = pieces.filter((p) => {
    if (q) {
      const hay = [p.title, p.inventory_number, p.medium, p.subject, p.style, p.location, p.description, ...(p.tags ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.status.length && !f.status.includes(p.status)) return false;
    if (f.medium && p.medium !== f.medium) return false;
    if (f.subject && p.subject !== f.subject) return false;
    if (f.collection && !p.collection_pieces.some((c) => c.collection_id === f.collection)) return false;
    if (f.visibility === 'public' && !p.is_public) return false;
    if (f.visibility === 'private' && p.is_public) return false;
    if (f.yearFrom && (p.year == null || p.year < Number(f.yearFrom))) return false;
    if (f.yearTo && (p.year == null || p.year > Number(f.yearTo))) return false;
    return true;
  });
  const by = <T,>(get: (p: PieceWithImages) => T | null, dir: 1 | -1) => (a: PieceWithImages, b: PieceWithImages) => {
    const x = get(a), y = get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  };
  const sorters: Record<Filters['sort'], (a: PieceWithImages, b: PieceWithImages) => number> = {
    newest: by((p) => p.created_at, -1),
    oldest: by((p) => p.created_at, 1),
    title: (a, b) => a.title.localeCompare(b.title),
    year_desc: by((p) => p.year, -1),
    year_asc: by((p) => p.year, 1),
    inventory: (a, b) => (a.inventory_number ?? '').localeCompare(b.inventory_number ?? '', undefined, { numeric: true }),
    price_desc: by((p) => (p.price == null ? null : Number(p.price)), -1),
    price_asc: by((p) => (p.price == null ? null : Number(p.price)), 1),
  };
  return out.sort(sorters[f.sort]);
}

export function distinct(pieces: PieceWithImages[], key: 'medium' | 'subject'): string[] {
  return [...new Set(pieces.map((p) => p[key]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}
