import type {
  ColorGrid,
  GameLevel,
  LevelEntity,
  LevelMark,
  LevelZone,
  PlayerSpawn,
  WallGrid,
} from "./types";
import {
  DEFAULT_CEIL,
  DEFAULT_FLOOR,
  LEVEL_VERSION,
  cloneLevel,
  colorGrid,
  parseHexColor,
} from "./types";

export type ParseResult =
  | { ok: true; level: GameLevel }
  | { ok: false; error: string };

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validateWalls(
  walls: unknown,
  width: number,
  height: number,
): walls is WallGrid {
  if (!Array.isArray(walls) || walls.length !== height) return false;
  for (const row of walls) {
    if (!Array.isArray(row) || row.length !== width) return false;
    for (const cell of row) {
      if (!isNum(cell) || cell < 0 || cell > 6 || !Number.isInteger(cell)) {
        return false;
      }
    }
  }
  return true;
}

function validateColors(
  grid: unknown,
  width: number,
  height: number,
): grid is ColorGrid {
  if (!Array.isArray(grid) || grid.length !== height) return false;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== width) return false;
    for (const cell of row) {
      if (!isNum(cell) || cell < 0 || cell > 0xffffff || !Number.isInteger(cell)) {
        return false;
      }
    }
  }
  return true;
}

function validateSpawn(s: unknown): s is PlayerSpawn {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return isNum(o.x) && isNum(o.y) && isNum(o.angle);
}

function validateEntity(e: unknown): e is LevelEntity {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  const types = [
    "enemy",
    "ammo",
    "health",
    "exit",
    "door",
    "teleport",
    "pickup",
  ];
  if (
    typeof o.id !== "string" ||
    typeof o.type !== "string" ||
    !types.includes(o.type) ||
    !isNum(o.x) ||
    !isNum(o.y)
  ) {
    return false;
  }
  if (o.name !== undefined && typeof o.name !== "string") return false;
  if (o.dest !== undefined && typeof o.dest !== "string") return false;
  if (o.variant !== undefined && o.variant !== "grunt" && o.variant !== "bruiser") {
    return false;
  }
  if (o.locked !== undefined && typeof o.locked !== "boolean") return false;
  return true;
}

function validateZones(v: unknown): v is LevelZone[] {
  if (v === undefined) return true;
  if (!Array.isArray(v)) return false;
  return v.every((z) => {
    if (!z || typeof z !== "object") return false;
    const o = z as Record<string, unknown>;
    return (
      typeof o.name === "string" &&
      isNum(o.x) &&
      isNum(o.y) &&
      isNum(o.w) &&
      isNum(o.h)
    );
  });
}

function validateMarks(v: unknown): v is LevelMark[] {
  if (v === undefined) return true;
  if (!Array.isArray(v)) return false;
  return v.every((m) => {
    if (!m || typeof m !== "object") return false;
    const o = m as Record<string, unknown>;
    return typeof o.name === "string" && isNum(o.x) && isNum(o.y);
  });
}

/** Parse and validate a level JSON string or object. */
export function parseLevel(input: string | unknown): ParseResult {
  let data: unknown;
  try {
    data = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return { ok: false, error: "That isn’t a valid map" };
  }
  if (!data || typeof data !== "object") {
    return { ok: false, error: "That isn’t a valid map" };
  }
  const o = data as Record<string, unknown>;
  if (o.version !== LEVEL_VERSION) {
    return {
      ok: false,
      error: "This map is from a different version",
    };
  }
  if (typeof o.name !== "string" || !o.name.trim()) {
    return { ok: false, error: "This map has no name" };
  }
  if (!isNum(o.width) || !isNum(o.height)) {
    return { ok: false, error: "This map is missing its size" };
  }
  const width = o.width | 0;
  const height = o.height | 0;
  if (width < 5 || height < 5 || width > 64 || height > 64) {
    return { ok: false, error: "Maps must be between 5×5 and 64×64" };
  }
  if (!validateWalls(o.walls, width, height)) {
    return { ok: false, error: "This map’s layout is damaged" };
  }
  if (!validateSpawn(o.spawn)) {
    return { ok: false, error: "This map has no valid start point" };
  }
  if (!Array.isArray(o.entities) || !o.entities.every(validateEntity)) {
    return { ok: false, error: "This map’s objects are damaged" };
  }
  if (!validateZones(o.zones)) {
    return { ok: false, error: "This map’s zones are damaged" };
  }
  if (!validateMarks(o.marks)) {
    return { ok: false, error: "This map’s marks are damaged" };
  }
  const seedFloor =
    typeof o.floorColor === "string" ? parseHexColor(o.floorColor) : DEFAULT_FLOOR;
  const seedCeil =
    typeof o.ceilingColor === "string"
      ? parseHexColor(o.ceilingColor)
      : DEFAULT_CEIL;
  const floors = validateColors(o.floors, width, height)
    ? (o.floors as ColorGrid).map((r) => [...r])
    : colorGrid(width, height, seedFloor);
  const ceils = validateColors(o.ceils, width, height)
    ? (o.ceils as ColorGrid).map((r) => [...r])
    : colorGrid(width, height, seedCeil);
  const level: GameLevel = {
    version: LEVEL_VERSION,
    name: o.name.trim().slice(0, 64),
    width,
    height,
    walls: (o.walls as WallGrid).map((r) => [...r]),
    floors,
    ceils,
    spawn: {
      x: (o.spawn as PlayerSpawn).x,
      y: (o.spawn as PlayerSpawn).y,
      angle: (o.spawn as PlayerSpawn).angle,
    },
    entities: (o.entities as LevelEntity[]).map((e) => ({ ...e })),
    fogColor: typeof o.fogColor === "string" ? o.fogColor : "#0a0a0c",
    author: typeof o.author === "string" ? o.author.slice(0, 64) : "",
    script: typeof o.script === "string" ? o.script : "",
    zones: Array.isArray(o.zones) ? (o.zones as LevelZone[]).map((z) => ({ ...z })) : [],
    marks: Array.isArray(o.marks) ? (o.marks as LevelMark[]).map((m) => ({ ...m })) : [],
  };
  return { ok: true, level };
}

export function serializeLevel(level: GameLevel, pretty = true): string {
  const payload = cloneLevel(level);
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

/** Trigger browser download of a level file. */
export function downloadLevel(level: GameLevel) {
  const json = serializeLevel(level);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe =
    level.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "level";
  a.href = url;
  a.download = `${safe}.json`;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Read a File as a level. */
export function importLevelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(parseLevel(String(reader.result ?? "")));
    };
    reader.onerror = () => resolve({ ok: false, error: "Couldn’t read that file" });
    reader.readAsText(file);
  });
}

export async function copyLevelToClipboard(level: GameLevel): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(serializeLevel(level));
    return true;
  } catch {
    return false;
  }
}
