/**
 * Classic DDA raycast FPS engine + gameplay sim.
 * Canvas 2D column rendering with textured walls and billboard sprites.
 */

import type { EnemyVariant, GameLevel, LevelEntity } from "./types";
import { cloneLevel, uid } from "./types";
import {
  getTextures,
  labeledPickup,
  sampleSprite,
  sampleWall,
  type TextureAtlas,
} from "./textures";
import { sfx, unlockAudio } from "./audio";
import {
  compileProgram,
  evalForms,
  fireHandlers,
  makeEnv,
  nil,
  num,
  str,
  type Env,
  type Host,
  type LispVal,
  type Program,
} from "./lisp";

export type GameMode = "playing" | "paused" | "won" | "dead";

export interface LiveEntity {
  id: string;
  type: LevelEntity["type"];
  x: number;
  y: number;
  hp: number;
  alive: boolean;
  hurtFlash: number;
  attackCd: number;
  name: string;
  dest: string;
  label: string;
  variant: EnemyVariant;
  locked: boolean;
  open: boolean;
  path: { x: number; y: number }[] | null;
  pathAge: number;
}

export interface GameState {
  level: GameLevel;
  px: number;
  py: number;
  dirX: number;
  dirY: number;
  planeX: number;
  planeY: number;
  angle: number;
  health: number;
  ammo: number;
  score: number;
  kills: number;
  totalEnemies: number;
  entities: LiveEntity[];
  mode: GameMode;
  message: string;
  shake: number;
  muzzle: number;
  hitmarker: number;
  bob: number;
  walkDist: number;
  keys: Set<string>;
  pointerLocked: boolean;
  lookDX: number;
  lookDY: number;
  fireHeld: boolean;
  fireCd: number;
  zBuffer: Float64Array;
  planeLen: number;
  inventory: Set<string>;
  flags: Map<string, LispVal>;
  script: Program | null;
  scriptEnv: Env;
  scriptError: string;
  timers: { t: number; fn: () => void }[];
  zonesHere: Set<string>;
  useLatch: boolean;
  useHint: string;
  started: boolean;
  teleportCd: number;
}

const MOVE_SPEED = 3.2;
const SPRINT_MULT = 1.55;
const ROT_SPEED = 2.4;
const MOUSE_SENS = 0.0022;
const PLAYER_RADIUS = 0.22;
const FIRE_INTERVAL = 0.18;
const MAX_AMMO = 99;
const ENEMY_STATS: Record<
  EnemyVariant,
  { hp: number; speed: number; damage: number; range: number }
> = {
  grunt: { hp: 100, speed: 1.35, damage: 12, range: 1.1 },
  bruiser: { hp: 220, speed: 0.85, damage: 22, range: 1.25 },
};
const HITSCAN_DAMAGE = 34;

function angleToDir(angle: number) {
  return { dirX: Math.cos(angle), dirY: Math.sin(angle) };
}

function setAngle(state: GameState, angle: number) {
  state.angle = angle;
  const { dirX, dirY } = angleToDir(angle);
  state.dirX = dirX;
  state.dirY = dirY;
  // Camera plane points screen-right: at angle 0 (facing +X), plane = (0, +1)
  state.planeX = -dirY * state.planeLen;
  state.planeY = dirX * state.planeLen;
}

export function createGameState(level: GameLevel): GameState {
  const L = cloneLevel(level);
  L.script = L.script ?? "";
  L.zones = L.zones ?? [];
  L.marks = L.marks ?? [];
  const entities: LiveEntity[] = L.entities.map((e) => liveFromLevel(e));
  const totalEnemies = entities.filter((e) => e.type === "enemy").length;
  const compiled = L.script.trim() ? compileProgram(L.script) : null;
  const state: GameState = {
    level: L,
    px: L.spawn.x,
    py: L.spawn.y,
    dirX: 1,
    dirY: 0,
    planeX: 0,
    planeY: 0.66,
    angle: L.spawn.angle,
    health: 100,
    ammo: 40,
    score: 0,
    kills: 0,
    totalEnemies,
    entities,
    mode: "playing",
    message: "",
    shake: 0,
    muzzle: 0,
    hitmarker: 0,
    bob: 0,
    walkDist: 0,
    keys: new Set(),
    pointerLocked: false,
    lookDX: 0,
    lookDY: 0,
    fireHeld: false,
    fireCd: 0,
    zBuffer: new Float64Array(1),
    planeLen: 0.66,
    inventory: new Set(),
    flags: new Map(),
    script: compiled && compiled.ok ? compiled.program : null,
    scriptEnv: makeEnv(null),
    scriptError: compiled && !compiled.ok ? compiled.error : "",
    timers: [],
    zonesHere: new Set(),
    useLatch: false,
    useHint: "",
    started: false,
    teleportCd: 0,
  };
  setAngle(state, L.spawn.angle);
  return state;
}

function liveFromLevel(e: LevelEntity): LiveEntity {
  const variant: EnemyVariant = e.variant === "bruiser" ? "bruiser" : "grunt";
  return {
    id: e.id,
    type: e.type,
    x: e.x,
    y: e.y,
    hp: e.type === "enemy" ? ENEMY_STATS[variant].hp : 1,
    alive: true,
    hurtFlash: 0,
    attackCd: 0.5 + Math.random() * 0.5,
    name: e.name || e.id,
    dest: e.dest || "",
    label: (e.label || "").trim().slice(0, 3),
    variant,
    locked: !!e.locked,
    open: e.type === "door" ? false : true,
    path: null,
    pathAge: 0,
  };
}

