/* ==========================================================================
   Gallery — loads artwork from JSON, renders grid, handles filtering + modal
   ========================================================================== */

(function () {
  'use strict';

  // --- State ---
  let artworks = [];
  let activeFilter = 'all';
  let activePeriodFrom = null;
  let activePeriodTo = null;
  let showSavedOnly = false;
  let saved = new Set(JSON.parse(localStorage.getItem('xano-saved') || '[]'));

  function persistSaved() {
    localStorage.setItem('xano-saved', JSON.stringify([...saved]));
  }

  // --- DOM refs ---
  const grid = document.getElementById('galleryGrid');
  const filtersContainer = document.getElementById('galleryFilters');
  const periodsContainer = document.getElementById('galleryPeriods');
  const savedToggle = document.getElementById('savedToggle');
  const savedLabel = document.getElementById('savedLabel');
  const emptyState = document.getElementById('galleryEmpty');
  const modal = document.getElementById('artworkModal');
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const modalMeta = document.getElementById('modalMeta');
  const modalDimensions = document.getElementById('modalDimensions');
  const modalSubject = document.getElementById('modalSubject');
  const modalLink = document.getElementById('modalLink');
  const modalClose = document.getElementById('modalClose');

  // --- Load artwork data ---
  fetch('js/artwork.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      artworks = data;
      buildFilters();
      renderGallery();
    })
    .catch(function (err) {
      console.error('Failed to load artwork data:', err);
      grid.innerHTML = '<p style="color: rgba(255,255,255,0.5); grid-column: 1/-1; text-align: center; padding: 4rem 0;">Gallery loading&hellip;</p>';
    });

  // --- Build filter buttons from artwork data ---
  function buildFilters() {
    // Collect unique subjects
    var subjects = {};
    artworks.forEach(function (a) {
      if (a.subject) {
        subjects[a.subject] = true;
      }
    });

    var subjectList = Object.keys(subjects).sort();

    // Clear existing filters (keep "All")
    filtersContainer.innerHTML = '';

    // "All" button
    var allBtn = document.createElement('button');
    allBtn.className = 'gallery__filter active';
    allBtn.setAttribute('data-filter', 'all');
    allBtn.textContent = 'All';
    filtersContainer.appendChild(allBtn);

    // Subject filters
    subjectList.forEach(function (subject) {
      var btn = document.createElement('button');
      btn.className = 'gallery__filter';
      btn.setAttribute('data-filter', subject);
      btn.textContent = subject;
      filtersContainer.appendChild(btn);
    });

    // Attach click handlers
    filtersContainer.addEventListener('click', function (e) {
      if (!e.target.classList.contains('gallery__filter')) return;

      // Update active state
      filtersContainer.querySelectorAll('.gallery__filter').forEach(function (b) {
        b.classList.remove('active');
      });
      e.target.classList.add('active');

      activeFilter = e.target.getAttribute('data-filter');
      renderGallery();
    });
  }

  // --- Period filter ---
  function parseYear(raw) {
    if (!raw) return null;
    return parseInt(String(raw).replace(/\D/g, ''), 10) || null;
  }

  periodsContainer.addEventListener('click', function (e) {
    var btn = e.target.closest('.gallery__period');
    if (!btn) return;
    periodsContainer.querySelectorAll('.gallery__period').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activePeriodFrom = btn.dataset.from ? parseInt(btn.dataset.from, 10) : null;
    activePeriodTo = btn.dataset.to ? parseInt(btn.dataset.to, 10) : null;
    renderGallery();
  });

  // --- Saved filter ---
  function updateSavedToggle() {
    savedToggle.classList.toggle('active', showSavedOnly);
    savedLabel.textContent = saved.size > 0 ? 'Saved (' + saved.size + ')' : 'Saved';
  }

  savedToggle.addEventListener('click', function () {
    showSavedOnly = !showSavedOnly;
    updateSavedToggle();
    renderGallery();
  });

  updateSavedToggle();

  // --- Render gallery grid ---
  function renderGallery() {
    var filtered = activeFilter === 'all'
      ? artworks
      : artworks.filter(function (a) { return a.subject === activeFilter; });

    if (activePeriodFrom !== null || activePeriodTo !== null) {
      filtered = filtered.filter(function (a) {
        var y = parseYear(a.year);
        if (!y) return false;
        if (activePeriodFrom !== null && y < activePeriodFrom) return false;
        if (activePeriodTo !== null && y > activePeriodTo) return false;
        return true;
      });
    }

    if (showSavedOnly) {
      filtered = filtered.filter(function (a) { return saved.has(a.title); });
    }

    grid.innerHTML = '';
    emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach(function (artwork) {
      var item = document.createElement('div');
      var isSaved = saved.has(artwork.title);
      var heartSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';

      if (artwork.image) {
        item.className = 'gallery__item';
        item.innerHTML =
          '<img src="' + artwork.image + '" alt="' + escapeHtml(artwork.title) + '" loading="lazy">' +
          '<button class="gallery__item-save' + (isSaved ? ' saved' : '') + '" aria-label="Save artwork">' + heartSvg + '</button>' +
          '<div class="gallery__item-overlay">' +
            '<span class="gallery__item-title">' + escapeHtml(artwork.title) + '</span>' +
            '<span class="gallery__item-meta">' + escapeHtml(buildMeta(artwork)) + '</span>' +
          '</div>';
      } else {
        item.className = 'gallery__item gallery__item--placeholder';
        item.innerHTML =
          '<button class="gallery__item-save' + (isSaved ? ' saved' : '') + '" aria-label="Save artwork">' + heartSvg + '</button>' +
          '<span class="gallery__item-title">' + escapeHtml(artwork.title) + '</span>' +
          '<span class="gallery__item-meta">' + escapeHtml(buildMeta(artwork)) + '</span>';
      }

      var saveBtn = item.querySelector('.gallery__item-save');
      saveBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (saved.has(artwork.title)) {
          saved.delete(artwork.title);
          saveBtn.classList.remove('saved');
        } else {
          saved.add(artwork.title);
          saveBtn.classList.add('saved');
        }
        persistSaved();
        updateSavedToggle();
        if (showSavedOnly) renderGallery();
      });

      item.addEventListener('click', function () {
        openModal(artwork);
      });

      grid.appendChild(item);
    });
  }

  // --- Modal ---
  function openModal(artwork) {
    if (artwork.image) {
      modalImage.src = artwork.image;
      modalImage.alt = artwork.title;
      modalImage.parentElement.style.display = 'flex';
    } else {
      modalImage.src = '';
      modalImage.parentElement.style.display = 'none';
    }

    modalTitle.textContent = artwork.title;
    modalMeta.textContent = buildMeta(artwork);
    modalDimensions.textContent = artwork.dimensions || '';
    modalSubject.textContent = artwork.subject ? 'Subject: ' + artwork.subject : '';

    if (artwork.aa_url) {
      modalLink.href = artwork.aa_url;
      modalLink.style.display = 'inline-block';
    } else {
      modalLink.style.display = 'none';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  // --- Zoom overlay ---
  var zoomOverlay = document.getElementById('zoomOverlay');
  var zoomImage = document.getElementById('zoomImage');
  var zoomClose = document.getElementById('zoomClose');
  var zoomReset = document.getElementById('zoomReset');
  var zoomHint = document.getElementById('zoomHint');

  var zoom = 1;
  var panX = 0;
  var panY = 0;
  var fitZoom = 1;
  var isDragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var panStartX = 0;
  var panStartY = 0;
  var hintTimer = null;

  // Touch pinch state
  var lastTouchDist = null;
  var lastTouchMidX = 0;
  var lastTouchMidY = 0;

  var MIN_ZOOM = 0.1;
  var MAX_ZOOM = 8;

  function applyTransform() {
    zoomImage.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoom + ')';
  }

  function centerFit() {
    var ow = zoomOverlay.clientWidth;
    var oh = zoomOverlay.clientHeight;
    var iw = zoomImage.naturalWidth;
    var ih = zoomImage.naturalHeight;
    fitZoom = Math.min(ow / iw, oh / ih);
    zoom = fitZoom;
    panX = (ow - iw * zoom) / 2;
    panY = (oh - ih * zoom) / 2;
    applyTransform();
  }

  function openZoom(src, alt) {
    zoomImage.alt = alt || '';
    zoomOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (zoomImage.src === src && zoomImage.naturalWidth > 0) {
      centerFit();
    } else {
      zoomImage.src = src;
      zoomImage.onload = centerFit;
    }

    zoomHint.style.opacity = '1';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { zoomHint.style.opacity = '0'; }, 2500);
  }

  function closeZoom() {
    zoomOverlay.classList.remove('active');
    isDragging = false;
    lastTouchDist = null;
  }

  function resetZoom() {
    centerFit();
  }

  // Open zoom on image click
  modalImage.addEventListener('click', function () {
    if (modalImage.src) {
      openZoom(modalImage.src, modalImage.alt);
    }
  });

  zoomClose.addEventListener('click', closeZoom);
  zoomReset.addEventListener('click', resetZoom);

  // Mouse wheel zoom
  zoomOverlay.addEventListener('wheel', function (e) {
    e.preventDefault();
    var rect = zoomOverlay.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;

    var delta = e.deltaY < 0 ? 1.12 : 0.89;
    var newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * delta));

    // Zoom toward cursor position
    panX = mouseX - (mouseX - panX) * (newZoom / zoom);
    panY = mouseY - (mouseY - panY) * (newZoom / zoom);
    zoom = newZoom;
    applyTransform();
  }, { passive: false });

  // Mouse drag to pan
  zoomOverlay.addEventListener('mousedown', function (e) {
    if (e.target === zoomClose || e.target === zoomReset) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    zoomOverlay.classList.add('dragging');
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    panX = panStartX + (e.clientX - dragStartX);
    panY = panStartY + (e.clientY - dragStartY);
    applyTransform();
  });

  window.addEventListener('mouseup', function () {
    if (isDragging) {
      isDragging = false;
      zoomOverlay.classList.remove('dragging');
    }
  });

  // Touch support
  zoomOverlay.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    } else if (e.touches.length === 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      panStartX = panX;
      panStartY = panY;
      lastTouchDist = null;
    }
  }, { passive: true });

  zoomOverlay.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (e.touches.length === 2 && lastTouchDist !== null) {
      var dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      var rect = zoomOverlay.getBoundingClientRect();
      var originX = midX - rect.left;
      var originY = midY - rect.top;

      var scale = dist / lastTouchDist;
      var newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * scale));

      panX = originX - (originX - panX) * (newZoom / zoom);
      panY = originY - (originY - panY) * (newZoom / zoom);
      zoom = newZoom;

      panX += midX - lastTouchMidX;
      panY += midY - lastTouchMidY;

      lastTouchDist = dist;
      lastTouchMidX = midX;
      lastTouchMidY = midY;
      applyTransform();
    } else if (e.touches.length === 1 && isDragging) {
      panX = panStartX + (e.touches[0].clientX - dragStartX);
      panY = panStartY + (e.touches[0].clientY - dragStartY);
      applyTransform();
    }
  }, { passive: false });

  zoomOverlay.addEventListener('touchend', function () {
    isDragging = false;
    lastTouchDist = null;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (zoomOverlay.classList.contains('active')) {
        closeZoom();
      } else if (modal.classList.contains('active')) {
        closeModal();
      }
    }
  });

  // --- Navigation ---
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  // Scroll effect
  window.addEventListener('scroll', function () {
    if (window.scrollY > 80) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
  });

  // Mobile menu
  navToggle.addEventListener('click', function () {
    navLinks.classList.toggle('open');
  });

  // Close mobile menu on link click
  navLinks.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navLinks.classList.remove('open');
    });
  });

  // --- Exhibition tabs ---
  var tabButtons = document.querySelectorAll('.exhibitions__tab');
  var tabPanels = document.querySelectorAll('.exhibitions__panel');

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-tab');

      tabButtons.forEach(function (b) { b.classList.remove('active'); });
      tabPanels.forEach(function (p) { p.classList.remove('active'); });

      btn.classList.add('active');
      document.getElementById('panel-' + target).classList.add('active');
    });
  });

  // --- Helpers ---
  function buildMeta(artwork) {
    var parts = [];
    if (artwork.medium) parts.push(artwork.medium);
    if (artwork.year) parts.push(artwork.year);
    return parts.join(', ');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
