import Papa from 'papaparse';
import type { Collection, PieceWithImages } from './types';
import { dimensions, statusLabel } from './format';
import { imageUrl } from './supabase';

export type ReportType = 'inventory' | 'available' | 'price_list' | 'portfolio';

export const REPORT_TYPES: { value: ReportType; label: string; blurb: string }[] = [
  { value: 'inventory', label: 'Inventory report', blurb: 'A table of every piece with thumbnail, status, location and price. For insurance, accountants and your own records.' },
  { value: 'available', label: 'Available works', blurb: 'Every work currently available, with image, size, price and where it is. For galleries, fairs and studio visits.' },
  { value: 'price_list', label: 'Price list', blurb: 'Clean list for galleries and collectors: image, title, year, medium, size and price.' },
  { value: 'portfolio', label: 'Portfolio', blurb: 'One work per page with a large image and caption. For submissions and presentations.' },
];

export const INVENTORY_FIELDS = [
  { key: 'image', label: 'Image' },
  { key: 'inventory_number', label: 'Inventory #' },
  { key: 'title', label: 'Title' },
  { key: 'year', label: 'Year' },
  { key: 'medium', label: 'Medium' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'subject', label: 'Subject' },
  { key: 'status', label: 'Status' },
  { key: 'location', label: 'Location' },
  { key: 'price', label: 'Price' },
  { key: 'notes', label: 'Private notes' },
] as const;
export type InventoryField = (typeof INVENTORY_FIELDS)[number]['key'];
export const DEFAULT_INVENTORY_FIELDS: InventoryField[] = ['image', 'inventory_number', 'title', 'year', 'medium', 'dimensions', 'status', 'location', 'price'];

/** Full data export, one row per piece. Columns mirror the import format so files round-trip. */
export function piecesToCsv(pieces: PieceWithImages[], collections: Collection[], locations: { id: string; name: string }[] = []): string {
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const colName = new Map(collections.map((c) => [c.id, c.name]));
  const rows = pieces.map((p) => ({
    inventory_number: p.inventory_number ?? '',
    title: p.title,
    kind: p.kind,
    year: p.year ?? '',
    creation_date: p.creation_date ?? '',
    medium: p.medium ?? '',
    subject: p.subject ?? '',
    style: p.style ?? '',
    height: p.height ?? '',
    width: p.width ?? '',
    depth: p.depth ?? '',
    dimension_unit: p.dimension_unit,
    dimensions: dimensions(p),
    framed: p.framed ? 'yes' : 'no',
    framed_height: p.framed_height ?? '',
    framed_width: p.framed_width ?? '',
    framed_depth: p.framed_depth ?? '',
    price: p.price ?? '',
    currency: p.currency ?? '',
    status: statusLabel(p.status),
    public: p.is_public ? 'yes' : 'no',
    show_price: p.show_price ? 'yes' : 'no',
    location: p.location ?? '',
    storage_location: p.location_id ? locName.get(p.location_id) ?? '' : '',
    edition_size: p.edition_size ?? '',
    signature: p.signature ?? '',
    tags: (p.tags ?? []).join(', '),
    collections: p.collection_pieces.map((c) => colName.get(c.collection_id)).filter(Boolean).join('; '),
    description: p.description ?? '',
    notes: p.notes ?? '',
    image_urls: p.piece_images.map((i) => imageUrl(i.storage_path)).join(' '),
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
  return Papa.unparse(rows);
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** "Camp 3 · rack B": the location record, plus the free-text details when they add something. */
export function locationLabel(p: { location: string | null; location_id: string | null }, locations: { id: string; name: string }[]): string {
  const rec = p.location_id ? locations.find((l) => l.id === p.location_id)?.name : undefined;
  const text = p.location?.trim();
  if (rec && text && text.toLowerCase() !== rec.toLowerCase()) return `${rec} · ${text}`;
  return rec ?? text ?? '';
}
