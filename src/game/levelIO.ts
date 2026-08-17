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
  DEFAULT_FOG,
  DEFAULT_PICKUP,
  LEVEL_VERSION,
  MAP_MAX,
  MAP_MIN,
  cloneLevel,
  colorGrid,
  defaultWallColor,
  emptyGrid,
  ensureKeys,
  levelIssues,
  parseHexColor,
  readPublicId,
  seedWallColors,
  withKey,
} from "./types";

export type ParseResult =
  | { ok: true; level: GameLevel; errors: string[] }
  | { ok: false; error: string };

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function inferSize(raw: unknown): { width: number; height: number } | null {
  if (Array.isArray(raw) && raw.length) {
    const first = raw[0];
    if (typeof first === "string") return { height: raw.length, width: first.length };
    if (Array.isArray(first)) return { height: raw.length, width: first.length };
  }
  return null;
}

function coerceWalls(raw: unknown, width: number, height: number): {
  walls: WallGrid;
  damaged: boolean;
} {
  const walls = emptyGrid(width, height, 0);
  if (typeof raw === "string") {
    let damaged = raw.length !== width * height;
    for (let i = 0; i < raw.length && i < width * height; i++) {
      const n = raw.charCodeAt(i) - 48;
      if (n < 0 || n > 6) {
        damaged = true;
        continue;
      }
      walls[(i / width) | 0]![i % width] = n;
    }
    return { walls, damaged };
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    let damaged = raw.length !== height;
    for (let y = 0; y < height; y++) {
      const row = raw[y];
      if (typeof row !== "string") {
        damaged = true;
        continue;
      }
      if (row.length !== width) damaged = true;
      for (let x = 0; x < width && x < row.length; x++) {
        const n = row.charCodeAt(x) - 48;
        if (n < 0 || n > 6) {
          damaged = true;
          continue;
        }
        walls[y]![x] = n;
      }
    }
    return { walls, damaged };
  }
  let damaged = !Array.isArray(raw);
  const rows = Array.isArray(raw) ? raw : [];
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    if (!Array.isArray(row)) {
      if (y < rows.length) damaged = true;
      continue;
    }
    if (row.length !== width) damaged = true;
    for (let x = 0; x < width; x++) {
      const cell = row[x];
      if (!isNum(cell) || cell < 0 || cell > 6 || !Number.isInteger(cell)) {
        if (x < row.length) damaged = true;
        continue;
      }
      walls[y]![x] = cell;
    }
  }
  if (rows.length !== height) damaged = true;
  return { walls, damaged };
}

function coerceColors(
  raw: unknown,
  width: number,
  height: number,
  fill: number,
): ColorGrid | null {
  if (!Array.isArray(raw) || raw.length !== height) return null;
  if (!Array.isArray(raw[0]) || (raw[0] as unknown[]).length !== width) return null;
  if (typeof (raw[0] as unknown[])[0] !== "number") return null;
  const out: ColorGrid = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== width) return null;
    const next: number[] = [];
    for (const cell of row) {
      if (!isNum(cell) || cell < 0 || cell > 0xffffff || !Number.isInteger(cell)) {
        return null;
      }
      next.push(cell);
    }
    out.push(next);
  }
  return out;
}

function applyColorHits(
  base: ColorGrid,
  raw: unknown,
  width: number,
  height: number,
): ColorGrid {
  if (!Array.isArray(raw)) return base;
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 3) continue;
    const [x, y, c] = item;
    if (!isNum(x) || !isNum(y) || !isNum(c)) continue;
    const ix = x | 0;
    const iy = y | 0;
    if (iy < 0 || ix < 0 || iy >= height || ix >= width) continue;
    if (c < 0 || c > 0xffffff || !Number.isInteger(c)) continue;
    base[iy]![ix] = c;
  }
  return base;
}

function coerceColorField(
  raw: unknown,
  width: number,
  height: number,
  fill: number,
): ColorGrid {
  const full = coerceColors(raw, width, height, fill);
  if (full) return full;
  return applyColorHits(colorGrid(width, height, fill), raw, width, height);
}

function coerceWallColors(
  raw: unknown,
  walls: WallGrid,
  width: number,
  height: number,
): ColorGrid {
  const full = coerceColors(raw, width, height, 0);
  if (full) return full;
  return applyColorHits(seedWallColors(walls), raw, width, height);
}

function packWalls(walls: WallGrid): string {
  return walls.map((row) => row.join("")).join("");
}

