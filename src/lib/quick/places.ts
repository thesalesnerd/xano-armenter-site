// Where a work is. Since the parity work, a piece points at a row in `locations`
// (location_id) and keeps a free-text `location` for details. The full piece form sets
// the text to the location's name when it was empty or still equal to the old name;
// Quick update follows the same rule so both screens agree.
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useLocations } from '../parity';
import type { Piece, PieceWithImages } from '../types';

export type PlacePatch = Partial<Pick<Piece, 'location' | 'location_id'>>;

export type Places = {
  /** Place names to offer, most used first. */
  names: string[];
  /** What to show for a work: its location's name, else the free text. */
  nameOf: (p: Piece) => string | null;
  /** The change that puts a work in `name` (creating the location if it's new); null clears it. */
  patchFor: (p: Piece, name: string | null) => Promise<PlacePatch>;
  isMissing: (p: Piece) => boolean;
};

export function usePlaces(artistId: string, pieces: PieceWithImages[], demo: boolean): Places {
  const qc = useQueryClient();
  const { data: locations = [] } = useLocations(demo ? '' : artistId);

  return useMemo<Places>(() => {
    const byId = new Map(locations.map((l) => [l.id, l]));
    const byName = new Map(locations.map((l) => [l.name.trim().toLowerCase(), l]));
    const nameOf = (p: Piece) => (p.location_id && byId.get(p.location_id)?.name) || p.location?.trim() || null;

    const counts = new Map<string, number>();
    for (const l of locations) counts.set(l.name, 0);
    for (const p of pieces) {
      const n = nameOf(p);
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const names = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([n]) => n)
      .slice(0, 16);

    async function patchFor(p: Piece, name: string | null): Promise<PlacePatch> {
      const oldName = (p.location_id && byId.get(p.location_id)?.name) || '';
      const text = p.location?.trim() ?? '';
      const textFollows = !text || text === oldName; // text was just the location's name
      if (demo) return { location: name };
      if (!name) return { location_id: null, ...(textFollows ? { location: null } : {}) };
      let loc = byName.get(name.trim().toLowerCase());
      if (!loc) {
        const { data, error } = await supabase
          .from('locations')
          .insert({ artist_id: artistId, name: name.trim(), kind: 'storage' } as never)
          .select()
          .single();
        if (error) throw error;
        loc = data as typeof locations[number];
        await qc.invalidateQueries({ queryKey: ['locations', artistId] });
      }
      return { location_id: loc.id, ...(textFollows ? { location: loc.name } : {}) };
    }

    const isMissing = (p: Piece) => !nameOf(p);
    return { names, nameOf, patchFor, isMissing };
  }, [locations, pieces, artistId, demo, qc]);
}
