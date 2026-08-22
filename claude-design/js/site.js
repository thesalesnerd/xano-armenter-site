// Shared site behaviors: header scroll state, mobile nav, current-page marker,
// graceful image-loading (hide broken images so fallback backgrounds show).

(function () {
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 4) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const nav = document.querySelector("nav.main-nav");
  const toggle = document.querySelector(".nav-toggle");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }

  const path = (location.pathname.replace(/\/$/, "").split("/").pop() || "index.html");
  document.querySelectorAll("nav.main-nav a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href === path || (path === "" && href === "index.html")) {
      a.setAttribute("aria-current", "page");
    }
  });

  if (typeof PAINTER_NAME !== "undefined") {
    document.querySelectorAll(".wordmark").forEach((el) => {
      el.textContent = PAINTER_NAME;
    });
  }

  function show(img) {
    img.style.visibility = "";
    img.setAttribute("data-loaded", "true");
    if (img.parentElement) img.parentElement.classList.remove("img-failed");
  }
  function hide(img) {
    img.style.visibility = "hidden";
    img.setAttribute("data-loaded", "false");
    if (img.parentElement) img.parentElement.classList.add("img-failed");
  }
  function handleImage(img) {
    // Skip images without a src — they'll be handled later when src is set.
    if (!img.getAttribute("src")) return;

    if (img.complete) {
      if (img.naturalWidth === 0) hide(img);
      else show(img);
      return;
    }
    // Attach listeners for this src. Listeners auto-clear on next handle.
    const onLoad = () => { show(img); cleanup(); };
    const onError = () => { hide(img); cleanup(); };
    const cleanup = () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
  }

  // Watch for src attribute changes on existing <img> (e.g. the viewer's
  // #piece-image gets its src rewritten by render() on prev/next nav).
  function watchSrcChanges(img) {
    if (img.__srcWatched) return;
    img.__srcWatched = true;
    const attrObserver = new MutationObserver(() => handleImage(img));
    attrObserver.observe(img, { attributes: true, attributeFilter: ["src"] });
  }

  function setup(img) {
    watchSrcChanges(img);
    handleImage(img);
  }

  document.querySelectorAll("img").forEach(setup);

  // Watch for new <img> elements added to the DOM (dynamic grids etc.).
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.tagName === "IMG") setup(n);
        if (n.querySelectorAll) n.querySelectorAll("img").forEach(setup);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
