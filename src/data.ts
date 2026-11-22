import raw from "./data/artworks.json";

export type Artwork = {
  slug: string;
  title: string;
  year: number | null;
  circa: boolean;
  medium: string | null;
  subject: string | null;
  /** Real size in centimetres, when the catalogue has it. */
  cm: { h: number; w: number } | null;
  dims: string | null;
  image: string;
  thumb: string;
  /** Pixel size of the image, used to lay out the mosaic without cropping. */
  w: number;
  h: number;
  selected: number | null;
  /** Asking price, only when Artfolio publishes it for this work. */
  price: number | null;
  currency: string | null;
  sold: boolean;
  /** Public Artfolio collections the work belongs to, other than "Selected". */
  series: string[];
};

/**
 * The catalogue, newest first. src/data/artworks.json is a snapshot of Artfolio's
 * public catalogue (catalogue_v1), refreshed by scripts/snapshot-catalogue.mjs
 * before every build; the committed copy is the fallback when the API is down.
 */
export const archive: Artwork[] = (raw as Artwork[])
  .slice()
  .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));

export const selected: Artwork[] = archive
  .filter((a) => a.selected !== null)
  .sort((a, b) => a.selected! - b.selected!);

export const bySlug = (slug: string | undefined) => archive.find((a) => a.slug === slug);

// Hand-picked works for the home and about pages. If one is renamed or made
// private in Artfolio, fall back to the Selected order instead of breaking.
const pool = selected.length ? selected : archive;
const pick = (slug: string, i: number) => bySlug(slug) ?? pool[i % pool.length];
export const HERO = pick("wave-xano-armenter", 0);
export const FEATURED = ["ultramar-4-underwater-4", "agora-xano-armenter", "pampagulles"].map((s, i) => pick(s, i + 1));
export const PRACTICE = pick("la-cova-dels-colors-retina-2", 4);

export const yearLabel = (a: Artwork, circa: string) => (a.year ? `${a.circa ? circa + " " : ""}${a.year}` : "");

export const priceLabel = (a: Artwork, locale: string) => {
  if (a.price === null || !a.currency) return "";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: a.currency, maximumFractionDigits: 0 }).format(a.price);
  } catch {
    return `${a.price} ${a.currency}`;
  }
};
