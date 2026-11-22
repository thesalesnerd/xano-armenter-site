// Decks and progress for Quick update.
//
// v1 keeps progress in this browser's localStorage (per artist and deck): which works
// were checked, where the artist stopped, and a per-day count for the streak. If the
// optional `pieces.checked_at` column exists (see the migration in supabase/migrations),
// answers also stamp it so the check is recorded on the server too.
import type { PieceWithImages } from '../types';
import type { Strings } from './i18n';

export type DeckId = 'available' | 'missing' | 'hidden' | 'sold';

export type Deck = {
  id: DeckId;
  title: (t: Strings) => string;
  help: (t: Strings) => string;
  ask: (t: Strings) => string;
  /** Works that belong in the deck right now (works already checked here stay in it). */
  match: (p: PieceWithImages) => boolean;
  icon: string;
};

const blank = (v: string | null | undefined) => !v || !v.trim();

export function missingFields(p: PieceWithImages) {
  return {
    year: p.year == null,
    size: p.height == null || p.width == null || Number(p.height) <= 0 || Number(p.width) <= 0,
    medium: blank(p.medium),
    location: blank(p.location) && !p.location_id,
  };
}

export const DECKS: Deck[] = [
  {
    id: 'available',
    title: (t) => t.deckAvailable,
    help: (t) => t.deckAvailableHelp,
    ask: (t) => t.askAvailable,
    match: () => true,
    icon: '✓',
  },
  {
    id: 'missing',
    title: (t) => t.deckMissing,
    help: (t) => t.deckMissingHelp,
    ask: (t) => t.askMissing,
    match: (p) => Object.values(missingFields(p)).some(Boolean),
    icon: '✎',
  },
  {
    id: 'hidden',
    title: (t) => t.deckHidden,
    help: (t) => t.deckHiddenHelp,
    ask: (t) => t.askHidden,
    match: (p) => !p.is_public,
    icon: '◐',
  },
  {
    id: 'sold',
    title: (t) => t.deckSold,
    help: (t) => t.deckSoldHelp,
    ask: (t) => t.askSold,
    match: (p) => p.status === 'sold',
    icon: '●',
  },
];

export const deckById = (id: string | undefined) => DECKS.find((d) => d.id === id);

/** Stable order: newest year first, then title, so the deck doesn't reshuffle between visits. */
export function orderPieces(pieces: PieceWithImages[]): PieceWithImages[] {
  return [...pieces].sort(
    (a, b) => (b.year ?? -1) - (a.year ?? -1) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}

export function deckPieces(deck: Deck, pieces: PieceWithImages[], checked: Set<string>): PieceWithImages[] {
  return orderPieces(pieces.filter((p) => deck.match(p) || checked.has(p.id)));
}

// ---------------------------------------------------------------------------
// localStorage (every read and write may fail: private mode, blocked storage)
// ---------------------------------------------------------------------------
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* progress just won't persist */
  }
}

type DeckState = { checked: string[]; lastId?: string };
const deckKey = (artistId: string, deck: DeckId) => `artfolio.quick.${artistId}.${deck}`;

export function loadDeck(artistId: string, deck: DeckId): { checked: Set<string>; lastId?: string } {
  const s = read<DeckState>(deckKey(artistId, deck), { checked: [] });
  return { checked: new Set(s.checked), lastId: s.lastId };
}
export function saveDeck(artistId: string, deck: DeckId, checked: Set<string>, lastId?: string) {
  write(deckKey(artistId, deck), { checked: [...checked], lastId } satisfies DeckState);
}
export function resetDeck(artistId: string, deck: DeckId) {
  try {
    localStorage.removeItem(deckKey(artistId, deck));
  } catch {
    /* ignore */
  }
}

// Daily activity, for "N works today" and the day streak.
type Days = Record<string, { checked: string[]; changes: number }>;
const daysKey = (artistId: string) => `artfolio.quick.${artistId}.days`;

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function recordActivity(artistId: string, pieceId: string, changed: boolean) {
  const days = read<Days>(daysKey(artistId), {});
  const k = todayKey();
  const day = days[k] ?? { checked: [], changes: 0 };
  if (!day.checked.includes(pieceId)) day.checked.push(pieceId);
  if (changed) day.changes += 1;
  days[k] = day;
  write(daysKey(artistId), days);
}

export function forgetActivity(artistId: string, pieceId: string, changed: boolean) {
  const days = read<Days>(daysKey(artistId), {});
  const day = days[todayKey()];
  if (!day) return;
  day.checked = day.checked.filter((id) => id !== pieceId);
  if (changed) day.changes = Math.max(0, day.changes - 1);
  write(daysKey(artistId), days);
}

export function activity(artistId: string): { today: number; changesToday: number; streak: number } {
  const days = read<Days>(daysKey(artistId), {});
  const today = days[todayKey()];
  let streak = 0;
  const d = new Date();
  // A streak counts today if there's activity, otherwise it may still be alive from yesterday.
  if (!today?.checked.length) d.setDate(d.getDate() - 1);
  while (days[todayKey(d)]?.checked.length) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return { today: today?.checked.length ?? 0, changesToday: today?.changes ?? 0, streak };
}

// Language preference (shared by all artists in this browser).
const LANG_KEY = 'artfolio.quick.lang';
export const loadLang = <L extends string>(fallback: L): L => read<L>(LANG_KEY, fallback);
export const saveLang = (l: string) => write(LANG_KEY, l);
