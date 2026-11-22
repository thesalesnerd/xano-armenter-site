import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { STRINGS, defaultLang, LANGS, type Lang, type Strings } from '../../lib/quick/i18n';
import { loadLang, saveLang } from '../../lib/quick/progress';

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------
const LangCtx = createContext<{ lang: Lang; t: Strings; setLang: (l: Lang) => void }>({
  lang: 'es',
  t: STRINGS.es,
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = loadLang<Lang>(defaultLang());
    return l in STRINGS ? l : 'es';
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = 'en';
    };
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    saveLang(l);
  };
  return <LangCtx.Provider value={{ lang, t: STRINGS[lang], setLang }}>{children}</LangCtx.Provider>;
}

export const useT = () => useContext(LangCtx);

export function LangSwitch() {
  const { lang, setLang } = useT();
  return (
    <div className="inline-flex rounded-full bg-stone-200/80 p-1" role="group" aria-label="Idioma / Language">
      {LANGS.map((l) => (
        <button
          key={l.value}
          onClick={() => setLang(l.value)}
          aria-pressed={lang === l.value}
          className={`min-w-11 rounded-full px-3 py-1.5 text-base font-semibold ${
            lang === l.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------
export function ProgressBar({ done, total, className = '' }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className={`h-3 overflow-hidden rounded-full bg-stone-200 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Slides up from the bottom of the screen; closes on the backdrop or Escape. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-stone-900/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl text-stone-900">{title}</h2>
          <button className="rounded-full px-4 py-2 text-lg text-stone-600 hover:bg-stone-100" onClick={onClose}>
            {t.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type ToastMsg = { id: number; text: string; tone?: 'ok' | 'error' | 'party'; undo?: () => void };

export function Toast({ toast, onDone }: { toast: ToastMsg | null; onDone: () => void }) {
  const { t } = useT();
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(onDone, toast.undo ? 7000 : 3500);
    return () => clearTimeout(h);
  }, [toast, onDone]);
  if (!toast) return null;
  const tone =
    toast.tone === 'error' ? 'bg-rose-700' : toast.tone === 'party' ? 'bg-amber-600' : 'bg-stone-900';
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(.5rem,env(safe-area-inset-top))] z-50 flex justify-center px-3" aria-live="polite">
      <div
        key={toast.id}
        className={`pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl px-5 py-3 text-lg text-white shadow-lg ${tone} animate-[toast-in_.2s_ease-out]`}
      >
        <span>{toast.text}</span>
        {toast.undo && (
          <button
            className="shrink-0 rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/25"
            onClick={() => {
              const undo = toast.undo!;
              onDone();
              undo(); // shows its own "undone" message
            }}
          >
            ↶ {t.undo}
          </button>
        )}
      </div>
    </div>
  );
}

export function BigButton({
  children,
  onClick,
  tone,
  current,
  disabled,
  kbd,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  tone: 'green' | 'red' | 'grey' | 'dark' | 'amber';
  current?: boolean;
  disabled?: boolean;
  kbd?: string;
  className?: string;
}) {
  const tones = {
    green: 'bg-emerald-600 text-white active:bg-emerald-700',
    red: 'bg-rose-600 text-white active:bg-rose-700',
    grey: 'bg-stone-200 text-stone-900 active:bg-stone-300',
    dark: 'bg-stone-800 text-white active:bg-stone-900',
    amber: 'bg-amber-500 text-stone-950 active:bg-amber-600',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={current}
      className={`relative flex min-h-[3.75rem] items-center justify-center rounded-2xl px-3 py-2.5 text-center text-lg leading-tight font-semibold shadow-sm transition-transform active:scale-[.97] disabled:opacity-40 ${tones[tone]} ${
        current ? 'ring-4 ring-amber-400 ring-offset-2' : ''
      } ${className}`}
    >
      {current && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-amber-400 px-2 text-xs font-bold text-stone-900">✓</span>
      )}
      {children}
      {kbd && (
        <kbd className="absolute right-2 bottom-1.5 hidden rounded bg-black/15 px-1.5 text-xs font-medium lg:block">{kbd}</kbd>
      )}
    </button>
  );
}

/** Tappable list of places already used for this artist, plus a free-text "somewhere else". */
export function PlacePicker({
  places,
  value,
  onPick,
}: {
  places: string[];
  value: string | null;
  onPick: (place: string | null) => void;
}) {
  const { t } = useT();
  const [other, setOther] = useState('');
  const known = new Set(places);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {places.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            aria-pressed={value === p}
            className={`min-h-12 rounded-full px-4 py-2 text-lg ring-1 ${
              value === p ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-800 ring-stone-300 active:bg-stone-100'
            }`}
          >
            {p}
          </button>
        ))}
        {value && !known.has(value) && (
          <span className="min-h-12 rounded-full bg-stone-900 px-4 py-2 text-lg text-white">{value}</span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="min-h-12 min-w-0 flex-1 rounded-xl border-0 px-4 text-lg ring-1 ring-stone-300 focus:ring-2 focus:ring-stone-900 focus:outline-none"
          placeholder={t.otherPlace}
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (other.trim()) onPick(other.trim());
          }}
        />
        <button
          type="button"
          className="min-h-12 shrink-0 rounded-xl bg-stone-900 px-5 text-lg font-semibold text-white disabled:opacity-40"
          disabled={!other.trim()}
          onClick={() => onPick(other.trim())}
        >
          {t.save}
        </button>
      </div>
      {value && (
        <button type="button" className="mt-3 text-lg text-stone-500 underline" onClick={() => onPick(null)}>
          {t.clear}: {value}
        </button>
      )}
    </div>
  );
}

/** Accepts "1500", "1.500", "1.500,50", "1500.5". Returns null for empty, NaN for nonsense. */
export function parsePrice(s: string): number | null {
  let v = s.replace(/[\s€$£]/g, '');
  if (!v) return null;
  if (v.includes(',') && v.includes('.')) v = v.replace(/\./g, '').replace(',', '.');
  else if (v.includes(',')) v = v.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
