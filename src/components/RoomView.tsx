import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router";
import type { Artwork } from "../data";
import { useI18n } from "../i18n";
import { ArrowIcon } from "./ArrowIcon";

type Scene = "living" | "dining" | "own";

const WALLS = [
  { name: "Gallery white", wall: "#f3f0e9", floor: "#b9a58c" },
  { name: "Linen", wall: "#e2dacb", floor: "#a8927a" },
  { name: "Sage", wall: "#b6c0b0", floor: "#b9a58c" },
  { name: "Terracotta", wall: "#b9694a", floor: "#8d7862" },
  { name: "Ink blue", wall: "#2b3545", floor: "#7d6b58" },
];

/**
 * "Imagine it in your home": the painting on a wall, drawn to scale.
 * The room scenes are SVG drawn in centimetres (1 unit = 1 cm), so the
 * painting's catalogued size places it at its true size next to furniture of
 * a known width. "Your own wall" puts it over a photo the visitor uploads,
 * which never leaves their device.
 */
export function RoomView({ work, onClose }: { work: Artwork; onClose: () => void }) {
  const { t, to } = useI18n();
  const [scene, setScene] = useState<Scene>("living");
  const [wall, setWall] = useState(0);

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
        {scene === "own" ? <OwnWall work={work} /> : <RoomScene work={work} cm={cm} scene={scene} colors={WALLS[wall]} />}
      </div>

      <aside className="room-panel">
        <button className="lightbox-close" onClick={onClose}>
          {t.room.close}
        </button>
        <div>
          <p className="eyebrow">{t.room.title}</p>
          <h2>{work.title}</h2>
          {work.dims && <p className="room-dims">{work.dims}</p>}
          {scene !== "own" && (
            <p className="room-note">
              {work.cm ? `${t.room.scale}. ${scene === "living" ? t.room.scaleNote(t.room.sofa) : t.room.sideboardNote}` : t.room.noDims}
            </p>
          )}
        </div>

        <div className="room-controls">
          <fieldset>
            <legend>{t.room.scene}</legend>
            {(["living", "dining", "own"] as Scene[]).map((s) => (
              <button key={s} type="button" aria-pressed={scene === s} onClick={() => setScene(s)}>
                {t.room[s]}
              </button>
            ))}
          </fieldset>
          {scene !== "own" && (
            <fieldset>
              <legend>{t.room.wall}</legend>
              <div className="room-swatches">
                {WALLS.map((w, i) => (
                  <button
                    key={w.name}
                    type="button"
                    className="room-swatch"
                    style={{ background: w.wall }}
                    aria-label={w.name}
                    aria-pressed={wall === i}
                    onClick={() => setWall(i)}
                  />
                ))}
              </div>
            </fieldset>
          )}
          <Link className="text-link" to={`${to("/contact")}?work=${work.slug}`}>
            <span>{t.room.enquire}</span>
            <ArrowIcon />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function RoomScene({
  work,
  cm,
  scene,
  colors,
}: {
  work: Artwork;
  cm: { w: number; h: number };
  scene: "living" | "dining";
  colors: (typeof WALLS)[number];
}) {
  const furnitureW = scene === "living" ? 210 : 180;
  const furnitureH = scene === "living" ? 84 : 78;
  const FLOOR = 62; // visible depth of floor, cm
  // Hang with the centre at eye level (150 cm), but always clear the furniture.
  const bottom = Math.max(furnitureH + 22, 150 - cm.h / 2);
  const ceiling = Math.max(255, bottom + cm.h + 34);
  const W = Math.max(400, cm.w + 200, furnitureW + 190);
  const cx = W / 2;
  const floorY = ceiling;
  const dark = colors.wall === "#2b3545";

  return (
    <svg className="room-svg" viewBox={`0 0 ${W} ${ceiling + FLOOR}`} preserveAspectRatio="xMidYMax meet" overflow="visible" role="img" aria-label={work.title}>
      <defs>
        <radialGradient id="room-light" cx="0.5" cy="0.42" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#000" stopOpacity="0.08" />
        </radialGradient>
        <linearGradient id="room-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.22" />
          <stop offset="0.35" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <filter id="room-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="1.5" dy="3" stdDeviation="3" floodOpacity="0.32" />
        </filter>
        <filter id="room-soft" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Wall and floor run past the viewBox so any screen shape is filled. */}
      <rect x={-3000} y={-3000} width={W + 6000} height={ceiling + 3000} fill={colors.wall} />
      <rect x={-3000} y={-3000} width={W + 6000} height={ceiling + 3000} fill="#000" opacity="0.08" />
      <rect x={-W} width={W * 3} height={ceiling} fill="url(#room-light)" />
      <rect x={-3000} y={floorY} width={W + 6000} height={FLOOR + 3000} fill={colors.floor} />
      <rect x={-3000} y={floorY} width={W + 6000} height={FLOOR} fill="url(#room-floor)" />
      {/* skirting board */}
      <rect x={-3000} y={floorY - 9} width={W + 6000} height={9} fill={dark ? "#222a37" : "#fbfaf6"} opacity={dark ? 1 : 0.9} />
      <rect x={-3000} y={floorY - 0.6} width={W + 6000} height={1.2} fill="#000" opacity="0.25" />

      {/* the painting, at its real size */}
      <g filter="url(#room-shadow)">
        <image href={work.image} x={cx - cm.w / 2} y={floorY - bottom - cm.h} width={cm.w} height={cm.h} preserveAspectRatio="none" />
      </g>

      <ellipse cx={cx} cy={floorY + 4} rx={furnitureW / 2 + 12} ry={7} fill="#000" opacity="0.28" filter="url(#room-soft)" />
      {scene === "living" ? <Sofa cx={cx} floorY={floorY} /> : <Sideboard cx={cx} floorY={floorY} />}
      <Plant x={cx + furnitureW / 2 + 42} floorY={floorY} />
      {scene === "living" && <Lamp x={cx - furnitureW / 2 - 46} floorY={floorY} />}
    </svg>
  );
}

