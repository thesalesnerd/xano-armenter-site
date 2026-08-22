// Xano Armenter — artwork data (103 pieces from Artwork Archive).
// SERIES auto-grouped by year range. SCULPTURE and GRAPHIC_DESIGN are empty
// placeholders — no data for those sections yet.

const PAINTER_NAME = "Xano Armenter";
const PAINTER_TAGLINE = "Paintings — four decades of studio practice";

/**
 * Rewrite an Artwork Archive (Cloudinary) URL to request a specific width.
 * Original URLs contain "/w_1600/" which is overkill for most display sizes.
 * Smaller widths = much faster loads, especially for grid thumbnails.
 *
 * imgAt("…/w_1600/v1/…", 600) → "…/w_600/v1/…"
 * Returns the original URL untouched if no /w_NNN/ segment is found.
 */
function imgAt(url, width) {
  if (!url || typeof url !== "string") return url;
  return url.replace(/\/w_\d+\//, `/w_${width}/`);
}

/**
 * Preload an image in the browser cache. No-op if no URL.
 * Used by the viewer to warm neighbor images so prev/next feels instant.
 */
function preload(url) {
  if (!url) return;
  const img = new Image();
  img.src = url;
}

// Image helpers — rewrite Cloudinary width to what the UI actually needs.
// Artwork Archive delivers /f_auto,q_auto,w_1600/ by default. For viewer and
// grids we ask for smaller files and let f_auto,q_auto serve AVIF/WebP at the
// right quality. Saves roughly 70–85% bytes per image.
function imgAt(url, width) {
  if (!url) return url;
  // Match the /image/upload/.../v1/... path and rewrite width transform.
  return url.replace(/\/image\/upload\/([^/]+)\//, (_m, transforms) => {
    const parts = transforms.split(",").filter((p) => !p.startsWith("w_"));
    parts.push("w_" + width);
    return `/image/upload/${parts.join(",")}/`;
  });
}

// Preload a URL in the background. Browser caches it for next time we set src.
function preloadImage(url) {
  if (!url) return;
  const img = new Image();
  img.src = url;
}

