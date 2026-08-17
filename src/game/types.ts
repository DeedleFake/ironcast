/** Shared level + entity types for play, editor, import/export. */

export const LEVEL_VERSION = 1 as const;

export const MAP_MIN = 5;
export const MAP_MAX = 64;

export const DEFAULT_FLOOR = 0x2a2420;
export const DEFAULT_CEIL = 0x12141a;
export const DEFAULT_PICKUP = 0xaa46c8;
export const DEFAULT_FOG = "#0a0a0c";

/** Wall cell: 0 = empty floor, 1+ = wall texture index */
export type WallGrid = number[][];
/** Per-cell 0xRRGGBB colors */
export type ColorGrid = number[][];

export type EntityType =
  | "enemy"
  | "ammo"
  | "health"
  | "exit"
  | "door"
  | "teleport"
  | "pickup"
  | "button";

export type EnemyVariant = "grunt" | "bruiser";

export interface LevelEntity {
  /** Runtime only. Never saved. */
  key: string;
  /** Explicit script id. Omitted when unnamed. */
  id?: string;
  type: EntityType;
  /** Cell-space coordinates (center of cell = integer + 0.5) */
  x: number;
  y: number;
  /** Teleport destination id */
  dest?: string;
  /** Short text drawn on a pickup sprite */
  label?: string;
  /** Pickup body color, 0xRRGGBB */
  color?: number;
  variant?: EnemyVariant;
  locked?: boolean;
  /** Button is hidden and cannot be used. */
  disabled?: boolean;
}

export interface PlayerSpawn {
  x: number;
  y: number;
  /** Radians; 0 faces +X (east), increases CCW */
  angle: number;
}

export interface LevelZone {
  key: string;
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Named cell — spawn, teleport, set-wall, shoot by id */
export interface LevelMark {
  key: string;
  id?: string;
  x: number;
  y: number;
}

export interface GameLevel {
  version: typeof LEVEL_VERSION;
  name: string;
  width: number;
  height: number;
  /** walls[y][x] — row-major, y down */
  walls: WallGrid;
  /** Floor color per empty cell, 0xRRGGBB */
  floors: ColorGrid;
  /** Ceiling color per empty cell, 0xRRGGBB */
  ceils: ColorGrid;
  /** Wall tint per cell, 0xRRGGBB. Pattern comes from walls[]. */
  wallColors: ColorGrid;
  spawn: PlayerSpawn;
  entities: LevelEntity[];
  fogColor: string;
  /** Optional author note */
  author?: string;
  script?: string;
  zones?: LevelZone[];
  marks?: LevelMark[];
}

export type EditorTool =
  | "select"
  | "move"
  | "paint"
  | "erase"
  | "fill"
  | "rect"
  | "rectFill"
  | "line"
  | "eyedrop"
  | "zone"
  | "mark";

export const WALL_TEXTURE_COUNT = 6;

export const WALL_NAMES = [
  "Empty",
  "Tech Panel",
  "Blood Brick",
  "Rust Metal",
  "Circuit",
  "Stone",
  "Hazard",
] as const;

export const WALL_IDS = [
  "empty",
  "tech-panel",
  "blood-brick",
  "rust-metal",
  "circuit",
  "stone",
  "hazard",
] as const;

export function texFromWallName(name: string): number | null {
  const n = name.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const i = (WALL_IDS as readonly string[]).indexOf(n);
  return i >= 0 ? i : null;
}

export const WALL_DEFAULT_COLORS = [
  0,
  0x4a5568,
  0x8b3a3a,
  0x6b4a3a,
  0x2d6b4a,
  0x6b6b5a,
  0xa08a20,
] as const;

export function defaultWallColor(tex: number): number {
  return WALL_DEFAULT_COLORS[tex] ?? WALL_DEFAULT_COLORS[1]!;
}

export function seedWallColors(walls: WallGrid): ColorGrid {
  const h = walls.length;
  const w = walls[0]?.length ?? 0;
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const tex = walls[y]?.[x] ?? 0;
      return tex > 0 ? defaultWallColor(tex) : 0;
    }),
  );
}

export function emptyGrid(w: number, h: number, fill = 0): WallGrid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

export function colorGrid(w: number, h: number, fill: number): ColorGrid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

export function parseHexColor(s: string): number {
  const t = s.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return Number.parseInt(t.slice(1), 16);
  if (/^#[0-9a-f]{3}$/i.test(t)) {
    const r = t[1]!;
    const g = t[2]!;
    const b = t[3]!;
    return Number.parseInt(r + r + g + g + b + b, 16);
  }
  return DEFAULT_FLOOR;
}

