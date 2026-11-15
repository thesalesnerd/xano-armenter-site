import { useEffect, useRef, useState } from "react";
import { mount, type SplashHandle } from "../lib/portraitSplash";
import { useI18n } from "../i18n";

const BASE = "/portrait/portrait-base.jpg";

/** The animated paint-splash portrait (see HANDOFF-portrait-splash.md). */
export function PortraitSplash() {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<SplashHandle | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/portrait/portrait-splash.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled && host.current) handle.current = mount(host.current, data, BASE);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      handle.current?.destroy();
      handle.current = null;
    };
  }, []);

  if (failed) return <img className="portrait-fallback" src={BASE} alt={t.about.portraitAlt} />;
  return (
    <div className="portrait-splash">
      <div ref={host} aria-label={t.about.portraitAlt} />
      <button type="button" className="portrait-replay" onClick={() => handle.current?.play()}>
        ↻ {t.about.replay}
      </button>
    </div>
  );
}
