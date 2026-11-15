import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase, imageUrl } from '../lib/supabase';
import { dimensions } from '../lib/format';
import type { PublicImage } from '../lib/types';
import { Spinner, Thumb } from '../components/ui';

export function usePublicArtist(slug: string) {
  return useQuery({
    queryKey: ['public', slug],
    queryFn: async () => {
      const { data: artist, error } = await supabase.from('public_artists').select('*').eq('slug', slug).maybeSingle();
      if (error) throw error;
      if (!artist) return null;
      const [{ data: pieces, error: e2 }, { data: collections, error: e3 }] = await Promise.all([
        supabase.from('public_pieces').select('*').eq('artist_id', artist.id!).order('year', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
        supabase.from('public_collections').select('*').eq('artist_id', artist.id!).order('name'),
      ]);
      if (e2 || e3) throw e2 || e3;
      return { artist, pieces: pieces ?? [], collections: collections ?? [] };
    },
  });
}

export default function PublicProfile() {
  const { slug } = useParams();
  const { data, isLoading } = usePublicArtist(slug!);
  const [collection, setCollection] = useState('');
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    if (!data) return [];
    const ids = collection ? new Set(data.collections.find((c) => c.id === collection)?.piece_ids ?? []) : null;
    const needle = q.trim().toLowerCase();
    return data.pieces.filter((p) => (!ids || ids.has(p.id!)) && (!needle || [p.title, p.medium, p.subject].join(' ').toLowerCase().includes(needle)));
  }, [data, collection, q]);

  if (isLoading) return <Spinner />;
  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div><p className="font-serif text-2xl">Profile not found</p><p className="mt-2 text-sm text-stone-500">This artist doesn't have a public profile.</p></div>
      </div>
    );
  }
  const { artist, collections } = data;

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto max-w-6xl px-5 pb-8 pt-14">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{artist.name}</h1>
        {artist.location && <p className="mt-2 text-stone-500">{artist.location}</p>}
        {artist.bio && <p className="mt-5 max-w-3xl whitespace-pre-line leading-relaxed text-stone-700">{artist.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {artist.website && <a className="underline" href={artist.website} target="_blank" rel="noreferrer">{artist.website.replace(/^https?:\/\//, '')}</a>}
          {artist.contact_email && <a className="underline" href={`mailto:${artist.contact_email}`}>Enquire</a>}
        </div>
      </header>
      <div className="sticky top-0 z-10 border-y border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-3">
          <button onClick={() => setCollection('')} className={`rounded-full px-3 py-1 text-sm ${!collection ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>All works ({data.pieces.length})</button>
          {collections.map((c) => (
            <button key={c.id} onClick={() => setCollection(c.id!)} className={`rounded-full px-3 py-1 text-sm ${collection === c.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
              {c.name}
            </button>
          ))}
          <input className="input ml-auto w-48" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search works" />
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-5 py-10">
        {!shown.length ? (
          <p className="py-16 text-center text-stone-500">No works to show.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((p) => {
              const img = (p.images as PublicImage[] | null)?.[0];
              return (
                <Link key={p.id} to={`w/${p.id}`} className="group">
                  <div className="aspect-square overflow-hidden bg-stone-50">
                    <Thumb src={imageUrl(img?.thumb_path ?? img?.storage_path)} alt={p.title ?? ''} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
                  </div>
                  <div className="mt-3 text-center">
                    <div className="font-serif italic">{p.title}</div>
                    <div className="text-xs text-stone-500">{[p.year, p.medium].filter(Boolean).join(', ')}</div>
                    <div className="text-xs text-stone-500">{dimensions(p)}</div>
                    {p.status === 'sold' && <div className="mt-1 text-xs text-rose-700">Sold</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-400">© {new Date().getFullYear()} {artist.name}</footer>
    </div>
  );
}
