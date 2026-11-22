// Column definitions for an Artwork Archive data export.
//
// AA exports one spreadsheet per area (pieces, contacts, sales, exhibitions,
// locations) as CSV or XLSX. Column names differ between AA reports and over
// time, so every field lists the names we have seen or expect, and the user
// can correct the mapping before anything is planned.

export type Entity = 'pieces' | 'contacts' | 'sales' | 'exhibitions' | 'locations';

export type FieldDef = { key: string; label: string; synonyms: string[] };

const f = (key: string, label: string, ...synonyms: string[]): FieldDef => ({ key, label, synonyms: [key.replace(/_/g, ' '), ...synonyms] });

export const FIELDS: Record<Entity, FieldDef[]> = {
  pieces: [
    f('title', 'Title', 'name', 'piece name', 'piece title', 'artwork title', 'artwork name', 'artwork'),
    f('inventory_number', 'Inventory #', 'inventory number', 'inventory #', 'inventory no', 'inventory', 'inv #', 'inv', 'piece id', 'catalog number', 'catalogue number', 'stock number'),
    f('slug', 'URL slug', 'url slug', 'handle', 'permalink'),
    f('source_ref', 'AA page link / ID', 'public url', 'public link', 'public profile url', 'artwork url', 'url', 'link', 'aa url', 'piece url', 'id'),
    f('year', 'Year', 'year created', 'creation year', 'date created', 'creation date', 'date'),
    f('medium', 'Medium', 'media', 'materials', 'technique'),
    f('subject', 'Subject', 'subject matter', 'genre', 'category'),
    f('style', 'Style', 'movement'),
    f('kind', 'Type (original / edition)', 'type', 'piece type', 'artwork type'),
    f('dimensions', 'Dimensions (text)', 'size', 'dims', 'measurements', 'dimensions text'),
    f('height', 'Height', 'h', 'height in', 'height cm'),
    f('width', 'Width', 'w', 'width in', 'width cm'),
    f('depth', 'Depth', 'd', 'depth in', 'depth cm'),
    f('dimension_unit', 'Dimension unit', 'unit', 'units', 'dimension units', 'dimensions unit', 'measurement unit'),
    f('framed', 'Framed (yes/no)', 'is framed'),
    f('framed_dimensions', 'Framed dimensions', 'framed size', 'frame dimensions'),
    f('price', 'Price', 'retail price', 'list price', 'asking price', 'value', 'retail value'),
    f('currency', 'Currency'),
    f('status', 'Status', 'availability', 'piece status', 'sale status'),
    f('location', 'Location', 'current location', 'location name', 'storage location'),
    f('description', 'Description (public)', 'public description', 'artwork description', 'about'),
    f('notes', 'Private notes', 'private notes', 'internal notes', 'notes', 'comments'),
    f('signature', 'Signature', 'signed', 'signature location', 'inscription', 'inscriptions'),
    f('edition_size', 'Edition size', 'edition', 'edition total', 'run size'),
    f('tags', 'Tags', 'keywords'),
    f('collections', 'Collections', 'collection', 'series', 'groups'),
    f('exhibitions', 'Exhibitions', 'exhibition', 'exhibition history', 'shows'),
    f('provenance', 'Provenance', 'provenance history', 'ownership history'),
    f('is_public', 'Public (yes/no)', 'public', 'is public', 'show on profile', 'published', 'visible'),
    f('image_urls', 'Main image URL', 'image', 'image url', 'primary image', 'primary image url', 'main image', 'photo', 'photo url', 'image link'),
    f('extra_image_urls', 'Additional image URLs', 'additional images', 'additional image urls', 'other images', 'extra images', 'images', 'detail images'),
    f('sale_date', 'Sale date', 'sold date', 'date sold'),
    f('sale_price', 'Sale price', 'sold price', 'sold for', 'price sold'),
    f('buyer', 'Buyer', 'sold to', 'buyer name', 'collector', 'owner', 'purchaser'),
    f('buyer_email', 'Buyer email', 'sold to email', 'collector email'),
    f('sold_via', 'Sold via (gallery)', 'sold through', 'gallery', 'sold by', 'consigned to', 'venue'),
    f('commission_pct', 'Commission %', 'commission', 'commission percent', 'commission rate'),
    f('invoice_number', 'Invoice #', 'invoice', 'invoice no', 'invoice id'),
  ],
  contacts: [
    f('source_ref', 'AA contact ID', 'contact id', 'id'),
    f('name', 'Full name', 'full name', 'contact name', 'display name', 'contact'),
    f('first_name', 'First name', 'first', 'given name'),
    f('last_name', 'Last name', 'last', 'surname', 'family name'),
    f('company', 'Company / organisation', 'organization', 'organisation', 'business', 'business name', 'gallery name'),
    f('kind', 'Contact type', 'type', 'contact type', 'category', 'role'),
    f('email', 'Email', 'email address', 'e mail', 'primary email'),
    f('phone', 'Phone', 'phone number', 'telephone', 'mobile', 'cell'),
    f('address', 'Address', 'address 1', 'address line 1', 'street', 'street address', 'mailing address'),
    f('address2', 'Address line 2', 'address 2', 'address line 2'),
    f('city', 'City', 'town'),
    f('region', 'State / region', 'state', 'province', 'region', 'county'),
    f('postal_code', 'Postal code', 'zip', 'zip code', 'postcode', 'postal code'),
    f('country', 'Country'),
    f('website', 'Website', 'web', 'url'),
    f('notes', 'Notes', 'comments', 'private notes'),
    f('tags', 'Tags', 'groups', 'lists'),
  ],
  sales: [
    f('source_ref', 'AA sale ID', 'sale id', 'transaction id', 'id'),
    f('inventory_number', 'Piece inventory #', 'inventory number', 'inventory #', 'piece inventory number', 'inv #'),
    f('title', 'Piece title', 'piece', 'piece name', 'artwork', 'artwork title', 'title'),
    f('sale_date', 'Sale date', 'date', 'sold date', 'date sold', 'transaction date'),
    f('price', 'Sale price', 'sale price', 'amount', 'price', 'sold price', 'total'),
    f('currency', 'Currency'),
    f('buyer', 'Buyer', 'buyer name', 'contact', 'sold to', 'collector', 'customer', 'purchaser'),
    f('buyer_email', 'Buyer email', 'contact email', 'email'),
    f('via', 'Sold via (gallery)', 'gallery', 'sold through', 'venue', 'agent', 'dealer'),
    f('commission_pct', 'Commission %', 'commission', 'commission percent', 'commission rate'),
    f('tax_amount', 'Tax', 'tax', 'sales tax', 'vat'),
    f('status', 'Sale status', 'status', 'payment status'),
    f('invoice_number', 'Invoice #', 'invoice', 'invoice no', 'invoice id'),
    f('notes', 'Notes', 'comments'),
  ],
  exhibitions: [
    f('source_ref', 'AA exhibition ID', 'exhibition id', 'id'),
    f('title', 'Exhibition title', 'exhibition', 'exhibition name', 'name', 'show', 'show name', 'title'),
    f('kind', 'Type', 'type', 'exhibition type'),
    f('venue', 'Venue', 'gallery', 'location', 'institution', 'host'),
    f('city', 'City'),
    f('country', 'Country'),
    f('start_date', 'Start date', 'start', 'opening', 'opening date', 'from', 'date'),
    f('end_date', 'End date', 'end', 'closing', 'closing date', 'to'),
    f('url', 'Website', 'website', 'link', 'url'),
    f('description', 'Description', 'notes', 'about'),
    f('pieces', 'Pieces (inventory # or titles)', 'artworks', 'pieces', 'works', 'piece', 'inventory numbers'),
    f('is_public', 'Public (yes/no)', 'public', 'is public', 'show on profile'),
  ],
  locations: [
    f('name', 'Location name', 'location', 'name', 'location name', 'title'),
    f('kind', 'Type', 'type', 'location type'),
    f('address', 'Address', 'street', 'address 1'),
    f('city', 'City'),
    f('country', 'Country'),
    f('notes', 'Notes', 'description', 'comments'),
  ],
};

