// Ready-made answers taken from the artist's own records, so most fields are a tap
// instead of typing on a phone keyboard.
import type { PieceWithImages } from '../types';

export type Suggestions = { years: number[]; sizes: [number, number][]; media: string[]; prices: number[] };

function top<T>(values: T[], key: (v: T) => string, max: number): T[] {
  const counts = new Map<string, { v: T; n: number }>();
  for (const v of values) {
    const k = key(v);
    const c = counts.get(k);
    if (c) c.n++;
    else counts.set(k, { v, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, max).map((c) => c.v);
}

export function suggestions(pieces: PieceWithImages[]): Suggestions {
  const years = top(pieces.map((p) => p.year).filter((y): y is number => y != null), String, 8).sort((a, b) => b - a);
  const sizes = top(
    pieces
      .filter((p) => p.height != null && p.width != null && Number(p.height) > 0 && Number(p.width) > 0)
      .map((p) => [Number(p.height), Number(p.width)] as [number, number]),
    ([h, w]) => `${h}x${w}`,
    8,
  );
  const media = top(pieces.map((p) => p.medium?.trim()).filter((m): m is string => !!m), (m) => m.toLowerCase(), 8);
  const prices = top(pieces.map((p) => (p.price != null ? Number(p.price) : null)).filter((n): n is number => n != null && n > 0), String, 6).sort((a, b) => a - b);
  return { years, sizes, media, prices };
}
