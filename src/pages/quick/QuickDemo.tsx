import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { WorkspaceContext } from '../../workspace';
import { ErrorNote, Spinner } from '../../components/ui';
import type { Artist, PieceWithImages, PublicImage } from '../../lib/types';
import { LangProvider, QuickEnv } from './parts';
import { QuickRoutes } from './QuickUpdate';

/**
 * /demo/:slug[/:deck] — Quick update without signing in, for trying it out and giving feedback.
 * Uses the public catalogue (only works shown on the website, no private fields) and never
 * writes anything: answers live in this browser tab only.
 */
export default function QuickDemo() {
  const { slug } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['quick-demo', slug],
    staleTime: Infinity,
    queryFn: async () => {
      const { data: a, error: e1 } = await supabase.from('public_artists').select('*').eq('slug', slug!).maybeSingle();
      if (e1) throw e1;
      if (!a) throw new Error('Not found');
      const { data: rows, error: e2 } = await supabase.from('public_pieces').select('*').eq('artist_slug', slug!);
      if (e2) throw e2;
      // A separate id keeps practice progress apart from the real Quick update's.
      const artist = { ...a, id: `demo-${a.id}` } as unknown as Artist;
      const pieces = (rows ?? []).map((r) => ({
        ...r,
        artist_id: artist.id,
        is_public: true,
        show_price: false,
        price: null,
        location: null,
        notes: null,
        piece_images: ((r.images as PublicImage[] | null) ?? []).map((i, n) => ({ id: `${r.id}-${n}`, storage_path: i.storage_path, thumb_path: i.thumb_path, position: n })),
        collection_pieces: [],
      })) as unknown as PieceWithImages[];
      // Seed the cache Quick update reads from, and never refetch it (the real table is private).
      qc.setQueryDefaults(['pieces', artist.id], { staleTime: Infinity, gcTime: Infinity, queryFn: () => qc.getQueryData(['pieces', artist.id]) ?? pieces });
      qc.setQueryData(['pieces', artist.id], pieces);
      return artist;
    },
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <div className="p-6"><ErrorNote error={error ?? 'Not found'} /></div>;
  return (
    <WorkspaceContext.Provider value={{ artist: data, role: 'editor', canEdit: true, isOwner: false }}>
      <QuickEnv.Provider value={{ base: `/demo/${slug}`, demo: true }}>
        <LangProvider>
          <QuickRoutes />
        </LangProvider>
      </QuickEnv.Provider>
    </WorkspaceContext.Provider>
  );
}
