import { useState } from 'react';
import type { Collection, PieceWithImages } from '../lib/types';
import { STATUSES } from '../lib/format';
import { distinct, EMPTY_FILTERS, type Filters } from '../lib/filters';
import { useLocations } from '../lib/parity';
import { useWorkspace } from '../workspace';

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  pieces: PieceWithImages[];
  collections: Collection[];
};

export default function FilterBar({ filters: f, onChange, pieces, collections }: Props) {
  const [open, setOpen] = useState(!!f.location);
  const { data: locations = [] } = useLocations(useWorkspace().artist.id);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...f, [k]: v });
  const active =
    f.status.length + [f.medium, f.subject, f.collection, f.location, f.visibility, f.yearFrom, f.yearTo].filter(Boolean).length;
  const mediums = distinct(pieces, 'medium');
  const subjects = distinct(pieces, 'subject');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="input pl-8"
            placeholder="Search title, inventory #, medium, tags…"
            value={f.q}
            onChange={(e) => set('q', e.target.value)}
            aria-label="Search pieces"
          />
        </div>
        <button className={open || active ? 'btn-primary' : 'btn-secondary'} onClick={() => setOpen((o) => !o)}>
          Filter{active ? ` (${active})` : ''}
        </button>
        <select className="input w-auto" value={f.sort} onChange={(e) => set('sort', e.target.value as Filters['sort'])} aria-label="Sort">
          <option value="newest">Recently added</option>
          <option value="oldest">Oldest added</option>
          <option value="title">Title A–Z</option>
          <option value="year_desc">Year (newest)</option>
          <option value="year_asc">Year (oldest)</option>
          <option value="inventory">Inventory #</option>
          <option value="price_desc">Price (high–low)</option>
          <option value="price_asc">Price (low–high)</option>
        </select>
        {active > 0 && (
          <button className="btn-ghost" onClick={() => onChange({ ...EMPTY_FILTERS, q: f.q, sort: f.sort })}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <span className="label">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => {
                const on = f.status.includes(s.value);
                return (
                  <button
                    key={s.value}
                    className={`chip cursor-pointer ${on ? s.tone : 'bg-white text-stone-600 ring-stone-300'}`}
                    onClick={() => set('status', on ? f.status.filter((x) => x !== s.value) : [...f.status, s.value])}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="f-medium">Medium</label>
            <select id="f-medium" className="input" value={f.medium} onChange={(e) => set('medium', e.target.value)}>
              <option value="">Any</option>
              {mediums.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-subject">Subject</label>
            <select id="f-subject" className="input" value={f.subject} onChange={(e) => set('subject', e.target.value)}>
              <option value="">Any</option>
              {subjects.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-col">Collection</label>
            <select id="f-col" className="input" value={f.collection} onChange={(e) => set('collection', e.target.value)}>
              <option value="">Any</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-loc">Location</label>
            <select id="f-loc" className="input" value={f.location} onChange={(e) => set('location', e.target.value)}>
              <option value="">Any</option>
              <option value="none">No location set</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-vis">Visibility</label>
            <select id="f-vis" className="input" value={f.visibility} onChange={(e) => set('visibility', e.target.value as Filters['visibility'])}>
              <option value="">Any</option>
              <option value="public">On public profile</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div>
            <span className="label">Year</span>
            <div className="flex items-center gap-1.5">
              <input className="input" inputMode="numeric" placeholder="From" value={f.yearFrom} onChange={(e) => set('yearFrom', e.target.value.replace(/\D/g, ''))} aria-label="Year from" />
              <span className="text-stone-400">–</span>
              <input className="input" inputMode="numeric" placeholder="To" value={f.yearTo} onChange={(e) => set('yearTo', e.target.value.replace(/\D/g, ''))} aria-label="Year to" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
