import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
// Fonts are bundled with the site, so nothing loads from Google.
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./index.css";
import { initSiteContent } from "./content";
import { builtInCv } from "./cv";
import { DEFAULT_PICKS } from "./data";
import { builtInText } from "./i18n";
import { AboutPage, ArchivePage, ContactPage, HomePage, NotFoundPage, SiteLayout, WorkPage } from "./site";

// The same pages are served in English at "/" and in Spanish under "/es".
const pages: RouteObject[] = [
  { index: true, Component: HomePage },
  { path: "work", Component: WorkPage },
  { path: "work/:slug", Component: WorkPage },
  { path: "archive", Component: ArchivePage },
  { path: "archive/:slug", Component: ArchivePage },
  { path: "about", Component: AboutPage },
  { path: "contact", Component: ContactPage },
  { path: "login", lazy: async () => ({ Component: (await import("./login")).default }) },
  { path: "*", Component: NotFoundPage },
];

const router = createBrowserRouter([
  { path: "/es", Component: SiteLayout, children: pages },
  { path: "/", Component: SiteLayout, children: pages },
]);

// Published website content (Artfolio → Website), and the draft when the site
// is shown inside Artfolio's preview. The editor is sent the site's built-in
// text so it starts from what the site says today.
initSiteContent({
  onNavigate: (path) => void router.navigate(path),
  defaults: () => {
    const text = builtInText();
    return { ...text, home: { ...text.home, ...DEFAULT_PICKS }, cv: builtInCv() };
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
