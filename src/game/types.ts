/** Shared level + entity types for play, editor, import/export. */

export const LEVEL_VERSION = 1 as const;

export const DEFAULT_FLOOR = 0x2a2420;
export const DEFAULT_CEIL = 0x12141a;

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
  | "pickup";

export type EnemyVariant = "grunt" | "bruiser";

export interface LevelEntity {
  id: string;
  type: EntityType;
  /** Cell-space coordinates (center of cell = integer + 0.5) */
  x: number;
  y: number;
  /** Script-facing name, e.g. door-armory */
  name?: string;
  /** Teleport destination name */
  dest?: string;
  variant?: EnemyVariant;
  locked?: boolean;
}

export interface PlayerSpawn {
  x: number;
  y: number;
  /** Radians; 0 faces +X (east), increases CCW */
  angle: number;
}

export interface LevelZone {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Named cell — shoot/use/set-wall by name */
export interface LevelMark {
  name: string;
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
  | "paint"
  | "erase"
  | "fill"
  | "rect"
  | "rectFill"
  | "line"
  | "eyedrop";

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
    spawn: { ...level.spawn },
    entities: level.entities.map((e) => ({ ...e })),
    zones: level.zones?.map((z) => ({ ...z })),
    marks: level.marks?.map((m) => ({ ...m })),
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
    spawn: { x: 1.5, y: 1.5, angle: 0 },
    entities: [],
    fogColor: "#0a0a0c",
    author: "",
    script: "",
    zones: [],
    marks: [],
  };
}

export function uid(prefix = "e"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
