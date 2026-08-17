import type { ColorGrid, GameLevel } from "./types";
import { LEVEL_VERSION, colorGrid, parseHexColor, seedWallColors, uid, withKey } from "./types";
import { parseLevel, toSavedLevel } from "./levelIO";
import { formatLisp } from "./lisp";

function prettyScript(src: string): string {
  const r = formatLisp(src);
  return r.ok ? r.text : src;
}

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
      withKey({ type: "enemy", x: 16.5, y: 11.5 }),
      withKey({ type: "enemy", x: 18.5, y: 13.5 }),
      withKey({ type: "enemy", x: 14.5, y: 9.5 }),
      withKey({ type: "enemy", x: 26.5, y: 11.5 }),
      withKey({ type: "enemy", x: 10.5, y: 21.5 }),
      withKey({ type: "enemy", x: 22.5, y: 21.5 }),
      withKey({ type: "enemy", x: 4.5, y: 24.5 }),
      withKey({ type: "ammo", x: 8.5, y: 6.5 }),
      withKey({ type: "ammo", x: 27.5, y: 12.5 }),
      withKey({ type: "ammo", x: 16.5, y: 23.5 }),
      withKey({ type: "health", x: 5.5, y: 5.5 }),
      withKey({ type: "health", x: 20.5, y: 11.5 }),
      withKey({ type: "exit", x: 28.5, y: 24.5 }),
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
      withKey({ type: "enemy", x: 9.5, y: 3.5 }),
      withKey({ type: "enemy", x: 16.5, y: 9.5 }),
      withKey({ type: "enemy", x: 9.5, y: 16.5 }),
      withKey({ type: "enemy", x: 3.5, y: 9.5 }),
      withKey({ type: "enemy", x: 16.5, y: 16.5 }),
      withKey({ type: "ammo", x: 2.5, y: 9.5 }),
      withKey({ type: "health", x: 17.5, y: 2.5 }),
      withKey({ type: "exit", x: 17.5, y: 17.5 }),
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