function isWall(state: GameState, x: number, y: number): boolean {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= state.level.width || iy >= state.level.height) {
    return true;
  }
  if ((state.level.walls[iy]?.[ix] ?? 1) > 0) return true;
  return closedDoorAt(state, ix, iy) !== null;
}

function closedDoorAt(state: GameState, ix: number, iy: number): LiveEntity | null {
  for (const e of state.entities) {
    if (!e.alive || e.type !== "door" || e.open) continue;
    if (Math.floor(e.x) === ix && Math.floor(e.y) === iy) return e;
  }
  return null;
}

function findNamed(state: GameState, name: string): LiveEntity | undefined {
  return state.entities.find((e) => e.alive && (e.name === name || e.id === name));
}

function findMark(state: GameState, name: string) {
  return (state.level.marks ?? []).find((m) => m.name === name);
}

function blocked(state: GameState, x: number, y: number): boolean {
  return (
    isWall(state, x - PLAYER_RADIUS, y - PLAYER_RADIUS) ||
    isWall(state, x + PLAYER_RADIUS, y - PLAYER_RADIUS) ||
    isWall(state, x - PLAYER_RADIUS, y + PLAYER_RADIUS) ||
    isWall(state, x + PLAYER_RADIUS, y + PLAYER_RADIUS)
  );
}

function tryMove(state: GameState, nx: number, ny: number) {
  if (!blocked(state, nx, state.py)) state.px = nx;
  if (!blocked(state, state.px, ny)) state.py = ny;
}

function hasLos(
  state: GameState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist * 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(state, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

function fireWeapon(state: GameState) {
  if (state.fireCd > 0 || state.mode !== "playing") return;
  if (state.ammo <= 0) {
    sfx.empty();
    state.fireCd = 0.25;
    return;
  }
  state.ammo -= 1;
  state.fireCd = FIRE_INTERVAL;
  state.muzzle = 0.08;
  state.shake = Math.max(state.shake, 0.35);
  sfx.shoot();

  const spread = (Math.random() - 0.5) * 0.04;
  const cos = Math.cos(spread);
  const sin = Math.sin(spread);
  const rdx = state.dirX * cos - state.dirY * sin;
  const rdy = state.dirX * sin + state.dirY * cos;

  let best: LiveEntity | null = null;
  let bestDist = Infinity;

  for (const e of state.entities) {
    if (!e.alive || e.type !== "enemy") continue;
    const dx = e.x - state.px;
    const dy = e.y - state.py;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.3 || dist > 18) continue;
    const along = dx * rdx + dy * rdy;
    if (along < 0.2) continue;
    const lat = Math.abs(dx * -rdy + dy * rdx);
    if (lat > 0.35 + dist * 0.02) continue;
    if (!hasLos(state, state.px, state.py, e.x, e.y)) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = e;
    }
  }

  if (best) {
    best.hp -= HITSCAN_DAMAGE;
    best.hurtFlash = 0.15;
    state.hitmarker = 0.12;
    sfx.hit();
    runScript(state, "hurt", best.name, {
      x: num(best.x),
      y: num(best.y),
    });
    if (best.hp <= 0) {
      best.alive = false;
      state.kills += 1;
      state.score += 100;
      sfx.enemyDie();
      runScript(state, "die", best.name, { x: num(best.x), y: num(best.y) });
      if (state.kills >= state.totalEnemies && state.totalEnemies > 0) {
        state.message = "They're down — find the exit";
      }
    }
    return;
  }

  const wall = firstWallHit(state, rdx, rdy);
  if (wall) {
    const door = closedDoorAt(state, wall.x, wall.y);
    const mark = (state.level.marks ?? []).find(
      (m) => m.x === wall.x && m.y === wall.y,
    );
    const who = door?.name || mark?.name || null;
    runScript(state, "shoot", who, { x: num(wall.x), y: num(wall.y) });
  }
}

function firstWallHit(
  state: GameState,
  rdx: number,
  rdy: number,
): { x: number; y: number } | null {
  let mapX = Math.floor(state.px);
  let mapY = Math.floor(state.py);
  const deltaDistX = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
  const deltaDistY = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
  let stepX = rdx < 0 ? -1 : 1;
  let stepY = rdy < 0 ? -1 : 1;
  let sideDistX =
    rdx < 0 ? (state.px - mapX) * deltaDistX : (mapX + 1 - state.px) * deltaDistX;
  let sideDistY =
    rdy < 0 ? (state.py - mapY) * deltaDistY : (mapY + 1 - state.py) * deltaDistY;
  for (let g = 0; g < 48; g++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
    }
    if (
      mapX < 0 ||
      mapY < 0 ||
      mapX >= state.level.width ||
      mapY >= state.level.height
    ) {
      return null;
    }
    if (isWall(state, mapX + 0.5, mapY + 0.5)) return { x: mapX, y: mapY };
  }
  return null;
}

