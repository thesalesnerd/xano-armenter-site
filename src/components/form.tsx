import type { ReactNode } from 'react';

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="accent-stone-900" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function PrivateBadge() {
  return <span className="chip bg-amber-50 text-amber-800 ring-amber-200" title="Only workspace owners can see this">Owner only</span>;
}

export function PublicBadge({ on }: { on: boolean }) {
  return on ? <span className="chip bg-emerald-50 text-emerald-800 ring-emerald-200">Public</span> : <span className="chip bg-stone-100 text-stone-600 ring-stone-200">Private</span>;
}
