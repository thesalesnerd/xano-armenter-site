// Artfolio → Website: what the artist's website says and shows.
//
// One tab per question the artist asks ("What's on my home page?", "What does
// my About page say?", ...), each next to a live preview of the real website
// showing the draft. Changes save as a draft automatically; Publish makes them
// live; Earlier versions brings any published copy back.
//
// The preview is the website itself in a frame (?xa-preview=1). This page sends
// it the draft with postMessage, and the site answers with its built-in text,
// which is what the fields start from.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWorkspace } from '../workspace';
import { usePieces } from '../lib/queries';
import { imageUrl } from '../lib/supabase';
import type { PieceWithImages } from '../lib/types';
import {
  EMAIL,
  LANGS,
  canon,
  discardDraft,
  publish,
  restoreVersion,
  saveDraft,
  setIn,
  useRefreshSite,
  useSiteContentRow,
  useSiteVersions,
  websiteUrl,
  type CvRow,
  type Lang,
  type Localized,
  type SiteContent,
  type SiteDefaults,
} from '../lib/siteContent';
import { ErrorNote, Spinner, Thumb } from '../components/ui';
import { WorkPicker } from '../components/WorkPicker';

type Tab = 'home' | 'about' | 'cv' | 'contact' | 'history';
const TABS: { id: Tab; label: string; page: string }[] = [
  { id: 'home', label: 'Home page', page: '/' },
  { id: 'about', label: 'About', page: '/about' },
  { id: 'cv', label: 'CV', page: '/about' },
  { id: 'contact', label: 'Contact', page: '/contact' },
  { id: 'history', label: 'Earlier versions', page: '/' },
];

const pagePath = (page: string, lang: Lang) => (lang === 'es' ? `/es${page === '/' ? '' : page}` : page);

