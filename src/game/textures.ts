/** Procedural wall + sprite textures for the raycaster. */

import { defaultWallColor } from "./types";

const TEX_SIZE = 64;

export type TextureAtlas = {
  size: number;
  /** wallTextures[id-1] = ImageData RGBA */
  walls: ImageData[];
  enemy: ImageData;
  bruiser: ImageData;
  ammo: ImageData;
  health: ImageData;
  exit: ImageData;
  door: ImageData;
  doorClosed: ImageData;
  doorLocked: ImageData;
  teleport: ImageData;
  pickup: ImageData;
  button: ImageData;
  weapon: ImageData;
};

function clampByte(n: number) {
  return Math.max(0, Math.min(255, n | 0));
}

function setPx(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
) {
  const i = (y * TEX_SIZE + x) * 4;
  data[i] = clampByte(r);
  data[i + 1] = clampByte(g);
  data[i + 2] = clampByte(b);
  data[i + 3] = clampByte(a);
}

function noise(x: number, y: number, seed: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.758) * 43758.5453;
  return n - Math.floor(n);
}

function makeWall(kind: number): ImageData {
  const img = new ImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const n = noise(x, y, kind);
      let r = 0,
        g = 0,
        b = 0;

      if (kind === 1) {
        // Tech panel — dark blue-gray plates
        const panel = (Math.floor(x / 16) + Math.floor(y / 16)) % 2;
        const edge =
          x % 16 === 0 || y % 16 === 0 || x % 16 === 15 || y % 16 === 15;
        r = panel ? 40 : 52;
        g = panel ? 48 : 58;
        b = panel ? 62 : 74;
        if (edge) {
          r = 24;
          g = 28;
          b = 36;
        }
        // vents
        if (y % 16 > 6 && y % 16 < 10 && x % 16 > 4 && x % 16 < 12) {
          r = 20;
          g = 22;
          b = 28;
        }
        r += n * 12;
        g += n * 12;
        b += n * 14;
      } else if (kind === 2) {
        // Blood brick
        const row = Math.floor(y / 8);
        const offset = row % 2 === 0 ? 0 : 8;
        const bx = (x + offset) % 16;
        const by = y % 8;
        const mortar = bx === 0 || by === 0;
        r = mortar ? 50 : 110 + n * 30;
        g = mortar ? 40 : 40 + n * 10;
        b = mortar ? 38 : 35 + n * 8;
        if (!mortar && n > 0.85) {
          r = 90;
          g = 20;
          b = 20;
        }
      } else if (kind === 3) {
        // Rust metal
        r = 70 + n * 40;
        g = 45 + n * 20;
        b = 35 + n * 15;
        if ((x + y) % 8 === 0) {
          r *= 0.7;
          g *= 0.7;
          b *= 0.7;
        }
        if (Math.abs(x - 32) < 2 || Math.abs(y - 32) < 2) {
          r = 40;
          g = 42;
          b = 48;
        }
      } else if (kind === 4) {
        // Circuit
        r = 18;
        g = 28 + n * 10;
        b = 22;
        if (x % 8 === 0 || y % 8 === 0) {
          r = 20;
          g = 80;
          b = 50;
        }
        if ((x % 16 === 4 && y % 16 < 10) || (y % 16 === 4 && x % 16 < 10)) {
          r = 40;
          g = 200;
          b = 120;
        }
        if (x % 16 === 8 && y % 16 === 8) {
          r = 220;
          g = 80;
          b = 40;
        }
      } else if (kind === 5) {
        // Stone
        r = 90 + n * 40;
        g = 85 + n * 35;
        b = 75 + n * 30;
        if ((x * 3 + y * 5) % 17 === 0) {
          r *= 0.6;
          g *= 0.6;
          b *= 0.6;
        }
      } else {
        // Hazard stripes
        const stripe = Math.floor((x + y) / 8) % 2 === 0;
        if (stripe) {
          r = 200 + n * 20;
          g = 160 + n * 10;
          b = 20;
        } else {
          r = 20 + n * 10;
          g = 18 + n * 8;
          b = 16 + n * 8;
        }
      }

      setPx(d, x, y, r, g, b);
    }
  }
  return img;
}

