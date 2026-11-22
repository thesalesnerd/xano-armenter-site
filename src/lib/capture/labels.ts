// What a scanned code can point at. The QR label format is owned by the QR
// work (branch claude/artfolio-qr): https://xanoarmenter.com/qr/<inventory #>.
// We only read the inventory number out of it, and also accept Artfolio's own
// piece URLs and the website's /archive/<slug> pages.

export type LabelTarget = { inventory?: string; pieceId?: string; slug?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "xa-1", "XA1", "xa-0001" -> "XA-0001". Anything else is returned trimmed and upper-cased. */
export function normalizeInventory(s: string): string {
  const t = s.trim();
  const m = t.match(/^([A-Za-z]+)[-_ ]?0*(\d+)$/);
  return m ? `${m[1].toUpperCase()}-${m[2].padStart(4, '0')}` : t.toUpperCase();
}

export function parseLabel(text: string): LabelTarget | null {
  const t = text.trim();
  if (!t) return null;
  let url: URL | null = null;
  try { url = new URL(t); } catch { /* not a URL */ }
  if (!url) return /^[A-Za-z]+[-_ ]?\d+$/.test(t) ? { inventory: normalizeInventory(t) } : null;
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const qr = parts.indexOf('qr');
  if (qr >= 0 && parts[qr + 1]) return { inventory: normalizeInventory(parts[qr + 1]) };
  const id = parts.find((p) => UUID.test(p));
  if (id) return { pieceId: id };
  const arch = parts.indexOf('archive');
  if (arch >= 0 && parts[arch + 1]) return { slug: parts[arch + 1] };
  return null;
}

/** Suggests the next inventory number from the existing ones ("XA-0101" -> "XA-0102"). */
export function nextInventory(existing: (string | null)[]): string {
  const counts = new Map<string, { n: number; w: number }>();
  for (const e of existing) {
    const m = e?.match(/^([A-Za-z]+)-(\d+)$/);
    if (!m) continue;
    const cur = counts.get(m[1]) ?? { n: 0, w: m[2].length };
    counts.set(m[1], { n: Math.max(cur.n, Number(m[2])), w: Math.max(cur.w, m[2].length) });
  }
  const best = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  return best ? `${best[0]}-${String(best[1].n + 1).padStart(best[1].w, '0')}` : '';
}
