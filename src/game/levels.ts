import type { ColorGrid, GameLevel } from "./types";
import { LEVEL_VERSION, colorGrid, parseHexColor, seedWallColors, uid } from "./types";
import { parseLevel } from "./levelIO";

function fillColors(w: number, h: number, hex: string): ColorGrid {
  return colorGrid(w, h, parseHexColor(hex));
}

function paintRect(
  g: ColorGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  hex: string,
) {
  const n = parseHexColor(hex);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (g[y]?.[x] !== undefined) g[y]![x] = n;
    }
  }
}

function bordered(w: number, h: number, fill = 0, border = 1): number[][] {
  const g = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  for (let x = 0; x < w; x++) {
    g[0]![x] = border;
    g[h - 1]![x] = border;
  }
  for (let y = 0; y < h; y++) {
    g[y]![0] = border;
    g[y]![w - 1] = border;
  }
  return g;
}

function setRect(
  g: number[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tex: number,
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (g[y]?.[x] !== undefined) g[y]![x] = tex;
    }
  }
}

function setH(g: number[][], y: number, x0: number, x1: number, tex: number) {
  for (let x = x0; x <= x1; x++) if (g[y]) g[y]![x] = tex;
}

function setV(g: number[][], x: number, y0: number, y1: number, tex: number) {
  for (let y = y0; y <= y1; y++) if (g[y]) g[y]![x] = tex;
}

/** Classic tech base — corridors, rooms, enemies. */
export function createOutpostLevel(): GameLevel {
  const w = 32;
  const h = 28;
  const walls = bordered(w, h, 0, 1);

  // Outer texture variety
  setH(walls, 0, 0, w - 1, 2);
  setH(walls, h - 1, 0, w - 1, 2);
  setV(walls, 0, 0, h - 1, 3);
  setV(walls, w - 1, 0, h - 1, 3);

  // Entry hall
  setRect(walls, 4, 4, 10, 4, 1);
  setRect(walls, 4, 8, 10, 8, 1);
  setV(walls, 4, 4, 8, 1);
  // door gap at 7,4 already open inside

  // Central chamber walls
  setRect(walls, 12, 6, 22, 6, 4);
  setRect(walls, 12, 16, 22, 16, 4);
  setV(walls, 12, 6, 16, 4);
  setV(walls, 22, 6, 16, 4);
  // doorways
  walls[6]![16] = 0;
  walls[16]![16] = 0;
  walls[11]![12] = 0;
  walls[11]![22] = 0;

  // Pillars in center
  walls[10]![15] = 5;
  walls[10]![19] = 5;
  walls[13]![15] = 5;
  walls[13]![19] = 5;

  // East armory
  setRect(walls, 24, 8, 29, 8, 3);
  setRect(walls, 24, 14, 29, 14, 3);
  setV(walls, 24, 8, 14, 3);
  walls[11]![24] = 0;

  // South maze
  setH(walls, 20, 4, 18, 6);
  setH(walls, 22, 8, 26, 6);
  setV(walls, 8, 18, 24, 6);
  setV(walls, 14, 18, 22, 2);
  setV(walls, 20, 18, 24, 2);
  walls[20]![6] = 0;
  walls[20]![12] = 0;
  walls[22]![16] = 0;

  // North storage
  setRect(walls, 6, 18, 6, 24, 1);
  setRect(walls, 2, 18, 10, 18, 1);

  // Hazard room SW
  setRect(walls, 2, 22, 6, 26, 0);
  setH(walls, 22, 2, 6, 6);
  setV(walls, 6, 22, 26, 6);

  return {
    version: LEVEL_VERSION,
    name: "Outpost 7",
    width: w,
    height: h,
    walls,
    spawn: { x: 3.5, y: 6.5, angle: 0 },
    entities: [
      { id: uid("en"), type: "enemy", x: 16.5, y: 11.5 },
      { id: uid("en"), type: "enemy", x: 18.5, y: 13.5 },
      { id: uid("en"), type: "enemy", x: 14.5, y: 9.5 },
      { id: uid("en"), type: "enemy", x: 26.5, y: 11.5 },
      { id: uid("en"), type: "enemy", x: 10.5, y: 21.5 },
      { id: uid("en"), type: "enemy", x: 22.5, y: 21.5 },
      { id: uid("en"), type: "enemy", x: 4.5, y: 24.5 },
      { id: uid("am"), type: "ammo", x: 8.5, y: 6.5 },
      { id: uid("am"), type: "ammo", x: 27.5, y: 12.5 },
      { id: uid("am"), type: "ammo", x: 16.5, y: 23.5 },
      { id: uid("hp"), type: "health", x: 5.5, y: 5.5 },
      { id: uid("hp"), type: "health", x: 20.5, y: 11.5 },
      { id: uid("ex"), type: "exit", x: 28.5, y: 24.5 },
    ],
    floors: (() => {
      const g = fillColors(w, h, "#2c2620");
      paintRect(g, 3, 3, 8, 8, "#3a3024");
      paintRect(g, 18, 8, 26, 14, "#241c18");
      return g;
    })(),
    ceils: (() => {
      const g = fillColors(w, h, "#101218");
      paintRect(g, 3, 3, 8, 8, "#1a1410");
      paintRect(g, 18, 8, 26, 14, "#0a0c10");
      return g;
    })(),
    wallColors: seedWallColors(walls),
    fogColor: "#0c0c10",
    author: "Built-in",
  };
}

