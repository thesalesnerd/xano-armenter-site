import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Artist, Piece } from '../lib/types';
import { downloadSvg, download, fileSafe, qrBase, qrPngDataUrl, qrSvg, qrUrl } from '../lib/qr';

/** QR code for one piece, with PNG and SVG downloads. Shown on the piece page. */
export default function PieceQr({ artist, piece }: { artist: Artist; piece: Pick<Piece, 'id' | 'inventory_number' | 'is_public'> }) {
  const base = qrBase(artist);
  const inv = piece.inventory_number?.trim() ?? '';
  const url = base && inv ? qrUrl(base, inv) : null;
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let live = true;
    if (url) qrSvg(url).then((s) => live && setSvg(s));
    else setSvg('');
    return () => { live = false; };
  }, [url]);

  return (
    <section className="card p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-stone-500">QR code</h2>
      {!base ? (
        <p className="text-sm text-stone-600">
          Add your website in <Link className="underline" to="../settings">Settings</Link> to make QR codes. They link to <span className="font-mono">yoursite/qr/{inv || 'XA-0001'}</span>.
        </p>
      ) : !inv ? (
        <p className="text-sm text-stone-600">Give this piece an inventory number to make its QR code.</p>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <div className="h-32 w-32 shrink-0 bg-white [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <a className="block break-all font-mono text-xs text-stone-600 underline" href={url!} target="_blank" rel="noreferrer">{url}</a>
            <p className="text-xs text-stone-500">
              This link is permanent: it follows the piece if its title or web page changes. Changing the inventory number breaks labels already printed.
            </p>
            {!piece.is_public && <p className="text-xs text-amber-700">The piece is private, so the code opens the website's archive until you make it public.</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={async () => download(`${fileSafe(inv)}-qr.png`, await qrPngDataUrl(url!))}>PNG</button>
              <button type="button" className="btn-secondary" onClick={() => downloadSvg(`${fileSafe(inv)}-qr.svg`, svg)} disabled={!svg}>SVG</button>
              <Link className="btn-ghost" to={`../reports/labels?ids=${piece.id}`}>Print label</Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
