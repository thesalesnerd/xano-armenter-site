import type { Piece, PieceStatus, PublicPiece } from './types';

export const STATUSES: { value: PieceStatus; label: string; tone: string }[] = [
  { value: 'available', label: 'Available', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  { value: 'on_hold', label: 'On hold', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  { value: 'sold', label: 'Sold', tone: 'bg-rose-50 text-rose-800 ring-rose-200' },
  { value: 'on_loan', label: 'On loan', tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
  { value: 'consigned', label: 'Consigned', tone: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
  { value: 'not_for_sale', label: 'Not for sale', tone: 'bg-stone-100 text-stone-700 ring-stone-200' },
  { value: 'gifted', label: 'Gifted', tone: 'bg-violet-50 text-violet-800 ring-violet-200' },
  { value: 'donated', label: 'Donated', tone: 'bg-violet-50 text-violet-800 ring-violet-200' },
  { value: 'destroyed', label: 'Destroyed', tone: 'bg-stone-100 text-stone-500 ring-stone-200' },
  { value: 'archived', label: 'Archived', tone: 'bg-stone-100 text-stone-500 ring-stone-200' },
];

export function statusLabel(s: PieceStatus | null | undefined): string {
  return STATUSES.find((x) => x.value === s)?.label ?? '';
}

export function statusTone(s: PieceStatus | null | undefined): string {
  return STATUSES.find((x) => x.value === s)?.tone ?? '';
}

function n(v: number | null | undefined): string {
  if (v == null) return '';
  return Number.isInteger(Number(v)) ? String(Number(v)) : String(Number(v));
}

type Dims = Pick<Piece, 'height' | 'width' | 'depth' | 'dimension_unit'> | Pick<PublicPiece, 'height' | 'width' | 'depth' | 'dimension_unit'>;

export function dimensions(p: Dims): string {
  const parts = [p.height, p.width, p.depth].filter((v) => v != null && Number(v) > 0).map((v) => n(v));
  return parts.length ? `${parts.join(' × ')} ${p.dimension_unit ?? 'cm'}` : '';
}

export function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency ?? ''}`.trim();
  }
}

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
