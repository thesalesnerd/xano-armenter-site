import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams, useSearchParams } from "react-router";
import { archive, bySlug, FEATURED, HERO, PRACTICE, selected, yearLabel, type Artwork } from "./data";
import { commissions, soloShows } from "./cv";
import { CONTACT_EMAIL, useI18n } from "./i18n";
import { ArrowIcon } from "./components/ArrowIcon";
import { Lightbox } from "./components/Lightbox";
import { Mosaic } from "./components/Mosaic";
import { PortraitSplash } from "./components/PortraitSplash";

export function SiteLayout() {
  const { t, to, lang, switchTo } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === to("/");
  // Scroll to the top on page changes, but not when a lightbox opens or closes.
  const page = location.pathname.replace(/^\/es(?=\/|$)/, "").split("/")[1] ?? "";

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [page, lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navItems = [
    { to: to("/work"), label: t.nav.work },
    { to: to("/archive"), label: t.nav.archive },
    { to: to("/about"), label: t.nav.about },
    { to: to("/contact"), label: t.nav.contact },
  ];
  const langSwitch = (
    <Link className="lang-switch" to={switchTo} hrefLang={lang === "en" ? "es" : "en"} aria-label={lang === "en" ? "Ver en español" : "View in English"}>
      {lang === "en" ? "ES" : "EN"}
    </Link>
  );

  return (
    <main>
      <header className={`site-header ${isHomePage ? "is-home" : "is-interior"}`}>
        {!isHomePage && (
          <Link className="wordmark" to={to("/")} aria-label="Xano Armenter">
            Xano Armenter
          </Link>
        )}
        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
          {langSwitch}
        </nav>
        <button className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label={t.menu.open} aria-expanded={menuOpen}>
          {t.menu.open}
        </button>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div className="site-footer-top">
          <Link className="site-footer-name" to={to("/")}>
            Xano Armenter
          </Link>
          <nav aria-label="Footer navigation">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
            <a href="https://www.instagram.com/xano_armenter/" target="_blank" rel="noreferrer">
              Instagram
            </a>
          </nav>
        </div>
        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} Xano Armenter</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <span>{t.footer.represented}</span>
        </div>
      </footer>

      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="menu-close" onClick={() => setMenuOpen(false)}>
            {t.menu.close}
          </button>
          <nav>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
            {langSwitch}
          </nav>
          <p>{t.menu.tagline}</p>
        </div>
      )}
    </main>
  );
}

