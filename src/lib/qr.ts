import QRCode from 'qrcode';
import type { Artist } from './types';

/**
 * Permanent QR links. Labels encode <website>/qr/<inventory number>, which the
 * artist's website redirects to the work's current page (see the site's
 * api/qr.js). The printed label never has to change when a work is renamed or
 * the site is redesigned; only the inventory number must stay the same.
 */
export function qrBase(artist: Pick<Artist, 'website'>): string | null {
  const w = artist.website?.trim();
  if (!w) return null;
  const withScheme = /^https?:\/\//i.test(w) ? w : `https://${w}`;
  try {
    const u = new URL(withScheme);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export function qrUrl(base: string, inventoryNumber: string): string {
  return `${base.replace(/\/+$/, '')}/qr/${encodeURIComponent(inventoryNumber.trim())}`;
}

/** Medium error correction: survives scuffs on a label, keeps the code small. */
const OPTS = { errorCorrectionLevel: 'M' as const };

/** SVG with a 4-module quiet zone, for download. `margin: 0` for labels, which add their own white space. */
export function qrSvg(text: string, margin = 4): Promise<string> {
  return QRCode.toString(text, { ...OPTS, type: 'svg', margin, color: { dark: '#000000', light: '#ffffff' } });
}

export function qrPngDataUrl(text: string, width = 1200): Promise<string> {
  return QRCode.toDataURL(text, { ...OPTS, type: 'image/png', margin: 4, width });
}

export function download(filename: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadSvg(filename: string, svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  download(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File-name-safe version of an inventory number. */
export const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '_');