const SERIES = [
  {
    "slug": "early-1978-1989",
    "title": "1978–1989",
    "years": "1978 – 1989",
    "summary": "Early years. Drawing, mark-making, and the first sustained body of paintings.",
    "cover": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3131_e6bunw.jpg",
    "pieces": [
      {
        "title": "Bodegon Amb Marge",
        "year": "~1978",
        "medium": "Oil on canvas",
        "dimensions": "",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3131_e6bunw.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/bodegon-amb-marge"
      },
      {
        "title": "Martini lady",
        "year": "~1978",
        "medium": "Oil on canvas",
        "dimensions": "100 x 81 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3194_bgw8xh.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/martini-lady-xano-armenter"
      },
      {
        "title": "Playa Negra",
        "year": "~1978",
        "medium": "Oil on canvas",
        "dimensions": "114 x 146 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3135_n6tisc.jpg",
        "subject": "",
        "price": "$20,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/playa-negra"
      },
      {
        "title": "Candy fallout",
        "year": "1979",
        "medium": "Oil on canvas",
        "dimensions": "146 x 114 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3164_uprob4.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/candy-fallout"
      },
      {
        "title": "Desnudo",
        "year": "1979",
        "medium": "Oil on canvas",
        "dimensions": "81 x 100 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3191_j8zqph.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/desnudo-xano-armenter"
      },
      {
        "title": "Doce y diez",
        "year": "1979",
        "medium": "Oil on canvas",
        "dimensions": "81 x 100 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3192_jl5zyo.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/doce-y-diez"
      },
      {
        "title": "Plantas",
        "year": "1979",
        "medium": "Oil on canvas",
        "dimensions": "100 x 72 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3166_mtngzq.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/plantas-xano-armenter"
      },
      {
        "title": "Taula de treball",
        "year": "1979",
        "medium": "Oil on canvas",
        "dimensions": "81 x 81 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3190_z76qg0.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/taula-de-treball"
      },
      {
        "title": "Estudi de estudi",
        "year": "1980",
        "medium": "Oil on canvas",
        "dimensions": "146 x 114 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3167_2_gtneou.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/estudi-de-estudi"
      },
      {
        "title": "Dirty dishes",
        "year": "1984",
        "medium": "Oil on canvas",
        "dimensions": "100 x 136 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3108_nzaba5.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/dirty-dishes-xano-armenter"
      },
      {
        "title": "El Bostezo",
        "year": "~1984",
        "medium": "Oil on canvas",
        "dimensions": "92 x 74 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3160_jpiu96.jpg",
        "subject": "",
        "price": "$10,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/el-bostezo"
      },
      {
        "title": "Wallpaper city",
        "year": "~1984",
        "medium": "Acrylic on paper",
        "dimensions": "25 x 46 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3204_2_rhhoeb.jpg",
        "subject": "Urban",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/wallpaper-city"
      },
      {
        "title": "Big Move",
        "year": "~1986",
        "medium": "Oil on canvas",
        "dimensions": "146 x 114 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3163_cb8bpa.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/big-move"
      },
      {
        "title": "Interesting (Red & black)",
        "year": "1986",
        "medium": "Oil on canvas",
        "dimensions": "168 x 123 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3114_ddyzey.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/interesting-red-black"
      },
      {
        "title": "La Visita",
        "year": "~1986",
        "medium": "Oil on canvas",
        "dimensions": "100 x 81 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3127_kqzddg.jpg",
        "subject": "",
        "price": "$30,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/la-visita-xano-armenter"
      },
      {
        "title": "Sink",
        "year": "1986",
        "medium": "Oil on canvas",
        "dimensions": "130 x 122 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3105_ciqgve.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/sink-xano-armenter"
      },
      {
        "title": "The breakfast",
        "year": "1986",
        "medium": "Oil on canvas",
        "dimensions": "134 x 160 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3095_kesyu7.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/the-breakfast"
      },
      {
        "title": "Dos figuras",
        "year": "~1989",
        "medium": "Acrylic on paper",
        "dimensions": "93 x 66 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3182_x7aoeq.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/dos-figuras-xano-armenter"
      },
      {
        "title": "House",
        "year": "1989",
        "medium": "Acrylic on paper",
        "dimensions": "66 x 93 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3183_nsngge.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/house-xano-armenter"
      },
      {
        "title": "No Se Conocen",
        "year": "~1989",
        "medium": "Acrylic on paper",
        "dimensions": "114 x 146 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3126_kpw0ds.jpg",
        "subject": "",
        "price": "$25,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/no-se-conocen"
      }
    ]
  },
  {
    "slug": "1990s",
    "title": "1990–1999",
    "years": "1990 – 1999",
    "summary": "The 1990s. A productive decade returning repeatedly to the figure and the still life.",
    "cover": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3133_ybxudx.jpg",
    "pieces": [
      {
        "title": "La Siesta",
        "year": "1990",
        "medium": "Oil on canvas",
        "dimensions": "",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3133_ybxudx.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/la-siesta-xano-armenter"
      },
      {
        "title": "Painting mix",
        "year": "1990",
        "medium": "Oil on canvas",
        "dimensions": "100 x 80 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3186_y9en8y.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/painting-mix"
      },
      {
        "title": "Paisatge pintat",
        "year": "1990",
        "medium": "Oil on canvas",
        "dimensions": "8 x 100 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3187_pyph4i.jpg",
        "subject": "Landscape",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/paisatge-pintat"
      },
      {
        "title": "The Truck Driver",
        "year": "~1990",
        "medium": "Acrylic on canvas",
        "dimensions": "",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3128_xy9sn0.jpg",
        "subject": "",
        "price": "$18,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/the-truck-driver"
      },
      {
        "title": "Continium",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "81 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3149_2_pfxgnc.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/continium"
      },
      {
        "title": "Graffiti Town",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3125_otiazv.jpg",
        "subject": "",
        "price": "$16,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/graffiti-town-xano-armenter"
      },
      {
        "title": "Hot pipes",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "100 x 81 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3220_stom0z.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/hot-pipes"
      },
      {
        "title": "Ingeni I",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "130 x 180 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3144_gf1vff.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/ingeni-i"
      },
      {
        "title": "Ingeni II",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "180 x 130 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3138_lbnhvt.jpg",
        "subject": "",
        "price": "$16,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/ingeni-ii"
      },
      {
        "title": "Ingeni III",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "180 x 130 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3141_hc2zef.jpg",
        "subject": "",
        "price": "$12,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/ingeni-iii"
      },
      {
        "title": "Ingeni petit",
        "year": "1991",
        "medium": "Acrylic on paper",
        "dimensions": "40 x 33 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3222_y8fm67.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/ingeni-petit"
      },
      {
        "title": "Jerry's Lab",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "100 x 81 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3132_cc0dms.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/jerry-s-lab"
      },
      {
        "title": "La Reserva",
        "year": "1991",
        "medium": "Acrylic on paper",
        "dimensions": "",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3136_pgmzrz.jpg",
        "subject": "",
        "price": "$14,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/la-reserva"
      },
      {
        "title": "Laberint",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "200 x 225 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3143_eggm1j.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/laberint"
      },
      {
        "title": "Laboratori",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "93 x 103 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3158_bz3t2o.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/laboratori"
      },
      {
        "title": "Loop",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "38 x 46 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3118_yrzm94.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/loop-xano-armenter"
      },
      {
        "title": "Mecanic",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "130 x 97 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3155_xnb3bz.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/mecanic"
      },
      {
        "title": "Monotipo",
        "year": "1991",
        "medium": "Ink On Paper",
        "dimensions": "68 x 48 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3224_dlbwwr.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/monotipo-xano-armenter"
      },
      {
        "title": "Red Pipe",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "38 x 46 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3272_kbuy1k.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/red-pipe-xano-armenter"
      },
      {
        "title": "Secret formula",
        "year": "~1991",
        "medium": "Acrylic on canvas",
        "dimensions": "100 x 81 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3153_vlgfsy.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/secret-formula"
      },
      {
        "title": "Sota No",
        "year": "~1991",
        "medium": "",
        "dimensions": "99 x 128 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3165_2_xd2ks9.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/sota-no"
      },
      {
        "title": "The Fool (Retrat)",
        "year": "1991",
        "medium": "Acrylic on canvas",
        "dimensions": "96 x 138 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3140_jhaldl.jpg",
        "subject": "",
        "price": "$16,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/the-fool-retrat"
      },
      {
        "title": "The New Baby",
        "year": "~1992",
        "medium": "Oil on canvas",
        "dimensions": "100 x 81 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3134_nquk07.jpg",
        "subject": "",
        "price": "$30,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/the-new-baby-xano-armenter"
      },
      {
        "title": "The club",
        "year": "1993",
        "medium": "Acrylic on canvas",
        "dimensions": "178 x 122 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3102_j4zr3h.jpg",
        "subject": "Urban",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/the-club-xano-armenter"
      },
      {
        "title": "Lets Dance",
        "year": "~1994",
        "medium": "Acrylic on paper",
        "dimensions": "35 x 62 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3203_3_i1w8up.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/lets-dance-xano-armenter"
      },
      {
        "title": "La mente tambien juega (Opening)",
        "year": "1996",
        "medium": "Acrylic on canvas",
        "dimensions": "92 x 81 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3184_r85olp.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/la-mente-tambien-juega-opening"
      },
      {
        "title": "Studio corner",
        "year": "1997",
        "medium": "Acrylic on canvas",
        "dimensions": "65 x 68 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3281_f9uz1c.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/studio-corner-xano-armenter"
      }
    ]
  },
  {
    "slug": "2000s",
    "title": "2000–2009",
    "years": "2000 – 2009",
    "summary": "A decade of consolidation and quieter, more intentional studio production.",
    "cover": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3264_ukxtwj.jpg",
    "pieces": [
      {
        "title": "Ciutat oberta",
        "year": "2001",
        "medium": "Acrylic on canvas",
        "dimensions": "50 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3264_ukxtwj.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/ciutat-oberta"
      },
      {
        "title": "Red table with yellow bird",
        "year": "~2001",
        "medium": "Acrylic on canvas",
        "dimensions": "114 x 146 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3168_d5yces.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/red-table-with-yellow-bird"
      },
      {
        "title": "Dark hour",
        "year": "2002",
        "medium": "Acrylic on canvas",
        "dimensions": "38 x 46 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_2882_frvyuj.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/dark-hour"
      },
      {
        "title": "Les Ferreres",
        "year": "2002",
        "medium": "Oil on canvas",
        "dimensions": "50 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3267_tuxw6f.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/les-ferreres"
      },
      {
        "title": "Luz blanca / White Light",
        "year": "2002",
        "medium": "Acrylic on canvas",
        "dimensions": "50 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3254_wtmg62.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/luz-blanca-white-ligth"
      },
      {
        "title": "Studio formula",
        "year": "2002",
        "medium": "Acrylic on canvas",
        "dimensions": "60 x 60 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3298_rqae56.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/studio-formula"
      },
      {
        "title": "Abstraccio de paisatge",
        "year": "2004",
        "medium": "Acrylic on canvas",
        "dimensions": "54 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3266_tscskh.jpg",
        "subject": "Abstract",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/abstraccio-de-paisatge"
      },
      {
        "title": "Abstraccio de paisatge 2",
        "year": "2004",
        "medium": "Oil on canvas",
        "dimensions": "54 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3269_l2xarr.jpg",
        "subject": "Abstract",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/abstraccio-de-paisatge-2"
      },
      {
        "title": "Caterina",
        "year": "2004",
        "medium": "Acrylic on canvas",
        "dimensions": "65 x 54 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3260_rabqjo.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/caterina-xano-armenter"
      },
      {
        "title": "Pintar la natura 2",
        "year": "2004",
        "medium": "Acrylic on canvas",
        "dimensions": "65 x 54 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3257_xb9you.jpg",
        "subject": "Landscape",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/pintar-la-natura-2"
      },
      {
        "title": "Tornar al origen",
        "year": "2004",
        "medium": "Acrilico sobre telaL",
        "dimensions": "108 x 92 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3170_ikpuy0.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/tornar-al-origen"
      },
      {
        "title": "Pintar la natura",
        "year": "2005",
        "medium": "Acrylic on canvas",
        "dimensions": "54 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3263_mieqr3.jpg",
        "subject": "Landscape",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/pintar-la-natura"
      },
      {
        "title": "Finestra oberta",
        "year": "2008",
        "medium": "Acrylic on canvas",
        "dimensions": "60 x 73 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3277_rscebi.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/finestra-oberta"
      },
      {
        "title": "Lo viejo y lo nuevo",
        "year": "2008",
        "medium": "Acrylic on canvas",
        "dimensions": "8 x 60 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3274_ijfjou.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/lo-viejo-y-lo-nuevo"
      },
      {
        "title": "Burning Room",
        "year": "2009",
        "medium": "Acrylic on canvas",
        "dimensions": "54 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3253_xatwxg.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/burning-room"
      }
    ]
  },
  {
    "slug": "recent-2010-2018",
    "title": "2010–2018",
    "years": "2010 – 2018",
    "summary": "Recent work. Marine, landscape, urban, and abstract paintings worked in parallel.",
    "cover": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/2011_Broken-Walls_2_150x150_tela_qij1n7.jpg",
    "pieces": [
      {
        "title": "Broken walls 2",
        "year": "2011",
        "medium": "Acrylic on canvas",
        "dimensions": "150 x 150 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/2011_Broken-Walls_2_150x150_tela_qij1n7.jpg",
        "subject": "Abstract",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/broken-walls-2"
      },
      {
        "title": "Celebration",
        "year": "2011",
        "medium": "Oil on canvas",
        "dimensions": "54 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3271_nyklhc.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/celebration-xano-armenter"
      },
      {
        "title": "Close up unit",
        "year": "2011",
        "medium": "Acrylic on canvas",
        "dimensions": "30 x 30 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3299_snyqv1.jpg",
        "subject": "Abstract",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/close-up-unit"
      },
      {
        "title": "Exoplaneta",
        "year": "2011",
        "medium": "Acrylic on canvas",
        "dimensions": "30 x 90 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3214_r9ohwb.jpg",
        "subject": "Abstract",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/exoplaneta"
      },
      {
        "title": "Explorer",
        "year": "2011",
        "medium": "Acrylic on canvas",
        "dimensions": "46 x 38 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/10._2011_Explorer_-_46x38_-_acrilic_sobre_tela_dhcoys.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/explorer-xano-armenter"
      },
      {
        "title": "City 1 and City 2",
        "year": "2012",
        "medium": "Acrylic on canvas",
        "dimensions": "56 x 84 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3211_mlekq3.jpg",
        "subject": "Urban",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/city-1-and-city-2"
      },
      {
        "title": "Drops 1",
        "year": "2012",
        "medium": "Oil on canvas",
        "dimensions": "46 x 38 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/1._2012__Drops_10-_46x38_-_acri%CC%81lic_sobre_tela_egndfm.jpg",
        "subject": "Abstract",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/drops-1"
      },
      {
        "title": "Not nothing",
        "year": "2012",
        "medium": "Oil on canvas",
        "dimensions": "65 x 54 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3256_2_kcxehz.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/not-nothing-xano-armenter"
      },
      {
        "title": "Beach",
        "year": "2013",
        "medium": "iPad print",
        "dimensions": "",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/6BCA6D75-7BE0-4C1E-BCF8-D1699DD4AA2F_2_ctbxfo.jpg",
        "subject": "Landscape",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/beach-xano-armenter"
      },
      {
        "title": "Break More Walls",
        "year": "2013",
        "medium": "Acrylic on canvas",
        "dimensions": "150 x 150 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3209_swvsye.jpg",
        "subject": "Abstract",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/break-more-walls"
      },
      {
        "title": "La riqueza / Content is waiting",
        "year": "2014",
        "medium": "Acrylic on canvas",
        "dimensions": "38 x 46 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/8._2014_Content_in_waiting-_38x46_-_acrilic_sobre_tela_xulvuj.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/la-riqueza-content-is-waiting"
      },
      {
        "title": "Public and private",
        "year": "2014",
        "medium": "Oil on aluminium",
        "dimensions": "50 x 66 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3305_v2ierj.jpg",
        "subject": "Urban",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/public-and-private"
      },
      {
        "title": "Sense parets",
        "year": "2014",
        "medium": "Acrylic on canvas",
        "dimensions": "80 x 80 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/30._2014_Sense_parets_-_80x80_-_acrilic_sobre_tela_iprsl3.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/sense-parets"
      },
      {
        "title": "Agora",
        "year": "2015",
        "medium": "Acrylic on canvas",
        "dimensions": "54 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3117_ig9avt.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/agora-xano-armenter"
      },
      {
        "title": "Carrer ple de gent",
        "year": "2015",
        "medium": "",
        "dimensions": "65 x 54 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/Carrer_ple_66x54_Acri_tela_hafzel.jpg",
        "subject": "Urban",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/carrer-ple-de-gent"
      },
      {
        "title": "Chanel sources",
        "year": "2015",
        "medium": "Acrylic on canvas",
        "dimensions": "46 x 38 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/9._2015_Channel_source_-_46x38_-_acrilic_sobre_tela_m7epu7.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/chanel-sources"
      },
      {
        "title": "En el aire",
        "year": "2015",
        "medium": "Acrylic on canvas",
        "dimensions": "54 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3116_zuimfq.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/en-el-aire-xano-armenter"
      },
      {
        "title": "Seres invisibles",
        "year": "2015",
        "medium": "Acrylic on canvas",
        "dimensions": "54 x 66 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/Seres_invisibles_2015_Acrl_tela_66x54_z6053l.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/seres-invisibles"
      },
      {
        "title": "La cova dels colors (Retina 2)",
        "year": "~2016",
        "medium": "Acrylic on canvas",
        "dimensions": "150 x 150 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/2016_Retina_2_acril_canvas_200x200_j5dfno.jpg",
        "subject": "Abstract",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/la-cova-dels-colors-retina-2"
      },
      {
        "title": "A un poema de Rossend Bonas (serie de 4 piezas)",
        "year": "~2017",
        "medium": "Acrylic on paper",
        "dimensions": "38 x 50 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/26._A_un_poema_de_Rossend_Bona%CC%80s_-_38x50_-_acrilic_sobre_paper_wsoabg.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/a-un-poema-de-rossend-bonas-serie-de-4-piezas"
      },
      {
        "title": "Jo pintor",
        "year": "~2017",
        "medium": "Acrylic on canvas",
        "dimensions": "50 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/34._Jo_pintor_-_50x65_-_oli_sobre_tela_qblcy0.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/jo-pintor"
      },
      {
        "title": "Pampagulles",
        "year": "~2017",
        "medium": "Acrylic on canvas",
        "dimensions": "107 x 91 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/Pampagulles_2017_107x91cm_tpablb.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/pampagulles"
      },
      {
        "title": "Street walkby",
        "year": "~2017",
        "medium": "Oil on aluminium",
        "dimensions": "42 x 59 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3295_by9fif.jpg",
        "subject": "Urban",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/street-walkby"
      },
      {
        "title": "About the future",
        "year": "2018",
        "medium": "Acrylic on canvas",
        "dimensions": "46 x 38 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/13._2018_About_the_future_-_46x38_-_acrilic_sobre_tela_uiccep.jpg",
        "subject": "",
        "price": "$1,500",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/about-the-future"
      },
      {
        "title": "Taula de treball 2",
        "year": "2018",
        "medium": "Acrylic on canvas",
        "dimensions": "55 x 65 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/17._2018_Taula_de_treball_2_-_50x65_-_acrilic_sobre_tela_xmnhrh.jpg",
        "subject": "Still Life",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/taula-de-treball-2"
      },
      {
        "title": "Ultramar 1",
        "year": "2018",
        "medium": "Acrylic on canvas",
        "dimensions": "166 x 128 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/Seascape_1_165x128_Tela_2018_yi43mp.jpg",
        "subject": "Marine",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/ultramar-1"
      },
      {
        "title": "Ultramar 2 / Underwater 2",
        "year": "2018",
        "medium": "Acrylic on canvas",
        "dimensions": "166 x 128 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/Seascape_3_165x128_Tela_2018_vrsh0t.jpg",
        "subject": "Marine",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/ultramar-2-underwater-2"
      },
      {
        "title": "Ultramar 3",
        "year": "2018",
        "medium": "Acrylic on canvas",
        "dimensions": "166 x 128 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/Seascape_2_165x128_Tela_2018_jvjjnm.jpg",
        "subject": "Marine",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/ultramar-3"
      },
      {
        "title": "Ultramar 4 / Underwater 4",
        "year": "2018",
        "medium": "Acrylic on canvas",
        "dimensions": "166 x 128 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/Seascape_4_165x128_Tela_2018_xffzkp.jpg",
        "subject": "Marine",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/ultramar-4-underwater-4"
      },
      {
        "title": "Wave",
        "year": "2018",
        "medium": "Acrylic on canvas",
        "dimensions": "162 x 180 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/Wave_200x210_2018_copia_njihtr.jpg",
        "subject": "Landscape",
        "price": "$5,000",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/wave-xano-armenter"
      }
    ]
  },
  {
    "slug": "undated",
    "title": "Undated works",
    "years": "Undated",
    "summary": "Works on paper and canvas not assigned to a specific year.",
    "cover": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3172_2_hbazb1.jpg",
    "pieces": [
      {
        "title": "Dirty dishes",
        "year": "",
        "medium": "Oil on canvas",
        "dimensions": "100 x 136 cm",
        "image": "",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter"
      },
      {
        "title": "Estudi de estudi",
        "year": "",
        "medium": "Oil on canvas",
        "dimensions": "146 x 114 cm",
        "image": "",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter"
      },
      {
        "title": "Hot pipes",
        "year": "",
        "medium": "Acrylic on canvas",
        "dimensions": "100 x 81 cm",
        "image": "",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter"
      },
      {
        "title": "Ingeni petit",
        "year": "",
        "medium": "Acrylic on paper",
        "dimensions": "40 x 33 cm",
        "image": "",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter"
      },
      {
        "title": "Las abuelas",
        "year": "",
        "medium": "Oil on canvas",
        "dimensions": "",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3172_2_hbazb1.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/las-abuelas"
      },
      {
        "title": "Luz blanca /White Ligth",
        "year": "",
        "medium": "Acrylic on canvas",
        "dimensions": "50 x 65 cm",
        "image": "",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter"
      },
      {
        "title": "Monotipo",
        "year": "",
        "medium": "Ink On Paper",
        "dimensions": "68 x 48 cm",
        "image": "",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter"
      },
      {
        "title": "Multiples realitats",
        "year": "",
        "medium": "Acrylic on canvas",
        "dimensions": "60 x 60 cm",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3284_dimuh4.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/multiples-realitats"
      },
      {
        "title": "Pineda de Olle Pinell",
        "year": "",
        "medium": "",
        "dimensions": "",
        "image": "https://assets.artworkarchive.com/image/upload/f_auto,q_auto,w_1600/v1/user_111754/IMG_3252_wxnnvl.jpg",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter/artwork/pineda-de-olle-pinell"
      },
      {
        "title": "Sense parets",
        "year": "",
        "medium": "Acrylic on canvas",
        "dimensions": "80 x 80 cm",
        "image": "",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter"
      },
      {
        "title": "Seres invisibles",
        "year": "",
        "medium": "Acrylic on canvas",
        "dimensions": "54 x 66 cm",
        "image": "",
        "subject": "",
        "price": "",
        "aa_url": "https://www.artworkarchive.com/profile/xano-armenter"
      }
    ]
  }
];

