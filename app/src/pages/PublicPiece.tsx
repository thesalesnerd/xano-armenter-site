import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { imageUrl } from '../lib/supabase';
import { dimensions, money, statusLabel } from '../lib/format';
import type { PublicImage } from '../lib/types';
import { Spinner } from '../components/ui';
import { usePublicArtist } from './PublicProfile';

export default function PublicPiece() {
  const { slug, pieceId } = useParams();
  const { data, isLoading } = usePublicArtist(slug!);
  const [active, setActive] = useState(0);
  if (isLoading) return <Spinner />;
  const idx = data?.pieces.findIndex((p) => p.id === pieceId) ?? -1;
  const p = idx >= 0 ? data!.pieces[idx] : null;
  if (!data || !p) {
    return <div className="grid min-h-screen place-items-center text-stone-500">Work not found. <Link to={`/p/${slug}`} className="underline">Back</Link></div>;
  }
  const images = (p.images as PublicImage[] | null) ?? [];
  const prev = data.pieces[idx - 1];
  const next = data.pieces[idx + 1];
  const { artist } = data;
  const subject = encodeURIComponent(`Enquiry: ${p.title}${p.year ? ` (${p.year})` : ''}`);

  return (
    <div className="min-h-screen bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 text-sm">
        <Link to={`/p/${slug}`} className="text-stone-600 hover:text-stone-900">← {artist.name}</Link>
        <div className="flex gap-4 text-stone-500">
          {prev && <Link to={`/p/${slug}/w/${prev.id}`} onClick={() => setActive(0)}>‹ Previous</Link>}
          {next && <Link to={`/p/${slug}/w/${next.id}`} onClick={() => setActive(0)}>Next ›</Link>}
        </div>
      </nav>
      <main className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 lg:grid-cols-[3fr_2fr]">
        <div>
          {images[active] ? (
            <img src={imageUrl(images[active].storage_path)} alt={p.title ?? ''} className="mx-auto max-h-[80vh] w-full object-contain" />
          ) : (
            <div className="aspect-square bg-stone-50" />
          )}
          {images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {images.map((img, i) => (
                <button key={img.storage_path} onClick={() => setActive(i)} className={`h-16 w-16 overflow-hidden ${i === active ? 'ring-2 ring-stone-900' : 'opacity-70'}`}>
                  <img src={imageUrl(img.thumb_path ?? img.storage_path)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lg:pt-6">
          <h1 className="font-serif text-3xl italic">{p.title}</h1>
          <dl className="mt-5 space-y-1.5 text-sm text-stone-700">
            {p.year && <div>{p.year}</div>}
            {p.medium && <div>{p.medium}</div>}
            {dimensions(p) && <div>{dimensions(p)}</div>}
            {p.kind === 'edition' && p.edition_size && <div>Edition of {p.edition_size}</div>}
          </dl>
          <div className="mt-5 text-base">
            {p.status === 'sold' ? <span className="text-rose-700">Sold</span>
              : p.status === 'available' ? (p.price != null ? money(p.price, p.currency) : 'Price on request')
              : <span className="text-stone-500">{statusLabel(p.status)}</span>}
          </div>
          {p.description && <p className="mt-6 whitespace-pre-line leading-relaxed text-stone-700">{p.description}</p>}
          {artist.contact_email && p.status !== 'sold' && (
            <a href={`mailto:${artist.contact_email}?subject=${subject}`} className="btn-primary mt-8">Enquire about this work</a>
          )}
        </div>
      </main>
    </div>
  );
}