function makeEnemy(bruiser = false): ImageData {
  const img = new ImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;
  // transparent bg
  for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;

  const cx = 32;
  const cy = 28;

  // body silhouette (demon-ish)
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // legs
      if (y > 40 && y < 60) {
        if (Math.abs(dx - 8) < 5 || Math.abs(dx + 8) < 5) {
          setPx(d, x, y, bruiser ? 50 : 90, 30, bruiser ? 70 : 30, 255);
        }
      }
      // torso
      if (y > 18 && y < 44) {
        const w = 14 + (y - 18) * 0.15;
        if (Math.abs(dx) < w) {
          const shade = 100 + (dx + dy) * 0.5;
          setPx(d, x, y, shade, 35, 35, 255);
        }
      }
      // head
      if (dx * dx + (dy + 4) * (dy + 4) < 100 && y < 26) {
        setPx(d, x, y, 120, 40, 40, 255);
      }
      // eyes
      if (y >= 16 && y <= 19) {
        if (Math.abs(dx - 4) < 2 || Math.abs(dx + 4) < 2) {
          setPx(d, x, y, 255, 200, 40, 255);
        }
      }
      // horns
      if (y >= 6 && y < 14) {
        if (Math.abs(dx - 10) < 2 || Math.abs(dx + 10) < 2) {
          setPx(d, x, y, 80, 25, 25, 255);
        }
      }
    }
  }
  return img;
}

function makePickup(r: number, g: number, b: number, glyph: string): ImageData {
  const img = new ImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;

  for (let y = 16; y < 48; y++) {
    for (let x = 16; x < 48; x++) {
      const dx = x - 32;
      const dy = y - 32;
      if (dx * dx + dy * dy < 220) {
        const edge = dx * dx + dy * dy > 180;
        setPx(
          d,
          x,
          y,
          edge ? r * 0.5 : r,
          edge ? g * 0.5 : g,
          edge ? b * 0.5 : b,
          255,
        );
      }
    }
  }
  if (glyph === "+") {
    for (let i = -8; i <= 8; i++) {
      setPx(d, 32 + i, 32, 255, 255, 255, 255);
      setPx(d, 32, 32 + i, 255, 255, 255, 255);
      setPx(d, 32 + i, 31, 255, 255, 255, 255);
      setPx(d, 31, 32 + i, 255, 255, 255, 255);
    }
  } else if (glyph) {
    stampGlyph(d, glyph);
  }
  return img;
}

function makeCrystal(r: number, g: number, b: number): ImageData {
  const img = new ImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
  for (let y = 10; y < 54; y++) {
    for (let x = 10; x < 54; x++) {
      const dx = Math.abs(x - 32);
      const dy = Math.abs(y - 32);
      if (dx / 14 + dy / 20 < 1) {
        const edge = dx / 14 + dy / 20 > 0.82;
        const hi = x < 32 ? 1.15 : 0.75;
        setPx(
          d,
          x,
          y,
          edge ? r * 0.45 : r * hi,
          edge ? g * 0.45 : g * hi,
          edge ? b * 0.45 : b * hi,
          255,
        );
      }
    }
  }
  return img;
}

function stampGlyph(
  d: Uint8ClampedArray,
  glyph: string,
  fill = "#fff8e8",
  stroke = "#1a1410",
) {
  if (typeof document === "undefined") return;
  const c = document.createElement("canvas");
  c.width = TEX_SIZE;
  c.height = TEX_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.font = "700 16px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.strokeText(glyph.slice(0, 3), 32, 33);
  ctx.fillStyle = fill;
  ctx.fillText(glyph.slice(0, 3), 32, 33);
  const src = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
  for (let i = 0; i < src.length; i += 4) {
    if ((src[i + 3] ?? 0) > 90) {
      d[i] = src[i]!;
      d[i + 1] = src[i + 1]!;
      d[i + 2] = src[i + 2]!;
      d[i + 3] = 255;
    }
  }
}

const pickupCache = new Map<string, ImageData>();

export function labeledPickup(label: string, color = 0xaa46c8): ImageData {
  const text = (label.trim() || "?").slice(0, 3);
  const packed = color & 0xffffff;
  const key = `${text}:${packed.toString(16)}`;
  const hit = pickupCache.get(key);
  if (hit) return hit;
  const r = (packed >> 16) & 255;
  const g = (packed >> 8) & 255;
  const b = packed & 255;
  const img = makeCrystal(r, g, b);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const light = luma > 0.55;
  stampGlyph(
    img.data,
    text,
    light ? "#1a1410" : "#fff8e8",
    light ? "#f4efe6" : "#1a1410",
  );
  pickupCache.set(key, img);
  return img;
}