const SCULPTURE = { summary: "No sculpture listed yet.", pieces: [] };

// Graphic Design — all entries are [Placeholder] fillers until real work is wired in.
const GRAPHIC_DESIGN = {
  summary:
    "[Placeholder] Posters, catalogues, and applied graphic work produced alongside the studio practice.",
  pieces: [
    { title: "[Placeholder] Exhibition poster — Ultramar",       year: 2018, medium: "Offset print", dimensions: "70 × 50 cm", image: "" },
    { title: "[Placeholder] Catalogue — Obra Recent",            year: 2016, medium: "Softcover, 48pp", dimensions: "24 × 17 cm", image: "" },
    { title: "[Placeholder] Book cover — Still Lives",           year: 2014, medium: "Hardcover", dimensions: "23 × 15 cm", image: "" },
    { title: "[Placeholder] Poster — Paintings 2001–2011",       year: 2011, medium: "Silkscreen, 3 colours", dimensions: "70 × 50 cm", image: "" },
    { title: "[Placeholder] Invitation card — Obra",             year: 2004, medium: "Offset print", dimensions: "15 × 10 cm", image: "" },
    { title: "[Placeholder] Catalogue — Works 1990s",            year: 1999, medium: "Softcover, 32pp", dimensions: "21 × 14.8 cm", image: "" },
    { title: "[Placeholder] Exhibition poster — Group show",     year: 1991, medium: "Offset print", dimensions: "60 × 40 cm", image: "" },
    { title: "[Placeholder] Poster — First exhibition",          year: 1979, medium: "Silkscreen",    dimensions: "50 × 35 cm", image: "" },
  ],
};

