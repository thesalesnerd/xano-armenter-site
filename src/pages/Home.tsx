import { Link, Navigate } from 'react-router-dom';
import { useMyArtists } from '../workspace';
import { Spinner } from '../components/ui';
import { supabase } from '../lib/supabase';

export default function Home() {
  const { data, isLoading } = useMyArtists();
  if (isLoading) return <Spinner />;
  if (!data?.length) return <Navigate to="/new" replace />;
  if (data.length === 1) return <Navigate to={`/a/${data[0].artist.slug}/pieces`} replace />;
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Your artists</h1>
        <button className="btn-ghost text-xs" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      <ul className="card divide-y divide-stone-200">
        {data.map(({ artist, role }) => (
          <li key={artist.id}>
            <Link to={`/a/${artist.slug}/pieces`} className="flex items-center justify-between px-5 py-4 hover:bg-stone-50">
              <span className="font-medium">{artist.name}</span>
              <span className="text-xs capitalize text-stone-500">{role}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/new" className="btn-secondary mt-6">+ New artist</Link>
    </div>
  );
}