/** Locked cell, card, alarm, warden. Script carries the loop. */
export function createNightVaultLevel(): GameLevel {
  const w = 22;
  const h = 16;
  const walls = bordered(w, h, 0, 3);

  setRect(walls, 1, 1, 5, 5, 2);
  setRect(walls, 2, 2, 4, 4, 0);
  walls[3]![5] = 0;
  walls[2]![5] = 6;

  setRect(walls, 1, 7, 5, 11, 1);
  setRect(walls, 2, 8, 4, 10, 0);
  walls[8]![5] = 0;
  walls[9]![5] = 0;

  setRect(walls, 15, 1, 20, 5, 6);
  setRect(walls, 16, 2, 19, 4, 0);
  walls[3]![15] = 0;

  setRect(walls, 15, 7, 20, 11, 4);
  setRect(walls, 16, 8, 19, 10, 0);
  walls[9]![15] = 0;

  setRect(walls, 1, 12, 4, 14, 5);
  setRect(walls, 2, 13, 3, 13, 0);

  walls[4]![10] = 5;
  walls[8]![10] = 5;

  const script = prettyScript(`(def announce (msg)
  (say (str ">> " msg)))

; Lock the doors. Tell the player the first job.
(on start ()
  (set-attr id: "door-cell" locked: true)
  (set-attr id: "door-vault" locked: true)
  (set-attr id: "door-exit" locked: true)
  (set "hits" 0)
  (announce "Cage locked. Shoot the fuse on the east wall."))

; A shot on the fuse opens the cage.
(on shoot (target: "panel")
  (if not (get "freed")
    (set-wall at: "panel" type: "empty")
    (set-attr id: "door-cell" locked: false open: true)
    (set "freed" true)
    (announce "Cage fried. Card is in the south locker.")))

; The card opens the vault and calls the warden.
(on pickup (target: "key-card")
  (set-attr id: "door-vault" locked: false)
  (announce "Vault lock dropped. Alarm!")
  (if not (get "sprung")
    (set "sprung" true)
    (spawn type: "enemy" x: 11.5 y: 6.5 id: "warden" variant: "bruiser")))

(on enter (zone: "ambush")
  (if not (get "add")
    (set "add" true)
    (spawn type: "enemy" x: 9.5 y: 6.5 id: "runner" variant: "grunt")
    (announce "Movement in the hall!")))

(on enter (zone: "pad-in")
  (if (has "key-card")
    (if not (get "hopped")
      (set "hopped" true)
      (teleport "player" "stash")
      (announce "Sump pipe. Pad home is on the floor."))
  else
    (say "The grate needs a card.")))

(on die (enemy: "warden")
  (after 1
    (set-attr id: "door-exit" locked: false open: true)
    (give "ammo" 20)
    (announce "Exit bolt released.")))

(on hurt (target: "player")
  (set "hits" (+ (get "hits") 1))
  (if (>= (get "hits") 3)
    (if not (get "warned")
      (set "warned" true)
      (announce "You are leaking. Find a pack."))))
`);

  return {
    version: LEVEL_VERSION,
    name: "Night Vault",
    width: w,
    height: h,
    walls,
    spawn: { x: 3.5, y: 3.5, angle: 0 },
    entities: [
      withKey({
        type: "door",
        x: 5.5,
        y: 3.5,
        id: "door-cell",
        locked: true,
      }),
      withKey({
        type: "door",
        x: 15.5,
        y: 3.5,
        id: "door-vault",
        locked: true,
      }),
      withKey({
        type: "door",
        x: 15.5,
        y: 9.5,
        id: "door-exit",
        locked: true,
      }),
      withKey({
        type: "pickup",
        x: 3.5,
        y: 9.5,
        id: "key-card",
        label: "KEY",
        color: 0xd4a017,
      }),
      withKey({ type: "health", x: 18.5, y: 2.5 }),
      withKey({ type: "ammo", x: 8.5, y: 10.5 }),
      withKey({ type: "ammo", x: 3.5, y: 13.5 }),
      withKey({
        type: "teleport",
        x: 2.5,
        y: 13.5,
        id: "pad-home",
        dest: "hall-return",
      }),
      withKey({ type: "enemy", x: 10.5, y: 3.5, id: "guard-a" }),
      withKey({ type: "enemy", x: 13.5, y: 9.5, id: "guard-b" }),
      withKey({ type: "exit", x: 18.5, y: 9.5 }),
    ],
    floors: (() => {
      const g = fillColors(w, h, "#1c1a18");
      paintRect(g, 2, 2, 4, 4, "#243038");
      paintRect(g, 2, 8, 4, 10, "#2a2418");
      paintRect(g, 16, 2, 19, 4, "#3a2810");
      paintRect(g, 16, 8, 19, 10, "#281410");
      paintRect(g, 2, 13, 3, 13, "#102418");
      return g;
    })(),
    ceils: (() => {
      const g = fillColors(w, h, "#0c0c10");
      paintRect(g, 2, 2, 4, 4, "#101418");
      paintRect(g, 16, 2, 19, 4, "#1a1008");
      paintRect(g, 16, 8, 19, 10, "#140808");
      paintRect(g, 2, 13, 3, 13, "#08140e");
      return g;
    })(),
    wallColors: seedWallColors(walls),
    fogColor: "#08070a",
    author: "Built-in",
    script,
    zones: [
      withKey({ id: "ambush", x: 7, y: 2, w: 7, h: 8 }),
      withKey({ id: "pad-in", x: 17, y: 2, w: 3, h: 3 }),
    ],
    marks: [
      withKey({ id: "panel", x: 5, y: 2 }),
      withKey({ id: "stash", x: 2, y: 13 }),
      withKey({ id: "hall-return", x: 8, y: 3 }),
    ],
  };
}