// All fields below are placeholder fillers about Xano Armenter — not verified
// biographical facts. Replace with real content when ready.
const EXHIBITIONS = [
  { year: 2018, venue: "[Placeholder venue]", city: "Barcelona", title: "Ultramar — recent paintings by Xano Armenter", type: "Solo" },
  { year: 2016, venue: "[Placeholder venue]", city: "Girona", title: "Xano Armenter — works on canvas", type: "Solo" },
  { year: 2014, venue: "[Placeholder venue]", city: "Barcelona", title: "Still life and landscape", type: "Solo" },
  { year: 2011, venue: "[Placeholder gallery]", city: "Madrid", title: "Xano Armenter — paintings 2001–2011", type: "Solo" },
  { year: 2004, venue: "[Placeholder venue]", city: "Barcelona", title: "Obra recent", type: "Solo" },
  { year: 1991, venue: "[Placeholder venue]", city: "Barcelona", title: "Xano Armenter — group show", type: "Group" },
  { year: 1986, venue: "[Placeholder venue]", city: "Barcelona", title: "Early works", type: "Solo" },
  { year: 1979, venue: "[Placeholder venue]", city: "Barcelona", title: "First exhibition", type: "Solo" },
];

const BIO = `
<p>[Placeholder bio — not verified] Xano Armenter is a Catalan painter working primarily in acrylic and oil on canvas. The studio practice spans more than four decades, from the first paintings in the late 1970s through the most recent body of work completed in 2018.</p>

<p>The work moves between the still life, the marine, the urban, the landscape, and the abstract — often in the same year. Colour and surface are the consistent subject across media and decades.</p>

<p>[Placeholder] Xano Armenter lives and works in [city], Catalonia. Work is held in private collections across Spain and Europe. Selected exhibitions and represented galleries are listed in the Exhibitions section.</p>
`;

const CONTACT = {
  email: "studio@xanoarmenter.com",
  studio: "[Placeholder] Studio Xano Armenter · Barcelona, Catalonia",
  representation: [
    { gallery: "[Placeholder gallery]", city: "Barcelona", email: "hola@gallery.cat" },
    { gallery: "[Placeholder gallery]", city: "Madrid", email: "hola@gallery.es" },
  ],
  social: [
    { label: "Artwork Archive — full catalogue", url: "https://www.artworkarchive.com/profile/xano-armenter" },
    { label: "Instagram", url: "https://instagram.com/" },
  ],
};