export function hexFromColor(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

function copyGrid(
  src: number[][] | undefined,
  width: number,
  height: number,
  fill: number,
): number[][] {
  const out = colorGrid(width, height, fill);
  if (!src) return out;
  const copyH = Math.min(height, src.length);
  for (let y = 0; y < copyH; y++) {
    const row = src[y];
    if (!row) continue;
    const copyW = Math.min(width, row.length);
    for (let x = 0; x < copyW; x++) out[y]![x] = row[x] ?? fill;
  }
  return out;
}

export function resizeLevel(
  level: GameLevel,
  width: number,
  height: number,
): GameLevel {
  const w = Math.max(MAP_MIN, Math.min(MAP_MAX, width | 0));
  const h = Math.max(MAP_MIN, Math.min(MAP_MAX, height | 0));
  const next = cloneLevel(level);
  if (w === next.width && h === next.height) return next;
  next.width = w;
  next.height = h;
  next.walls = copyGrid(level.walls, w, h, 0);
  next.floors = copyGrid(level.floors, w, h, DEFAULT_FLOOR);
  next.ceils = copyGrid(level.ceils, w, h, DEFAULT_CEIL);
  next.wallColors = copyGrid(level.wallColors, w, h, 0);
  next.spawn = {
    ...next.spawn,
    x: Math.min(Math.max(next.spawn.x, 0.5), w - 0.5),
    y: Math.min(Math.max(next.spawn.y, 0.5), h - 0.5),
  };
  next.entities = next.entities.filter(
    (e) => Math.floor(e.x) < w && Math.floor(e.y) < h && e.x >= 0 && e.y >= 0,
  );
  next.marks = (next.marks ?? []).filter((m) => m.x < w && m.y < h && m.x >= 0 && m.y >= 0);
  next.zones = (next.zones ?? [])
    .map((z) => ({
      ...z,
      w: Math.min(z.w, w - z.x),
      h: Math.min(z.h, h - z.y),
    }))
    .filter((z) => z.x < w && z.y < h && z.w > 0 && z.h > 0);
  return next;
}

export function cloneLevel(level: GameLevel): GameLevel {
  const width = level.width;
  const height = level.height;
  return {
    ...level,
    walls: level.walls.map((row) => [...row]),
    floors: (level.floors ?? colorGrid(width, height, DEFAULT_FLOOR)).map((row) => [
      ...row,
    ]),
    ceils: (level.ceils ?? colorGrid(width, height, DEFAULT_CEIL)).map((row) => [
      ...row,
    ]),
    wallColors: (level.wallColors ?? seedWallColors(level.walls)).map((row) => [
      ...row,
    ]),
    spawn: { ...level.spawn },
    entities: level.entities.map((e) => withKey({ ...e })),
    zones: (level.zones ?? []).map((z) => withKey({ ...z })),
    marks: (level.marks ?? []).map((m) => withKey({ ...m })),
  };
}

export function makeEmptyLevel(
  name = "Untitled",
  width = 24,
  height = 24,
): GameLevel {
  return {
    version: LEVEL_VERSION,
    name,
    width,
    height,
    walls: emptyGrid(width, height, 0),
    floors: colorGrid(width, height, DEFAULT_FLOOR),
    ceils: colorGrid(width, height, DEFAULT_CEIL),
    wallColors: colorGrid(width, height, 0),
    spawn: { x: 1.5, y: 1.5, angle: 0 },
    entities: [],
    fogColor: DEFAULT_FOG,
    author: "",
    script: "",
    zones: [],
    marks: [],
  };
}

export function uid(prefix = "e"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const AUTO_ID = /^[a-z]{1,4}_[a-z0-9]+$/i;

export function isAutoId(id: string): boolean {
  return AUTO_ID.test(id);
}

/** User-facing id from old or new JSON. Auto-generated ids are dropped. */
export function readPublicId(id: unknown, name?: unknown): string | undefined {
  const named = typeof name === "string" ? name.trim() : "";
  if (named) return named;
  const raw = typeof id === "string" ? id.trim() : "";
  if (raw && !isAutoId(raw)) return raw;
  return undefined;
}

export function withKey<T>(item: T): T & { key: string } {
  const rec = item as T & { key?: string };
  return rec.key ? (item as T & { key: string }) : { ...item, key: uid("k") };
}

export function ensureKeys(level: GameLevel): GameLevel {
  level.entities = level.entities.map((e) => withKey(e));
  level.zones = (level.zones ?? []).map((z) => withKey(z));
  level.marks = (level.marks ?? []).map((m) => withKey(m));
  return level;
}

export function levelIssues(level: GameLevel): string[] {
  const issues: string[] = [];
  if (!level.name.trim()) issues.push("This map has no title");
  const seen = new Map<string, number>();
  const add = (id?: string) => {
    const v = id?.trim();
    if (!v) return;
    seen.set(v, (seen.get(v) ?? 0) + 1);
  };
  for (const e of level.entities) add(e.id);
  for (const z of level.zones ?? []) add(z.id);
  for (const m of level.marks ?? []) add(m.id);
  for (const [id, n] of seen) {
    if (n > 1) issues.push(`id “${id}” is used ${n} times`);
  }
  return issues;
}
