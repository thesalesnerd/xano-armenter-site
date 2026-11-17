import type { PieceInsert, PieceStatus } from './types';

/** Fields a source column can be mapped to. */
export const TARGETS = [
  { key: 'title', label: 'Title', synonyms: ['title', 'name', 'piece title', 'artwork title', 'piece name', 'artwork'] },
  { key: 'inventory_number', label: 'Inventory #', synonyms: ['inventory number', 'inventory #', 'inventory no', 'inventory', 'inv', 'inv #', 'id', 'catalog number', 'catalogue number', 'stock number', 'piece id'] },
  { key: 'year', label: 'Year', synonyms: ['year', 'year created', 'date created', 'creation year', 'date', 'creation date'] },
  { key: 'medium', label: 'Medium', synonyms: ['medium', 'media', 'materials', 'technique', 'type'] },
  { key: 'subject', label: 'Subject', synonyms: ['subject', 'subject matter', 'genre', 'category'] },
  { key: 'style', label: 'Style', synonyms: ['style', 'movement'] },
  { key: 'dimensions', label: 'Dimensions (text, e.g. 46 x 38 cm)', synonyms: ['dimensions', 'size', 'dims', 'measurements'] },
  { key: 'height', label: 'Height', synonyms: ['height', 'h'] },
  { key: 'width', label: 'Width', synonyms: ['width', 'w'] },
  { key: 'depth', label: 'Depth', synonyms: ['depth', 'd'] },
  { key: 'dimension_unit', label: 'Dimension unit', synonyms: ['unit', 'units', 'dimension unit', 'measurement unit'] },
  { key: 'price', label: 'Price', synonyms: ['price', 'retail price', 'sale price', 'value', 'list price', 'asking price'] },
  { key: 'currency', label: 'Currency', synonyms: ['currency'] },
  { key: 'status', label: 'Status', synonyms: ['status', 'availability', 'state'] },
  { key: 'location', label: 'Location', synonyms: ['location', 'current location', 'where'] },
  { key: 'description', label: 'Description (public)', synonyms: ['description', 'about', 'artwork description', 'public description'] },
  { key: 'notes', label: 'Private notes', synonyms: ['notes', 'private notes', 'internal notes', 'comments'] },
  { key: 'signature', label: 'Signature', synonyms: ['signature', 'signed', 'inscription', 'inscriptions'] },
  { key: 'edition_size', label: 'Edition size', synonyms: ['edition size', 'edition', 'run size'] },
  { key: 'tags', label: 'Tags', synonyms: ['tags', 'keywords'] },
  { key: 'collections', label: 'Collections (separate with ;)', synonyms: ['collections', 'collection', 'series', 'groups'] },
  { key: 'is_public', label: 'Public (yes/no)', synonyms: ['public', 'is public', 'show on profile', 'published', 'visible'] },
  { key: 'image_urls', label: 'Image URL(s)', synonyms: ['image', 'image url', 'image urls', 'images', 'photo', 'photo url', 'primary image', 'image link'] },
  { key: 'source_ref', label: 'Original link / ID', synonyms: ['url', 'link', 'aa url', 'aa_url', 'source', 'source url', 'artwork url'] },
] as const;

export type TargetKey = (typeof TARGETS)[number]['key'];
export type Mapping = Record<string, TargetKey | ''>;

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

export function autoMap(headers: string[]): Mapping {
  const used = new Set<string>();
  const m: Mapping = {};
  for (const h of headers) {
    const n = norm(h);
    const hit = TARGETS.find((t) => !used.has(t.key) && (t.key === n || (t.synonyms as readonly string[]).includes(n)));
    m[h] = hit?.key ?? '';
    if (hit) used.add(hit.key);
  }
  return m;
}

const STATUS_WORDS: [RegExp, PieceStatus][] = [
  [/sold/i, 'sold'],
  [/hold|reserved|pending/i, 'on_hold'],
  [/loan/i, 'on_loan'],
  [/consign/i, 'consigned'],
  [/not for sale|nfs|private collection|personal/i, 'not_for_sale'],
  [/gift/i, 'gifted'],
  [/donat/i, 'donated'],
  [/destroy|lost|damaged/i, 'destroyed'],
  [/archiv/i, 'archived'],
  [/avail|for sale|inventory|in stock/i, 'available'],
];

export function parseStatus(v: string): PieceStatus | null {
  if (!v.trim()) return null;
  return STATUS_WORDS.find(([re]) => re.test(v))?.[1] ?? null;
}

