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
  { path: "*", Component: NotFoundPage },
];

const router = createBrowserRouter([
  { path: "/es", Component: SiteLayout, children: pages },
  { path: "/", Component: SiteLayout, children: pages },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
