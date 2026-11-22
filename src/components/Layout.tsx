import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useMyArtists, WorkspaceContext } from '../workspace';
import { Spinner } from './ui';
import { useAuth } from '../auth';

const NAV = [
  { to: 'pieces', label: 'Pieces', icon: 'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z' },
  { to: 'play', label: 'Quick update', icon: 'M13 3 5 14h6l-1 7 8-11h-6z' },
  { to: 'collections', label: 'Collections', icon: 'M3 7h6l2 2h10v10H3z' },
  { to: 'locations', label: 'Locations', icon: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
  { to: 'exhibitions', label: 'Exhibitions', icon: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6' },
  { to: 'contacts', label: 'Contacts', icon: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8', owner: true },
  { to: 'sales', label: 'Sales', icon: 'M4 7h16v12H4zM4 11h16M8 15h3', owner: true },
  { to: 'reports', label: 'Reports', icon: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3' },
  { to: 'import', label: 'Import', icon: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3' },
  { to: 'website', label: 'Website', icon: 'M3 5h18v14H3zM3 9h18M7 7h.01M10 7h.01' },
  { to: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .3-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 1.8L6 8.3 4 8 3 11l2 1v0l-2 1 1 3 2-.3 1.5 1.5L7 19l3 1 1-2h2l1 2 3-1-.5-1.8 1.5-1.5 2 .3 1-3z' },
];

export default function Layout() {
  const { slug } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { data: mine, isLoading } = useMyArtists();
  const [open, setOpen] = useState(false);

  if (isLoading) return <Spinner />;
  const current = mine?.find((m) => m.artist.slug === slug);
  if (!current) {
    return (
      <div className="p-10 text-center">
        <p className="mb-4 text-stone-600">You don't have access to this artist, or it doesn't exist.</p>
        <Link to="/" className="btn-secondary">Back to your artists</Link>
      </div>
    );
  }
  const ws = {
    artist: current.artist,
    role: current.role,
    canEdit: current.role !== 'viewer',
    isOwner: current.role === 'owner',
  };

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3 text-sm">
      <Link to="/" className="mb-4 flex items-center gap-2 px-2 pt-1">
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="font-serif text-xl">Artfolio</span>
      </Link>
      <label className="label px-2">Artist</label>
      <select
        className="input mb-4"
        value={slug}
        onChange={(e) => (e.target.value === '__new' ? navigate('/new') : navigate(`/a/${e.target.value}/pieces`))}
      >
        {mine!.map((m) => (
          <option key={m.artist.id} value={m.artist.slug}>{m.artist.name}</option>
        ))}
        <option value="__new">+ New artist…</option>
      </select>
      {NAV.filter((n) => !('owner' in n) || current.role === 'owner').map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-md px-2 py-1.5 ${isActive ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-200/70'}`
          }
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d={n.icon} />
          </svg>
          {n.label}
        </NavLink>
      ))}
      <a
        href={`/p/${current.artist.slug}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-stone-700 hover:bg-stone-200/70"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
        </svg>
        Public profile
        <span className={`ml-auto text-[10px] uppercase tracking-wide ${current.artist.public_profile ? 'text-emerald-700' : 'text-stone-400'}`}>
          {current.artist.public_profile ? 'Live' : 'Off'}
        </span>
      </a>
      <div className="mt-auto border-t border-stone-200 px-2 pt-3 text-xs text-stone-500">
        <div className="truncate">{session?.user.email}</div>
        <div className="mt-1 flex items-center justify-between">
          <span className="capitalize">{current.role}</span>
          <button className="underline hover:text-stone-900" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    </nav>
  );

  return (
    <WorkspaceContext.Provider value={ws}>
      <div className="min-h-screen md:grid md:grid-cols-[232px_1fr] print:block">
        <aside className="no-print sticky top-0 hidden h-screen border-r border-stone-200 bg-stone-100/70 md:block">{sidebar}</aside>
        <div className="no-print flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2 md:hidden">
          <span className="font-serif text-lg">{current.artist.name}</span>
          <button className="btn-ghost" onClick={() => setOpen((o) => !o)} aria-label="Menu">☰</button>
        </div>
        {open && <div className="no-print border-b border-stone-200 bg-stone-100 md:hidden">{sidebar}</div>}
        <main className="min-w-0 px-4 py-6 md:px-8 md:py-8 print:p-0">
          <Outlet />
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}
