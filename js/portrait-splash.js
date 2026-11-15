/* =============================================================
   PORTRAIT SPLASH
   Paints the colour blobs onto the black & white portrait one at a
   time. Round blobs fly in and splat (overshoot, squash, a few
   flecks); long blobs are brushed on along their length.

   Usage:
     <div class="portrait-splash" data-splash="js/portrait-splash.json"
          data-base="images/portrait-base.jpg" data-intro="bird"></div>
   data-intro="bird" (optional): a bird flies over and drops the jacket
   splatter first, then the head burst plays.
     <script src="js/portrait-splash.js"></script>

   Starts when scrolled into view. Click/tap the image to replay.
   el.portraitSplash.play() also replays it.
   No dependencies. Respects prefers-reduced-motion.
============================================================= */
(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeInQuad = t => t * t;
  const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
  // small damped spring for the "settle" after impact
  const settle = t => 1 + Math.exp(-6 * t) * Math.cos(11 * t) * 0.16;

  // deterministic random, so every play looks the same
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function mount(host, data, baseSrc) {
    const { width: W, height: H, blobs } = data;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const uid = 'ps' + Math.random().toString(36).slice(2, 7);

    host.style.aspectRatio = W + ' / ' + H;
    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: 'xMidYMid slice',
      role: 'img',
      'aria-label': host.getAttribute('aria-label') || 'Portrait with colourful paint splashes',
    });
    svg.style.cssText = 'display:block;width:100%;height:100%;cursor:pointer';

    const defs = el('defs', {}, svg);
    // paint grain: slightly roughens the blob edges while wet
    const f = el('filter', { id: uid + 'wet', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: '2', seed: '3', result: 'n' }, f);
    const disp = el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '0' }, f);

    const photo = el('image', { href: baseSrc, x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'xMidYMid slice' }, svg);
    const paintLayer = el('g', { filter: `url(#${uid}wet)` }, svg);
    const fleckLayer = el('g', {}, svg);
    host.appendChild(svg);

    // origin of the burst: the top of the head
    const HX = W * 0.66, HY = H * 0.36;
    const rand = rng(7);

    // ---- optional intro: a bird flies over and drops the lapel paint ----
    const bird = host.dataset.intro === 'bird';
    let IPx = 0, IPy = 0, A = 0; // impact point = centre of the lapel splatter
    blobs.forEach(b => { if (b.group === 'lapel') { IPx += b.cx * b.area; IPy += b.cy * b.area; A += b.area; } });
    IPx /= A || 1; IPy /= A || 1;

    let BIRD = null;
    let tB = 650, tL = null; // next start time for burst / lapel blobs
    if (bird) {
      const D = 3200, tb = 600, x0 = -90, x1 = W + 90, y0 = H * 0.17, drift = 26, fall = 860;
      const tr = tb + D * ((IPx - drift) - x0) / (x1 - x0); // release when nearly overhead
      BIRD = { tb, D, x0, x1, y0, tr, fall, drift, impact: tr + fall };
      tL = BIRD.impact;
      tB = BIRD.impact + 1150; // a beat... then the idea hits
    }

    // ---- build a timeline -------------------------------------------
    const items = blobs.map((b, i) => {
      const isLapel = b.group === 'lapel';
      const isStroke = b.elong > 2.4 && b.len > 34;
      const big = Math.sqrt(b.area);
      const dur = isStroke ? 260 + b.len * 2.6 : 300 + big * 2.2;
      let start;
      if (isLapel) {
        if (tL === null) tL = tB + 420;
        start = tL; tL += bird ? 26 : 85;
      } else {
        start = tB;
        // big blobs take a beat longer before the next one hits
        tB += 38 + Math.min(big, 80) * 0.55 + rand() * 30;
      }
      const item = { b, isStroke, start, dur, flecks: [], fromIP: bird && isLapel };

      const path = el('path', { d: b.d, fill: b.fill, opacity: 0 }, paintLayer);
      item.path = path;

      // travel direction (from the head outward / from above for the lapel)
      let vx = b.cx - HX, vy = b.cy - HY;
      if (item.fromIP) { vx = b.cx - IPx; vy = b.cy - IPy; if (Math.hypot(vx, vy) < 1) vy = 1; }
      else if (isLapel) { vx = (b.cx - W * 0.55) * 0.3; vy = 60; }
      const vl = Math.hypot(vx, vy) || 1;
      item.ux = vx / vl; item.uy = vy / vl;

      if (isStroke) {
        // brush it on: a clip rect that grows along the blob's main axis
        const a = (b.angle * Math.PI) / 180;
        let dx = Math.cos(a), dy = Math.sin(a);
        // start from the end nearer the burst origin (or the top for drips)
        const sx = b.cx - dx * b.len / 2, sy = b.cy - dy * b.len / 2;
        const ex = b.cx + dx * b.len / 2, ey = b.cy + dy * b.len / 2;
        const fromStart = b.group === 'lapel'
          ? sy <= ey
          : Math.hypot(sx - HX, sy - HY) <= Math.hypot(ex - HX, ey - HY);
        const ang = fromStart ? b.angle : b.angle + 180;
        const cp = el('clipPath', { id: `${uid}c${i}`, clipPathUnits: 'userSpaceOnUse' }, defs);
        const L = b.len + 40, T = Math.max(b.bbox[2] - b.bbox[0], b.bbox[3] - b.bbox[1]) * 2 + 40;
        const rect = el('rect', {
          x: b.cx - L / 2, y: b.cy - T / 2, width: 0, height: T,
          transform: `rotate(${ang} ${b.cx} ${b.cy})`,
        }, cp);
        path.setAttribute('clip-path', `url(#${uid}c${i})`);
        item.rect = rect; item.L = L;
      } else {
        // a few transient flecks thrown off on impact
        const n = big > 30 ? 3 + Math.floor(rand() * 4) : big > 16 ? 2 : 0;
        for (let k = 0; k < n; k++) {
          const spread = (rand() - 0.5) * 2.4;
          const ca = Math.cos(spread), sa = Math.sin(spread);
          const dx = item.ux * ca - item.uy * sa, dy = item.ux * sa + item.uy * ca;
          const r = 1.5 + rand() * Math.min(big / 9, 5);
          const c = el('circle', { cx: b.cx, cy: b.cy, r, fill: b.fill, opacity: 0 }, fleckLayer);
          item.flecks.push({ c, dx, dy, dist: big * (0.6 + rand() * 0.9) + 14, r });
        }
      }
      return item;
    });
    const total = Math.max(tB, tL || 0, BIRD ? BIRD.tb + BIRD.D : 0) + 900;

    // ---- the bird (drawn facing right, origin at its body) --------------
    let birdG, nearWing, farWing, drop, birdPos;
    if (BIRD) {
      const grad = el('linearGradient', { id: uid + 'drop', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      [['0', '#fffb9a'], ['.3', '#fffb9a'], ['.3', '#17ff56'], ['.55', '#17ff56'], ['.55', '#fe011c'], ['.8', '#fe011c'], ['.8', '#8a30b0'], ['1', '#8a30b0']]
        .forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, grad));
      drop = el('path', { d: 'M0 -10C4 -3 8 2 8 6A8 8 0 0 1 -8 6C-8 2 -4 -3 0 -10Z', fill: `url(#${uid}drop)`, opacity: 0 }, svg);
      birdG = el('g', { opacity: 0 }, svg);
      const ink = '#16161a';
      farWing = el('path', { d: 'M-2 -3C-6 -18 -2 -30 4 -38C8 -26 10 -14 8 -3Z', fill: '#3b3b44' }, birdG);
      el('path', { d: 'M-15 -2L-31 -9L-28 0L-31 7Z', fill: ink }, birdG);                       // tail
      el('ellipse', { cx: 0, cy: 0, rx: 17, ry: 7.5 }, birdG).setAttribute('fill', ink);       // body
      el('circle', { cx: 15, cy: -4, r: 6.5, fill: ink }, birdG);                               // head
      el('path', { d: 'M20.5 -6L29 -3.5L20.5 -1Z', fill: '#ffae22' }, birdG);                   // beak
      el('circle', { cx: 17, cy: -5.5, r: 1.3, fill: '#fff' }, birdG);                          // eye
      nearWing = el('path', { d: 'M-8 -2C-12 -20 -6 -34 6 -44C10 -28 12 -14 6 -1Z', fill: ink }, birdG);
      birdPos = now => {
        const u = (now - BIRD.tb) / BIRD.D;
        let x = BIRD.x0 + (BIRD.x1 - BIRD.x0) * u;
        let y = BIRD.y0 - 40 * u + Math.sin(u * Math.PI * 2.5) * 12;
        if (now > BIRD.tr) y -= 9 * Math.sin(Math.min((now - BIRD.tr) / 260, 1) * Math.PI); // little hop on release
        return { u, x, y };
      };
    }
    function renderBird(now) {
      if (!BIRD) return;
      const { u, x, y } = birdPos(now);
      if (u <= 0 || u >= 1) birdG.setAttribute('opacity', 0);
      else {
        const flap = Math.cos(now / 1000 * Math.PI * 2 * 4.2);
        const tilt = -4 + Math.sin(u * Math.PI * 2.5) * 4;
        birdG.setAttribute('opacity', 1);
        birdG.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(1)}) scale(1.35)`);
        nearWing.setAttribute('transform', `translate(0 -2) scale(1 ${flap.toFixed(3)}) translate(0 2)`);
        farWing.setAttribute('transform', `translate(0 -2) scale(1 ${(flap * 0.8).toFixed(3)}) translate(0 2)`);
      }
      const q = (now - BIRD.tr) / BIRD.fall;
      if (q <= 0 || q >= 1) { drop.setAttribute('opacity', 0); return; }
      const r = birdPos(BIRD.tr);
      const sx = r.x, sy = r.y + 12;
      const dx = sx + BIRD.drift * easeOutCubic(q), dy = sy + (IPy - sy) * q * q;
      drop.setAttribute('opacity', 1);
      drop.setAttribute('transform', `translate(${dx.toFixed(1)} ${dy.toFixed(1)}) scale(${(1.7 * (1 - 0.2 * q)).toFixed(3)} ${(1.7 * (1 + 0.6 * q)).toFixed(3)})`);
    }

    // ---- render a moment in time -------------------------------------
    function render(now) {
      photo.setAttribute('opacity', easeInOutSine(clamp01(now / 600)).toFixed(3));
      let wet = 0;
      for (const it of items) {
        const { b, path } = it;
        const p = (now - it.start) / it.dur;
        if (p <= 0) { path.setAttribute('opacity', 0); if (it.rect) it.rect.setAttribute('width', 0); continue; }

        if (it.isStroke) {
          const q = easeOutCubic(clamp01(p));
          path.setAttribute('opacity', 1);
          it.rect.setAttribute('width', (it.L * q).toFixed(1));
          path.removeAttribute('transform');
          if (p < 1) wet = Math.max(wet, 1 - q);
        } else {
          // flight (0-0.35) -> impact overshoot -> damped settle
          const fly = 0.35;
          let s, ox = 0, oy = 0, sq = 0;
          if (p < fly) {
            const f = easeInQuad(p / fly);
            s = 0.15 + 0.95 * f;
            const back = (1 - f) * (it.fromIP ? Math.hypot(b.cx - IPx, b.cy - IPy) : 22 + Math.sqrt(b.area) * 0.6);
            ox = -it.ux * back; oy = -it.uy * back;
            sq = -0.25 * (1 - f); // stretched along travel while flying
          } else {
            const q = (p - fly) / (1 - fly);
            s = q >= 1 ? 1 : settle(q * 1.4) * (q < 0.08 ? 1.05 : 1);
            sq = q >= 1 ? 0 : 0.18 * Math.exp(-7 * q) * Math.cos(9 * q); // squash on impact
          }
          const ang = Math.atan2(it.uy, it.ux) * 180 / Math.PI;
          const sxv = s * (1 - sq), syv = s * (1 + sq * 0.7);
          path.setAttribute('opacity', Math.min(1, p / 0.12).toFixed(3));
          path.setAttribute('transform',
            p >= 1 ? '' :
            `translate(${(b.cx + ox).toFixed(1)} ${(b.cy + oy).toFixed(1)}) rotate(${ang.toFixed(1)}) ` +
            `scale(${sxv.toFixed(3)} ${syv.toFixed(3)}) rotate(${(-ang).toFixed(1)}) translate(${-b.cx} ${-b.cy})`);
          if (p < 1) wet = Math.max(wet, 1 - p);

          // flecks
          const fp = (now - it.start - it.dur * fly) / 700;
          for (const fl of it.flecks) {
            if (fp <= 0 || fp >= 1) { fl.c.setAttribute('opacity', 0); continue; }
            const e = easeOutCubic(fp);
            fl.c.setAttribute('cx', (b.cx + fl.dx * fl.dist * e).toFixed(1));
            fl.c.setAttribute('cy', (b.cy + fl.dy * fl.dist * e + 30 * fp * fp).toFixed(1));
            fl.c.setAttribute('r', (fl.r * (1 - fp * 0.6)).toFixed(2));
            fl.c.setAttribute('opacity', (1 - easeInQuad(fp)).toFixed(3));
          }
        }
      }
      disp.setAttribute('scale', (wet * 7).toFixed(2));
      renderBird(now);
    }

    // ---- playback ----------------------------------------------------
    let raf = 0, t0 = 0;
    function frame(ts) {
      if (!t0) t0 = ts;
      const now = ts - t0;
      render(now);
      if (now < total) raf = requestAnimationFrame(frame);
      else { render(1e9); paintLayer.removeAttribute('filter'); }
    }
    function play() {
      cancelAnimationFrame(raf);
      paintLayer.setAttribute('filter', `url(#${uid}wet)`);
      t0 = 0;
      raf = requestAnimationFrame(frame);
    }
    function finish() { cancelAnimationFrame(raf); render(1e9); paintLayer.removeAttribute('filter'); }

    if (reduce) { finish(); }
    else {
      render(0);
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { io.disconnect(); play(); }
      }, { threshold: 0.35 });
      io.observe(host);
      svg.addEventListener('click', play);
    }
    host.portraitSplash = { play, finish, duration: total, render };
    return host.portraitSplash;
  }

  async function init(host) {
    const url = host.dataset.splash, base = host.dataset.base;
    const data = await fetch(url).then(r => r.json());
    return mount(host, data, base);
  }

  window.PortraitSplash = { init, mount };
  document.querySelectorAll('[data-splash]').forEach(init);
})();
