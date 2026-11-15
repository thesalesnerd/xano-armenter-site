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
};

/** The catalogue, newest first. To read it from Artfolio instead, replace this module. */
export const archive: Artwork[] = (raw as Artwork[])
  .slice()
  .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));

export const selected: Artwork[] = archive
  .filter((a) => a.selected !== null)
  .sort((a, b) => a.selected! - b.selected!);

export const bySlug = (slug: string | undefined) => archive.find((a) => a.slug === slug);

export const HERO = bySlug("wave-xano-armenter")!;
export const FEATURED = ["ultramar-4-underwater-4", "agora-xano-armenter", "pampagulles"].map((s) => bySlug(s)!);
export const PRACTICE = bySlug("la-cova-dels-colors-retina-2")!;

export const yearLabel = (a: Artwork, circa: string) => (a.year ? `${a.circa ? circa + " " : ""}${a.year}` : "");
