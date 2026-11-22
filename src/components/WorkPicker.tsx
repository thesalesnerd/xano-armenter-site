import { useEffect, useMemo, useState } from 'react';
import { imageUrl } from '../lib/supabase';
import type { PieceWithImages } from '../lib/types';
import { Thumb } from './ui';

/** Full-screen sheet on a phone, a dialog on a computer: tap a work to choose it. */
export function WorkPicker({
  title,
  works,
  current,
  taken = [],
  onPick,
  onClose,
}: {
  title: string;
  works: PieceWithImages[];
  current?: string;
  taken?: string[];
  onPick: (slug: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? works.filter((w) => w.title.toLowerCase().includes(s) || String(w.year ?? '').includes(s)) : works;
  }, [q, works]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="flex h-full w-full flex-col bg-white sm:h-[80vh] sm:max-w-3xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <h2 className="font-serif text-xl">{title}</h2>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="px-4 pt-3">
          <input className="input py-2.5 text-base" type="search" placeholder="Search by title or year" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <p className="mt-2 text-xs text-stone-500">Only works shown on your website are listed.</p>
        </div>
        <ul className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-4">
          {shown.map((w) => {
            const img = w.piece_images[0];
            const on = w.slug === current;
            const elsewhere = !on && taken.includes(w.slug);
            return (
              <li key={w.id}>
                <button
                  type="button"
                  className={`block w-full overflow-hidden rounded-lg text-left ring-1 transition ${on ? 'ring-4 ring-stone-900' : 'ring-stone-200 hover:ring-stone-400'}`}
                  onClick={() => onPick(w.slug)}
                  aria-pressed={on}
                >
                  <Thumb src={imageUrl(img?.thumb_path ?? img?.storage_path)} alt="" className="aspect-square w-full" />
                  <span className="block truncate px-2 pt-1.5 text-sm font-medium">{w.title}</span>
                  <span className="block px-2 pb-2 text-xs text-stone-500">{[w.year, on ? 'Chosen' : elsewhere ? 'Already used on this page' : ''].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="col-span-full py-10 text-center text-sm text-stone-500">No works match.</li>}
        </ul>
      </div>
    </div>
  );
}
