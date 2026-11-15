import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import type { Artist, MemberRole } from './lib/types';
import { useAuth } from './auth';

export type Workspace = { artist: Artist; role: MemberRole; canEdit: boolean; isOwner: boolean };

export const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error('useWorkspace outside an artist workspace');
  return ws;
}

/** All workspaces the signed-in user belongs to. */
export function useMyArtists() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ['my-artists', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artist_members')
        .select('role, artists(*)')
        .eq('user_id', uid!)
        .order('created_at');
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.artists)
        .map((r) => ({ role: r.role, artist: r.artists as unknown as Artist }));
    },
  });
}