export function createDepthsLevel(): GameLevel {
  const result = parseLevel({
    version: LEVEL_VERSION,
    name: "The Depths",
    width: 20,
    height: 23,
    walls:
      "0000000100000000000000000001000000000000000000010000000000000000000100000000000011101111000000000000000000010000000000000000000100000000000000000001000000000000000000010000000000000000000100000000000000000001000000000000000000010000000000000000000100000000000000000001000000000000000000010000000000000000000111111111111100000001010000000000000000010100000000000000000101000000000000000001040000000000000000010100000000000000000101000000000000000001010000000000",
    spawn: { x: 3, y: 1, angle: Math.PI / 2 },
    floors: [
      [15, 17, 6505772],
      [16, 17, 6505772],
      [17, 17, 6505772],
      [18, 17, 6505772],
      [19, 17, 6505772],
      [15, 18, 6505772],
      [16, 18, 13478799],
      [17, 18, 13478799],
      [18, 18, 13478799],
      [19, 18, 6505772],
      [15, 19, 6505772],
      [16, 19, 13478799],
      [17, 19, 13478799],
      [18, 19, 13478799],
      [19, 19, 6505772],
      [15, 20, 6505772],
      [16, 20, 13478799],
      [17, 20, 13478799],
      [18, 20, 13478799],
      [19, 20, 6505772],
      [15, 21, 6505772],
      [16, 21, 6505772],
      [17, 21, 6505772],
      [18, 21, 6505772],
      [19, 21, 6505772],
    ],
    ceils: [
      [16, 18, 10076657],
      [17, 18, 10076657],
      [18, 18, 10076657],
      [16, 19, 10076657],
      [17, 19, 10076657],
      [18, 19, 10076657],
      [16, 20, 10076657],
      [17, 20, 10076657],
      [18, 20, 10076657],
    ],
    entities: [
      { type: "door", x: 3, y: 4 },
      { type: "exit", x: 17, y: 19, id: "exit" },
      { type: "button", x: 9, y: 19, id: "activate-server" },
    ],
    zones: [
      { x: 0, y: 13, w: 7, h: 1, id: "tripwire" },
      { x: 1, y: 17, w: 5, h: 5, id: "lair" },
      { x: 7, y: 16, w: 1, h: 7, id: "seal" },
      { x: 2, y: 20, w: 3, h: 1, id: "guard-spawn-3" },
      { x: 2, y: 19, w: 3, h: 1, id: "guard-spawn-2" },
      { x: 2, y: 17, w: 3, h: 1, id: "guard-spawn-1" },
      { x: 2, y: 21, w: 3, h: 1, id: "guard-spawn" },
    ],
    marks: [{ x: 9, y: 19, id: "server" }],
    script: prettyScript(`(def explode (target:)
  (set-wall at: target
            type: "empty"
            ceiling: "#ff0000"
            floor: "#ff0000")
  (let ((ceiling (get-wall 0 0 "ceiling"))
        (floor (get-wall 0 0 "floor"))
        (explosion (spawn at: target
                          fill: true
                          type: "pickup"
                          color: "#ff7800"
                          shape: "explosion")))
    (after 0.2
      (set-wall at: target ceiling: ceiling floor: floor)
      (remove explosion))))

(def teleport-guard (0))
(def teleport-guard (n)
  (after 0.5
    (teleport "guard" (str "guard-spawn-" n))
    (teleport-guard (- n 1))))

(on enter (zone: "tripwire")
  (if not (get "spawned")
    (set "spawned" true)
    (say "You've activated my trap card!")
    (set-wall at: "lair"
              type: "empty"
              ceiling: "#3584e4"
              floor: "#63452c")
    (spawn type: "enemy"
           id: "guard"
           at: "guard-spawn"
           variant: "bruiser")
    (teleport-guard 3)))

(on die (enemy:)
  (say "Aghhhh!!!")
  (after 3
    (say "SYSTEM: Emergency override activated."))
  (after 6
    (explode target: "seal")))

(on use (target: "activate-server")
  (set-attr id: "activate-server" disabled: true)
  (set-wall at: "server" color: "#ff0000")
  (after 2
    (explode target: "server")))
`),
  });
  if (!result.ok) throw new Error(result.error);
  result.level.author = "Built-in";
  return result.level;
}

export const BUILTIN_LEVELS: GameLevel[] = [
  createOutpostLevel(),
  createReactorLevel(),
  createNightVaultLevel(),
  createDepthsLevel(),
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
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(levels.map((l) => toSavedLevel(l))),
  );
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