function makeButton(): ImageData {
  const img = new ImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
  for (let y = 18; y < 56; y++) {
    for (let x = 20; x < 44; x++) {
      const post = x >= 27 && x <= 36;
      if (y > 38 && post) {
        const edge = x === 27 || x === 36;
        setPx(d, x, y, edge ? 48 : 72, edge ? 50 : 74, edge ? 56 : 80, 255);
      }
    }
  }
  for (let y = 16; y < 40; y++) {
    for (let x = 16; x < 48; x++) {
      const inset = x > 18 && x < 46 && y > 18 && y < 38;
      const edge = !inset;
      if (edge) {
        setPx(d, x, y, 90, 88, 78, 255);
      } else {
        const glow = 1 - Math.abs(y - 28) / 12;
        setPx(d, x, y, 220, 150 + glow * 50, 40, 255);
      }
    }
  }
  for (let x = 22; x < 42; x++) {
    setPx(d, x, 26, 255, 230, 140, 255);
    setPx(d, x, 27, 255, 210, 90, 255);
  }
  return img;
}

function makeDoorClosed(locked: boolean): ImageData {
  const img = new ImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const n = noise(x, y, locked ? 9 : 8);
      const frame = x < 5 || x > 58 || y < 4 || y > 59;
      const seam = x >= 30 && x <= 33;
      const bar = y === 16 || y === 17 || y === 46 || y === 47;
      let r = 48 + n * 10;
      let g = 54 + n * 10;
      let b = 62 + n * 12;
      if ((Math.floor(x / 8) + Math.floor(y / 10)) % 2 === 0) {
        r -= 6;
        g -= 6;
        b -= 4;
      }
      if (seam) {
        r = 18;
        g = 20;
        b = 24;
      }
      if (bar) {
        r = 72 + n * 8;
        g = 78 + n * 8;
        b = 86 + n * 8;
      }
      if (frame) {
        r = 22;
        g = 24;
        b = 28;
      }
      // viewport slit
      if (x >= 12 && x <= 26 && y >= 18 && y <= 26) {
        const inner = x > 13 && x < 25 && y > 19 && y < 25;
        if (inner) {
          r = locked ? 40 : 90;
          g = locked ? 12 : 70;
          b = locked ? 10 : 30;
        } else {
          r = 12;
          g = 12;
          b = 14;
        }
      }
      // handle
      if (x >= 42 && x <= 50 && y >= 30 && y <= 36) {
        r = 180;
        g = 150;
        b = 70;
      }
      // lock lamp
      if (x >= 28 && x <= 35 && y >= 7 && y <= 12) {
        if (locked) {
          r = 200;
          g = 40;
          b = 28;
        } else {
          r = 40;
          g = 190;
          b = 70;
        }
      }
      // rivets
      if (
        ((x === 8 || x === 55) && (y === 8 || y === 32 || y === 55)) ||
        ((x === 22 || x === 41) && (y === 16 || y === 47))
      ) {
        r = 160;
        g = 160;
        b = 150;
      }
      setPx(d, x, y, r, g, b, 255);
    }
  }
  return img;
}

function makeDoorPillar(): ImageData {
  const img = new ImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
  const left = 27;
  const right = 36;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = left; x <= right; x++) {
      const n = noise(x, y, 12);
      const edge = x === left || x === right;
      const band = y === 14 || y === 15 || y === 48 || y === 49;
      let r = 56 + n * 10;
      let g = 62 + n * 10;
      let b = 70 + n * 12;
      if (edge) {
        r = 22;
        g = 24;
        b = 28;
      } else if (band) {
        r = 170;
        g = 140;
        b = 70;
      }
      if ((y === 8 || y === 32 || y === 55) && (x === 29 || x === 34)) {
        r = 150;
        g = 150;
        b = 140;
      }
      setPx(d, x, y, r, g, b, 255);
    }
  }
  return img;
}

