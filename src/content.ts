import { useSyncExternalStore } from "react";
import bundled from "./data/site-content.json";

// What Xano sets in Artfolio → Website (the `site_content` table). Everything is
// optional: a missing or empty value means "keep what the site says today"
// (the text in src/i18n.tsx, the works in src/data.ts, the CV in src/cv.ts).
//
// Sources, in order: the copy bundled at build time (src/data/site-content.json),
// then the live published copy from /api/site-content, and, only inside the
// Artfolio preview frame, the draft Xano is editing (sent with postMessage).

export type Lang = "en" | "es";
export type Localized = Partial<Record<Lang, string>>;
export type CvRow = { year: string; text: string };

export type SiteContent = {
  home?: {
    hero?: string;
    featured?: string[];
    practice?: string;
    intro?: Localized;
    introDetail?: Localized;
  };
  about?: {
    quote?: Localized;
    title?: Localized;
    p1?: Localized;
    p2?: Localized;
    today?: Localized;
    statement?: Localized;
  };
  cv?: { solo?: CvRow[]; commissions?: CvRow[] };
  contact?: { email?: string; represented?: Localized; instagram?: string };
};

// ------------------------------------------------------------------ cleaning
// Content comes from the network (or another window), so only known fields of
// the right type and a sensible size are kept. All of it is rendered as text,
// never as HTML.

const MAX_TEXT = 4000;
const str = (v: unknown, max = MAX_TEXT) => (typeof v === "string" ? v.slice(0, max) : undefined);
const slug = (v: unknown) => (typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,200}$/.test(v) ? v : undefined);

function localized(v: unknown, max = MAX_TEXT): Localized | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const out: Localized = {};
  for (const l of ["en", "es"] as const) {
    const s = str(o[l], max);
    if (s !== undefined) out[l] = s;
  }
  return Object.keys(out).length ? out : undefined;
}

function rows(v: unknown): CvRow[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .slice(0, 200)
    .map((r) => ({ year: str(r?.year, 20)?.trim() ?? "", text: str(r?.text, 400)?.trim() ?? "" }))
    .filter((r) => r.year || r.text);
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** A full Instagram link from "@handle", "handle" or a link; undefined if it is neither. */
export function instagramUrl(v: unknown): string | undefined {
  const s = str(v, 200)?.trim();
  if (!s) return undefined;
  const handle = s.match(/^@?([A-Za-z0-9._]{1,30})$/)?.[1];
  if (handle) return `https://www.instagram.com/${handle}/`;
  try {
    const u = new URL(s);
    if (u.protocol === "https:" && /(^|\.)instagram\.com$/.test(u.hostname)) return u.toString();
  } catch {
    /* not a link */
  }
  return undefined;
}

export function cleanContent(raw: unknown): SiteContent {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const home = c.home ?? {};
  const about = c.about ?? {};
  const cv = c.cv ?? {};
  const contact = c.contact ?? {};
  const email = str(contact.email, 200)?.trim();
  return {
    home: {
      hero: slug(home.hero),
      featured: Array.isArray(home.featured) ? home.featured.map(slug).filter(Boolean).slice(0, 3) as string[] : undefined,
      practice: slug(home.practice),
      intro: localized(home.intro, 400),
      introDetail: localized(home.introDetail),
    },
    about: {
      quote: localized(about.quote, 600),
      title: localized(about.title, 400),
      p1: localized(about.p1),
      p2: localized(about.p2),
      today: localized(about.today),
      statement: localized(about.statement, 1200),
    },
    cv: { solo: rows(cv.solo), commissions: rows(cv.commissions) },
    contact: {
      email: email && EMAIL.test(email) ? email : undefined,
      represented: localized(contact.represented, 300),
      instagram: str(contact.instagram, 200),
    },
  };
}

/** Text for one language, or the site's own text when Xano left it empty. */
export const pick = (v: Localized | undefined, lang: Lang, fallback: string) => {
  const s = v?.[lang]?.trim();
  return s ? s : fallback;
};

// ------------------------------------------------------------------ store

let published = cleanContent((bundled as { content?: unknown }).content ?? bundled);
let publishedText = JSON.stringify(bundled);
let draft: SiteContent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function refreshSiteContent(url = "/api/site-content") {
  return fetch(url, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((text) => {
      if (text === publishedText) return;
      const data = JSON.parse(text);
      if (!data || typeof data !== "object" || typeof data.content !== "object") throw new Error("unexpected shape");
      published = cleanContent(data.content);
      publishedText = text;
      emit();
    })
    .catch((err) => console.warn(`Live site content unavailable, using the bundled copy: ${err.message}`));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSiteContent(): SiteContent {
  return useSyncExternalStore(subscribe, () => draft ?? published);
}

export const isPreview = () => draft !== null || previewRequested;

// ------------------------------------------------------------------ preview
// Artfolio shows the real site in a frame with ?xa-preview=1 and sends the
// draft with postMessage. Only Artfolio's own addresses are listened to, and
// the draft only ever changes what this one frame shows.

const ADMIN_ORIGINS = [
  "https://artfolio-sandy.vercel.app",
  /^https:\/\/artfolio-[a-z0-9-]+-mike-8009s-projects\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  ...String(import.meta.env.VITE_ADMIN_ORIGINS ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean),
];
export const adminOriginAllowed = (origin: string) => ADMIN_ORIGINS.some((o) => (typeof o === "string" ? o === origin : o.test(origin)));

let previewRequested = false;
let adminOrigin: string | null = null;

/** Tell Artfolio something (the frame is ready, the visitor moved to another page). */
export function postToAdmin(message: Record<string, unknown>) {
  if (adminOrigin) window.parent.postMessage({ source: "xa-site", ...message }, adminOrigin);
}

function startPreview(onNavigate: (path: string) => void, defaults: () => unknown) {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window.parent || !adminOriginAllowed(e.origin)) return;
    const m = e.data;
    if (!m || m.source !== "artfolio") return;
    adminOrigin = e.origin;
    if (m.type === "hello") postToAdmin({ type: "ready", path: location.pathname, defaults: defaults() });
    if (m.type === "draft") {
      draft = cleanContent(m.content);
      emit();
    }
    if (m.type === "navigate" && typeof m.path === "string" && m.path.startsWith("/")) onNavigate(m.path);
  });
  // Artfolio may already be listening: announce ourselves to it, then wait for "hello".
  for (const o of ADMIN_ORIGINS) {
    if (typeof o === "string") window.parent.postMessage({ source: "xa-site", type: "loaded" }, o);
  }
}

/** Called once at start-up. Returns true when the site runs inside the Artfolio preview. */
export function initSiteContent(opts: { onNavigate: (path: string) => void; defaults: () => unknown }) {
  if (typeof window === "undefined") return false;
  void refreshSiteContent();
  let wanted = false;
  try {
    wanted = new URLSearchParams(location.search).has("xa-preview") || sessionStorage.getItem("xa-preview") === "1";
    if (wanted) sessionStorage.setItem("xa-preview", "1");
  } catch {
    /* storage blocked: preview lasts for this page only */
  }
  if (!wanted || window.parent === window) return false;
  previewRequested = true;
  startPreview(opts.onNavigate, opts.defaults);
  return true;
}