function packWallColors(walls: WallGrid, colors: ColorGrid): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let y = 0; y < walls.length; y++) {
    const row = walls[y]!;
    for (let x = 0; x < row.length; x++) {
      const tex = row[x] ?? 0;
      if (tex <= 0) continue;
      const c = colors[y]?.[x] ?? 0;
      if (!c || c === defaultWallColor(tex)) continue;
      out.push([x, y, c]);
    }
  }
  return out;
}

function packColorHits(grid: ColorGrid | undefined, fill: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  if (!grid) return out;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]!;
    for (let x = 0; x < row.length; x++) {
      const c = row[x] ?? fill;
      if (c !== fill) out.push([x, y, c]);
    }
  }
  return out;
}

function packCoord(n: number): number {
  const cell = Math.floor(n);
  return n === cell + 0.5 ? cell : n;
}

function unpackCoord(n: number): number {
  return Number.isInteger(n) ? n + 0.5 : n;
}

function packAngle(a: number): number | undefined {
  const tau = Math.PI * 2;
  let n = ((a % tau) + tau) % tau;
  if (n < 1e-9 || tau - n < 1e-9) return undefined;
  const q = Math.round(n / (Math.PI / 2));
  if (Math.abs(n - q * (Math.PI / 2)) < 1e-6) {
    n = ((q % 4) + 4) % 4 * (Math.PI / 2);
    if (n < 1e-9) return undefined;
  }
  return n;
}

function coerceSpawn(s: unknown): PlayerSpawn {
  if (!s || typeof s !== "object") return { x: 1.5, y: 1.5, angle: 0 };
  const o = s as Record<string, unknown>;
  return {
    x: isNum(o.x) ? unpackCoord(o.x) : 1.5,
    y: isNum(o.y) ? unpackCoord(o.y) : 1.5,
    angle: isNum(o.angle) ? o.angle : 0,
  };
}

function coerceEntity(e: unknown): LevelEntity | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  const types = [
    "enemy",
    "ammo",
    "health",
    "exit",
    "door",
    "teleport",
    "pickup",
    "button",
  ];
  if (typeof o.type !== "string" || !types.includes(o.type) || !isNum(o.x) || !isNum(o.y)) {
    return null;
  }
  const ent: LevelEntity = withKey({
    type: o.type as LevelEntity["type"],
    x: unpackCoord(o.x),
    y: unpackCoord(o.y),
    id: readPublicId(o.id, o.name),
    dest: typeof o.dest === "string" ? o.dest : undefined,
    label: typeof o.label === "string" ? o.label : undefined,
    color: isNum(o.color) ? o.color : undefined,
    variant: o.variant === "bruiser" ? "bruiser" : o.variant === "grunt" ? "grunt" : undefined,
    locked: typeof o.locked === "boolean" ? o.locked : undefined,
    disabled: o.disabled === true ? true : undefined,
  });
  return ent;
}

function coerceZones(v: unknown): LevelZone[] {
  if (!Array.isArray(v)) return [];
  const out: LevelZone[] = [];
  for (const z of v) {
    if (!z || typeof z !== "object") continue;
    const o = z as Record<string, unknown>;
    if (!isNum(o.x) || !isNum(o.y) || !isNum(o.w) || !isNum(o.h)) continue;
    out.push(
      withKey({
        id: readPublicId(o.id, o.name),
        x: o.x,
        y: o.y,
        w: o.w,
        h: o.h,
      }),
    );
  }
  return out;
}

function coerceMarks(v: unknown): LevelMark[] {
  if (!Array.isArray(v)) return [];
  const out: LevelMark[] = [];
  for (const m of v) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    if (!isNum(o.x) || !isNum(o.y)) continue;
    out.push(
      withKey({
        id: readPublicId(o.id, o.name),
        x: o.x,
        y: o.y,
      }),
    );
  }
  return out;
}