export default function Website() {
  const { artist, canEdit } = useWorkspace();
  const { data: row, isLoading, error: loadError } = useSiteContentRow(artist.id);
  const { data: pieces = [] } = usePieces(artist.id);
  const refresh = useRefreshSite(artist.id);
  const site = useMemo(() => websiteUrl(artist.slug, artist.website), [artist.slug, artist.website]);

  const [tab, setTab] = useState<Tab>('home');
  const [lang, setLang] = useState<Lang>('en');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [defaults, setDefaults] = useState<SiteDefaults | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Start from the stored draft once it has loaded.
  const loaded = useRef(false);
  useEffect(() => {
    if (isLoading || loaded.current) return;
    loaded.current = true;
    setDraft(row?.draft ?? {});
  }, [isLoading, row]);

  // Autosave, a moment after the last change.
  const savedText = useRef<string | null>(null);
  const exists = useRef(false);
  useEffect(() => {
    exists.current = !!row;
    if (row && savedText.current === null) savedText.current = canon(row.draft);
  }, [row]);
  const save = useCallback(
    async (d: SiteContent) => {
      const text = canon(d);
      if (text === (savedText.current ?? canon({}))) return;
      setSaving('saving');
      try {
        await saveDraft(artist.id, d, exists.current);
        exists.current = true;
        savedText.current = text;
        setSaving('saved');
        await refresh();
      } catch (e) {
        setSaving('error');
        setError(e);
        throw e;
      }
    },
    [artist.id, refresh],
  );
  useEffect(() => {
    if (!draft || !canEdit) return;
    const t = setTimeout(() => void save(draft).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [draft, canEdit, save]);

  const change = (path: (string | number)[], value: unknown) => {
    setNotice(null);
    setDraft((d) => setIn(d ?? {}, path, value));
  };

  const published = row?.published ?? {};
  const unpublished = draft !== null && canon(draft) !== canon(published);
  const emailProblem = draft?.contact?.email && !EMAIL.test(draft.contact.email.trim()) ? 'The enquiry email doesn’t look like an email address.' : null;

  async function onPublish() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await save(draft);
      await publish(artist.id);
      await refresh();
      setNotice('Published. Your website shows it within a minute.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onDiscard() {
    if (!confirm('Throw away your unpublished changes? Your website stays as it is.')) return;
    setBusy(true);
    try {
      const d = await discardDraft(artist.id);
      savedText.current = canon(d);
      setDraft(d);
      await refresh();
      setNotice('Changes thrown away. The preview shows your published website again.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onRestore(versionId: string) {
    if (unpublished && !confirm('This replaces your unpublished changes with the earlier version. Continue?')) return;
    setBusy(true);
    try {
      const d = await restoreVersion(versionId);
      savedText.current = canon(d);
      exists.current = true;
      setDraft(d);
      await refresh();
      setTab('home');
      setNotice('The earlier version is in the preview. Publish to put it back on your website.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  // Public works with a picture: the only ones the website can show.
  const works = useMemo(() => pieces.filter((p) => p.is_public && p.piece_images.length > 0 && p.slug), [pieces]);

  if (isLoading || !draft) return <Spinner />;
  if (loadError) return <ErrorNote error={loadError} />;

  const props: EditorProps = { draft, defaults, change, canEdit, works, lang };
  const page = TABS.find((t) => t.id === tab)!.page;

  return (
    <div className="pb-28">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">Your website</h1>
          <p className="mt-1 text-sm text-stone-500">
            {site ? (
              <>Change what <a className="underline" href={site} target="_blank" rel="noreferrer">{site.replace(/^https?:\/\//, '')}</a> says and shows. Nothing here changes your inventory.</>
            ) : (
              <>Add your website’s address in Settings to see the preview.</>
            )}
          </p>
        </div>
        <StatusPill unpublished={unpublished} />
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ring-1 ${tab === t.id ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-100'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 rounded-lg bg-stone-200/70 p-1 text-sm lg:hidden">
        {(['edit', 'preview'] as const).map((v) => (
          <button key={v} className={`rounded-md py-2 ${mobileView === v ? 'bg-white shadow-sm' : 'text-stone-600'}`} onClick={() => setMobileView(v)}>
            {v === 'edit' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      {notice && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200" role="status">{notice}</p>}
      <ErrorNote error={error} />

      <div className="grid gap-6 lg:grid-cols-[minmax(340px,440px)_1fr]">
        <section className={`${mobileView === 'edit' ? '' : 'hidden'} space-y-6 lg:block`} aria-label="Edit">
          {!canEdit && <p className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-600">You can look, but only the artist’s owners and editors can change the website.</p>}
          {tab === 'home' && <HomeEditor {...props} />}
          {tab === 'about' && <AboutEditor {...props} />}
          {tab === 'cv' && <CvEditor {...props} />}
          {tab === 'contact' && <ContactEditor {...props} problem={emailProblem} />}
          {tab === 'history' && <History artistId={artist.id} liveVersion={row?.published_version ?? null} canEdit={canEdit} busy={busy} onRestore={onRestore} />}
        </section>
        <section className={`${mobileView === 'preview' ? '' : 'hidden'} lg:block`} aria-label="Preview">
          <Preview site={site} path={pagePath(page, lang)} draft={draft} onDefaults={setDefaults} lang={lang} setLang={setLang} />
        </section>
      </div>

      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur md:left-[232px]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-stone-500" aria-live="polite">
              {saving === 'saving' ? 'Saving…' : saving === 'error' ? 'Couldn’t save. Check your connection.' : emailProblem ? emailProblem : unpublished ? 'Saved as a draft · only you can see it' : 'Everything is published'}
            </span>
            <span className="flex gap-2">
              <button className="btn-secondary px-4 py-2" disabled={!unpublished || busy || !row?.published} onClick={onDiscard}>Discard changes</button>
              <button className="btn-primary px-5 py-2" disabled={!unpublished || busy || !!emailProblem} onClick={onPublish}>{busy ? 'Working…' : 'Publish'}</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ unpublished }: { unpublished: boolean }) {
  return unpublished ? (
    <span className="chip bg-amber-50 text-amber-800 ring-amber-200">● Changes not published yet</span>
  ) : (
    <span className="chip bg-emerald-50 text-emerald-800 ring-emerald-200">● Everything is published</span>
  );
}

// ---------------------------------------------------------------- preview

function Preview({
  site,
  path,
  draft,
  onDefaults,
  lang,
  setLang,
}: {
  site: string | null;
  path: string;
  draft: SiteContent;
  onDefaults: (d: SiteDefaults) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<'computer' | 'phone'>('computer');
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [boxWidth, setBoxWidth] = useState(800);
  const src = useRef<string | null>(null);
  if (site && src.current === null) src.current = `${site}${path}?xa-preview=1`;

  const post = useCallback(
    (m: Record<string, unknown>) => {
      if (site) frame.current?.contentWindow?.postMessage({ source: 'artfolio', ...m }, site);
    },
    [site],
  );

  useEffect(() => {
    if (!site) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== site || e.source !== frame.current?.contentWindow || e.data?.source !== 'xa-site') return;
      if (e.data.type === 'loaded') post({ type: 'hello' });
      if (e.data.type === 'ready') {
        setReady(true);
        if (e.data.defaults) onDefaults(e.data.defaults as SiteDefaults);
      }
    };
    window.addEventListener('message', onMessage);
    const t = setTimeout(() => setSlow(true), 12_000);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(t);
    };
  }, [site, post, onDefaults]);

  // Keep the frame showing the draft and the page being edited.
  useEffect(() => {
    if (ready) post({ type: 'draft', content: draft });
  }, [ready, draft, post]);
  useEffect(() => {
    if (ready) post({ type: 'navigate', path });
  }, [ready, path, post]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!site) return <div className="card p-6 text-sm text-stone-500">No website address yet. Add it in Settings → Website.</div>;

  // Draw the site at a real screen size and scale it down to fit.
  const size = device === 'computer' ? { w: 1280, h: 820 } : { w: 390, h: 780 };
  const scale = Math.min(1, boxWidth / size.w);

  return (
    <div className="card overflow-hidden lg:sticky lg:top-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-3 py-2 text-xs text-stone-500">
        <span>Preview · only you can see it</span>
        <span className="flex gap-2">
          <Segmented value={device} options={[['computer', 'Computer'], ['phone', 'Phone']]} onChange={setDevice} />
          <Segmented value={lang} options={LANGS.map((l) => [l.code, l.code.toUpperCase()] as [Lang, string])} onChange={setLang} />
        </span>
      </div>
      <div ref={box} className="bg-stone-100 p-0">
        <div style={{ height: size.h * scale }} className="relative mx-auto overflow-hidden" >
          <iframe
            ref={frame}
            title="Preview of your website"
            src={src.current ?? undefined}
            onLoad={() => post({ type: 'hello' })}
            style={{ width: size.w, height: size.h, transform: `scale(${scale})`, transformOrigin: 'top left', left: device === 'phone' ? Math.max(0, (boxWidth - size.w * scale) / 2) : 0 }}
            className="absolute top-0 border-0 bg-white"
          />
        </div>
      </div>
      {!ready && slow && (
        <p className="border-t border-stone-200 px-3 py-2 text-xs text-stone-500">
          The preview isn’t answering yet. You can keep editing: your changes appear on your website when you publish.
        </p>
      )}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <span className="inline-flex overflow-hidden rounded-md ring-1 ring-stone-300">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={value === v} className={`px-2.5 py-1 ${value === v ? 'bg-stone-900 text-white' : 'bg-white text-stone-700'}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- editors

type EditorProps = {
  draft: SiteContent;
  defaults: SiteDefaults | null;
  change: (path: (string | number)[], value: unknown) => void;
  canEdit: boolean;
  works: PieceWithImages[];
  lang: Lang;
};

function Group({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="card space-y-3 p-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-stone-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** One text in English and Spanish. Starts from what the website says today. */
function TwoLanguages({
  label,
  value,
  fallback,
  onChange,
  canEdit,
  long = false,
  emptyHides = false,
}: {
  label: string;
  value: Localized | undefined;
  fallback: Localized | undefined;
  onChange: (v: Localized) => void;
  canEdit: boolean;
  long?: boolean;
  emptyHides?: boolean;
}) {
  const get = (l: Lang) => value?.[l] ?? fallback?.[l] ?? '';
  const set = (l: Lang, s: string) => onChange({ en: get('en'), es: get('es'), [l]: s });
  const changed = (l: Lang) => fallback?.[l] !== undefined && get(l).trim() !== (fallback[l] ?? '').trim();
  const spanishBehind = changed('en') && !changed('es') && fallback?.es !== undefined;
  const englishBehind = changed('es') && !changed('en') && fallback?.en !== undefined;
  const Field = long ? 'textarea' : 'input';
  return (
    <div>
      <span className="label text-sm">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {LANGS.map((l) => (
          <label key={l.code} className="block">
            <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-stone-400">{l.label}</span>
            <Field
              className={`input text-base sm:text-sm ${long ? 'min-h-32' : ''}`}
              value={get(l.code)}
              readOnly={!canEdit}
              placeholder={emptyHides ? 'Empty: the line is hidden' : 'Empty: your website keeps its current text'}
              onChange={(e) => set(l.code, e.target.value)}
              aria-label={`${label} (${l.label})`}
            />
          </label>
        ))}
      </div>
      {spanishBehind && <p className="mt-1 text-xs text-amber-700">Spanish not updated yet. The Spanish site keeps its current text until you change it.</p>}
      {englishBehind && <p className="mt-1 text-xs text-amber-700">English not updated yet.</p>}
    </div>
  );
}

function WorkSlot({
  label,
  number,
  slug,
  works,
  canEdit,
  onChange,
  onUp,
  onDown,
  taken,
}: {
  label: string;
  number?: number;
  slug: string | undefined;
  works: PieceWithImages[];
  canEdit: boolean;
  onChange: (slug: string) => void;
  onUp?: () => void;
  onDown?: () => void;
  taken: string[];
}) {
  const [open, setOpen] = useState(false);
  const work = works.find((w) => w.slug === slug);
  const img = work?.piece_images[0];
  return (
    <div className="flex items-center gap-3 rounded-lg p-2 ring-1 ring-stone-200" data-testid={`slot-${label}`}>
      {number !== undefined && <span className="w-4 text-center text-sm font-semibold text-stone-500">{number}</span>}
      <Thumb src={imageUrl(img?.thumb_path ?? img?.storage_path)} alt="" className="h-16 w-16 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{work?.title ?? (slug ? 'Hidden from your website' : 'Not chosen')}</p>
        <p className="text-xs text-stone-500">
          {work ? work.year ?? '' : slug ? 'Your site shows another work here until you choose a new one.' : ''}
        </p>
      </div>
      {canEdit && (
        <span className="flex shrink-0 items-center gap-1">
          {onUp && <button type="button" className="btn-ghost h-10 w-9 px-0" onClick={onUp} aria-label={`Move ${label} up`}>↑</button>}
          {onDown && <button type="button" className="btn-ghost h-10 w-9 px-0" onClick={onDown} aria-label={`Move ${label} down`}>↓</button>}
          <button type="button" className="btn-secondary h-10" onClick={() => setOpen(true)} aria-label={`Change ${label}`}>Change</button>
        </span>
      )}
      {open && (
        <WorkPicker
          title={`Choose: ${label}`}
          works={works}
          current={slug}
          taken={taken}
          onPick={(s) => {
            onChange(s);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function HomeEditor({ draft, defaults, change, canEdit, works }: EditorProps) {
  const d = defaults?.home;
  const hero = draft.home?.hero ?? d?.hero;
  const practice = draft.home?.practice ?? d?.practice;
  const featured = [0, 1, 2].map((i) => draft.home?.featured?.[i] ?? d?.featured?.[i] ?? '');
  const taken = [hero, practice, ...featured].filter(Boolean) as string[];
  const move = (i: number, step: number) => {
    const next = [...featured];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    change(['home', 'featured'], next);
  };
  return (
    <>
      <Group title="Big picture at the top" hint="It fills the whole screen, so the edges may be cut. Check the Phone view.">
        <WorkSlot label="big picture" slug={hero} works={works} canEdit={canEdit} taken={taken} onChange={(s) => change(['home', 'hero'], s)} />
      </Group>
      <Group title="Three works under it" hint="Shown under “Recent paintings”, in this order.">
        <div className="space-y-2">
          {featured.map((s, i) => (
            <WorkSlot
              key={i}
              number={i + 1}
              label={`work ${i + 1}`}
              slug={s || undefined}
              works={works}
              canEdit={canEdit}
              taken={taken}
              onChange={(slug) => change(['home', 'featured'], featured.map((f, j) => (j === i ? slug : f)))}
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={i < 2 ? () => move(i, 1) : undefined}
            />
          ))}
        </div>
      </Group>
      <Group title="Picture next to “The practice”">
        <WorkSlot label="practice picture" slug={practice} works={works} canEdit={canEdit} taken={taken} onChange={(s) => change(['home', 'practice'], s)} />
      </Group>
      <Group title="Introduction">
        <TwoLanguages label="Headline" value={draft.home?.intro} fallback={defaults?.home.intro} canEdit={canEdit} long onChange={(v) => change(['home', 'intro'], v)} />
        <TwoLanguages label="Paragraph" value={draft.home?.introDetail} fallback={defaults?.home.introDetail} canEdit={canEdit} long onChange={(v) => change(['home', 'introDetail'], v)} />
      </Group>
    </>
  );
}

const ABOUT_FIELDS: { key: keyof SiteDefaults['about']; label: string; long?: boolean }[] = [
  { key: 'quote', label: 'Quote at the top', long: true },
  { key: 'title', label: 'Headline' },
  { key: 'p1', label: 'Bio, first paragraph', long: true },
  { key: 'p2', label: 'Bio, second paragraph', long: true },
  { key: 'today', label: 'What you do today', long: true },
  { key: 'statement', label: 'Artist statement', long: true },
];

function AboutEditor({ draft, defaults, change, canEdit }: EditorProps) {
  return (
    <Group title="Your About page" hint="Each text in English and Spanish. A box left empty keeps the text your website shows today.">
      {ABOUT_FIELDS.map((f) => (
        <TwoLanguages
          key={f.key}
          label={f.label}
          value={draft.about?.[f.key]}
          fallback={defaults?.about[f.key]}
          canEdit={canEdit}
          long={f.long}
          onChange={(v) => change(['about', f.key], v)}
        />
      ))}
    </Group>
  );
}

function CvList({ title, rows, canEdit, onChange }: { title: string; rows: CvRow[]; canEdit: boolean; onChange: (rows: CvRow[]) => void }) {
  const set = (i: number, k: keyof CvRow, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i: number, step: number) => {
    const next = [...rows];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    onChange(next);
  };
  return (
    <Group title={title} hint="Names stay in their original language on both the English and Spanish sites.">
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <input className="input w-20 text-base sm:text-sm" value={r.year} readOnly={!canEdit} placeholder="Year" aria-label={`${title} ${i + 1}: year`} onChange={(e) => set(i, 'year', e.target.value)} />
            <input className="input min-w-0 flex-1 text-base sm:text-sm" value={r.text} readOnly={!canEdit} placeholder="Title · place" aria-label={`${title} ${i + 1}: text`} onChange={(e) => set(i, 'text', e.target.value)} />
            {canEdit && (
              <span className="flex shrink-0">
                <button type="button" className="btn-ghost h-9 w-8 px-0" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                <button type="button" className="btn-ghost h-9 w-8 px-0" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                <button type="button" className="btn-ghost h-9 w-8 px-0 text-rose-700" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="text-sm text-stone-500">No lines: this list is hidden on your website.</p>}
      {canEdit && <button type="button" className="btn-secondary" onClick={() => onChange([{ year: String(new Date().getFullYear()), text: '' }, ...rows])}>+ Add a line</button>}
    </Group>
  );
}

function CvEditor({ draft, defaults, change, canEdit }: EditorProps) {
  return (
    <>
      <CvList title="Solo exhibitions" rows={draft.cv?.solo ?? defaults?.cv.solo ?? []} canEdit={canEdit} onChange={(r) => change(['cv', 'solo'], r)} />
      <CvList title="Commissions" rows={draft.cv?.commissions ?? defaults?.cv.commissions ?? []} canEdit={canEdit} onChange={(r) => change(['cv', 'commissions'], r)} />
    </>
  );
}

function ContactEditor({ draft, defaults, change, canEdit, problem }: EditorProps & { problem: string | null }) {
  const c = draft.contact ?? {};
  return (
    <Group title="How people reach you">
      <label className="block">
        <span className="label text-sm">Email for enquiries</span>
        <input className="input text-base sm:text-sm" type="email" inputMode="email" autoComplete="email" readOnly={!canEdit} value={c.email ?? defaults?.contact.email ?? ''} onChange={(e) => change(['contact', 'email'], e.target.value.trim())} />
        <span className={`mt-1 block text-xs ${problem ? 'text-rose-700' : 'text-stone-500'}`}>{problem ?? 'Every “Enquire” button on your website writes to this address.'}</span>
      </label>
      <TwoLanguages
        label="Gallery that represents you"
        value={c.represented}
        fallback={defaults?.contact.represented}
        canEdit={canEdit}
        emptyHides
        onChange={(v) => change(['contact', 'represented'], v)}
      />
      <label className="block">
        <span className="label text-sm">Instagram</span>
        <input className="input text-base sm:text-sm" readOnly={!canEdit} placeholder="@yourname" value={c.instagram ?? defaults?.contact.instagram ?? ''} onChange={(e) => change(['contact', 'instagram'], e.target.value.trim())} />
        <span className="mt-1 block text-xs text-stone-500">Your @name or a link to your Instagram page.</span>
      </label>
    </Group>
  );
}

function History({ artistId, liveVersion, canEdit, busy, onRestore }: { artistId: string; liveVersion: string | null; canEdit: boolean; busy: boolean; onRestore: (id: string) => void }) {
  const { data: versions, isLoading, error } = useSiteVersions(artistId);
  if (isLoading) return <Spinner />;
  return (
    <Group title="Earlier versions" hint="Each time you publish, a copy is kept here. “Look at this version” puts it in the preview; publish it to bring it back.">
      <ErrorNote error={error} />
      {versions?.length === 0 && <p className="text-sm text-stone-500">Nothing published from Artfolio yet.</p>}
      <ul className="space-y-2">
        {versions?.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg p-3 ring-1 ring-stone-200">
            <div>
              <p className="text-sm font-medium">
                {new Date(v.published_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                {v.id === liveVersion && <span className="ml-2 text-emerald-700">· on your website now</span>}
              </p>
              <p className="text-xs text-stone-500">Published by {v.who ?? 'someone no longer in this workspace'}</p>
            </div>
            {canEdit && v.id !== liveVersion && (
              <button className="btn-secondary h-10 shrink-0" disabled={busy} onClick={() => onRestore(v.id)}>Look at this version</button>
            )}
          </li>
        ))}
      </ul>
    </Group>
  );
}
