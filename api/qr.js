// Permanent QR links: /qr/<inventory number>  ->  /archive/<slug>
//
// The QR labels on the paintings encode https://xanoarmenter.com/qr/XA-0001.
// That URL never changes: if a work is renamed (new slug) or the site moves its
// pages, only this lookup changes, never the printed label.
//
// The mapping is read live from Artfolio's public catalogue (catalogue_v1, the
// same RPC the site snapshot uses), cached for a few minutes. If Artfolio cannot
// be reached, the committed fallback map (api/_qr-map.js, written by
// scripts/qr-map.mjs) answers instead, so a scan always lands somewhere useful.
//
// vercel.json rewrites /qr/:id to /api/qr?id=:id.
import fallback from "./_qr-map.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://trcqmiemvyoxeetgfguo.supabase.co";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_UG-NEwH8e6-YNrKIcOY1vw_dydhBKDg";
const ARTIST = process.env.ARTIST_SLUG || "xano-armenter";
const TTL_MS = 5 * 60_000;

/** "xa-1", " XA-0001 " -> "XA-0001". Keeps anything that isn't PREFIX-digits as typed, upper-cased. */
export function normalize(id) {
  const s = String(id ?? "").trim().toUpperCase();
  const m = /^([A-Z]+)-?(\d+)$/.exec(s);
  return m ? `${m[1]}-${m[2].padStart(4, "0")}` : s;
}

const slugify = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** catalogue_v1 response -> { "XA-0001": "about-the-future", … }. Same slug rule and image rule as the site snapshot. */
export function mapFromCatalogue(catalogue) {
  const map = {};
  const artistSlug = catalogue?.artist?.slug ?? "";
  for (const p of catalogue?.pieces ?? []) {
    if (!p.inventory_number || !p.images?.[0]?.path) continue; // no image: not on the site
    const slug = (typeof p.slug === "string" && p.slug.trim()) || [slugify(p.title), artistSlug].filter(Boolean).join("-");
    if (slug) map[normalize(p.inventory_number)] = slug;
  }
  return map;
}

let cache = { at: 0, map: null };

async function liveMap() {
  if (cache.map && Date.now() - cache.at < TTL_MS) return cache.map;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/catalogue_v1`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_artist_slug: ARTIST }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`catalogue_v1 HTTP ${res.status}`);
  const map = mapFromCatalogue(await res.json());
  if (Object.keys(map).length === 0) throw new Error("catalogue_v1 returned no works");
  cache = { at: Date.now(), map };
  return map;
}

export async function resolve(id, getMap = liveMap) {
  const key = normalize(id);
  let map;
  let source = "live";
  try {
    map = await getMap();
  } catch {
    map = fallback.works;
    source = "fallback";
  }
  const slug = map[key];
  return { key, slug, source };
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const id = url.searchParams.get("id") ?? url.pathname.split("/").pop();
  const { key, slug, source } = await resolve(id);
  // A label for a work that is hidden or unknown still lands on the site.
  const target = slug ? `/archive/${encodeURIComponent(slug)}` : "/archive";
  res.statusCode = 302; // temporary on purpose: the target may change, the label must not be cached as final
  res.setHeader("Location", target);
  res.setHeader("Cache-Control", slug ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" : "no-store");
  res.setHeader("X-QR-Id", key);
  res.setHeader("X-QR-Source", source);
  res.setHeader("X-Robots-Tag", "noindex");
  res.end();
}