export const ENTITY_LABEL: Record<Entity, string> = {
  pieces: 'Pieces',
  contacts: 'Contacts',
  sales: 'Sales',
  exhibitions: 'Exhibitions',
  locations: 'Locations',
};

export type FieldMap = Record<string, string>; // header -> field key ('' = ignore)

export const normHeader = (s: string) =>
  s.toLowerCase().replace(/[_\-.:()/]+/g, ' ').replace(/[#]/g, ' # ').replace(/\s+/g, ' ').trim().replace(/ #$/, ' #');

/** Maps each header to a field of the entity, first exact key/synonym match wins, each field used once. */
export function autoMapFields(entity: Entity, headers: string[]): FieldMap {
  const used = new Set<string>();
  const out: FieldMap = {};
  const defs = FIELDS[entity];
  // Two passes: exact keys/labels first so a generic synonym ("id", "url") never steals a specific column.
  for (const pass of [0, 1] as const) {
    for (const h of headers) {
      if (out[h]) continue;
      const n = normHeader(h);
      const hit = defs.find((d) =>
        !used.has(d.key) &&
        (pass === 0
          ? normHeader(d.key) === n || normHeader(d.label) === n
          : d.synonyms.some((s) => normHeader(s) === n)),
      );
      if (hit) {
        out[h] = hit.key;
        used.add(hit.key);
      }
    }
  }
  for (const h of headers) out[h] ??= '';
  return out;
}

/** Guesses which kind of sheet this is from its name and headers. */
export function classifySheet(name: string, headers: string[]): Entity {
  const n = name.toLowerCase();
  if (/contact|collector|client|customer/.test(n)) return 'contacts';
  if (/sale|invoice|transaction/.test(n)) return 'sales';
  if (/exhib|show/.test(n)) return 'exhibitions';
  if (/location/.test(n)) return 'locations';
  if (/piece|artwork|inventory|work/.test(n)) return 'pieces';
  const hs = headers.map(normHeader);
  const has = (...xs: string[]) => xs.some((x) => hs.includes(x));
  if (has('medium', 'dimensions', 'height', 'subject matter', 'piece name')) return 'pieces';
  if (has('first name', 'last name', 'email', 'company', 'phone')) return 'contacts';
  if (has('venue', 'start date', 'opening date', 'exhibition', 'exhibition title')) return 'exhibitions';
  if (has('sale price', 'buyer', 'sale date', 'invoice')) return 'sales';
  if (has('location name', 'address') && hs.length <= 6) return 'locations';
  return 'pieces';
}
