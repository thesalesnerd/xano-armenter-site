/* ==========================================================================
   Gallery — loads artwork from JSON, renders grid, handles filtering + modal
   ========================================================================== */

(function () {
  'use strict';

  // --- State ---
  let artworks = [];
  let activeFilter = 'all';

  // --- DOM refs ---
  const grid = document.getElementById('galleryGrid');
  const filtersContainer = document.getElementById('galleryFilters');
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

  // --- Render gallery grid ---
  function renderGallery() {
    var filtered = activeFilter === 'all'
      ? artworks
      : artworks.filter(function (a) { return a.subject === activeFilter; });

    grid.innerHTML = '';
    emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach(function (artwork, index) {
      var item = document.createElement('div');

      if (artwork.image) {
        item.className = 'gallery__item';
        item.innerHTML =
          '<img src="' + artwork.image + '" alt="' + escapeHtml(artwork.title) + '" loading="lazy">' +
          '<div class="gallery__item-overlay">' +
            '<span class="gallery__item-title">' + escapeHtml(artwork.title) + '</span>' +
            '<span class="gallery__item-meta">' + escapeHtml(buildMeta(artwork)) + '</span>' +
          '</div>';
      } else {
        item.className = 'gallery__item gallery__item--placeholder';
        item.innerHTML =
          '<span class="gallery__item-title">' + escapeHtml(artwork.title) + '</span>' +
          '<span class="gallery__item-meta">' + escapeHtml(buildMeta(artwork)) + '</span>';
      }

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
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
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