/** Tight industrial corridors — good for editor demos. */
export function createReactorLevel(): GameLevel {
  const w = 20;
  const h = 20;
  const walls = bordered(w, h, 0, 3);

  // Cross corridors
  for (let i = 2; i < 18; i++) {
    if (i !== 9 && i !== 10) {
      walls[5]![i] = 1;
      walls[14]![i] = 1;
      walls[i]![5] = 4;
      walls[i]![14] = 4;
    }
  }
  // Core room
  setRect(walls, 7, 7, 12, 7, 6);
  setRect(walls, 7, 12, 12, 12, 6);
  setV(walls, 7, 7, 12, 6);
  setV(walls, 12, 7, 12, 6);
  walls[7]![9] = 0;
  walls[7]![10] = 0;
  walls[12]![9] = 0;
  walls[12]![10] = 0;
  walls[9]![7] = 0;
  walls[10]![7] = 0;
  walls[9]![12] = 0;
  walls[10]![12] = 0;

  // Core pillar
  walls[9]![9] = 5;
  walls[9]![10] = 5;
  walls[10]![9] = 5;
  walls[10]![10] = 5;

  return {
    version: LEVEL_VERSION,
    name: "Reactor Core",
    width: w,
    height: h,
    walls,
    spawn: { x: 2.5, y: 2.5, angle: Math.PI / 4 },
    entities: [
      { id: uid("en"), type: "enemy", x: 9.5, y: 3.5 },
      { id: uid("en"), type: "enemy", x: 16.5, y: 9.5 },
      { id: uid("en"), type: "enemy", x: 9.5, y: 16.5 },
      { id: uid("en"), type: "enemy", x: 3.5, y: 9.5 },
      { id: uid("en"), type: "enemy", x: 16.5, y: 16.5 },
      { id: uid("am"), type: "ammo", x: 2.5, y: 9.5 },
      { id: uid("hp"), type: "health", x: 17.5, y: 2.5 },
      { id: uid("ex"), type: "exit", x: 17.5, y: 17.5 },
    ],
    floors: (() => {
      const g = fillColors(w, h, "#1e2228");
      paintRect(g, 8, 8, 11, 11, "#2a1814");
      return g;
    })(),
    ceils: (() => {
      const g = fillColors(w, h, "#0e1014");
      paintRect(g, 8, 8, 11, 11, "#180808");
      return g;
    })(),
    wallColors: seedWallColors(walls),
    fogColor: "#080a0c",
    author: "Built-in",
  };
}

export const BUILTIN_LEVELS: GameLevel[] = [
  createOutpostLevel(),
  createReactorLevel(),
];

const STORAGE_KEY = "raycast-doom-custom-levels-v1";

export function loadCustomLevels(): GameLevel[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: GameLevel[] = [];
    for (const item of parsed) {
      const result = parseLevel(item);
      if (result.ok) out.push(result.level);
    }
    return out;
  } catch {
    return [];
  }
}

export function saveCustomLevels(levels: GameLevel[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
}

export function upsertCustomLevel(level: GameLevel) {
  const all = loadCustomLevels();
  const idx = all.findIndex((l) => l.name === level.name);
  if (idx >= 0) all[idx] = level;
  else all.push(level);
  saveCustomLevels(all);
}

export function deleteCustomLevel(name: string) {
  saveCustomLevels(loadCustomLevels().filter((l) => l.name !== name));
}
