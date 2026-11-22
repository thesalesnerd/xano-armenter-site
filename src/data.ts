import { useSyncExternalStore } from "react";
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

export type Catalogue = {
  /** Every public work, newest first. */
  archive: Artwork[];
  /** The "Selected" collection, in its order. */
  selected: Artwork[];
  bySlug: (slug: string | undefined) => Artwork | undefined;
  HERO: Artwork;
  FEATURED: Artwork[];
  PRACTICE: Artwork;
};

function build(works: Artwork[]): Catalogue {
  const archive = works.slice().sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));
  const selected = archive.filter((a) => a.selected !== null).sort((a, b) => a.selected! - b.selected!);
  const bySlug = (slug: string | undefined) => archive.find((a) => a.slug === slug);
  // Hand-picked works for the home page. If one is renamed or made private in
  // Artfolio, fall back to the Selected order instead of breaking.
  const pool = selected.length ? selected : archive;
  const pick = (slug: string, i: number) => bySlug(slug) ?? pool[i % pool.length];
  return {
    archive,
    selected,
    bySlug,
    HERO: pick("wave-xano-armenter", 0),
    FEATURED: ["ultramar-4-underwater-4", "agora-xano-armenter", "pampagulles"].map((s, i) => pick(s, i + 1)),
    PRACTICE: pick("la-cova-dels-colors-retina-2", 4),
  };
}

/** A response is used only if every work has what the pages need to draw it. */
function isCatalogue(data: unknown): data is Artwork[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (w) =>
        w &&
        typeof w.slug === "string" &&
        typeof w.title === "string" &&
        typeof w.image === "string" &&
        typeof w.thumb === "string" &&
        Number.isFinite(w.w) &&
        Number.isFinite(w.h) &&
        Array.isArray(w.series),
    )
  );
}

// The catalogue starts as the copy bundled at build time (src/data/artworks.json,
// a snapshot of Artfolio), so pages render at once and work offline or if the
// API is down. The live copy from /api/catalogue (edge-cached, a minute old at
// most) replaces it as soon as it arrives, so edits made in Artfolio show
// without a redeploy.
let current = build(raw as Artwork[]);
let currentText = JSON.stringify(raw);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function refreshCatalogue(url = "/api/catalogue") {
  return fetch(url, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((text) => {
      if (text === currentText) return;
      const data: unknown = JSON.parse(text);
      if (!isCatalogue(data)) throw new Error("unexpected catalogue shape");
      current = build(data);
      currentText = text;
    })
    .catch((err) => console.warn(`Live catalogue unavailable, showing the bundled copy: ${err.message}`))
    .finally(emit);
}

if (typeof window !== "undefined") void refreshCatalogue();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useCatalogue(): Catalogue {
  return useSyncExternalStore(subscribe, () => current);
}

export const yearLabel = (a: Artwork, circa: string) => (a.year ? `${a.circa ? circa + " " : ""}${a.year}` : "");

export const priceLabel = (a: Artwork, locale: string) => {
  if (a.price === null || !a.currency) return "";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: a.currency, maximumFractionDigits: 0 }).format(a.price);
  } catch {
    return `${a.price} ${a.currency}`;
  }
};