function updateEnemies(state: GameState, dt: number) {
  for (const e of state.entities) {
    if (!e.alive || e.type !== "enemy") continue;
    e.hurtFlash = Math.max(0, e.hurtFlash - dt);
    e.attackCd = Math.max(0, e.attackCd - dt);
    const stats = ENEMY_STATS[e.variant] ?? ENEMY_STATS.grunt;

    const dx = state.px - e.x;
    const dy = state.py - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 14) continue;

    if (dist > stats.range) {
      e.pathAge -= dt;
      if (!e.path || e.path.length === 0 || e.pathAge <= 0) {
        e.path = findPath(state, e.x, e.y, state.px, state.py);
        e.pathAge = 0.35;
      }
      const step = e.path?.[0];
      if (step) {
        const sx = step.x - e.x;
        const sy = step.y - e.y;
        const sl = Math.hypot(sx, sy);
        if (sl < 0.12) {
          e.path.shift();
        } else {
          const nx = e.x + (sx / sl) * stats.speed * dt;
          const ny = e.y + (sy / sl) * stats.speed * dt;
          if (!isWall(state, nx, e.y)) e.x = nx;
          if (!isWall(state, e.x, ny)) e.y = ny;
        }
      }
    }

    if (dist < stats.range && e.attackCd <= 0) {
      e.attackCd = 0.9;
      state.health -= stats.damage;
      state.shake = Math.max(state.shake, 0.7);
      sfx.hurt();
      runScript(state, "hurt", "player", { amount: num(stats.damage) });
      if (state.health <= 0) {
        state.health = 0;
        state.mode = "dead";
        state.message = "YOU DIED";
      }
    }
  }
}

function walkableCell(state: GameState, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= state.level.width || cy >= state.level.height) {
    return false;
  }
  if ((state.level.walls[cy]?.[cx] ?? 1) > 0) return false;
  if (closedDoorAt(state, cx, cy)) return false;
  return true;
}

function findPath(
  state: GameState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number }[] {
  const sx = Math.floor(x0);
  const sy = Math.floor(y0);
  const tx = Math.floor(x1);
  const ty = Math.floor(y1);
  if (sx === tx && sy === ty) return [{ x: x1, y: y1 }];
  const key = (x: number, y: number) => x + y * 128;
  const came = new Map<number, { x: number; y: number }>();
  const q: { x: number; y: number }[] = [{ x: sx, y: sy }];
  const seen = new Set<number>([key(sx, sy)]);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let found = false;
  let guard = 0;
  while (q.length && guard++ < 800) {
    const cur = q.shift()!;
    if (cur.x === tx && cur.y === ty) {
      found = true;
      break;
    }
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx!;
      const ny = cur.y + dy!;
      const k = key(nx, ny);
      if (seen.has(k) || !walkableCell(state, nx, ny)) continue;
      seen.add(k);
      came.set(k, cur);
      q.push({ x: nx, y: ny });
    }
  }
  if (!found) return [];
  const cells: { x: number; y: number }[] = [];
  let cx = tx;
  let cy = ty;
  while (!(cx === sx && cy === sy)) {
    cells.push({ x: cx + 0.5, y: cy + 0.5 });
    const prev = came.get(key(cx, cy));
    if (!prev) break;
    cx = prev.x;
    cy = prev.y;
  }
  cells.reverse();
  return cells;
}

function updatePickups(state: GameState) {
  for (const e of state.entities) {
    if (!e.alive) continue;
    const dist = Math.hypot(e.x - state.px, e.y - state.py);
    if (dist > 0.55) continue;

    if (e.type === "ammo") {
      e.alive = false;
      state.ammo = Math.min(MAX_AMMO, state.ammo + 15);
      state.score += 10;
      sfx.pickup();
      runScript(state, "pickup", e.name);
    } else if (e.type === "health") {
      e.alive = false;
      state.health = Math.min(100, state.health + 25);
      state.score += 10;
      sfx.pickup();
      runScript(state, "pickup", e.name);
    } else if (e.type === "pickup") {
      e.alive = false;
      sfx.pickup();
      state.inventory.add(e.name);
      runScript(state, "pickup", e.name);
    } else if (e.type === "teleport") {
      if (state.teleportCd > 0 || !e.dest) continue;
      const destEnt = findNamed(state, e.dest);
      const m = findMark(state, e.dest);
      const dest = destEnt
        ? { x: destEnt.x, y: destEnt.y }
        : m
          ? { x: m.x + 0.5, y: m.y + 0.5 }
          : null;
      if (dest) {
        state.px = dest.x;
        state.py = dest.y;
        state.teleportCd = 0.85;
        sfx.pickup();
        runScript(state, "teleport", e.name);
      }
    } else if (e.type === "exit") {
      if (state.kills >= state.totalEnemies) {
        e.alive = false;
        state.mode = "won";
        state.message = "SECTOR CLEARED";
        state.score += 500;
        sfx.win();
      } else {
        state.message = `Still ${state.totalEnemies - state.kills} left`;
      }
    }
  }
}

