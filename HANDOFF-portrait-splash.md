# Handoff: animated paint-splash portrait

Branch: `claude/adoring-cerf-xu5evm` (2 commits ahead of `main`, pushed, no PR yet)

## What exists

A black and white portrait of Xano looking up. About 69 flat paint blobs land on it one at a time, mostly bursting out of the top of his head ("mind expanding"), plus a splatter on his jacket. Round blobs fly in, squash on impact and throw off small flecks that fade. Long blobs (swooshes, drips) are brushed on along their length. The final frame matches the source artwork almost pixel for pixel.

There's an optional **bird intro** (`data-intro="bird"`). A bird crosses the sky and drops a paint blob onto his jacket, where it splats into the jacket splatter. After about 1 second the head burst plays.

It's live in the **About** section, in place of the artwork image that was shown there, **with the bird intro on**.

| | |
|---|---|
| Duration | ~7 s plain, ~9 s with the bird |
| Trigger | when 35% of the image is in view, once (IntersectionObserver) |
| Replay | click the image, or call `el.portraitSplash.play()` |
| Reduced motion | shows the finished frame, no animation |
| Dependencies | none (plain JS and SVG; the site's GSAP and Lenis aren't used) |

## Files

| File | Purpose |
|---|---|
| `js/portrait-splash.js` | The component. Builds the SVG, the timeline and the bird, and renders with requestAnimationFrame. |
| `js/portrait-splash.json` | Blob data: smoothed SVG path, colour, centroid, area, elongation, angle, group (`burst` / `lapel`). |
| `images/portrait-base.jpg` | Photo with the paint removed and the gaps filled in (686×976). |
| `tools/extract-paint-splash.py` | Regenerates the two files above from any painted-over B&W photo. |
| `index.html` | `#aboutImage` carries the `data-*` attributes; the script tag is just before `</body>`; the old `initAboutImage()` was removed. |

Markup:
```html
<div class="about__image" id="aboutImage"
     data-splash="js/portrait-splash.json"
     data-base="images/portrait-base.jpg"
     data-intro="bird"
     aria-label="Xano Armenter looking up, with colourful paint bursting from his head"></div>
<script src="js/portrait-splash.js"></script>
```
Remove `data-intro="bird"` to get the plain version.

Regenerate the assets:
```bash
pip install opencv-python-headless numpy
python3 tools/extract-paint-splash.py <source-image> <out-dir>
# then copy <out-dir>/portrait-base.jpg -> images/, portrait-splash.json -> js/
```
The script treats any colour as paint, which works because the photo is greyscale. It snaps each paint pixel to a 9-colour palette, splits the blobs into separate shapes, traces smooth outlines and fills in the photo underneath.

### Tuning knobs (in `portrait-splash.js`)
- **Stagger between head-burst blobs:** `tB += 38 + Math.min(big, 80) * 0.55 + rand() * 30`
- **Blob durations:** `dur = isStroke ? 260 + len*2.6 : 300 + big*2.2`
- **Burst origin:** `HX, HY`
- **Bird timing:** `BIRD = { tb, D, x0, x1, y0, drift, fall }`. `tB = impact + 1150` is the pause between the jacket splat and the head burst.
- **Wet-edge strength:** `disp.setAttribute('scale', wet * 7)`

## Open issues (from the UX review, checked against screenshots)

Ranked. None of these are fixed yet.

1. **The photo is invisible until the animation starts.** `render(0)` sets the photo to opacity 0, so on phones visitors see an empty dark box under the bio.
   *Fix:* the photo starts at opacity 1; only the paint animates.
2. **On desktop the whole frame doesn't fit on screen.** The image is about 840px tall at 1440×900, so the jacket splatter is below the fold while the burst plays. The image-and-stats column also no longer stays in place while you scroll, because it's taller than the viewport.
   *Fix:* `max-height: min(70vh, 640px)` (or a width cap) on `.about__image`, so the full frame and the stats fit.
3. **On phones the portrait sits after two screens of bio text.**
   *Fix:* under 900px wide, put the image above the bio (`order: -1`), at about 85vw.
4. **Too long.** *Target:* 3.5–4.5 s for the plain version (halve the stagger). Trigger at about 60% visible.
5. **Replay can't be found.**
   *Fix:* make the image a `<button>` (keyboard and focus style), add a small "↻ replay" chip and `cursor: pointer`.
6. **Robustness and performance:**
   - Handle a failed JSON fetch by falling back to a static image.
   - Pause the animation when the tab or element is off-screen.
   - Test on a mid-range Android phone. The wet-edge displacement filter is the expensive part, so drop it on low-end devices if needed.
7. **The bird is a judgement call.** Both reviewers recommend keeping it **off** the default About load: bird poop clashes with the tone for collectors and curators, and he needs to approve it since it's his face.
   *Suggested:* play the plain version first and the bird only on replay (easter egg), or use it on a 404 page or social reel. Waiting on the site owner's decision.

## Other placements recommended
- **Social sharing image:** a 1200×630 crop of the final frame. The site has no `og:image` today.
- **404 page:** the playful bird version, looping, with a pause control. There's no 404 page yet.
- **Contact section on desktop:** the finished frame, static.
- **Avoid** the hero (it already rotates artwork, and his work should come first) and the loading screen (it has a 2.8 s budget).

## Unrelated site issues noticed
- **Contact form:** it can't send, because the endpoint is still `https://formspree.io/f/YOUR_FORM_ID` (index.html ~L1597). On phones it also runs off the right edge of the screen; try `minmax(0,1fr)` on `.connect__grid` and `.connect__form-row`.
- **Inventory PDF:** `images/InventoryReport-xano-armenter-20260416190206.pdf` (4.7 MB) would be public once deployed. Check it for prices or collector data.
- **Unused files:** `css/style.css` and `js/gallery.js` aren't referenced; all CSS and JS is inline in `index.html`.
- **Footer** still says © 2025.

## Previewing locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000/#about
```
The page loads GSAP and Lenis from CDNs. In sandboxes that block them, the rest of the page's script fails ("Lenis is not defined"). The splash component still works, because it's independent.