function makeExit(): ImageData {
  const img = new ImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
  for (let y = 8; y < 56; y++) {
    for (let x = 12; x < 52; x++) {
      const edge = x === 12 || x === 51 || y === 8 || y === 55;
      if (edge) setPx(d, x, y, 40, 200, 100, 255);
      else if ((x + y) % 6 < 2) setPx(d, x, y, 20, 80, 50, 200);
      else setPx(d, x, y, 10, 40, 30, 180);
    }
  }
  // chevron
  for (let i = 0; i < 12; i++) {
    setPx(d, 28 + i, 28 + i, 80, 255, 140, 255);
    setPx(d, 40 - i, 28 + i, 80, 255, 140, 255);
  }
  return img;
}

function makeWeapon(): ImageData {
  // Not used as world texture — gun is drawn in HUD overlay code-wise.
  // Keep a small muzzle flash atlas cell.
  const img = new ImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
  for (let y = 20; y < 44; y++) {
    for (let x = 20; x < 44; x++) {
      const dx = x - 32;
      const dy = y - 32;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 14) {
        const t = 1 - dist / 14;
        setPx(d, x, y, 255, 200 + t * 55, 40, t * 255);
      }
    }
  }
  return img;
}

let cached: TextureAtlas | null = null;

export function getTextures(): TextureAtlas {
  if (cached) return cached;
  cached = {
    size: TEX_SIZE,
    walls: [1, 2, 3, 4, 5, 6].map(makeWall),
    enemy: makeEnemy(),
    bruiser: makeEnemy(true),
    ammo: makePickup(200, 160, 40, "A"),
    health: makePickup(40, 180, 80, "+"),
    exit: makeExit(),
    door: makeDoorPillar(),
    doorClosed: makeDoorClosed(false),
    doorLocked: makeDoorClosed(true),
    teleport: makePickup(80, 140, 220, "T"),
    pickup: makeCrystal(170, 70, 200),
    button: makeButton(),
    weapon: makeWeapon(),
  };
  return cached;
}

/** Sample wall texture with optional shade (0-1). Returns [r,g,b]. */
export function sampleWall(
  atlas: TextureAtlas,
  texId: number,
  u: number,
  v: number,
  shade: number,
  tint = 0,
): [number, number, number] {
  const tex = atlas.walls[Math.max(0, Math.min(atlas.walls.length - 1, texId - 1))];
  if (!tex) return [40, 40, 40];
  const size = atlas.size;
  const tx = Math.max(0, Math.min(size - 1, Math.floor(u * size))) | 0;
  const ty = Math.max(0, Math.min(size - 1, Math.floor(v * size))) | 0;
  const i = (ty * size + tx) * 4;
  const d = tex.data;
  const tr = d[i] ?? 0;
  const tg = d[i + 1] ?? 0;
  const tb = d[i + 2] ?? 0;
  if (!tint || tint === defaultWallColor(texId)) {
    return [(tr * shade) | 0, (tg * shade) | 0, (tb * shade) | 0];
  }
  const lum = (tr + tg + tb) / (3 * 140);
  const wr = (tint >> 16) & 255;
  const wg = (tint >> 8) & 255;
  const wb = tint & 255;
  return [
    Math.min(255, wr * lum * shade) | 0,
    Math.min(255, wg * lum * shade) | 0,
    Math.min(255, wb * lum * shade) | 0,
  ];
}

export function sampleDoor(
  img: ImageData,
  u: number,
  v: number,
  shade: number,
): [number, number, number] {
  const size = img.width;
  const tx = Math.max(0, Math.min(size - 1, Math.floor(u * size))) | 0;
  const ty = Math.max(0, Math.min(size - 1, Math.floor(v * size))) | 0;
  const i = (ty * size + tx) * 4;
  const d = img.data;
  return [
    (((d[i] ?? 0) * shade) | 0),
    (((d[i + 1] ?? 0) * shade) | 0),
    (((d[i + 2] ?? 0) * shade) | 0),
  ];
}

export function sampleSprite(
  img: ImageData,
  u: number,
  v: number,
  shade: number,
): [number, number, number, number] {
  const size = img.width;
  const tx = Math.max(0, Math.min(size - 1, Math.floor(u * size))) | 0;
  const ty = Math.max(0, Math.min(size - 1, Math.floor(v * size))) | 0;
  const i = (ty * size + tx) * 4;
  const d = img.data;
  return [
    ((d[i] ?? 0) * shade) | 0,
    ((d[i + 1] ?? 0) * shade) | 0,
    ((d[i + 2] ?? 0) * shade) | 0,
    d[i + 3] ?? 0,
  ];
}
