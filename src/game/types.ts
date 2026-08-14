/** Shared level + entity types for play, editor, import/export. */

export const LEVEL_VERSION = 1 as const;

/** Wall cell: 0 = empty floor, 1+ = wall texture index */
export type WallGrid = number[][];

export type EntityType = "enemy" | "ammo" | "health" | "exit";

export interface LevelEntity {
  id: string;
  type: EntityType;
  /** Cell-space coordinates (center of cell = integer + 0.5) */
  x: number;
  y: number;
}

export interface PlayerSpawn {
  x: number;
  y: number;
  /** Radians; 0 faces +X (east), increases CCW */
  angle: number;
}

export interface GameLevel {
  version: typeof LEVEL_VERSION;
  name: string;
  width: number;
  height: number;
  /** walls[y][x] — row-major, y down */
  walls: WallGrid;
  spawn: PlayerSpawn;
  entities: LevelEntity[];
  floorColor: string;
  ceilingColor: string;
  fogColor: string;
  /** Optional author note */
  author?: string;
}

export type EditorTool =
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

export function cloneLevel(level: GameLevel): GameLevel {
  return {
    ...level,
    walls: level.walls.map((row) => [...row]),
    spawn: { ...level.spawn },
    entities: level.entities.map((e) => ({ ...e })),
  };
}

export function makeEmptyLevel(
  name = "Untitled",
  width = 24,
  height = 24,
): GameLevel {
  const walls = emptyGrid(width, height, 0);
  return {
    version: LEVEL_VERSION,
    name,
    width,
    height,
    walls,
    spawn: { x: 1.5, y: 1.5, angle: 0 },
    entities: [],
    floorColor: "#2a2420",
    ceilingColor: "#12141a",
    fogColor: "#0a0a0c",
    author: "",
  };
}

export function uid(prefix = "e"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
