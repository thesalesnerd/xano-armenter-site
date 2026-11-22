import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMyArtists, WorkspaceContext, useWorkspace } from '../../workspace';
import { usePieces } from '../../lib/queries';
import { Spinner, ErrorNote } from '../../components/ui';
import { activity, deckById, deckPieces, DECKS, loadDeck, resetDeck } from '../../lib/quick/progress';
import type { PieceWithImages } from '../../lib/types';
import { LangProvider, LangSwitch, ProgressBar, QuickEnv, useQuickEnv, useT } from './parts';
import QuickDeck from './QuickDeck';

/** /a/:slug/play[/:deck|/done] — full screen, without the inventory's sidebar. */
export default function QuickUpdate() {
  const { slug } = useParams();
  const { data: mine, isLoading } = useMyArtists();
  if (isLoading) return <Spinner />;
  const current = mine?.find((m) => m.artist.slug === slug);
  if (!current) return <Navigate to="/" replace />;
  const ws = {
    artist: current.artist,
    role: current.role,
    canEdit: current.role !== 'viewer',
    isOwner: current.role === 'owner',
  };
  return (
    <WorkspaceContext.Provider value={ws}>
      <QuickEnv.Provider value={{ base: `/a/${current.artist.slug}/play`, demo: false }}>
        <LangProvider>
          <QuickRoutes />
        </LangProvider>
      </QuickEnv.Provider>
    </WorkspaceContext.Provider>
  );
}

/** Places and media already used for this artist, most used first. */
function topValues(pieces: PieceWithImages[], key: 'location' | 'medium', max: number): string[] {
  const counts = new Map<string, number>();
  for (const p of pieces) {
    const v = p[key]?.trim();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([v]) => v);
}

export function QuickRoutes() {
  const { deckId } = useParams();
  const { artist } = useWorkspace();
  const { base } = useQuickEnv();
  const { data: pieces, isLoading, error } = usePieces(artist.id);
  const places = useMemo(() => topValues(pieces ?? [], 'location', 12), [pieces]);
  const media = useMemo(() => topValues(pieces ?? [], 'medium', 40), [pieces]);

  if (isLoading) return <Spinner />;
  if (error) return <div className="p-6"><ErrorNote error={error} /></div>;
  if (deckId === 'done') return <DoneToday />;
  const deck = deckById(deckId);
  if (deckId && !deck) return <Navigate to={base} replace />;
  if (deck) return <QuickDeck key={deck.id} deck={deck} pieces={pieces ?? []} places={places} media={media} />;
  return <DeckPicker pieces={pieces ?? []} />;
}

function DeckPicker({ pieces }: { pieces: PieceWithImages[] }) {
  const { artist } = useWorkspace();
  const { t } = useT();
  const { demo } = useQuickEnv();
  const [, force] = useState(0);
  const act = activity(artist.id);

  return (
    <div className="min-h-dvh bg-stone-50">
      <div className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-12">
        <div className="flex items-center justify-between gap-3">
          {demo ? (
            <span />
          ) : (
            <Link to={`/a/${artist.slug}/pieces`} className="-ml-2 rounded-full px-3 py-2 text-lg text-stone-600 active:bg-stone-200">
              ‹ {t.backToInventory}
            </Link>
          )}
          <LangSwitch />
        </div>
        {demo && <p className="mt-4 rounded-2xl bg-amber-100 p-4 text-lg text-amber-950">🎈 {t.demoBanner}</p>}

        <h1 className="mt-6 font-serif text-4xl leading-tight text-stone-900">{t.appTitle}</h1>
        <p className="mt-1 text-xl text-stone-500">{artist.name}</p>
        <p className="mt-4 text-xl leading-relaxed text-stone-700">{t.intro}</p>

        {(act.today > 0 || act.streak > 0) && (
          <div className="mt-5 flex flex-wrap gap-2 text-lg">
            {act.streak > 1 && <span className="rounded-full bg-amber-100 px-4 py-1.5 font-semibold text-amber-900">🔥 {t.streakDays(act.streak)}</span>}
            {act.today > 0 && <span className="rounded-full bg-emerald-100 px-4 py-1.5 font-semibold text-emerald-900">✓ {t.today(act.today)}</span>}
          </div>
        )}

        <ul className="mt-6 flex flex-col gap-4">
          {DECKS.map((deck) => {
            const { checked } = loadDeck(artist.id, deck.id);
            const list = deckPieces(deck, pieces, checked);
            const done = list.filter((p) => checked.has(p.id)).length;
            const total = list.length;
            const complete = total > 0 && done === total;
            const label = complete ? t.review : done > 0 ? t.resume : t.start;
            return (
              <li key={deck.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-stone-900">{deck.title(t)}</h2>
                    <p className="mt-0.5 text-lg text-stone-500">{deck.help(t)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-lg font-semibold text-stone-700">{t.works(total)}</span>
                </div>
                {total > 0 && (
                  <>
                    <ProgressBar done={done} total={total} className="mt-4" />
                    <p className="mt-1 text-base text-stone-600">{complete ? `🎉 ${t.allDone}` : t.checkedOf(done, total)}</p>
                  </>
                )}
                <div className="mt-4 flex items-center gap-3">
                  {total > 0 ? (
                    <Link
                      to={deck.id}
                      className={`flex min-h-14 flex-1 items-center justify-center rounded-2xl text-xl font-semibold ${
                        complete ? 'bg-stone-100 text-stone-800 ring-1 ring-stone-300' : 'bg-stone-900 text-white'
                      }`}
                    >
                      {label} ›
                    </Link>
                  ) : (
                    <span className="flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-stone-100 text-xl text-stone-500">✓ {t.allDone}</span>
                  )}
                  {done > 0 && (
                    <button
                      className="min-h-14 rounded-2xl px-4 text-base text-stone-500 underline"
                      onClick={() => {
                        if (!confirm(t.startOverConfirm)) return;
                        resetDeck(artist.id, deck.id);
                        force((n) => n + 1);
                      }}
                    >
                      {t.startOver}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-center text-base text-stone-500">{t.websiteDelay}</p>
      </div>
    </div>
  );
}

function DoneToday() {
  const { artist } = useWorkspace();
  const { t } = useT();
  const { base, demo } = useQuickEnv();
  const act = activity(artist.id);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-stone-50 p-8 text-center">
      <div className="text-7xl" aria-hidden>☕</div>
      <h1 className="font-serif text-4xl text-stone-900">{t.doneTitle}</h1>
      <p className="text-2xl text-stone-700">{t.doneBody(act.today)}</p>
      {act.changesToday > 0 && <p className="text-xl text-stone-600">{t.doneChanges(act.changesToday)}</p>}
      {act.streak > 1 && <p className="rounded-full bg-amber-100 px-5 py-2 text-xl font-semibold text-amber-900">🔥 {t.streakDays(act.streak)}</p>}
      <p className="max-w-sm text-xl text-stone-600">{t.doneResume}</p>
      <p className="text-lg text-stone-500">{t.websiteDelay}</p>
      <Link to={base} className="mt-2 rounded-2xl bg-stone-900 px-6 py-4 text-xl font-semibold text-white">{t.backToDecks}</Link>
      {!demo && <Link to={`/a/${artist.slug}/pieces`} className="text-lg text-stone-500 underline">{t.backToInventory}</Link>}
    </div>
  );
}
