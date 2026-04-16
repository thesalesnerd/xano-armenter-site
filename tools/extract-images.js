/**
 * IMAGE EXTRACTOR FOR ARTWORK ARCHIVE
 *
 * Run this in your browser console while on Xano's AA profile page:
 * https://www.artworkarchive.com/profile/xano-armenter
 *
 * HOW TO USE:
 * 1. Open the profile page in Chrome
 * 2. Open DevTools (Cmd+Option+I)
 * 3. Go to Console tab
 * 4. Paste this entire script and press Enter
 * 5. It will extract all artwork image URLs and download a JSON file
 *
 * Then give me the downloaded JSON and I'll update the site.
 */

(async function() {
  console.log('🎨 Starting image extraction...');

  // Step 1: Collect all artwork links from the current page
  const artworkLinks = [...document.querySelectorAll('a[href*="/artwork/"]')]
    .map(a => a.href)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  console.log(`Found ${artworkLinks.length} artwork links on this page.`);

  // Check if there are more pages
  const pageLinks = [...document.querySelectorAll('a')]
    .filter(a => a.href.includes('page='))
    .map(a => a.href)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  if (pageLinks.length > 0) {
    console.log(`⚠️ There are ${pageLinks.length} additional pages. Run this on each page, or scroll to load all items first.`);
  }

  // Step 2: Get images from the thumbnail grid on this page
  const results = [];
  const images = document.querySelectorAll('img');

  images.forEach(img => {
    const src = img.src || img.dataset.src || '';
    if (src && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
      // Try to find the associated artwork link
      const parent = img.closest('a');
      const href = parent ? parent.href : null;
      const slug = href ? href.split('/artwork/').pop() : null;

      // Get the highest resolution version
      let hiRes = src;
      // AA often uses query params for sizing — try to get full size
      if (src.includes('?')) {
        hiRes = src.split('?')[0];
      }

      if (slug) {
        results.push({
          slug: slug,
          imageUrl: hiRes,
          thumbnailUrl: src
        });
      }
    }
  });

  // Also check for background images in style attributes
  document.querySelectorAll('[style*="background-image"]').forEach(el => {
    const style = el.style.backgroundImage;
    const match = style.match(/url\(["']?(.+?)["']?\)/);
    if (match) {
      const parent = el.closest('a');
      const href = parent ? parent.href : null;
      const slug = href ? href.split('/artwork/').pop() : null;
      if (slug) {
        results.push({
          slug: slug,
          imageUrl: match[1],
          thumbnailUrl: match[1]
        });
      }
    }
  });

  console.log(`Extracted ${results.length} images from this page.`);
  console.log('Results:', results);

  // Step 3: Download as JSON
  const blob = new Blob([JSON.stringify(results, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'xano-artwork-images.json';
  a.click();
  URL.revokeObjectURL(url);

  console.log('✅ Downloaded xano-artwork-images.json');
  console.log('');
  console.log('NEXT: Give this file to Claude to update the website.');

  // Also log a simple table for quick review
  console.table(results.map(r => ({ slug: r.slug, url: r.imageUrl.substring(0, 80) + '...' })));
})();