export function updateGame(state: GameState, dt: number) {
  // Frozen until they're actually in control (paused / dead / won / click-to-fight)
  if (state.mode !== "playing" || !state.pointerLocked) return;
  const d = Math.min(dt, 0.1);

  // Look — this map basis uses angle 0 = +X with plane = (-dirY, dirX).
  // Increasing angle turns the view RIGHT, so mouse right (+lookDX) must
  // increase angle (opposite of typical three.js yaw -= movementX).
  if (state.lookDX !== 0 || state.lookDY !== 0) {
    setAngle(state, state.angle + state.lookDX * MOUSE_SENS);
    state.lookDX = 0;
    state.lookDY = 0;
  }

  // Keyboard turn: left decreases angle, right increases angle
  let rot = 0;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyQ")) rot -= 1;
  if (state.keys.has("ArrowRight")) rot += 1;
  if (rot !== 0) setAngle(state, state.angle + rot * ROT_SPEED * d);

  // FPS: W +forward, S -forward, D +right, A -right
  // right vector = plane unit direction = (-dirY, dirX)
  const sprint =
    state.keys.has("ShiftLeft") || state.keys.has("ShiftRight")
      ? SPRINT_MULT
      : 1;
  const speed = MOVE_SPEED * sprint * d;
  let mx = 0;
  let my = 0;
  if (state.keys.has("KeyW") || state.keys.has("ArrowUp")) {
    mx += state.dirX;
    my += state.dirY;
  }
  if (state.keys.has("KeyS") || state.keys.has("ArrowDown")) {
    mx -= state.dirX;
    my -= state.dirY;
  }
  if (state.keys.has("KeyD")) {
    mx += -state.dirY;
    my += state.dirX;
  }
  if (state.keys.has("KeyA")) {
    mx -= -state.dirY;
    my -= state.dirX;
  }
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx = (mx / len) * speed;
    my = (my / len) * speed;
    tryMove(state, state.px + mx, state.py + my);
    state.walkDist += speed;
    state.bob = Math.min(1, state.bob + d * 6);
  } else {
    state.bob = Math.max(0, state.bob - d * 5);
  }

  state.fireCd = Math.max(0, state.fireCd - d);
  state.shake = Math.max(0, state.shake - d * 3);
  state.muzzle = Math.max(0, state.muzzle - d);
  state.hitmarker = Math.max(0, state.hitmarker - d);
  state.teleportCd = Math.max(0, state.teleportCd - d);

  if (state.fireHeld || state.keys.has("Space")) {
    fireWeapon(state);
  }

  if (state.keys.has("KeyE")) {
    if (!state.useLatch) {
      state.useLatch = true;
      tryUse(state);
    }
  } else {
    state.useLatch = false;
  }

  updateUseHint(state);
  updateZones(state);
  updateTimers(state, d);
  updateEnemies(state, d);
  updatePickups(state);

  if (!state.started) {
    state.started = true;
    if (state.script) {
      try {
        evalForms(state.script.boot, state.scriptEnv, makeHost(state));
      } catch (err) {
        state.scriptError = err instanceof Error ? err.message : "Script error";
        state.message = state.scriptError;
      }
      runScript(state, "start", null);
    }
    if (state.scriptError) state.message = state.scriptError;
  }
}

function runScript(
  state: GameState,
  event: string,
  name: string | null,
  extras: Record<string, LispVal> = {},
) {
  if (!state.script || state.mode === "dead") return;
  try {
    fireHandlers(
      state.script,
      state.scriptEnv,
      makeHost(state),
      event,
      name,
      extras,
    );
  } catch (err) {
    state.scriptError = err instanceof Error ? err.message : "Script error";
    state.message = state.scriptError;
  }
}

function makeHost(state: GameState): Host {
  const setDoor = (name: string, patch: Partial<LiveEntity>) => {
    const e = findNamed(state, name);
    if (!e || e.type !== "door") return false;
    Object.assign(e, patch);
    return true;
  };
  return {
    say: (msg) => {
      state.message = msg;
    },
    give: (what, n) => {
      if (what === "ammo") {
        state.ammo = Math.min(MAX_AMMO, state.ammo + (n ?? 15));
        return true;
      }
      if (what === "health") {
        state.health = Math.min(200, state.health + (n ?? 25));
        return true;
      }
      state.inventory.add(what);
      return true;
    },
    take: (what, n) => {
      if (what === "ammo") {
        state.ammo = Math.max(0, state.ammo - (n ?? 1));
        return true;
      }
      if (what === "health") {
        state.health = Math.max(0, state.health - (n ?? 1));
        return true;
      }
      return state.inventory.delete(what);
    },
    has: (what) => {
      if (what === "ammo") return state.ammo > 0;
      return state.inventory.has(what);
    },
    getVar: (key) => state.flags.get(key) ?? nil(),
    setVar: (key, val) => {
      state.flags.set(key, val);
    },
    open: (name) => setDoor(name, { open: true }),
    close: (name) => setDoor(name, { open: false }),
    lock: (name) => setDoor(name, { locked: true }),
    unlock: (name) => setDoor(name, { locked: false }),
    isLocked: (name) => !!findNamed(state, name)?.locked,
    isOpen: (name) => !!findNamed(state, name)?.open,
    setWall: (a, b, c) => {
      let x: number, y: number, tex: number;
      if (a.k === "sym" || a.k === "str") {
        const mark = findMark(state, a.v);
        const door = findNamed(state, a.v);
        if (mark) {
          x = mark.x;
          y = mark.y;
        } else if (door) {
          x = Math.floor(door.x);
          y = Math.floor(door.y);
        } else return false;
        tex = b && b.k === "num" ? b.v : 0;
      } else if (a.k === "num" && b?.k === "num") {
        x = Math.floor(a.v);
        y = Math.floor(b.v);
        tex = c && c.k === "num" ? c.v : 0;
      } else return false;
      if (y < 0 || x < 0 || y >= state.level.height || x >= state.level.width) {
        return false;
      }
      state.level.walls[y]![x] = Math.max(0, Math.min(6, tex | 0));
      return true;
    },
    spawn: (type, x, y, name, variant) => {
      const id = uid(type.slice(0, 2));
      const ent = liveFromLevel({
        id,
        type: type as LevelEntity["type"],
        x,
        y,
        name: name || id,
        variant: variant === "bruiser" ? "bruiser" : "grunt",
      });
      if (ent.type === "enemy") state.totalEnemies += 1;
      state.entities.push(ent);
      return name || id;
    },
    remove: (name) => {
      const e = findNamed(state, name);
      if (!e) return false;
      e.alive = false;
      return true;
    },
    teleport: (who, dest, y) => {
      let tx: number | null = null;
      let ty: number | null = null;
      if (dest.k === "num" && y?.k === "num") {
        tx = dest.v;
        ty = y.v;
      } else if (dest.k === "sym" || dest.k === "str") {
        const e = findNamed(state, dest.v);
        const m = findMark(state, dest.v);
        if (e) {
          tx = e.x;
          ty = e.y;
        } else if (m) {
          tx = m.x + 0.5;
          ty = m.y + 0.5;
        }
      }
      if (tx === null || ty === null) return false;
      if (who === "player") {
        state.px = tx;
        state.py = ty;
        return true;
      }
      const e = findNamed(state, who);
      if (!e) return false;
      e.x = tx;
      e.y = ty;
      return true;
    },
    win: () => {
      state.mode = "won";
      state.message = "SECTOR CLEARED";
      sfx.win();
    },
    lose: () => {
      state.mode = "dead";
      state.message = "YOU DIED";
    },
    after: (sec, fn) => {
      state.timers.push({ t: Math.max(0, sec), fn });
    },
  };
}

