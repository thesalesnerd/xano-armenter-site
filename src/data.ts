import { useMemo, useSyncExternalStore } from "react";
import raw from "./data/artworks.json";
import { useSiteContent, type SiteContent } from "./content";

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

type Works = {
  /** Every public work, newest first. */
  archive: Artwork[];
  /** The "Selected" collection, in its order. */
  selected: Artwork[];
  bySlug: (slug: string | undefined) => Artwork | undefined;
};

export type Catalogue = Works & {
  HERO: Artwork;
  FEATURED: Artwork[];
  PRACTICE: Artwork;
};

/** The home-page works when Xano has not chosen any in Artfolio → Website. */
export const DEFAULT_PICKS = {
  hero: "wave-xano-armenter",
  featured: ["ultramar-4-underwater-4", "agora-xano-armenter", "pampagulles"],
  practice: "la-cova-dels-colors-retina-2",
};

function build(works: Artwork[]): Works {
  const archive = works.slice().sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));
  const selected = archive.filter((a) => a.selected !== null).sort((a, b) => a.selected! - b.selected!);
  const bySlug = (slug: string | undefined) => archive.find((a) => a.slug === slug);
  return { archive, selected, bySlug };
}

/**
 * The home-page works: Xano's choice in Artfolio, else the built-in one. If a
 * chosen work is renamed or made private, the slot falls back to the built-in
 * work, then to the Selected order, and never repeats a work already shown.
 */
function withPicks({ archive, selected, bySlug }: Works, content: SiteContent): Catalogue {
  const pool = selected.length ? selected : archive;
  const used = new Set<string>();
  const take = (wanted: (string | undefined)[], i: number) => {
    const w = wanted.map((s) => bySlug(s)).find((a) => a && !used.has(a.slug)) ?? pool.find((a, j) => j >= i && !used.has(a.slug)) ?? pool[i % pool.length];
    used.add(w.slug);
    return w;
  };
  const home = content.home ?? {};
  const HERO = take([home.hero, DEFAULT_PICKS.hero], 0);
  const FEATURED = DEFAULT_PICKS.featured.map((s, i) => take([home.featured?.[i], s], i + 1));
  const PRACTICE = take([home.practice, DEFAULT_PICKS.practice], 4);
  return { archive, selected, bySlug, HERO, FEATURED, PRACTICE };
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
  const works = useSyncExternalStore(subscribe, () => current);
  const content = useSiteContent();
  return useMemo(() => withPicks(works, content), [works, content]);
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
