import type { ReactNode } from 'react';
import type { PieceStatus } from '../lib/types';
import { statusLabel, statusTone } from '../lib/format';

export function StatusBadge({ status }: { status: PieceStatus }) {
  return <span className={`chip ${statusTone(status)}`}>{statusLabel(status)}</span>;
}

export function PageHeader({ title, count, actions, children }: { title: string; count?: number; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl tracking-tight text-stone-900">
          {title}
          {count != null && <span className="ml-2 font-sans text-lg text-stone-400">({count})</span>}
        </h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-stone-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
      {label}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="font-serif text-xl text-stone-800">{title}</p>
      {children && <div className="max-w-md text-sm text-stone-500">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : (error as { message?: string })?.message ?? String(error);
  return <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{msg}</p>;
}

export function Thumb({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  return src ? (
    <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-stone-100 text-stone-400 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="16" rx="1.5" />
        <path d="m3 16 5-5 4 4 3-3 6 6" />
        <circle cx="15.5" cy="8.5" r="1.5" />
      </svg>
    </div>
  );
}
