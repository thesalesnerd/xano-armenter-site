import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import type { Artwork } from "../data";
import { yearLabel } from "../data";
import { useI18n } from "../i18n";

function useColumns(max: number) {
  const pick = () => (window.innerWidth < 560 ? 1 : window.innerWidth < 800 ? 2 : window.innerWidth < 1200 ? Math.min(max, 3) : max);
  const [n, setN] = useState(pick);
  useEffect(() => {
    const on = () => setN(pick());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  });
  return n;
}

/**
 * Mosaic of whole, uncropped paintings. Each work goes into the currently
 * shortest column, so reading order stays roughly left to right and the
 * columns end at similar heights.
 */
export function Mosaic({ works, base, search = "", columns = 3 }: { works: Artwork[]; base: string; search?: string; columns?: number }) {
  const { t, medium } = useI18n();
  const n = useColumns(columns);
  const cols = useMemo(() => {
    const out: Artwork[][] = Array.from({ length: n }, () => []);
    const heights = new Array(n).fill(0);
    // Offsets match the staggered column starts in the CSS, in units of column width.
    const stagger = n >= 3 ? [0, 0.28, 0.12, 0.36] : [0, 0.18];
    heights.forEach((_, i) => (heights[i] = stagger[i % stagger.length] ?? 0));
    for (const w of works) {
      const i = heights.indexOf(Math.min(...heights));
      out[i].push(w);
      heights[i] += w.h / w.w + 0.22;
    }
    return out;
  }, [works, n]);

  return (
    <div className={`mosaic mosaic-${n}`}>
      {cols.map((col, i) => (
        <div className="mosaic-col" key={i}>
          {col.map((w) => (
            <article className="work-card" key={w.slug}>
              <Link className="work-image" to={`${base}/${w.slug}${search}`} preventScrollReset style={{ aspectRatio: `${w.w} / ${w.h}` }}>
                <img src={w.thumb} alt={w.title} loading="lazy" width={w.w} height={w.h} />
                <span className="view-work">
                  <span>{t.work.view}</span>
                </span>
              </Link>
              <div className="work-meta">
                <div>
                  <h2>{w.title}</h2>
                  <p>{[medium(w.medium), w.dims].filter(Boolean).join(" · ")}</p>
                </div>
                <span>{yearLabel(w, t.lightbox.circa)}</span>
              </div>
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}
