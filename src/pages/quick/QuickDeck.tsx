import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../../workspace';
import { supabase, imageUrl } from '../../lib/supabase';
import { dimensions, money } from '../../lib/format';
import type { Piece, PieceStatus, PieceWithImages } from '../../lib/types';
import {
  deckPieces,
  forgetActivity,
  loadDeck,
  missingFields,
  recordActivity,
  saveDeck,
  type Deck,
} from '../../lib/quick/progress';
import Confetti from '../../components/Confetti';
import { BigButton, PlacePicker, ProgressBar, Sheet, Toast, parsePrice, useQuickEnv, useT, type ToastMsg } from './parts';

type Patch = Partial<Pick<Piece, 'status' | 'is_public' | 'location' | 'price' | 'currency' | 'year' | 'height' | 'width' | 'medium'>>;
type SheetKind = 'place' | 'price' | null;

export default function QuickDeck({ deck, pieces, places, media }: { deck: Deck; pieces: PieceWithImages[]; places: string[]; media: string[] }) {
  const { artist, canEdit } = useWorkspace();
  const { t } = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { base: home, demo } = useQuickEnv();

  // Progress is restored from this browser. The order is frozen when the deck opens, so
  // works don't jump around (or drop out) while the artist is answering.
  const saved = useMemo(() => loadDeck(artist.id, deck.id), [artist.id, deck.id]);
  const [checked, setChecked] = useState<Set<string>>(saved.checked);
  const [order] = useState<string[]>(() => deckPieces(deck, pieces, saved.checked).map((p) => p.id));
  const byId = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces]);
  const list = useMemo(() => order.filter((id) => byId.has(id)), [order, byId]);
  const [index, setIndex] = useState(() => {
    const start = Math.max(0, saved.lastId ? list.indexOf(saved.lastId) : 0);
    for (let i = 0; i < list.length; i++) {
      const j = (start + i) % list.length;
      if (!saved.checked.has(list[j])) return j;
    }
    return 0;
  });
  const doneCount = list.filter((id) => checked.has(id)).length;
  const finished = list.length > 0 && doneCount === list.length;
  const [celebrate, setCelebrate] = useState(0);
  const [showFinished, setShowFinished] = useState(finished);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);
  const run = useRef(0);
  const hasCheckedAt = pieces.length > 0 && 'checked_at' in pieces[0];

  const piece = byId.get(list[index]);
  const nextPiece = byId.get(list[(index + 1) % Math.max(1, list.length)]);

  useEffect(() => {
    saveDeck(artist.id, deck.id, checked, list[index]);
  }, [artist.id, deck.id, checked, index, list]);

  const say = useCallback((m: Omit<ToastMsg, 'id'>) => setToast({ ...m, id: Date.now() }), []);
  const clearToast = useCallback(() => setToast(null), []);

  function patchCache(id: string, patch: Patch) {
    qc.setQueryData<PieceWithImages[]>(['pieces', artist.id], (old) => old?.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function write(id: string, patch: Patch): Promise<boolean> {
    if (demo) return true; // practice mode: nothing leaves the browser
    const body: Record<string, unknown> = { ...patch };
    if (hasCheckedAt) body.checked_at = new Date().toISOString();
    const { error } = await supabase.from('pieces').update(body as Patch).eq('id', id);
    return !error;
  }

  function go(to: number, dir: 'left' | 'right' = 'left') {
    if (!list.length) return;
    setLeaving(dir);
    setTimeout(() => {
      setIndex(((to % list.length) + list.length) % list.length);
      setLeaving(null);
    }, 160);
  }

  /** The next work not yet checked, after the current one; null when the deck is complete. */
  function nextUnchecked(nowChecked: Set<string>): number | null {
    for (let i = 1; i <= list.length; i++) {
      const j = (index + i) % list.length;
      if (!nowChecked.has(list[j])) return j;
    }
    return null;
  }

  /**
   * Save an answer for the current work. `patch` may be empty (the answer confirms what's
   * there). Saves straight away, marks the work as checked, offers undo and moves on.
   */
  async function answer(patch: Patch, label: string, advance = true) {
    if (!piece || !canEdit) return;
    const id = piece.id;
    const before: Patch = {};
    let changed = false;
    for (const k of Object.keys(patch) as (keyof Patch)[]) {
      (before as Record<string, unknown>)[k] = piece[k];
      if (piece[k] !== patch[k]) changed = true;
    }
    const wasChecked = checked.has(id);
    const myIndex = index;

    if (changed) {
      patchCache(id, patch);
      write(id, patch).then((ok) => {
        if (ok) return;
        patchCache(id, before);
        say({ text: t.saveFailed, tone: 'error' });
        setIndex(myIndex);
      });
    } else if (hasCheckedAt) {
      void write(id, {});
    }

    const nowChecked = new Set(checked).add(id);
    setChecked(nowChecked);
    recordActivity(artist.id, id, changed);
    run.current += 1;

    const undo = () => {
      if (changed) {
        patchCache(id, before);
        write(id, before).then((ok) => !ok && say({ text: t.saveFailed, tone: 'error' }));
      }
      if (!wasChecked) {
        setChecked((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        forgetActivity(artist.id, id, changed);
      }
      run.current = Math.max(0, run.current - 1);
      setShowFinished(false);
      setIndex(myIndex);
      say({ text: t.undone });
    };

    const combo = run.current > 0 && run.current % 10 === 0;
    const text = label ? t.savedAs(label) : t.saved;
    say({ text: combo ? `${text} · ${t.combo(run.current)}` : text, tone: combo ? 'party' : 'ok', undo });

    if (!advance) return;
    const nxt = nextUnchecked(nowChecked);
    if (nxt == null) {
      setCelebrate((c) => c + 1);
      setShowFinished(true);
    } else {
      go(nxt);
    }
  }

  // Keyboard (desktop): ← → move, A/S/N/H answer, Z undo.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || sheet || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowright') go(index + 1);
    else if (k === 'arrowleft') go(index - 1, 'right');
    else if (k === 'z' && toast?.undo) {
      const undo = toast.undo;
      setToast(null);
      undo();
    } else if (!piece || deck.id === 'missing') return;
    else if (k === 'a') void answer({ status: 'available' }, t.status.available);
    else if (k === 's') void answer({ status: 'sold' }, t.status.sold);
    else if (k === 'n') void answer({ status: 'not_for_sale' }, t.status.not_for_sale);
    else if (k === 'h') void answer({ is_public: !piece.is_public }, piece.is_public ? t.hiddenFromWebsite : t.onWebsite);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Swipe the picture: left = next, right = back.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const swipe = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      drag.current = { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag.current) return;
      const x = e.clientX - drag.current.x;
      if (Math.abs(x) > Math.abs(e.clientY - drag.current.y)) setDx(x);
    },
    onPointerUp: () => {
      if (dx < -80) go(index + 1);
      else if (dx > 80) go(index - 1, 'right');
      drag.current = null;
      setDx(0);
    },
    onPointerCancel: () => {
      drag.current = null;
      setDx(0);
    },
  };

  // Warm the next picture so it appears instantly.
  useEffect(() => {
    const path = nextPiece?.piece_images[0]?.storage_path;
    if (path) new Image().src = imageUrl(path)!;
  }, [nextPiece]);

  if (!list.length) {
    return (
      <Shell deck={deck} done={0} total={0} home={home}>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <p className="font-serif text-3xl">{t.allDone}</p>
          <p className="text-xl text-stone-600">{t.works(0)}</p>
          <Link to={home} className="rounded-2xl bg-stone-900 px-6 py-4 text-xl font-semibold text-white">{t.backToDecks}</Link>
        </div>
      </Shell>
    );
  }

  if (showFinished) {
    return (
      <Shell deck={deck} done={doneCount} total={list.length} home={home}>
        <Confetti run={celebrate} />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="text-7xl" aria-hidden>🎉</div>
          <p className="font-serif text-4xl">{t.finishedTitle}</p>
          <p className="max-w-sm text-xl text-stone-600">{t.finishedBody(list.length)}</p>
          <p className="text-lg text-stone-500">{t.websiteDelay}</p>
          <Link to={home} className="mt-2 rounded-2xl bg-stone-900 px-6 py-4 text-xl font-semibold text-white">{t.backToDecks}</Link>
          <button className="text-lg text-stone-600 underline" onClick={() => setShowFinished(false)}>{t.review}</button>
        </div>
        <Toast toast={toast} onDone={clearToast} />
      </Shell>
    );
  }

  if (!piece) return null;
  const img = piece.piece_images[0];
  const size = dimensions(piece);
  const isChecked = checked.has(piece.id);
  const statusText = t.status[piece.status] ?? piece.status;
  const currency = piece.currency || artist.currency || 'EUR';

  const navBtn = 'min-h-12 flex-1 rounded-xl bg-stone-100 text-lg font-semibold text-stone-700 active:bg-stone-200';

  return (
    <Shell deck={deck} done={doneCount} total={list.length} home={home} onDoneToday={() => navigate(`${home}/done`)}>
      <Confetti run={celebrate} />
      {/* Scrolls only if the screen is very short; the answers below always stay in reach. */}
      <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-y-auto px-4 pb-3">
        {/* Picture: takes whatever height is left. Swipe left = next, right = back. */}
        <div
          {...swipe}
          className={`relative mt-3 flex touch-pan-y items-center justify-center overflow-hidden rounded-3xl bg-stone-200 transition-[transform,opacity] duration-150 select-none ${
            deck.id === 'missing' ? 'h-[26dvh] min-h-40 shrink-0' : 'min-h-48 flex-1'
          } ${leaving === 'left' ? '-translate-x-8 opacity-0' : leaving === 'right' ? 'translate-x-8 opacity-0' : ''}`}
          style={dx ? { transform: `translateX(${dx}px) rotate(${dx / 40}deg)`, transition: 'none' } : undefined}
        >
          {img ? (
            <img
              key={img.storage_path}
              src={imageUrl(img.storage_path)}
              alt={piece.title}
              draggable={false}
              className="absolute inset-0 h-full w-full bg-contain bg-center bg-no-repeat object-contain p-2"
              style={img.thumb_path ? { backgroundImage: `url(${imageUrl(img.thumb_path)})` } : undefined}
            />
          ) : (
            <span className="text-xl text-stone-500">{t.noImage}</span>
          )}
          <span className="absolute top-2.5 left-2.5 rounded-full bg-white/90 px-3 py-0.5 text-base font-medium text-stone-700 shadow-sm">
            {index + 1} / {list.length}
          </span>
          {isChecked && (
            <span className="absolute top-2.5 right-2.5 rounded-full bg-emerald-600 px-3 py-0.5 text-base font-semibold text-white shadow-sm">✓</span>
          )}
          <div className="absolute bottom-2.5 left-2.5 flex flex-wrap gap-1.5 text-base">
            <span className={`rounded-full px-3 py-0.5 font-semibold shadow-sm ${statusPill(piece.status)}`}>{statusText}</span>
            <span className={`rounded-full px-3 py-0.5 font-medium shadow-sm ${piece.is_public ? 'bg-sky-100 text-sky-900' : 'bg-stone-800 text-white'}`}>
              {piece.is_public ? `🌐 ${t.onWebsite}` : `◐ ${t.hiddenFromWebsite}`}
            </span>
          </div>
        </div>

        {/* What it is */}
        <div className="mt-3 shrink-0">
          <h1 className="font-serif text-[1.75rem] leading-tight text-stone-900">{piece.title}</h1>
          <p className="text-lg text-stone-600">{[piece.year, size, piece.medium].filter(Boolean).join(' · ') || '—'}</p>
        </div>

        {!canEdit && <p className="mt-3 shrink-0 rounded-2xl bg-amber-50 p-4 text-lg text-amber-900">{t.cannotEdit}</p>}

        {deck.id === 'missing' && (
          <div className="mt-4 shrink-0">
            <MissingForm key={piece.id} piece={piece} places={places} media={media} disabled={!canEdit} onSave={(p) => answer(p, '')} />
          </div>
        )}

        {deck.id === 'hidden' && <StatusRow piece={piece} disabled={!canEdit} onPick={(s) => answer({ status: s }, t.status[s], false)} />}

        {/* Extras: where it is, private price */}
        {deck.id !== 'missing' && (
          <div className="mt-3 grid shrink-0 grid-cols-2 gap-3">
            <button
              disabled={!canEdit}
              onClick={() => setSheet('place')}
              className="flex min-h-14 flex-col items-start justify-center rounded-2xl bg-white px-4 py-1.5 text-left ring-1 ring-stone-300 active:bg-stone-100 disabled:opacity-40"
            >
              <span className="text-sm text-stone-500">📍 {t.where}</span>
              <span className="line-clamp-1 text-lg font-medium text-stone-900">{piece.location || t.noLocation}</span>
            </button>
            <button
              disabled={!canEdit}
              onClick={() => setSheet('price')}
              className="flex min-h-14 flex-col items-start justify-center rounded-2xl bg-white px-4 py-1.5 text-left ring-1 ring-stone-300 active:bg-stone-100 disabled:opacity-40"
            >
              <span className="text-sm text-stone-500">🔒 {t.privatePrice}</span>
              <span className="line-clamp-1 text-lg font-medium text-stone-900">{piece.price != null ? money(piece.price, currency) : t.noPrice}</span>
            </button>
          </div>
        )}

        <div className="mt-2 flex shrink-0 items-center justify-between">
          {demo ? (
            <span className="py-2 text-base text-amber-800">{t.demoShort}</span>
          ) : (
            <Link to={`/a/${artist.slug}/pieces/${piece.id}`} className="py-2 text-base whitespace-nowrap text-stone-500 underline">{t.openFull}</Link>
          )}
          <span className="hidden text-sm text-stone-400 lg:block">{t.keys}</span>
        </div>
      </main>

      {/* Answers and moving on, at the bottom where the thumb is. */}
      <footer className="shrink-0 border-t border-stone-200 bg-white px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-xl">
          {deck.id === 'hidden' ? (
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <BigButton tone="green" kbd="H" disabled={!canEdit} current={piece.is_public} onClick={() => answer({ is_public: true }, t.onWebsite)}>
                🌐 {t.show}
              </BigButton>
              <BigButton tone="dark" disabled={!canEdit} current={!piece.is_public} onClick={() => answer({ is_public: false }, t.hiddenFromWebsite)}>
                ◐ {t.keepHidden}
              </BigButton>
            </div>
          ) : deck.id !== 'missing' ? (
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <BigButton tone="green" kbd="A" disabled={!canEdit} current={piece.status === 'available'} onClick={() => answer({ status: 'available' }, t.status.available)}>
                {deck.id === 'available' ? t.yesAvailable : t.available}
              </BigButton>
              <BigButton tone="red" kbd="S" disabled={!canEdit} current={piece.status === 'sold'} onClick={() => answer({ status: 'sold' }, t.status.sold)}>
                {t.sold}
              </BigButton>
              <BigButton tone="grey" kbd="N" disabled={!canEdit} current={piece.status === 'not_for_sale'} onClick={() => answer({ status: 'not_for_sale' }, t.status.not_for_sale)}>
                {t.notForSale}
              </BigButton>
              <BigButton
                tone="dark"
                kbd="H"
                disabled={!canEdit}
                onClick={() => answer({ is_public: !piece.is_public }, piece.is_public ? t.hiddenFromWebsite : t.onWebsite)}
              >
                {piece.is_public ? `◐ ${t.hide}` : `🌐 ${t.show}`}
              </BigButton>
            </div>
          ) : (
            <button
              type="submit"
              form="missing-form"
              disabled={!canEdit}
              className="mb-3 min-h-[3.75rem] w-full rounded-2xl bg-amber-500 text-xl font-semibold text-stone-950 shadow-sm active:bg-amber-600 disabled:opacity-40"
            >
              {t.saveNext} ›
            </button>
          )}
          <div className="flex gap-2.5">
            <button className={navBtn} onClick={() => go(index - 1, 'right')}>‹ {t.back}</button>
            <button className={navBtn} onClick={() => go(index + 1)}>{isChecked ? t.next : t.skip} ›</button>
          </div>
        </div>
      </footer>

      {sheet === 'place' && (
        <Sheet title={t.where} onClose={() => setSheet(null)}>
          <PlacePicker
            places={places}
            value={piece.location}
            onPick={(place) => {
              setSheet(null);
              void answer({ location: place }, place ?? t.noLocation, false);
            }}
          />
        </Sheet>
      )}
      {sheet === 'price' && (
        <Sheet title={t.privatePrice} onClose={() => setSheet(null)}>
          <PriceForm
            piece={piece}
            currency={currency}
            onSave={(price) => {
              setSheet(null);
              const patch: Patch = { price };
              if (price != null && !piece.currency) patch.currency = currency;
              void answer(patch, price == null ? t.noPrice : money(price, currency), false);
            }}
          />
        </Sheet>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </Shell>
  );
}

function statusPill(s: PieceStatus) {
  if (s === 'available') return 'bg-emerald-100 text-emerald-900';
  if (s === 'sold') return 'bg-rose-100 text-rose-900';
  if (s === 'not_for_sale') return 'bg-stone-200 text-stone-800';
  return 'bg-amber-100 text-amber-900';
}

function Shell({
  deck,
  done,
  total,
  home,
  onDoneToday,
  children,
}: {
  deck: Deck;
  done: number;
  total: number;
  home: string;
  onDoneToday?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="flex h-dvh flex-col bg-stone-50">
      <header className="shrink-0 border-b border-stone-200 bg-stone-50 px-4 pt-[max(.5rem,env(safe-area-inset-top))] pb-2.5">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-2">
            {/* "Done for today" is the way out: it shows today's summary, then back to the piles. */}
            <span className="min-w-0 flex-1 text-xl leading-tight font-semibold text-stone-900">{deck.ask(t)}</span>
            {onDoneToday ? (
              <button onClick={onDoneToday} className="-mr-1 shrink-0 rounded-full bg-amber-100 px-3.5 py-2 text-base font-semibold text-amber-900 active:bg-amber-200">
                {t.doneToday}
              </button>
            ) : (
              <Link to={home} className="-mr-1 shrink-0 rounded-full bg-stone-200 px-3.5 py-2 text-base font-semibold text-stone-800">
                {t.exit}
              </Link>
            )}
          </div>
          {total > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar done={done} total={total} className="flex-1" />
              <span className="shrink-0 text-base text-stone-600">{t.checkedOf(done, total)}</span>
            </div>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

function StatusRow({ piece, disabled, onPick }: { piece: Piece; disabled: boolean; onPick: (s: PieceStatus) => void }) {
  const { t } = useT();
  const opts: PieceStatus[] = ['available', 'sold', 'not_for_sale'];
  return (
    <div className="mt-3 shrink-0">
      <p className="mb-1.5 text-base text-stone-500">{t.changeStatus}</p>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((s) => (
          <button
            key={s}
            disabled={disabled}
            aria-pressed={piece.status === s}
            onClick={() => onPick(s)}
            className={`min-h-12 rounded-xl px-2 text-base font-semibold ring-1 disabled:opacity-40 ${
              piece.status === s ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-800 ring-stone-300'
            }`}
          >
            {t.status[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

function PriceForm({ piece, currency, onSave }: { piece: Piece; currency: string; onSave: (price: number | null) => void }) {
  const { t } = useT();
  const [v, setV] = useState(piece.price != null ? String(Number(piece.price)) : '');
  const parsed = parsePrice(v);
  const bad = Number.isNaN(parsed);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!bad) onSave(parsed);
      }}
    >
      <p className={`mb-4 rounded-2xl p-4 text-lg ${piece.show_price ? 'bg-amber-50 text-amber-900' : 'bg-stone-100 text-stone-700'}`}>
        🔒 {piece.show_price ? t.priceIsShown : t.priceIsPrivate}
      </p>
      <div className="flex items-center gap-3">
        <input
          autoFocus
          inputMode="decimal"
          className="min-h-14 min-w-0 flex-1 rounded-xl border-0 px-4 text-2xl ring-1 ring-stone-300 focus:ring-2 focus:ring-stone-900 focus:outline-none"
          value={v}
          onChange={(e) => setV(e.target.value)}
          aria-invalid={bad}
          aria-label={t.privatePrice}
        />
        <span className="text-2xl text-stone-600">{currency}</span>
      </div>
      <div className="mt-4 flex gap-3">
        {piece.price != null && (
          <button type="button" className="min-h-14 rounded-2xl px-5 text-lg text-stone-600 ring-1 ring-stone-300" onClick={() => onSave(null)}>
            {t.clear}
          </button>
        )}
        <button type="submit" disabled={bad} className="min-h-14 flex-1 rounded-2xl bg-stone-900 text-xl font-semibold text-white disabled:opacity-40">
          {t.save}
        </button>
      </div>
    </form>
  );
}

function MissingForm({
  piece,
  places,
  media,
  disabled,
  onSave,
}: {
  piece: PieceWithImages;
  places: string[];
  media: string[];
  disabled: boolean;
  onSave: (p: Patch) => void;
}) {
  const { t } = useT();
  // Which fields to ask for is decided when the card opens, so they don't vanish while typing.
  const [miss] = useState(() => missingFields(piece));
  const [year, setYear] = useState('');
  const [h, setH] = useState(piece.height != null ? String(Number(piece.height)) : '');
  const [w, setW] = useState(piece.width != null ? String(Number(piece.width)) : '');
  const [medium, setMedium] = useState(piece.medium ?? '');
  const [place, setPlace] = useState<string | null>(piece.location);
  const nothing = !Object.values(miss).some(Boolean);
  const big = 'min-h-14 w-full rounded-xl border-0 px-4 text-2xl ring-1 ring-stone-300 focus:ring-2 focus:ring-stone-900 focus:outline-none';
  const num = (s: string) => {
    const n = parsePrice(s);
    return n == null || Number.isNaN(n) ? null : n;
  };

  function submit() {
    const p: Patch = {};
    const y = parseInt(year, 10);
    if (miss.year && y >= 1000 && y <= 3000) p.year = y;
    if (miss.size) {
      if (num(h) != null) p.height = num(h);
      if (num(w) != null) p.width = num(w);
    }
    if (miss.medium && medium.trim()) p.medium = medium.trim();
    if (miss.location && place) p.location = place;
    onSave(p);
  }

  if (nothing) {
    return (
      <form
        id="missing-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) onSave({});
        }}
      >
        <p className="rounded-2xl bg-emerald-50 p-4 text-center text-lg text-emerald-900">✓ {t.missingNothing}</p>
      </form>
    );
  }

  return (
    <form
      id="missing-form"
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {miss.year && (
        <label className="block">
          <span className="mb-1 block text-lg font-medium text-stone-700">{t.year}</span>
          <input className={big} inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="1998" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
        </label>
      )}
      {miss.size && (
        <fieldset>
          <legend className="mb-1 text-lg font-medium text-stone-700">{t.size} ({piece.dimension_unit})</legend>
          <div className="flex items-center gap-2">
            <input className={big} inputMode="decimal" placeholder={t.height} aria-label={t.height} value={h} onChange={(e) => setH(e.target.value)} />
            <span className="text-2xl text-stone-500">×</span>
            <input className={big} inputMode="decimal" placeholder={t.width} aria-label={t.width} value={w} onChange={(e) => setW(e.target.value)} />
          </div>
        </fieldset>
      )}
      {miss.medium && (
        <label className="block">
          <span className="mb-1 block text-lg font-medium text-stone-700">{t.medium}</span>
          <input className={big} placeholder={t.mediumPlaceholder} value={medium} onChange={(e) => setMedium(e.target.value)} list="quick-media" />
          <datalist id="quick-media">
            {media.map((m) => <option key={m} value={m} />)}
          </datalist>
        </label>
      )}
      {miss.location && (
        <div>
          <span className="mb-2 block text-lg font-medium text-stone-700">📍 {t.where}</span>
          <PlacePicker places={places} value={place} onPick={setPlace} />
        </div>
      )}
</form>
  );
}