function tryUse(state: GameState) {
  const aheadX = state.px + state.dirX * 0.9;
  const aheadY = state.py + state.dirY * 0.9;
  const cx = Math.floor(aheadX);
  const cy = Math.floor(aheadY);
  const mark = (state.level.marks ?? []).find((m) => m.x === cx && m.y === cy);
  let best: LiveEntity | null = null;
  let bestD = 1.6;
  for (const e of state.entities) {
    if (!e.alive) continue;
    if (e.type !== "door" && e.type !== "pickup" && !e.name) continue;
    const d = Math.hypot(e.x - aheadX, e.y - aheadY);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  const who = best?.name || mark?.name || null;
  if (best?.type === "door") {
    if (best.locked) {
      state.message = "Locked";
    } else {
      best.open = !best.open;
      sfx.click?.();
    }
  }
  if (who) runScript(state, "use", who, { x: num(cx), y: num(cy) });
}

function updateUseHint(state: GameState) {
  const aheadX = state.px + state.dirX * 0.9;
  const aheadY = state.py + state.dirY * 0.9;
  const cx = Math.floor(aheadX);
  const cy = Math.floor(aheadY);
  const nearbyDoor = state.entities.find(
    (e) =>
      e.alive &&
      e.type === "door" &&
      Math.hypot(e.x - aheadX, e.y - aheadY) < 1.2,
  );
  const mark = (state.level.marks ?? []).find((m) => m.x === cx && m.y === cy);
  if (nearbyDoor) {
    state.useHint = nearbyDoor.locked
      ? "E  Locked"
      : nearbyDoor.open
        ? "E  Close"
        : "E  Open";
  } else if (mark) {
    state.useHint = `E  Use ${mark.name}`;
  } else {
    state.useHint = "";
  }
}

function updateZones(state: GameState) {
  const px = Math.floor(state.px);
  const py = Math.floor(state.py);
  const now = new Set<string>();
  for (const z of state.level.zones ?? []) {
    if (px >= z.x && py >= z.y && px < z.x + z.w && py < z.y + z.h) {
      now.add(z.name);
    }
  }
  for (const name of now) {
    if (!state.zonesHere.has(name)) runScript(state, "enter", name);
  }
  for (const name of state.zonesHere) {
    if (!now.has(name)) runScript(state, "leave", name);
  }
  state.zonesHere = now;
}

function updateTimers(state: GameState, dt: number) {
  if (!state.timers.length) return;
  const left: { t: number; fn: () => void }[] = [];
  for (const t of state.timers) {
    t.t -= dt;
    if (t.t <= 0) {
      try {
        t.fn();
      } catch {
        /* ignore */
      }
    } else left.push(t);
  }
  state.timers = left;
}

function padTint(
  fx: number,
  fy: number,
  pads: { x: number; y: number }[],
): [number, number, number, number] | null {
  let best: [number, number, number, number] | null = null;
  let bestA = 0;
  for (const p of pads) {
    const dx = fx - p.x;
    const dy = fy - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 0.42 * 0.42) continue;
    const d = Math.sqrt(d2);
    let r = 30;
    let g = 90;
    let b = 160;
    let a = 0.22;
    if (d > 0.28 && d < 0.4) {
      const edge = 1 - Math.abs(d - 0.34) / 0.06;
      r = 80;
      g = 190;
      b = 255;
      a = 0.35 + edge * 0.55;
    } else if (d < 0.13) {
      const core = 1 - d / 0.13;
      r = 140;
      g = 220;
      b = 255;
      a = 0.2 + core * 0.35;
    }
    if (a > bestA) {
      bestA = a;
      best = [r, g, b, a];
    }
  }
  return best;
}

