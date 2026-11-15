import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../workspace';
import { useCollections, usePieces } from '../lib/queries';
import { imageUrl, supabase } from '../lib/supabase';
import { Empty, ErrorNote, PageHeader, Spinner, Thumb } from '../components/ui';

export default function Collections() {
  const { artist, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const { data: collections, isLoading } = useCollections(artist.id);
  const { data: pieces = [] } = usePieces(artist.id);
  const [name, setName] = useState('');
  const [error, setError] = useState<unknown>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('collections').insert({ artist_id: artist.id, name: name.trim() });
    if (error) return setError(error.code === '23505' ? new Error('A collection with that name already exists.') : error);
    setName('');
    setError(null);
    qc.invalidateQueries({ queryKey: ['collections', artist.id] });
  }

  if (isLoading) return <Spinner />;

  const cover = (collectionId: string) => {
    const p = pieces.find((p) => p.piece_images.length && p.collection_pieces.some((c) => c.collection_id === collectionId));
    const img = p?.piece_images[0];
    return imageUrl(img?.thumb_path ?? img?.storage_path);
  };

  return (
    <div>
      <PageHeader title="Collections" count={collections?.length}>
        <p className="mt-1 text-sm text-stone-500">Group pieces into series, shows or portfolios. Public collections appear on your profile.</p>
      </PageHeader>
      {canEdit && (
        <form onSubmit={create} className="mb-6 flex max-w-md gap-2">
          <input className="input" placeholder="New collection name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={!name.trim()}>Create</button>
        </form>
      )}
      <ErrorNote error={error} />
      {!collections?.length ? (
        <Empty title="No collections yet">Create one above, then add pieces from a piece's page or with bulk actions.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {collections.map((c) => (
            <Link key={c.id} to={c.id} className="group">
              <div className="aspect-[4/3] overflow-hidden rounded-md bg-stone-100">
                <Thumb src={cover(c.id)} alt={c.name} className="h-full w-full transition-transform group-hover:scale-[1.02]" />
              </div>
              <div className="mt-2 font-serif text-base">{c.name}</div>
              <div className="text-xs text-stone-500">
                {c.collection_pieces[0]?.count ?? 0} pieces{c.is_public ? ' · Public' : ''}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