/** 210 cm wide, 84 cm high. */
function Sofa({ cx, floorY }: { cx: number; floorY: number }) {
  const x = cx - 105;
  const y = floorY - 84;
  return (
    <g>
      {[x + 14, x + 190].map((lx) => (
        <rect key={lx} x={lx} y={floorY - 12} width={6} height={12} fill="#3a2f26" />
      ))}
      <rect x={x + 10} y={y} width={190} height={56} rx={10} fill="#8f9a8c" />
      <rect x={x} y={y + 22} width={24} height={52} rx={9} fill="#7f8a7c" />
      <rect x={x + 186} y={y + 22} width={24} height={52} rx={9} fill="#7f8a7c" />
      <rect x={x + 22} y={y + 44} width={82} height={24} rx={6} fill="#a2ad9f" />
      <rect x={x + 106} y={y + 44} width={82} height={24} rx={6} fill="#a2ad9f" />
      <rect x={x + 8} y={y + 62} width={194} height={12} rx={4} fill="#788375" />
      <rect x={x + 30} y={y + 16} width={34} height={30} rx={7} fill="#d9a441" transform={`rotate(-8 ${x + 47} ${y + 31})`} />
      <rect x={x + 150} y={y + 18} width={32} height={28} rx={7} fill="#e9e3d6" transform={`rotate(7 ${x + 166} ${y + 32})`} />
    </g>
  );
}

/** 180 cm wide, 78 cm high. */
function Sideboard({ cx, floorY }: { cx: number; floorY: number }) {
  const x = cx - 90;
  const y = floorY - 78;
  return (
    <g>
      {[x + 12, x + 164].map((lx) => (
        <rect key={lx} x={lx} y={floorY - 18} width={4} height={18} fill="#2c241d" />
      ))}
      <rect x={x} y={y} width={180} height={60} rx={2} fill="#9c6f46" />
      <rect x={x} y={y} width={180} height={4} fill="#b78758" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={x + 4 + i * 58} y={y + 8} width={56} height={48} fill="#8b6039" />
          <circle cx={x + 32 + i * 58} cy={y + 32} r={1.6} fill="#e7d3a8" />
        </g>
      ))}
      {/* vase and books */}
      <path d={`M${x + 36} ${y} c-9 -8 -9 -22 -3 -30 h6 c6 8 6 22 -3 30 z`} fill="#e9e3d6" />
      <rect x={x + 120} y={y - 5} width={34} height={5} fill="#0d49bc" />
      <rect x={x + 123} y={y - 9} width={28} height={4} fill="#ed5b22" />
    </g>
  );
}

function Plant({ x, floorY }: { x: number; floorY: number }) {
  const leaves = [-34, -20, -7, 6, 19, 32];
  return (
    <g>
      <path d={`M${x - 15} ${floorY - 36} h30 l-4 36 h-22 z`} fill="#c9bfae" />
      {leaves.map((a, i) => (
        <path
          key={a}
          d={`M${x} ${floorY - 36} q-7 -${34 + (i % 3) * 9} 0 -${62 + (i % 3) * 16} q7 ${28 + (i % 3) * 7} 0 ${62 + (i % 3) * 16}z`}
          fill={i % 2 ? "#4f7a56" : "#3f6a4a"}
          transform={`rotate(${a} ${x} ${floorY - 36})`}
        />
      ))}
    </g>
  );
}

function Lamp({ x, floorY }: { x: number; floorY: number }) {
  return (
    <g>
      <ellipse cx={x} cy={floorY - 1} rx={15} ry={3} fill="#2c2a27" />
      <rect x={x - 1} y={floorY - 150} width={2} height={150} fill="#2c2a27" />
      <path d={`M${x - 20} ${floorY - 150} l8 -30 h24 l8 30 z`} fill="#efe6d2" />
    </g>
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