export function parseNumber(v: string): number | null {
  const cleaned = v.replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;
  // "1.500,50" (European) vs "1,500.50"
  // "3.200" / "1.250.000" with no decimal comma: dots are thousands separators.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/\./g, ''));
  if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/,/g, ''));
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let s = cleaned;
  if (lastComma > lastDot) s = cleaned.replace(/\./g, '').replace(',', '.');
  else s = cleaned.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseCurrency(v: string): string | null {
  const code = v.match(/\b([A-Z]{3})\b/)?.[1];
  if (code) return code;
  if (v.includes('€')) return 'EUR';
  if (v.includes('£')) return 'GBP';
  if (v.includes('$')) return 'USD';
  return null;
}

/** "46 x 38 cm", "36 × 48 × 1.5 in", "120x90" */
export function parseDimensions(v: string): { height: number | null; width: number | null; depth: number | null; unit: 'cm' | 'in' | null } {
  const nums = (v.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')));
  const unit = /\bin\b|inch|"/i.test(v) ? 'in' : /cm|centim/i.test(v) ? 'cm' : null;
  return { height: nums[0] ?? null, width: nums[1] ?? null, depth: nums[2] ?? null, unit };
}

const truthy = (v: string) => /^(y|yes|true|1|public|published|visible|x)$/i.test(v.trim());

export type ParsedRow = {
  piece: Omit<PieceInsert, 'artist_id'>;
  collections: string[];
  imageUrls: string[];
  problems: string[];
};

export function mapRow(
  row: Record<string, unknown>,
  mapping: Mapping,
  defaults: { currency: string; unit: 'cm' | 'in'; status: PieceStatus; isPublic: boolean },
): ParsedRow {
  const get = (k: TargetKey) => {
    const col = Object.keys(mapping).find((h) => mapping[h] === k);
    const v = col ? row[col] : undefined;
    return v == null ? '' : String(v).trim();
  };
  const problems: string[] = [];
  const title = get('title');
  if (!title) problems.push('missing title');

  const dimsText = get('dimensions');
  const dims = dimsText ? parseDimensions(dimsText) : { height: null, width: null, depth: null, unit: null };
  const height = get('height') ? parseNumber(get('height')) : dims.height;
  const width = get('width') ? parseNumber(get('width')) : dims.width;
  const depth = get('depth') ? parseNumber(get('depth')) : dims.depth;
  const unitRaw = get('dimension_unit').toLowerCase();
  const unit = unitRaw.startsWith('in') ? 'in' : unitRaw.startsWith('c') ? 'cm' : dims.unit ?? defaults.unit;

  const priceRaw = get('price');
  const statusRaw = get('status');
  const status = parseStatus(statusRaw);
  if (statusRaw && !status) problems.push(`unknown status “${statusRaw}”`);
  const yearMatch = get('year').match(/\b(1\d{3}|2\d{3})\b/);
  const pub = get('is_public');

  return {
    piece: {
      title: title || 'Untitled',
      inventory_number: get('inventory_number') || null,
      year: yearMatch ? Number(yearMatch[1]) : null,
      medium: get('medium') || null,
      subject: get('subject') || null,
      style: get('style') || null,
      height, width, depth,
      dimension_unit: unit,
      price: priceRaw ? parseNumber(priceRaw) : null,
      currency: get('currency').toUpperCase().slice(0, 3) || parseCurrency(priceRaw) || defaults.currency,
      status: status ?? defaults.status,
      is_public: pub ? truthy(pub) : defaults.isPublic,
      location: get('location') || null,
      description: get('description') || null,
      notes: get('notes') || null,
      signature: get('signature') || null,
      edition_size: get('edition_size') ? parseNumber(get('edition_size')) : null,
      kind: get('edition_size') ? 'edition' : 'original',
      tags: get('tags').split(/[,;]/).map((t) => t.trim()).filter(Boolean),
      source_ref: get('source_ref') || null,
    },
    collections: get('collections').split(';').map((c) => c.trim()).filter(Boolean),
    // Split on whitespace, | or ;, and on a comma only when another URL follows it.
    // Image CDN URLs (Artwork Archive / Cloudinary) carry commas inside the path: f_auto,q_auto,w_1600.
    imageUrls: splitImageUrls(get('image_urls')),
    problems,
  };
}

/** Splits an image-URL cell into URLs without cutting CDN paths that contain commas. */
export function splitImageUrls(cell: string): string[] {
  return cell
    .split(/[\s|;]+|,(?=\s*https?:\/\/)/)
    .map((u) => u.trim().replace(/,+$/, ''))
    .filter((u) => /^https?:\/\//.test(u));
}
