import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { Artwork } from "../data";
import { priceLabel, yearLabel } from "../data";
import { useI18n } from "../i18n";
import { ArrowIcon } from "./ArrowIcon";
import { RoomView } from "./RoomView";

/** Full-screen view of one work. `base` is the list it was opened from, e.g. "/work". */
export function Lightbox({ works, index, base }: { works: Artwork[]; index: number; base: string }) {
  const { t, to, medium, lang } = useI18n();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [room, setRoom] = useState(false);
  const work = works[index];
  const go = (step: number) =>
    navigate(`${base}/${works[(index + step + works.length) % works.length].slug}${search}`, { replace: true, preventScrollReset: true });
  const close = () => navigate(base + search, { preventScrollReset: true });

  // Each work has its own URL; give the tab (and bookmarks) its title too.
  useEffect(() => {
    const before = document.title;
    document.title = `${work.title} — Xano Armenter`;
    return () => {
      document.title = before;
    };
  }, [work.title]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (room) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={work.title}>
      <button className="lightbox-close" onClick={close}>
        {t.lightbox.close}
      </button>
      <div className="lightbox-image-wrap">
        <img key={work.slug} src={work.image} alt={work.title} />
      </div>
      <div className="lightbox-info">
        <span>
          {String(index + 1).padStart(2, "0")} / {String(works.length).padStart(2, "0")}
        </span>
        <div>
          <h2>{work.title}</h2>
          <p>{[medium(work.medium), yearLabel(work, t.lightbox.circa)].filter(Boolean).join(", ")}</p>
          {work.dims && <p>{work.dims}</p>}
          {work.series.length > 0 && <p>{work.series.join(", ")}</p>}
          <p className="lightbox-price">
            {work.sold ? t.lightbox.sold : [t.lightbox.available, priceLabel(work, lang === "es" ? "es-ES" : "en-US")].filter(Boolean).join(" · ")}
          </p>
          <div className="lightbox-actions">
            <button type="button" className="text-link" onClick={() => setRoom(true)}>
              <span>{t.lightbox.room}</span>
              <ArrowIcon />
            </button>
            <Link className="text-link" to={`${to("/contact")}?work=${work.slug}`}>
              <span>{t.lightbox.enquire}</span>
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>
      <div className="lightbox-controls">
        <button onClick={() => go(-1)} aria-label={t.lightbox.prev}>
          <ArrowIcon direction="left" />
        </button>
        <button onClick={() => go(1)} aria-label={t.lightbox.next}>
          <ArrowIcon />
        </button>
      </div>
      {room && <RoomView work={work} onClose={() => setRoom(false)} />}
    </div>
  );
}
