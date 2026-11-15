import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../workspace';
import { useCollections, usePieces } from '../lib/queries';
import { imageUrl, supabase } from '../lib/supabase';
import { dimensions } from '../lib/format';
import { Empty, ErrorNote, Spinner, StatusBadge, Thumb } from '../components/ui';

export default function CollectionDetail() {
  const { collectionId } = useParams();
  const { artist, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: collections, isLoading } = useCollections(artist.id);
  const { data: pieces = [] } = usePieces(artist.id);
  const col = collections?.find((c) => c.id === collectionId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (col) {
      setName(col.name);
      setDescription(col.description ?? '');
      setIsPublic(col.is_public);
    }
  }, [col]);

  if (isLoading) return <Spinner />;
  if (!col) return <ErrorNote error={new Error('Collection not found')} />;

  const members = pieces.filter((p) => p.collection_pieces.some((c) => c.collection_id === col.id));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['collections', artist.id] });
    qc.invalidateQueries({ queryKey: ['pieces', artist.id] });
  };

  async function save(patch: { name?: string; description?: string | null; is_public?: boolean }) {
    const { error } = await supabase.from('collections').update(patch).eq('id', col!.id);
    setError(error);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    refresh();
  }

  async function removePiece(pieceId: string) {
    const { error } = await supabase.from('collection_pieces').delete().eq('collection_id', col!.id).eq('piece_id', pieceId);
    setError(error);
    refresh();
  }

  async function del() {
    if (!confirm(`Delete the collection “${col!.name}”? The pieces themselves are kept.`)) return;
    const { error } = await supabase.from('collections').delete().eq('id', col!.id);
    if (error) return setError(error);
    refresh();
    navigate('..', { relative: 'path' });
  }

  return (
    <div>
      <Link to="../collections" className="text-sm text-stone-500 hover:text-stone-900">← Collections</Link>
      <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="font-serif text-3xl">{col.name} <span className="font-sans text-lg text-stone-400">({members.length})</span></h1>
          {col.description && <p className="mt-1 max-w-2xl text-stone-600">{col.description}</p>}
          <div className="mt-6">
            {!members.length ? (
              <Empty title="This collection is empty">
                Add pieces from a piece's page, or select several on the <Link className="underline" to="../pieces">Pieces</Link> page and use “Add to collection”.
              </Empty>
            ) : (
              <ul className="card divide-y divide-stone-200">
                {members.map((p) => {
                  const img = p.piece_images[0];
                  return (
                    <li key={p.id} className="flex items-center gap-4 px-4 py-3">
                      <Thumb src={imageUrl(img?.thumb_path ?? img?.storage_path)} alt={p.title} className="h-14 w-14 shrink-0 rounded" />
                      <Link to={`../pieces/${p.id}`} className="min-w-0 flex-1">
                        <div className="truncate font-serif">{p.title}</div>
                        <div className="truncate text-xs text-stone-500">{[p.year, p.medium, dimensions(p)].filter(Boolean).join(' · ')}</div>
                      </Link>
                      <StatusBadge status={p.status} />
                      {canEdit && <button className="btn-ghost text-xs" onClick={() => removePiece(p.id)}>Remove</button>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <aside className="space-y-4">
          <fieldset disabled={!canEdit} className="card space-y-3 p-4">
            <label className="block">
              <span className="label">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== col.name && save({ name: name.trim() })} />
            </label>
            <label className="block">
              <span className="label">Description</span>
              <textarea className="input min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => description !== (col.description ?? '') && save({ description: description || null })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-stone-900" checked={isPublic} onChange={(e) => { setIsPublic(e.target.checked); save({ is_public: e.target.checked }); }} />
              Show on public profile
            </label>
            {saved && <p className="text-xs text-emerald-700">Saved</p>}
            <ErrorNote error={error} />
          </fieldset>
          <Link to={`../reports/print?type=portfolio&collection=${col.id}`} className="btn-secondary w-full">Print portfolio</Link>
          {canEdit && <button className="btn-danger w-full" onClick={del}>Delete collection</button>}
        </aside>
      </div>
    </div>
  );
}
