"""
Split the painted-over portrait into
  1. a clean black & white base photo (paint removed + inpainted), and
  2. one SVG path per paint blob, layered in drawing order,
so the blobs can be animated "hitting the canvas" on the site.

Usage:  python3 tools/extract-paint-splash.py <source-image> <out-dir>
Writes: <out-dir>/portrait-base.jpg  and  <out-dir>/portrait-splash.json
Needs:  pip install opencv-python-headless numpy
"""
import json
import sys

import cv2
import numpy as np

src, out = sys.argv[1], sys.argv[2]
img = cv2.imread(src)[:, :, ::-1]  # RGB

# Crop the white page margins away -> the photo itself.
nonwhite = img.min(2) < 235
cols = np.where(nonwhite.mean(0) > 0.3)[0]
rows = np.where(nonwhite.mean(1) > 0.3)[0]
x0, x1, y0, y1 = cols.min() + 1, cols.max(), rows.min(), rows.max() + 1
img = img[y0:y1, x0:x1].copy()
H, W = img.shape[:2]

# The photo is greyscale, so any chroma at all is paint.
I = img.astype(np.int32)
chroma = I.max(2) - I.min(2)
paint = chroma > 34
paint = cv2.morphologyEx(paint.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

PALETTE = {
    "orange":   (245, 170, 35),
    "yellow":   (250, 222, 0),
    "cream":    (250, 246, 180),
    "red":      (240, 8, 30),
    "magenta":  (242, 10, 128),
    "orchid":   (222, 106, 246),
    "violet":   (132, 104, 246),
    "purple":   (130, 54, 172),
    "green":    (20, 238, 88),
}
names = list(PALETTE)
pal = np.array([PALETTE[n] for n in names], np.int32)

# Classify every paint pixel by its nearest palette colour (hue-ish distance).
d = ((I[:, :, None, :] - pal[None, None]) ** 2).sum(-1)
label = d.argmin(-1)

# Sample the true colour of each class from its confident core pixels.
true_col = {}
for k, n in enumerate(names):
    core = (label == k) & (paint > 0) & (d.min(-1) < 2500) & (chroma > 80)
    if core.sum() > 20:
        c = np.median(I[core], axis=0).astype(int)
    else:
        c = pal[k]
    true_col[n] = "#%02x%02x%02x" % tuple(int(v) for v in c)

blobs = []
for k, n in enumerate(names):
    m = ((label == k) & (paint > 0)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    cnt, cc, stats, cents = cv2.connectedComponentsWithStats(m, 8)
    for i in range(1, cnt):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 18:
            continue
        comp = (cc == i).astype(np.uint8)
        # grow 1px so neighbouring blobs overlap and no seams show
        grown = cv2.dilate(comp, np.ones((3, 3), np.uint8))
        up = cv2.resize(grown * 255, (W * 4, H * 4), interpolation=cv2.INTER_LINEAR)
        up = cv2.GaussianBlur(up, (9, 9), 0)
        _, up = cv2.threshold(up, 127, 255, cv2.THRESH_BINARY)
        contours, hier = cv2.findContours(up, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        d_parts = []
        for c in contours:
            if cv2.contourArea(c) < 16 * 6:
                continue
            c = cv2.approxPolyDP(c, 2.2, True)[:, 0, :] / 4.0
            if len(c) < 3:
                continue
            d_parts.append(c)
        if not d_parts:
            continue
        ys, xs = np.where(comp)
        pts = np.stack([xs, ys], 1).astype(float)
        cx, cy = pts.mean(0)
        # principal axis -> is this a "stroke" or a "splat"?
        cov = np.cov((pts - (cx, cy)).T) if len(pts) > 2 else np.eye(2)
        ev, evec = np.linalg.eigh(cov)
        elong = float(np.sqrt(ev[1] / max(ev[0], 1e-6)))
        ax = evec[:, 1]
        # project to find stroke extent along main axis
        proj = (pts - (cx, cy)) @ ax
        blobs.append({
            "color": n,
            "fill": true_col[n],
            "polys": d_parts,
            "cx": round(float(cx), 1), "cy": round(float(cy), 1),
            "area": int(area),
            "elong": round(elong, 2),
            "angle": round(float(np.degrees(np.arctan2(ax[1], ax[0]))), 1),
            "len": round(float(proj.max() - proj.min()), 1),
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
        })


def catmull(poly):
    """Closed Catmull-Rom spline through the polygon -> smooth cubic bezier path."""
    p = poly
    n = len(p)
    s = "M%.1f %.1f" % tuple(p[0])
    for i in range(n):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        s += "C%.1f %.1f %.1f %.1f %.1f %.1f" % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    return s + "Z"


for b in blobs:
    b["d"] = "".join(catmull(p) for p in b.pop("polys"))

# Layer order: paint on the lower layer first. Where two blobs touch, the
# one whose pixels are on top in the source must be drawn later. Visible masks
# never overlap, so any order reproduces the source; we order by the "burst":
# blobs closest to the top of the head land first and spray outwards, the
# lapel splatter lands last.
HEAD = (W * 0.62, H * 0.33)
for b in blobs:
    lapel = b["cy"] > H * 0.75
    dist = np.hypot(b["cx"] - HEAD[0], b["cy"] - HEAD[1])
    b["group"] = "lapel" if lapel else "burst"
    b["order"] = (1e4 if lapel else 0) + dist - min(b["area"], 4000) / 40.0
blobs.sort(key=lambda b: b["order"])
for b in blobs:
    del b["order"]

# Clean base photo: inpaint where the paint was.
mask = cv2.dilate(paint, np.ones((5, 5), np.uint8), iterations=2) * 255
grey = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
base = cv2.inpaint(grey, mask, 9, cv2.INPAINT_TELEA)
# soften the inpainted patch so it reads as out-of-focus background
blur = cv2.GaussianBlur(base, (0, 0), 6)
soft = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 4)
base = (base * (1 - soft) + blur * soft).astype(np.uint8)
cv2.imwrite(f"{out}/portrait-base.jpg", base, [cv2.IMWRITE_JPEG_QUALITY, 86])
cv2.imwrite(f"{out}/portrait-original-crop.png", img[:, :, ::-1])

json.dump({"width": W, "height": H, "blobs": blobs}, open(f"{out}/portrait-splash.json", "w"))
print(W, H, len(blobs), "blobs", true_col)