export function HomePage() {
  const { t, to } = useI18n();
  return (
    <>
      <section className="hero">
        <img src={HERO.image} alt={t.home.heroAlt} />
        <div className="hero-shade" />
        <div className="hero-copy">
          <h1>
            <span>Xano</span>
            <span>Armenter</span>
          </h1>
        </div>
        <Link className="hero-scroll" to={to("/work")}>
          <span>{t.home.explore}</span>
          <span className="scroll-line" />
        </Link>
      </section>

      <section className="home-intro">
        <p className="eyebrow">{t.home.eyebrow}</p>
        <div>
          <h2>{t.home.intro}</h2>
          <div className="home-intro-detail">
            <p>{t.home.introDetail}</p>
            <Link className="text-link" to={to("/about")}>
              <span>{t.home.aboutLink}</span>
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <section className="featured-section">
        <div className="featured-heading">
          <p className="eyebrow">{t.home.featuredEyebrow}</p>
          <h2>{t.home.featuredTitle}</h2>
          <Link className="text-link" to={to("/work")}>
            <span>{t.home.viewAll}</span>
            <ArrowIcon />
          </Link>
        </div>
        <div className="featured-grid">
          {FEATURED.map((w, index) => (
            <Link className={`featured-card featured-card-${index + 1}`} to={`${to("/work")}/${w.slug}`} key={w.slug}>
              <div className="featured-image" style={{ aspectRatio: `${w.w} / ${w.h}` }}>
                <img src={w.image} alt={w.title} loading="lazy" />
              </div>
              <div>
                <h3>{w.title}</h3>
                <span>{yearLabel(w, t.lightbox.circa)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-artist">
        <Link className="home-artist-image" to={`${to("/work")}/${PRACTICE.slug}`}>
          <img src={PRACTICE.image} alt={PRACTICE.title} loading="lazy" width={PRACTICE.w} height={PRACTICE.h} />
        </Link>
        <div className="home-artist-copy">
          <p className="eyebrow">{t.home.practiceEyebrow}</p>
          <h2>{t.home.practiceTitle}</h2>
          <p>{t.home.practiceBody}</p>
          <Link className="text-link" to={to("/about")}>
            <span>{t.home.readStory}</span>
            <ArrowIcon />
          </Link>
        </div>
      </section>

      <PageCta eyebrow={t.home.ctaEyebrow} title={t.home.ctaTitle} linkLabel={t.home.ctaLink} />
    </>
  );
}

/** Opens the lightbox when the URL carries a work, e.g. /work/wave-xano-armenter. */
function useLightbox(works: Artwork[]) {
  const { slug } = useParams();
  const index = slug ? works.findIndex((w) => w.slug === slug) : -1;
  return index >= 0 ? index : null;
}

export function WorkPage() {
  const { t, to } = useI18n();
  const active = useLightbox(selected);
  return (
    <>
      <section className="works-section page-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.work.eyebrow}</p>
            <h1>
              {t.work.title[0]}
              <br />
              {t.work.title[1]}
            </h1>
          </div>
          <p className="section-intro">{t.work.intro}</p>
        </div>
        <Mosaic works={selected} base={to("/work")} columns={3} />
      </section>

      <section className="collection-note">
        <div>
          <p className="eyebrow">{t.work.noteEyebrow}</p>
          <h2>{t.work.noteTitle}</h2>
        </div>
        <div className="collection-note-copy">
          <p>{t.work.noteBody1}</p>
          <p>{t.work.noteBody2}</p>
          <Link className="text-link" to={to("/archive")}>
            <span>{t.work.fullArchive}</span>
            <ArrowIcon />
          </Link>
        </div>
      </section>

      <PageCta eyebrow={t.work.ctaEyebrow} title={t.work.ctaTitle} linkLabel={t.work.ctaLink} />
      {active !== null && <Lightbox works={selected} index={active} base={to("/work")} />}
    </>
  );
}

export function ArchivePage() {
  const { t, to } = useI18n();
  const [params, setParams] = useSearchParams();
  const decade = params.get("decade") ?? "";
  const decades = useMemo(() => [...new Set(archive.filter((a) => a.year).map((a) => Math.floor(a.year! / 10) * 10))].sort((a, b) => b - a), []);
  const works = useMemo(
    () => (decade === "" ? archive : decade === "none" ? archive.filter((a) => !a.year) : archive.filter((a) => a.year && Math.floor(a.year / 10) * 10 === Number(decade))),
    [decade],
  );
  const active = useLightbox(works);
  const base = to("/archive");
  const pick = (d: string) => setParams(d ? { decade: d } : {}, { replace: true, preventScrollReset: true });

  return (
    <>
      <section className="works-section page-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.archive.eyebrow}</p>
            <h1>
              {t.archive.title[0]}
              <br />
              {t.archive.title[1]}
            </h1>
          </div>
          <p className="section-intro">{t.archive.intro}</p>
        </div>
        <div className="archive-filters" role="group" aria-label={t.nav.archive}>
          <button type="button" aria-pressed={decade === ""} onClick={() => pick("")}>
            {t.archive.all}
          </button>
          {decades.map((d) => (
            <button type="button" key={d} aria-pressed={decade === String(d)} onClick={() => pick(String(d))}>
              {d}s
            </button>
          ))}
          {archive.some((a) => !a.year) && (
            <button type="button" aria-pressed={decade === "none"} onClick={() => pick("none")}>
              {t.archive.undated}
            </button>
          )}
          <span>{t.archive.count(works.length)}</span>
        </div>
        <Mosaic works={works} base={base} search={decade ? `?decade=${decade}` : ""} columns={4} />
      </section>
      <PageCta eyebrow={t.work.ctaEyebrow} title={t.work.ctaTitle} linkLabel={t.work.ctaLink} />
      {active !== null && <Lightbox works={works} index={active} base={base} />}
    </>
  );
}

export function AboutPage() {
  const { t, to } = useI18n();
  return (
    <>
      <section className="interlude" aria-label={t.about.closingEyebrow}>
        <blockquote>{t.about.quote}</blockquote>
        <svg className="statement-line" viewBox="0 0 600 80" aria-hidden="true">
          <path d="M10 43c57-30 105 24 164-3s105-26 160 2 100 18 139-3 75-14 117 1" />
        </svg>
      </section>

      <section className="about-section">
        <div className="about-label">
          <p className="eyebrow">{t.about.eyebrow}</p>
          <span className="about-number">XA</span>
        </div>
        <div className="about-copy">
          <h1>{t.about.title}</h1>
          <div className="about-columns">
            <p>{t.about.p1}</p>
            <p>{t.about.p2}</p>
          </div>
          <Link className="text-link" to={to("/contact")}>
            <span>{t.about.enquiries}</span>
            <ArrowIcon />
          </Link>
        </div>
      </section>

      <section className="practice-section">
        <div className="practice-image">
          <PortraitSplash />
        </div>
        <div className="practice-copy">
          <p className="eyebrow">{t.about.citiesEyebrow}</p>
          <h2>{t.about.citiesTitle}</h2>
          <div className="practice-list">
            {t.about.cities.map((c) => (
              <article key={c.n}>
                <span>{c.n}</span>
                <div>
                  <h3>{c.h}</h3>
                  <p>{c.p}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="practice-today">{t.about.today}</p>
        </div>
      </section>

      <section className="about-closing">
        <p className="eyebrow">{t.about.closingEyebrow}</p>
        <p>{t.about.closing}</p>
      </section>

      <section className="cv-section">
        <div className="contact-details-heading">
          <p className="eyebrow">{t.about.cvEyebrow}</p>
          <h2>{t.about.cvTitle}</h2>
        </div>
        <div className="cv-columns">
          {(
            [
              [t.about.solo, soloShows],
              [t.about.commissions, commissions],
            ] as const
          ).map(([title, rows]) => (
            <div key={title}>
              <h3>{title}</h3>
              <ul>
                {rows.map(([year, text]) => (
                  <li key={year + text}>
                    <span>{year}</span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <PageCta eyebrow={t.about.ctaEyebrow} title={t.about.ctaTitle} linkLabel={t.about.ctaLink} />
    </>
  );
}

export function ContactPage() {
  const { t, to, medium } = useI18n();
  const [params] = useSearchParams();
  const work = bySlug(params.get("work") ?? undefined);
  const label = work ? `${work.title}${work.year ? ` (${work.year})` : ""}` : "";
  const mailto = work
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t.contact.subjectWork(label))}&body=${encodeURIComponent(
        t.contact.bodyWork(label, `${window.location.origin}${to("/archive")}/${work.slug}`),
      )}`
    : `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t.contact.subject)}`;

  return (
    <>
      <section className="contact-hero">
        <p className="eyebrow">{t.contact.eyebrow}</p>
        <h1>{t.contact.title}</h1>
        {work && (
          <div className="contact-work">
            <img src={work.thumb} alt="" />
            <div>
              <p className="eyebrow">{t.contact.aboutWork}</p>
              <h2>{work.title}</h2>
              <p>{[medium(work.medium), work.dims, yearLabel(work, t.lightbox.circa)].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        )}
        <a className="contact-email" href={mailto}>
          {work ? t.contact.writeAbout : CONTACT_EMAIL}
          <ArrowIcon />
        </a>
      </section>

      <section className="contact-details">
        <div className="contact-details-heading">
          <p className="eyebrow">{t.contact.detailsEyebrow}</p>
          <h2>{t.contact.detailsTitle}</h2>
        </div>
        <div className="contact-options">
          {t.contact.options.map((o, i) => (
            <article key={o.h}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <h3>{o.h}</h3>
              <p>{o.p}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function PageCta({ eyebrow, title, linkLabel }: { eyebrow: string; title: string; linkLabel: string }) {
  const { to } = useI18n();
  return (
    <section className="page-cta">
      <p className="eyebrow">{eyebrow}</p>
      <div>
        <h2>{title}</h2>
        <Link className="cta-link" to={to("/contact")}>
          <span>{linkLabel}</span>
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

export function NotFoundPage() {
  const { t, to } = useI18n();
  return (
    <section className="not-found">
      <p className="eyebrow">{t.notFound.eyebrow}</p>
      <h1>{t.notFound.title}</h1>
      <Link className="text-link" to={to("/")}>
        <span>{t.notFound.home}</span>
        <ArrowIcon />
      </Link>
    </section>
  );
}