/** Parse a level. Only invalid JSON fails. Other problems are errors on a loaded map. */
export function parseLevel(input: string | unknown): ParseResult {
  let data: unknown;
  try {
    data = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return { ok: false, error: "That isn’t a valid map" };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "That isn’t a valid map" };
  }
  const o = data as Record<string, unknown>;
  const errors: string[] = [];
  if (o.version !== LEVEL_VERSION) {
    errors.push("This map is from a different version");
  }
  const name =
    typeof o.name === "string" && o.name.trim()
      ? o.name.trim().slice(0, 64)
      : "";
  if (!name) errors.push("This map has no title");
  const inferred = inferSize(o.walls);
  let width = isNum(o.width) ? o.width | 0 : inferred?.width ?? 0;
  let height = isNum(o.height) ? o.height | 0 : inferred?.height ?? 0;
  if (!width || !height) {
    errors.push("This map is missing its size");
    width = width || 16;
    height = height || 16;
  }
  if (width < MAP_MIN) {
    errors.push("Width is below the minimum");
    width = MAP_MIN;
  }
  if (height < MAP_MIN) {
    errors.push("Height is below the minimum");
    height = MAP_MIN;
  }
  if (width > MAP_MAX) {
    errors.push("Width is above the maximum");
    width = MAP_MAX;
  }
  if (height > MAP_MAX) {
    errors.push("Height is above the maximum");
    height = MAP_MAX;
  }
  const { walls, damaged } = coerceWalls(o.walls, width, height);
  if (damaged) errors.push("This map’s layout was repaired");
  const seedFloor =
    typeof o.floorColor === "string" ? parseHexColor(o.floorColor) : DEFAULT_FLOOR;
  const seedCeil =
    typeof o.ceilingColor === "string"
      ? parseHexColor(o.ceilingColor)
      : DEFAULT_CEIL;
  const floors = coerceColorField(o.floors, width, height, seedFloor);
  const ceils = coerceColorField(o.ceils, width, height, seedCeil);
  const wallColors = coerceWallColors(o.wallColors, walls, width, height);
  const entities: LevelEntity[] = [];
  if (Array.isArray(o.entities)) {
    for (const e of o.entities) {
      const ent = coerceEntity(e);
      if (ent) entities.push(ent);
      else errors.push("A damaged object was skipped");
    }
  }
  const spawn = coerceSpawn(o.spawn);
  if (!o.spawn) errors.push("This map had no start point");
  const level: GameLevel = ensureKeys({
    version: LEVEL_VERSION,
    name: name || "Untitled",
    width,
    height,
    walls,
    floors,
    ceils,
    wallColors,
    spawn,
    entities,
    fogColor: typeof o.fogColor === "string" ? o.fogColor : DEFAULT_FOG,
    author: typeof o.author === "string" ? o.author.slice(0, 64) : "",
    script: typeof o.script === "string" ? o.script : "",
    zones: coerceZones(o.zones),
    marks: coerceMarks(o.marks),
  });
  errors.push(...levelIssues(level).filter((e) => !errors.includes(e)));
  return { ok: true, level, errors };
}

export function toSavedLevel(level: GameLevel): Record<string, unknown> {
  const src = cloneLevel(level);
  const stripEnt = (e: LevelEntity) => {
    const out: Record<string, unknown> = {
      type: e.type,
      x: packCoord(e.x),
      y: packCoord(e.y),
    };
    if (e.id?.trim()) out.id = e.id.trim();
    if (e.dest) out.dest = e.dest;
    if (e.label && e.label !== "?") out.label = e.label;
    if (e.color !== undefined && e.color !== DEFAULT_PICKUP) out.color = e.color;
    if (e.variant === "bruiser") out.variant = "bruiser";
    if (e.locked) out.locked = true;
    if (e.disabled) out.disabled = true;
    return out;
  };
  const stripZone = (z: LevelZone) => {
    const out: Record<string, unknown> = { x: z.x, y: z.y, w: z.w, h: z.h };
    if (z.id?.trim()) out.id = z.id.trim();
    return out;
  };
  const stripMark = (m: LevelMark) => {
    const out: Record<string, unknown> = { x: m.x, y: m.y };
    if (m.id?.trim()) out.id = m.id.trim();
    return out;
  };
  const spawn: Record<string, unknown> = {
    x: packCoord(src.spawn.x),
    y: packCoord(src.spawn.y),
  };
  const angle = packAngle(src.spawn.angle);
  if (angle !== undefined) spawn.angle = angle;
  const out: Record<string, unknown> = {
    version: src.version,
    name: src.name,
    width: src.width,
    height: src.height,
    walls: packWalls(src.walls),
    spawn,
  };
  const floorHits = packColorHits(src.floors, DEFAULT_FLOOR);
  if (floorHits.length) out.floors = floorHits;
  const ceilHits = packColorHits(src.ceils, DEFAULT_CEIL);
  if (ceilHits.length) out.ceils = ceilHits;
  const wallTints = packWallColors(src.walls, src.wallColors);
  if (wallTints.length) out.wallColors = wallTints;
  if (src.entities.length) out.entities = src.entities.map(stripEnt);
  if (src.fogColor && src.fogColor !== DEFAULT_FOG) out.fogColor = src.fogColor;
  if (src.author) out.author = src.author;
  if (src.script) out.script = src.script;
  const zones = (src.zones ?? []).map(stripZone);
  if (zones.length) out.zones = zones;
  const marks = (src.marks ?? []).map(stripMark);
  if (marks.length) out.marks = marks;
  return out;
}

export function serializeLevel(level: GameLevel, pretty = false): string {
  const payload = toSavedLevel(level);
  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
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