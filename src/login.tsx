// Xano's "Log in" (/login, /es/login). Signs in with Supabase Auth on the same
// project as Artfolio, then hands the session to the Artfolio admin.
//
// There is no sign-up here: only existing Artfolio logins that are members of
// the xano-armenter workspace get through. The session is not kept on this
// site (nothing in localStorage); it is passed to Artfolio in the URL fragment
// (#access_token=…&refresh_token=…), which Artfolio's Supabase client reads and
// stores on start-up and then removes from the address bar. Fragments are never
// sent to a server. The destination is a fixed origin, never taken from the URL.
//
// This module and @supabase/supabase-js load only when /login is opened.

import { useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { useI18n } from "./i18n";

export const ADMIN_URL = "https://artfolio-sandy.vercel.app";
const SUPABASE_URL = "https://trcqmiemvyoxeetgfguo.supabase.co";
// Publishable (anon) key: public, the same one the Artfolio app uses.
const SUPABASE_ANON_KEY = "sb_publishable_UG-NEwH8e6-YNrKIcOY1vw_dydhBKDg";
const ARTIST_SLUG = "xano-armenter";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const copy = {
  en: {
    eyebrow: "Studio",
    title: "Log in",
    intro: "For Xano and the studio team. Log in to update works, prices, sold status and the website.",
    email: "Email",
    password: "Password",
    submit: "Log in",
    busy: "Logging in…",
    wrong: "That email and password don't match. Check them and try again.",
    notMember: "You're logged in, but this account isn't linked to Xano Armenter's catalogue. Ask Mike to add it.",
    failed: "Couldn't log in right now. Try again in a minute.",
    forgot: "Forgot your password?",
    forgotSent: "If that email has a login, a reset link is on its way.",
    forgotNeedEmail: "Type your email above first.",
    already: "Already logged in to Artfolio? Go straight to the admin",
  },
  es: {
    eyebrow: "Estudio",
    title: "Entrar",
    intro: "Para Xano y el estudio. Entra para actualizar obras, precios, vendidas y la web.",
    email: "Correo",
    password: "Contraseña",
    submit: "Entrar",
    busy: "Entrando…",
    wrong: "El correo y la contraseña no coinciden. Revísalos y vuelve a intentarlo.",
    notMember: "Has entrado, pero esta cuenta no está vinculada al catálogo de Xano Armenter. Pide a Mike que la añada.",
    failed: "No se ha podido entrar. Inténtalo de nuevo en un minuto.",
    forgot: "¿Has olvidado la contraseña?",
    forgotSent: "Si ese correo tiene acceso, te llegará un enlace para cambiarla.",
    forgotNeedEmail: "Escribe primero tu correo.",
    already: "¿Ya has entrado en Artfolio? Ve directo al panel",
  },
};

/** The Artfolio URL that signs the browser in there with this session. */
export function handoffUrl(session: { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; token_type: string }) {
  const p = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in),
    expires_at: String(session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in),
    token_type: session.token_type,
  });
  return `${ADMIN_URL}/a/${ARTIST_SLUG}/pieces#${p.toString()}`;
}

export default function LoginPage() {
  const { lang } = useI18n();
  const c = copy[lang === "es" ? "es" : "en"];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session) {
        setMessage({ kind: "error", text: error && /invalid|credentials|not confirmed/i.test(error.message) ? c.wrong : c.failed });
        return;
      }
      // RLS only shows workspaces the user belongs to.
      const { data: artist } = await supabase.from("artists").select("id").eq("slug", ARTIST_SLUG).maybeSingle();
      if (!artist) {
        await supabase.auth.signOut({ scope: "local" });
        setMessage({ kind: "error", text: c.notMember });
        return;
      }
      window.location.assign(handoffUrl(data.session));
    } catch {
      setMessage({ kind: "error", text: c.failed });
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) {
      setMessage({ kind: "error", text: c.forgotNeedEmail });
      return;
    }
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${ADMIN_URL}/` }).catch(() => undefined);
    setMessage({ kind: "info", text: c.forgotSent });
  }

  return (
    <section className="login-page">
      <p className="eyebrow">{c.eyebrow}</p>
      <h1>{c.title}</h1>
      <p className="login-intro">{c.intro}</p>
      <form className="login-form" onSubmit={submit} noValidate>
        <label>
          <span>{c.email}</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span>{c.password}</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {message && (
          <p className={`login-message is-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={busy || !email || !password}>
          {busy ? c.busy : c.submit}
        </button>
        <button type="button" className="login-link" onClick={forgot}>
          {c.forgot}
        </button>
      </form>
      <a className="login-link" href={`${ADMIN_URL}/a/${ARTIST_SLUG}/pieces`}>
        {c.already} →
      </a>
    </section>
  );
}
