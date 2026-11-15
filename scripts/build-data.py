#!/usr/bin/env python3
"""Builds src/data/artworks.json (what the site reads) from data/artwork.json
(the catalogue exported from Artwork Archive). Run after changing the catalogue
or the SELECTED / HIDDEN lists below:  python3 scripts/build-data.py"""
import json, re
from PIL import Image

# Shown on the Selected work page, in this order.
SELECTED = """wave-xano-armenter ultramar-4-underwater-4 agora-xano-armenter pampagulles
ultramar-2-underwater-2 en-el-aire-xano-armenter about-the-future sense-parets
la-cova-dels-colors-retina-2 public-and-private ultramar-3 celebration-xano-armenter
pintar-la-natura-2 the-club-xano-armenter tornar-al-origen red-table-with-yellow-bird
caterina-xano-armenter pintar-la-natura seres-invisibles big-move les-ferreres
martini-lady-xano-armenter jerry-s-lab plantas-xano-armenter""".split()
# Left out of the site entirely (photo of the work hanging in a room, not the work).
HIDDEN = {"beach-xano-armenter"}

MEDIUM_FIX = {"Acrilico sobre telaL": "Acrylic on canvas", "Ink On Paper": "Ink on paper"}

src = json.load(open("data/artwork.json"))
out, notes = [], []
for a in src:
    if not a.get("image") or a["slug"] in HIDDEN:
        continue
    w, h = Image.open("public/" + a["image"].removeprefix("images/")).size
    ratio = w / h
    year = re.search(r"\d{4}", a.get("year") or "")
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", a.get("dimensions") or "")][:2]
    cm = None
    if len(nums) == 2:
        # The catalogue mixes "height x width" and "width x height": let the
        # image decide which number is which.
        long, short = max(nums), min(nums)
        hw = (long, short) if ratio < 1 else (short, long)
        if abs((hw[1] / hw[0]) - ratio) / ratio < 0.15:
            cm = {"h": hw[0], "w": hw[1]}
        else:
            notes.append(f"{a['title']}: '{a['dimensions']}' does not match the image; dimensions left out")
    out.append({
        "slug": a["slug"], "title": a["title"].strip(),
        "year": int(year.group()) if year else None,
        "circa": (a.get("year") or "").startswith("~"),
        "medium": MEDIUM_FIX.get(a.get("medium"), a.get("medium")),
        "subject": a.get("subject"), "cm": cm,
        # Text shown to visitors. Kept when the image is a catalogue scan (so the
        # proportions differ); dropped when the catalogue value is a typo.
        "dims": (f"{cm['h']:g} × {cm['w']:g} cm" if cm else
                 f"{nums[0]:g} × {nums[1]:g} cm" if len(nums) == 2 and min(nums) >= 20 else None),
        "image": "/" + a["image"].removeprefix("images/"),
        "thumb": "/" + a["thumb"].removeprefix("images/"),
        "w": w, "h": h,
        "selected": SELECTED.index(a["slug"]) if a["slug"] in SELECTED else None,
    })
missing = [s for s in SELECTED if s not in {o["slug"] for o in out}]
assert not missing, missing
json.dump(out, open("src/data/artworks.json", "w"), indent=1, ensure_ascii=False)
print(len(out), "works;", sum(o["selected"] is not None for o in out), "selected;", sum(o["cm"] is None for o in out), "without dimensions")
print("\n".join(notes))