function getSpriteImg(ent: LiveEntity, atlas: TextureAtlas) {
  if (ent.type === "enemy") {
    return ent.variant === "bruiser" ? atlas.bruiser : atlas.enemy;
  }
  if (ent.type === "ammo") return atlas.ammo;
  if (ent.type === "health") return atlas.health;
  if (ent.type === "door") return atlas.door;
  if (ent.type === "teleport") return atlas.teleport;
  if (ent.type === "pickup") return labeledPickup(ent.label);
  return atlas.exit;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
) {
  const atlas = getTextures();
  if (state.zBuffer.length !== width) {
    state.zBuffer = new Float64Array(width);
  }

  const shakeX =
    state.shake > 0 ? (Math.random() - 0.5) * state.shake * 8 : 0;
  const shakeY =
    state.shake > 0 ? (Math.random() - 0.5) * state.shake * 8 : 0;

  const half = height / 2;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const pix = imgData.data;
  const floors = state.level.floors;
  const ceils = state.level.ceils;
  const mapW = state.level.width;
  const mapH = state.level.height;
  const pads: { x: number; y: number }[] = [];
  for (const e of state.entities) {
    if (e.alive && e.type === "teleport") pads.push({ x: e.x, y: e.y });
  }

  for (let col = 0; col < width; col++) {
    const cameraX = (2 * col) / width - 1;
    const rayDirX = state.dirX + state.planeX * cameraX;
    const rayDirY = state.dirY + state.planeY * cameraX;

    let mapX = Math.floor(state.px);
    let mapY = Math.floor(state.py);

    const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
    const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

    let stepX: number;
    let stepY: number;
    let sideDistX: number;
    let sideDistY: number;

    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (state.px - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - state.px) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (state.py - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - state.py) * deltaDistY;
    }

    let hit = 0;
    let side = 0;
    let texId = 1;
    let guard = 0;
    while (hit === 0 && guard++ < 64) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      if (
        mapX < 0 ||
        mapY < 0 ||
        mapX >= state.level.width ||
        mapY >= state.level.height
      ) {
        hit = 1;
        texId = 1;
        break;
      }
      const cell = state.level.walls[mapY]?.[mapX] ?? 1;
      if (cell > 0) {
        hit = 1;
        texId = cell;
      } else if (closedDoorAt(state, mapX, mapY)) {
        hit = 1;
        texId = 3;
      }
    }

    let perpWallDist: number;
    if (side === 0) {
      perpWallDist = (mapX - state.px + (1 - stepX) / 2) / rayDirX;
    } else {
      perpWallDist = (mapY - state.py + (1 - stepY) / 2) / rayDirY;
    }
    if (perpWallDist < 0.0001) perpWallDist = 0.0001;
    state.zBuffer[col] = perpWallDist;

    const lineHeight = Math.floor(height / perpWallDist);
    let drawStart = Math.floor(-lineHeight / 2 + half + shakeY);
    let drawEnd = Math.floor(lineHeight / 2 + half + shakeY);
    if (drawStart < 0) drawStart = 0;
    if (drawEnd >= height) drawEnd = height - 1;

    let wallX: number;
    if (side === 0) wallX = state.py + perpWallDist * rayDirY;
    else wallX = state.px + perpWallDist * rayDirX;
    wallX -= Math.floor(wallX);

    let texX = Math.floor(wallX * atlas.size);
    if (side === 0 && rayDirX > 0) texX = atlas.size - texX - 1;
    if (side === 1 && rayDirY < 0) texX = atlas.size - texX - 1;

    const shade =
      Math.min(1, 1.2 / (1 + perpWallDist * 0.22)) * (side === 1 ? 0.72 : 1);

    const colX = Math.min(width - 1, Math.max(0, Math.floor(col + shakeX)));
    const horizon = half + shakeY;
    const posZ = height * 0.5;

    for (let y = 0; y < drawStart; y++) {
      const p = horizon - y;
      if (p < 1) continue;
      const rowDist = posZ / p;
      const fx = state.px + rayDirX * rowDist;
      const fy = state.py + rayDirY * rowDist;
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      const packed =
        cx >= 0 && cy >= 0 && cx < mapW && cy < mapH
          ? (ceils[cy]?.[cx] ?? 0x12141a)
          : 0x12141a;
      const fog = Math.min(1, 1.15 / (1 + rowDist * 0.18));
      const i = (y * width + colX) * 4;
      pix[i] = (((packed >> 16) & 255) * fog) | 0;
      pix[i + 1] = (((packed >> 8) & 255) * fog) | 0;
      pix[i + 2] = ((packed & 255) * fog) | 0;
      pix[i + 3] = 255;
    }

    for (let y = drawStart; y <= drawEnd; y++) {
      const d = y * 256 - height * 128 + lineHeight * 128;
      const texY = Math.floor(((d * atlas.size) / lineHeight) / 256);
      const u = texX / atlas.size;
      const v = texY / atlas.size;
      const [r, g, b] = sampleWall(atlas, texId, u, v, shade);
      const i = (y * width + colX) * 4;
      pix[i] = r;
      pix[i + 1] = g;
      pix[i + 2] = b;
      pix[i + 3] = 255;
    }

    for (let y = drawEnd + 1; y < height; y++) {
      const p = y - horizon;
      if (p < 1) continue;
      const rowDist = posZ / p;
      const fx = state.px + rayDirX * rowDist;
      const fy = state.py + rayDirY * rowDist;
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      const packed =
        cx >= 0 && cy >= 0 && cx < mapW && cy < mapH
          ? (floors[cy]?.[cx] ?? 0x2a2420)
          : 0x2a2420;
      const fog = Math.min(1, 1.15 / (1 + rowDist * 0.18));
      let r = ((packed >> 16) & 255) * fog;
      let g = ((packed >> 8) & 255) * fog;
      let b = (packed & 255) * fog;
      if (pads.length) {
        const tint = padTint(fx, fy, pads);
        if (tint) {
          const a = tint[3];
          r = r * (1 - a) + tint[0] * a;
          g = g * (1 - a) + tint[1] * a;
          b = b * (1 - a) + tint[2] * a;
        }
      }
      const i = (y * width + colX) * 4;
      pix[i] = r | 0;
      pix[i + 1] = g | 0;
      pix[i + 2] = b | 0;
      pix[i + 3] = 255;
    }
  }

  const sprites: { ent: LiveEntity; dist: number }[] = [];
  for (const e of state.entities) {
    if (!e.alive) continue;
    if (e.type === "door" && !e.open) continue;
    if (e.type === "teleport") continue;
    const dist =
      (e.x - state.px) * (e.x - state.px) + (e.y - state.py) * (e.y - state.py);
    sprites.push({ ent: e, dist });
  }
  sprites.sort((a, b) => b.dist - a.dist);

  for (const { ent } of sprites) {
    const spriteX = ent.x - state.px;
    const spriteY = ent.y - state.py;
    const invDet =
      1 / (state.planeX * state.dirY - state.dirX * state.planeY);
    const transformX =
      invDet * (state.dirY * spriteX - state.dirX * spriteY);
    const transformY =
      invDet * (-state.planeY * spriteX + state.planeX * spriteY);
    if (transformY <= 0.05) continue;

    const spriteScreenX = Math.floor(
      (width / 2) * (1 + transformX / transformY),
    );
    const spriteH = Math.abs(Math.floor(height / transformY));
    const spriteW = spriteH;
    const drawStartY = Math.floor(-spriteH / 2 + half + shakeY);
    const drawEndY = Math.floor(spriteH / 2 + half + shakeY);
    const drawStartX = Math.floor(-spriteW / 2 + spriteScreenX + shakeX);
    const drawEndX = Math.floor(spriteW / 2 + spriteScreenX + shakeX);

    const img = getSpriteImg(ent, atlas);
    const shade = Math.min(1, 1.1 / (1 + transformY * 0.2));
    const flash = ent.hurtFlash > 0;

    for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
      if (stripe < 0 || stripe >= width) continue;
      if (transformY >= (state.zBuffer[stripe] ?? 0)) continue;
      const texX =
        (stripe - (-spriteW / 2 + spriteScreenX + shakeX)) / spriteW;
      for (
        let y = Math.max(0, drawStartY);
        y < Math.min(height, drawEndY);
        y++
      ) {
        const texY = (y - drawStartY) / spriteH;
        let [r, g, b, a] = sampleSprite(img, texX, texY, shade);
        if (a < 16) continue;
        if (flash) {
          r = Math.min(255, r + 120);
          g = Math.min(255, g + 40);
          b = Math.min(255, b + 40);
        }
        const i = (y * width + stripe) * 4;
        const alpha = a / 255;
        pix[i] = (r * alpha + (pix[i] ?? 0) * (1 - alpha)) | 0;
        pix[i + 1] = (g * alpha + (pix[i + 1] ?? 0) * (1 - alpha)) | 0;
        pix[i + 2] = (b * alpha + (pix[i + 2] ?? 0) * (1 - alpha)) | 0;
        pix[i + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  drawWeapon(ctx, width, height, state);

  const cx = width / 2;
  const cy = height / 2;
  ctx.strokeStyle =
    state.hitmarker > 0 ? "rgba(255,220,80,0.95)" : "rgba(232,228,220,0.75)";
  ctx.lineWidth = 2;
  const ch = state.hitmarker > 0 ? 10 : 7;
  ctx.beginPath();
  ctx.moveTo(cx - ch, cy);
  ctx.lineTo(cx - 3, cy);
  ctx.moveTo(cx + 3, cy);
  ctx.lineTo(cx + ch, cy);
  ctx.moveTo(cx, cy - ch);
  ctx.lineTo(cx, cy - 3);
  ctx.moveTo(cx, cy + 3);
  ctx.lineTo(cx, cy + ch);
  ctx.stroke();

  if (state.health < 40) {
    const v = ctx.createRadialGradient(
      cx,
      cy,
      height * 0.2,
      cx,
      cy,
      height * 0.7,
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(120,0,0,${0.35 + (40 - state.health) * 0.01})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: GameState,
) {
  // Viewmodel sway only — world stays planted. Two vertical dips per stride.
  const step = state.walkDist * 3.2;
  const amp = state.bob;
  const bobX = Math.sin(step) * 6 * amp;
  const bobY = (1 - Math.cos(step * 2)) * 2.2 * amp;
  const kick = state.muzzle > 0 ? 10 : 0;

  // Crosshair is screen center — the barrel must aim here.
  const aimX = width / 2;
  const aimY = height / 2;
  const handX = width * 0.56 + bobX;
  const handY = height * 0.98 + bobY + kick;
  const dx = aimX - handX;
  const dy = aimY - handY;
  const aimAngle = Math.atan2(dy, dx);
  const reach = Math.hypot(dx, dy);
  // Stop short of the reticle so the muzzle sits under it, clearly pointing at it
  const barrelTip = reach * 0.52;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(handX - 8, height - 6, 56, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(aimAngle);

  // Local +X = toward crosshair
  const tip = barrelTip;

  // Stock
  ctx.fillStyle = "#3a2a20";
  ctx.beginPath();
  ctx.moveTo(-36, -10);
  ctx.lineTo(4, -14);
  ctx.lineTo(4, 16);
  ctx.lineTo(-32, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2a1e16";
  ctx.fillRect(-34, 4, 28, 10);

  // Receiver
  ctx.fillStyle = "#5a5a62";
  ctx.fillRect(-4, -13, 42, 26);
  ctx.fillStyle = "#3e3e46";
  ctx.fillRect(-2, -10, 38, 8);
  ctx.fillStyle = "#2c2c32";
  ctx.fillRect(20, -6, 16, 12);

  // Barrel — tapers toward the reticle
  ctx.fillStyle = "#2a2a30";
  ctx.beginPath();
  ctx.moveTo(34, -7);
  ctx.lineTo(tip, -3.5);
  ctx.lineTo(tip, 3.5);
  ctx.lineTo(34, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a1a1e";
  ctx.fillRect(tip - 10, -2.5, 10, 5);
  // Bore
  ctx.fillStyle = "#0a0a0c";
  ctx.beginPath();
  ctx.ellipse(tip, 0, 2.2, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pump / mag
  ctx.fillStyle = "#4a4038";
  ctx.fillRect(18, 6, 22, 12);

  // Rear hand (grip)
  ctx.fillStyle = "#8a6a50";
  ctx.beginPath();
  ctx.ellipse(-2, 16, 14, 11, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6a5040";
  ctx.beginPath();
  ctx.ellipse(4, 18, 9, 8, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Forward hand
  ctx.fillStyle = "#8a6a50";
  ctx.beginPath();
  ctx.ellipse(28, 14, 11, 8, 0.05, 0, Math.PI * 2);
  ctx.fill();

  if (state.muzzle > 0) {
    const atlas = getTextures();
    const a = Math.min(1, state.muzzle * 12);
    ctx.globalAlpha = a;
    ctx.drawImage(imageDataToCanvas(atlas.weapon), tip - 18, -22, 44, 44);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(255,220,80,${0.55 * a})`;
    ctx.beginPath();
    ctx.arc(tip + 4, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

const _canvasCache = new WeakMap<ImageData, HTMLCanvasElement>();

function imageDataToCanvas(img: ImageData): HTMLCanvasElement {
  let c = _canvasCache.get(img);
  if (!c) {
    c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d")!.putImageData(img, 0, 0);
    _canvasCache.set(img, c);
  }
  return c;
}

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  size: number,
) {
  const { level } = state;
  const cell = size / Math.max(level.width, level.height);
  const w = level.width * cell;
  const h = level.height * cell;
  ctx.fillStyle = "rgba(10,10,12,0.75)";
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const c = level.walls[y]![x]!;
      if (c > 0) {
        const colors = [
          "",
          "#4a5568",
          "#8b3a3a",
          "#6b4a3a",
          "#2d6b4a",
          "#6b6b5a",
          "#a08a20",
        ];
        ctx.fillStyle = colors[c] ?? "#555";
        ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
      }
    }
  }

  for (const e of state.entities) {
    if (!e.alive) continue;
    if (e.type === "enemy") ctx.fillStyle = e.variant === "bruiser" ? "#a050d0" : "#e04040";
    else if (e.type === "ammo") ctx.fillStyle = "#d4a017";
    else if (e.type === "health") ctx.fillStyle = "#40c060";
    else if (e.type === "door") ctx.fillStyle = e.open ? "#6b4a3a" : "#c08040";
    else if (e.type === "teleport") ctx.fillStyle = "#4080e0";
    else if (e.type === "pickup") ctx.fillStyle = "#d060c0";
    else ctx.fillStyle = "#40e0a0";
    ctx.beginPath();
    ctx.arc(e.x * cell, e.y * cell, cell * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#e8e4dc";
  ctx.beginPath();
  ctx.arc(state.px * cell, state.py * cell, cell * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c43c2c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(state.px * cell, state.py * cell);
  ctx.lineTo(
    (state.px + state.dirX * 1.2) * cell,
    (state.py + state.dirY * 1.2) * cell,
  );
  ctx.stroke();
}

export { unlockAudio, sfx };

export function attachControlsProbe(state: GameState) {
  if (typeof window === "undefined") return;
  (
    window as unknown as {
      __controlsTest?: object;
    }
  ).__controlsTest = {
    getYaw: () => state.angle,
    getSpeed: () => {
      const moving =
        state.keys.has("KeyW") ||
        state.keys.has("KeyS") ||
        state.keys.has("KeyA") ||
        state.keys.has("KeyD");
      return moving ? MOVE_SPEED : 0;
    },
    getPos: () => ({ x: state.px, y: state.py }),
    getDir: () => ({ x: state.dirX, y: state.dirY }),
    getMode: () => state.mode,
    getEntities: () =>
      state.entities.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        alive: e.alive,
      })),
    setKeys: (codes: string[]) => {
      state.keys.clear();
      for (const c of codes) state.keys.add(c);
    },
    look: (dx: number) => {
      state.lookDX += dx;
    },
  };
}
