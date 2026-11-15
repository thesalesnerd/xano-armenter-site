import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Collection, PieceWithImages } from './types';

export function usePieces(artistId: string) {
  return useQuery({
    queryKey: ['pieces', artistId],
    queryFn: async () => {
      const all: PieceWithImages[] = [];
      // Page through in chunks of 1000 (PostgREST's default max rows).
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('pieces')
          .select('*, piece_images(id, storage_path, thumb_path, position), collection_pieces(collection_id)')
          .eq('artist_id', artistId)
          .order('created_at', { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        for (const p of data as PieceWithImages[]) {
          p.piece_images.sort((a, b) => a.position - b.position);
          all.push(p);
        }
        if (data.length < 1000) break;
      }
      return all;
    },
  });
}

export function useCollections(artistId: string) {
  return useQuery({
    queryKey: ['collections', artistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*, collection_pieces(count)')
        .eq('artist_id', artistId)
        .order('name');
      if (error) throw error;
      return data as (Collection & { collection_pieces: { count: number }[] })[];
    },
  });
}
