import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router";
import type { Artwork } from "../data";
import { useI18n } from "../i18n";
import { ArrowIcon } from "./ArrowIcon";

type RoomKey = "living" | "dining" | "bedroom";
type Scene = RoomKey | "own";

/**
 * Room photographs (public/rooms, 1536 × 1024). Each is shot straight-on, so
 * one measurement gives the scale of the whole wall: the furniture's real
 * width divided into its width in pixels. All numbers are in photo pixels.
 */
const ROOMS: Record<RoomKey, { src: string; pxPerCm: number; centerX: number; floorY: number; clearY: number; light: 1 | -1 }> = {
  // sofa: 240 cm = 632 px
  living: { src: "/rooms/living.jpg", pxPerCm: 632 / 240, centerX: 768, floorY: 865, clearY: 655, light: 1 },
  // sideboard: 180 cm = 477 px; clearY sits above the branches in the vase
  dining: { src: "/rooms/dining.jpg", pxPerCm: 477 / 180, centerX: 756, floorY: 850, clearY: 548, light: -1 },
  // headboard: 165 cm = 372 px
  bedroom: { src: "/rooms/bedroom.jpg", pxPerCm: 372 / 165, centerX: 764, floorY: 822, clearY: 606, light: 1 },
};
const PHOTO = { w: 1536, h: 1024 };

/**
 * "Imagine it in your home": the painting hung in a photographed room at its
 * true size, worked out from its catalogued centimetres and the scale of the
 * room photo. "Your own wall" puts it over a photo the visitor uploads, which
 * never leaves their device.
 */
export function RoomView({ work, onClose }: { work: Artwork; onClose: () => void }) {
  const { t, to } = useI18n();
  const [scene, setScene] = useState<Scene>("living");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Without catalogued dimensions, assume a 100 cm long side and say so.
  const cm = work.cm ?? (work.w >= work.h ? { w: 100, h: (100 * work.h) / work.w } : { h: 100, w: (100 * work.w) / work.h });

  return (
    <div className="room" role="dialog" aria-modal="true" aria-label={t.room.title}>
      <div className="room-stage">
        {scene === "own" ? <OwnWall work={work} /> : <RoomPhoto work={work} cm={cm} room={ROOMS[scene]} />}
      </div>

      <aside className="room-panel">
        <button className="lightbox-close" onClick={onClose}>
          {t.room.close}
        </button>
        <div>
          <p className="eyebrow">{t.room.title}</p>
          <h2>{work.title}</h2>
          {work.dims && <p className="room-dims">{work.dims}</p>}
          {scene !== "own" && <p className="room-note">{work.cm ? `${t.room.scale}. ${t.room.scaleNote[scene]}` : t.room.noDims}</p>}
        </div>

        <div className="room-controls">
          <fieldset>
            <legend>{t.room.scene}</legend>
            {(["living", "dining", "bedroom", "own"] as Scene[]).map((s) => (
              <button key={s} type="button" aria-pressed={scene === s} onClick={() => setScene(s)}>
                {t.room[s]}
              </button>
            ))}
          </fieldset>
          <Link className="text-link" to={`${to("/contact")}?work=${work.slug}`}>
            <span>{t.room.enquire}</span>
            <ArrowIcon />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function RoomPhoto({ work, cm, room }: { work: Artwork; cm: { w: number; h: number }; room: (typeof ROOMS)[RoomKey] }) {
  const w = cm.w * room.pxPerCm;
  const h = cm.h * room.pxPerCm;
  // Centre at eye level (150 cm), but keep clear of the furniture and inside the photo.
  const eyeLevelBottom = room.floorY - (150 - cm.h / 2) * room.pxPerCm;
  const y = Math.max(14, Math.min(room.clearY, eyeLevelBottom) - h);
  const x = room.centerX - w / 2;
  const depth = Math.max(2.5, 3.5 * room.pxPerCm); // the canvas stands about 3.5 cm off the wall

  return (
    <svg className="room-svg" viewBox={`0 0 ${PHOTO.w} ${PHOTO.h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={work.title}>
      <defs>
        <filter id="room-cast" x="-30%" y="-30%" width="160%" height="170%">
          <feGaussianBlur stdDeviation={depth * 1.1} />
        </filter>
        <filter id="room-contact" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        {/* the room's light falls across the canvas too */}
        <linearGradient id="room-sheen" x1={room.light === 1 ? 0 : 1} y1="0" x2={room.light === 1 ? 1 : 0} y2="1">
          <stop offset="0" stopColor="#fff6e6" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#1a1208" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <image href={room.src} width={PHOTO.w} height={PHOTO.h} />
      {/* soft cast shadow away from the window, then a tight contact shadow */}
      <rect x={x + room.light * depth * 1.6} y={y + depth * 2.2} width={w} height={h} fill="#2a1d10" opacity="0.34" filter="url(#room-cast)" />
      <rect x={x + room.light * 1.5} y={y + 2.5} width={w} height={h} fill="#1c130a" opacity="0.45" filter="url(#room-contact)" />
      <image href={work.image} x={x} y={y} width={w} height={h} preserveAspectRatio="none" />
      <rect x={x} y={y} width={w} height={h} fill="url(#room-sheen)" />
      <rect x={x + 0.4} y={y + 0.4} width={w - 0.8} height={h - 0.8} fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
    </svg>
  );
}

function OwnWall({ work }: { work: Artwork }) {
  const { t } = useI18n();
  const [photo, setPhoto] = useState<string | null>(null);
  const [size, setSize] = useState(32); // painting width as % of the stage
  const [pos, setPos] = useState({ x: 50, y: 40 }); // centre, % of the stage
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);

  const onFile = (file: File | undefined) => {
    if (file && file.type.startsWith("image/")) setPhoto(URL.createObjectURL(file));
  };

  const onDown = (e: ReactPointerEvent<HTMLImageElement>) => {
    const r = stage.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - (r.left + (pos.x / 100) * r.width), dy: e.clientY - (r.top + (pos.y / 100) * r.height) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!drag.current) return;
    const r = stage.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    setPos({
      x: clamp(((e.clientX - drag.current.dx - r.left) / r.width) * 100),
      y: clamp(((e.clientY - drag.current.dy - r.top) / r.height) * 100),
    });
  };

  if (!photo) {
    return (
      <label className="room-upload">
        <span className="room-upload-title">{t.room.upload}</span>
        <span>{t.room.ownHint}</span>
        <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
    );
  }

  return (
    <div className="room-own" ref={stage} style={{ backgroundImage: `url(${photo})` }}>
      <img
        src={work.image}
        alt={work.title}
        draggable={false}
        style={{ width: `${size}%`, left: `${pos.x}%`, top: `${pos.y}%` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
      />
      <div className="room-own-bar">
        <label>
          {t.room.size}
          <input type="range" min={8} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
        <label className="room-own-change">
          {t.room.change}
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}
