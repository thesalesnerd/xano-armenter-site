// Website content (Artfolio → Website): the draft Xano edits, the published
// copy his website shows, and the history of publishes. Stored in the
// `site_content` and `site_content_versions` tables (migration
// 20261122120000_site_content.sql). The browser may only write the draft;
// publishing, discarding and restoring go through database functions.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

// The tables are newer than the generated types; keep this module untyped
// against them instead of hand-editing database.types.ts.
const db = supabase as unknown as SupabaseClient;

export type Lang = 'en' | 'es';
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];
export type Localized = Partial<Record<Lang, string>>;
export type CvRow = { year: string; text: string };

/** Same shape the website reads (src/content.ts in the site repo). Everything optional. */
export type SiteContent = {
  home?: { hero?: string; featured?: string[]; practice?: string; intro?: Localized; introDetail?: Localized };
  about?: { quote?: Localized; title?: Localized; p1?: Localized; p2?: Localized; today?: Localized; statement?: Localized };
  cv?: { solo?: CvRow[]; commissions?: CvRow[] };
  contact?: { email?: string; represented?: Localized; instagram?: string };
};

/** What the website says when nothing is set: sent by the site itself from the preview frame. */
export type SiteDefaults = {
  home: { hero: string; featured: string[]; practice: string; intro: Localized; introDetail: Localized };
  about: Record<'quote' | 'title' | 'p1' | 'p2' | 'today' | 'statement', Localized>;
  cv: { solo: CvRow[]; commissions: CvRow[] };
  contact: { email: string; represented: Localized; instagram: string };
};

export type SiteContentRow = {
  artist_id: string;
  draft: SiteContent;
  draft_updated_at: string;
  published: SiteContent | null;
  published_at: string | null;
  published_by: string | null;
  published_version: string | null;
};

export type SiteVersion = { id: string; published_at: string; published_by: string | null; who: string | null };

export function useSiteContentRow(artistId: string) {
  return useQuery({
    queryKey: ['site-content', artistId],
    queryFn: async () => {
      const { data, error } = await db.from('site_content').select('*').eq('artist_id', artistId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as SiteContentRow | null;
    },
  });
}

export function useSiteVersions(artistId: string) {
  return useQuery({
    queryKey: ['site-versions', artistId],
    queryFn: async () => {
      const { data, error } = await db
        .from('site_content_versions')
        .select('id, published_at, published_by')
        .eq('artist_id', artistId)
        .order('published_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as Omit<SiteVersion, 'who'>[];
      const ids = [...new Set(rows.map((r) => r.published_by).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: people } = await db.from('profiles').select('id, full_name, email').in('id', ids);
        for (const p of (people ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
          names.set(p.id, p.full_name?.trim() || p.email || 'Someone');
        }
      }
      return rows.map((r) => ({ ...r, who: r.published_by ? names.get(r.published_by) ?? null : null }));
    },
  });
}

/** Save the draft. Only the draft column is writable from the browser. */
export async function saveDraft(artistId: string, draft: SiteContent, exists: boolean) {
  if (!exists) {
    const { error } = await db.from('site_content').insert({ artist_id: artistId, draft });
    if (!error) return;
    if (error.code !== '23505') throw error; // someone else created it meanwhile: update instead
  }
  const { error } = await db.from('site_content').update({ draft }).eq('artist_id', artistId);
  if (error) throw error;
}

export async function publish(artistId: string) {
  const { data, error } = await db.rpc('publish_site_content', { p_artist_id: artistId });
  if (error) throw error;
  return data as string;
}

export async function discardDraft(artistId: string) {
  const { data, error } = await db.rpc('discard_site_draft', { p_artist_id: artistId });
  if (error) throw error;
  return (data ?? {}) as SiteContent;
}

export async function restoreVersion(versionId: string) {
  const { data, error } = await db.rpc('restore_site_version', { p_version_id: versionId });
  if (error) throw error;
  return (data ?? {}) as SiteContent;
}

export function useRefreshSite(artistId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['site-content', artistId] }),
      qc.invalidateQueries({ queryKey: ['site-versions', artistId] }),
    ]);
}

/** JSON with sorted keys, so drafts compare equal however the database ordered them. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** Set one value deep in the draft, returning a new object. */
export function setIn<T extends object>(obj: T, path: (string | number)[], value: unknown): T {
  const [head, ...rest] = path;
  const base: any = Array.isArray(obj) ? [...obj] : { ...obj };
  base[head] = rest.length ? setIn((base[head] ?? (typeof rest[0] === 'number' ? [] : {})) as object, rest, value) : value;
  return base;
}

export const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Where the website lives. ?site=<url> (kept for this browser tab) overrides it, for trying a preview deploy. */
export function websiteUrl(artistSlug: string, website: string | null): string | null {
  const key = `artfolio:website-preview:${artistSlug}`;
  try {
    const fromQuery = new URLSearchParams(location.search).get('site');
    if (fromQuery) sessionStorage.setItem(key, fromQuery);
    const stored = sessionStorage.getItem(key);
    if (stored) return new URL(stored).origin;
  } catch {
    /* bad URL or storage blocked: use the artist's website */
  }
  try {
    return website ? new URL(website).origin : null;
  } catch {
    return null;
  }
}
