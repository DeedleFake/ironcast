import { o as __toESM } from "../_runtime.mjs";
import { N as require_react, g as require_jsx_runtime, h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as signOut, t as authClient } from "./client-B0Lqc8Iq.mjs";
import { C as ArrowLeft, S as ChevronRight, _ as Eraser, b as DoorOpen, c as Save, d as Pencil, f as Pause, g as Heart, h as MapPin, i as Trophy, l as RotateCcw, m as Map$1, n as User, o as Trash2, p as Paintbrush, r as Upload, s as Skull, t as Zap, u as Play, v as Droplets, x as Crosshair, y as Download } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DllOd5v3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var WALL_NAMES = [
	"Empty",
	"Tech Panel",
	"Blood Brick",
	"Rust Metal",
	"Circuit",
	"Stone",
	"Hazard"
];
function emptyGrid(w, h, fill = 0) {
	return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}
function cloneLevel(level) {
	return {
		...level,
		walls: level.walls.map((row) => [...row]),
		spawn: { ...level.spawn },
		entities: level.entities.map((e) => ({ ...e }))
	};
}
function makeEmptyLevel(name = "Untitled", width = 24, height = 24) {
	const walls = emptyGrid(width, height, 0);
	for (let x = 0; x < width; x++) {
		walls[0][x] = 1;
		walls[height - 1][x] = 1;
	}
	for (let y = 0; y < height; y++) {
		walls[y][0] = 1;
		walls[y][width - 1] = 1;
	}
	return {
		version: 1,
		name,
		width,
		height,
		walls,
		spawn: {
			x: 1.5,
			y: 1.5,
			angle: 0
		},
		entities: [],
		floorColor: "#2a2420",
		ceilingColor: "#12141a",
		fogColor: "#0a0a0c",
		author: ""
	};
}
function uid(prefix = "e") {
	return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
function bordered(w, h, fill = 0, border = 1) {
	const g = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
	for (let x = 0; x < w; x++) {
		g[0][x] = border;
		g[h - 1][x] = border;
	}
	for (let y = 0; y < h; y++) {
		g[y][0] = border;
		g[y][w - 1] = border;
	}
	return g;
}
function setRect(g, x0, y0, x1, y1, tex) {
	for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]?.[x] !== void 0) g[y][x] = tex;
}
function setH(g, y, x0, x1, tex) {
	for (let x = x0; x <= x1; x++) if (g[y]) g[y][x] = tex;
}
function setV(g, x, y0, y1, tex) {
	for (let y = y0; y <= y1; y++) if (g[y]) g[y][x] = tex;
}
/** Classic tech base — corridors, rooms, enemies. */
function createOutpostLevel() {
	const w = 32;
	const h = 28;
	const walls = bordered(w, h, 0, 1);
	setH(walls, 0, 0, 31, 2);
	setH(walls, 27, 0, 31, 2);
	setV(walls, 0, 0, 27, 3);
	setV(walls, 31, 0, 27, 3);
	setRect(walls, 4, 4, 10, 4, 1);
	setRect(walls, 4, 8, 10, 8, 1);
	setV(walls, 4, 4, 8, 1);
	setRect(walls, 12, 6, 22, 6, 4);
	setRect(walls, 12, 16, 22, 16, 4);
	setV(walls, 12, 6, 16, 4);
	setV(walls, 22, 6, 16, 4);
	walls[6][16] = 0;
	walls[16][16] = 0;
	walls[11][12] = 0;
	walls[11][22] = 0;
	walls[10][15] = 5;
	walls[10][19] = 5;
	walls[13][15] = 5;
	walls[13][19] = 5;
	setRect(walls, 24, 8, 29, 8, 3);
	setRect(walls, 24, 14, 29, 14, 3);
	setV(walls, 24, 8, 14, 3);
	walls[11][24] = 0;
	setH(walls, 20, 4, 18, 6);
	setH(walls, 22, 8, 26, 6);
	setV(walls, 8, 18, 24, 6);
	setV(walls, 14, 18, 22, 2);
	setV(walls, 20, 18, 24, 2);
	walls[20][6] = 0;
	walls[20][12] = 0;
	walls[22][16] = 0;
	setRect(walls, 6, 18, 6, 24, 1);
	setRect(walls, 2, 18, 10, 18, 1);
	setRect(walls, 2, 22, 6, 26, 0);
	setH(walls, 22, 2, 6, 6);
	setV(walls, 6, 22, 26, 6);
	return {
		version: 1,
		name: "Outpost 7",
		width: w,
		height: h,
		walls,
		spawn: {
			x: 3.5,
			y: 6.5,
			angle: 0
		},
		entities: [
			{
				id: uid("en"),
				type: "enemy",
				x: 16.5,
				y: 11.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 18.5,
				y: 13.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 14.5,
				y: 9.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 26.5,
				y: 11.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 10.5,
				y: 21.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 22.5,
				y: 21.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 4.5,
				y: 24.5
			},
			{
				id: uid("am"),
				type: "ammo",
				x: 8.5,
				y: 6.5
			},
			{
				id: uid("am"),
				type: "ammo",
				x: 27.5,
				y: 12.5
			},
			{
				id: uid("am"),
				type: "ammo",
				x: 16.5,
				y: 23.5
			},
			{
				id: uid("hp"),
				type: "health",
				x: 5.5,
				y: 5.5
			},
			{
				id: uid("hp"),
				type: "health",
				x: 20.5,
				y: 11.5
			},
			{
				id: uid("ex"),
				type: "exit",
				x: 28.5,
				y: 24.5
			}
		],
		floorColor: "#2c2620",
		ceilingColor: "#101218",
		fogColor: "#0c0c10",
		author: "Built-in"
	};
}
/** Tight industrial corridors — good for editor demos. */
function createReactorLevel() {
	const w = 20;
	const h = 20;
	const walls = bordered(w, h, 0, 3);
	for (let i = 2; i < 18; i++) if (i !== 9 && i !== 10) {
		walls[5][i] = 1;
		walls[14][i] = 1;
		walls[i][5] = 4;
		walls[i][14] = 4;
	}
	setRect(walls, 7, 7, 12, 7, 6);
	setRect(walls, 7, 12, 12, 12, 6);
	setV(walls, 7, 7, 12, 6);
	setV(walls, 12, 7, 12, 6);
	walls[7][9] = 0;
	walls[7][10] = 0;
	walls[12][9] = 0;
	walls[12][10] = 0;
	walls[9][7] = 0;
	walls[10][7] = 0;
	walls[9][12] = 0;
	walls[10][12] = 0;
	walls[9][9] = 5;
	walls[9][10] = 5;
	walls[10][9] = 5;
	walls[10][10] = 5;
	return {
		version: 1,
		name: "Reactor Core",
		width: w,
		height: h,
		walls,
		spawn: {
			x: 2.5,
			y: 2.5,
			angle: Math.PI / 4
		},
		entities: [
			{
				id: uid("en"),
				type: "enemy",
				x: 9.5,
				y: 3.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 16.5,
				y: 9.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 9.5,
				y: 16.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 3.5,
				y: 9.5
			},
			{
				id: uid("en"),
				type: "enemy",
				x: 16.5,
				y: 16.5
			},
			{
				id: uid("am"),
				type: "ammo",
				x: 2.5,
				y: 9.5
			},
			{
				id: uid("hp"),
				type: "health",
				x: 17.5,
				y: 2.5
			},
			{
				id: uid("ex"),
				type: "exit",
				x: 17.5,
				y: 17.5
			}
		],
		floorColor: "#1e2228",
		ceilingColor: "#0e1014",
		fogColor: "#080a0c",
		author: "Built-in"
	};
}
var BUILTIN_LEVELS = [createOutpostLevel(), createReactorLevel()];
var STORAGE_KEY = "raycast-doom-custom-levels-v1";
function loadCustomLevels() {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((l) => l && l.version === 1 && l.walls);
	} catch {
		return [];
	}
}
function saveCustomLevels(levels) {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
}
function upsertCustomLevel(level) {
	const all = loadCustomLevels();
	const idx = all.findIndex((l) => l.name === level.name);
	if (idx >= 0) all[idx] = level;
	else all.push(level);
	saveCustomLevels(all);
}
function deleteCustomLevel(name) {
	saveCustomLevels(loadCustomLevels().filter((l) => l.name !== name));
}
function isNum(v) {
	return typeof v === "number" && Number.isFinite(v);
}
function validateWalls(walls, width, height) {
	if (!Array.isArray(walls) || walls.length !== height) return false;
	for (const row of walls) {
		if (!Array.isArray(row) || row.length !== width) return false;
		for (const cell of row) if (!isNum(cell) || cell < 0 || cell > 6 || !Number.isInteger(cell)) return false;
	}
	return true;
}
function validateSpawn(s) {
	if (!s || typeof s !== "object") return false;
	const o = s;
	return isNum(o.x) && isNum(o.y) && isNum(o.angle);
}
function validateEntity(e) {
	if (!e || typeof e !== "object") return false;
	const o = e;
	return typeof o.id === "string" && typeof o.type === "string" && [
		"enemy",
		"ammo",
		"health",
		"exit"
	].includes(o.type) && isNum(o.x) && isNum(o.y);
}
/** Parse and validate a level JSON string or object. */
function parseLevel(input) {
	let data;
	try {
		data = typeof input === "string" ? JSON.parse(input) : input;
	} catch {
		return {
			ok: false,
			error: "Invalid JSON"
		};
	}
	if (!data || typeof data !== "object") return {
		ok: false,
		error: "Level must be an object"
	};
	const o = data;
	if (o.version !== 1) return {
		ok: false,
		error: `Unsupported version (expected 1)`
	};
	if (typeof o.name !== "string" || !o.name.trim()) return {
		ok: false,
		error: "Missing level name"
	};
	if (!isNum(o.width) || !isNum(o.height)) return {
		ok: false,
		error: "Missing width/height"
	};
	const width = o.width | 0;
	const height = o.height | 0;
	if (width < 5 || height < 5 || width > 64 || height > 64) return {
		ok: false,
		error: "Size must be 5–64"
	};
	if (!validateWalls(o.walls, width, height)) return {
		ok: false,
		error: "Invalid walls grid"
	};
	if (!validateSpawn(o.spawn)) return {
		ok: false,
		error: "Invalid spawn"
	};
	if (!Array.isArray(o.entities) || !o.entities.every(validateEntity)) return {
		ok: false,
		error: "Invalid entities"
	};
	return {
		ok: true,
		level: {
			version: 1,
			name: o.name.trim().slice(0, 64),
			width,
			height,
			walls: o.walls.map((r) => [...r]),
			spawn: {
				x: o.spawn.x,
				y: o.spawn.y,
				angle: o.spawn.angle
			},
			entities: o.entities.map((e) => ({ ...e })),
			floorColor: typeof o.floorColor === "string" ? o.floorColor : "#2a2420",
			ceilingColor: typeof o.ceilingColor === "string" ? o.ceilingColor : "#12141a",
			fogColor: typeof o.fogColor === "string" ? o.fogColor : "#0a0a0c",
			author: typeof o.author === "string" ? o.author.slice(0, 64) : ""
		}
	};
}
function serializeLevel(level, pretty = true) {
	const payload = cloneLevel(level);
	return JSON.stringify(payload, null, pretty ? 2 : 0);
}
/** Trigger browser download of level JSON. */
function downloadLevel(level) {
	const json = serializeLevel(level);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	const safe = level.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "level";
	a.href = url;
	a.download = `${safe}.json`;
	a.click();
	URL.revokeObjectURL(url);
}
/** Read a File as level JSON. */
function importLevelFile(file) {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => {
			resolve(parseLevel(String(reader.result ?? "")));
		};
		reader.onerror = () => resolve({
			ok: false,
			error: "Failed to read file"
		});
		reader.readAsText(file);
	});
}
/** Procedural wall + sprite textures for the raycaster. */
var TEX_SIZE = 64;
function clampByte(n) {
	return Math.max(0, Math.min(255, n | 0));
}
function setPx(data, x, y, r, g, b, a = 255) {
	const i = (y * TEX_SIZE + x) * 4;
	data[i] = clampByte(r);
	data[i + 1] = clampByte(g);
	data[i + 2] = clampByte(b);
	data[i + 3] = clampByte(a);
}
function noise(x, y, seed) {
	const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.758) * 43758.5453;
	return n - Math.floor(n);
}
function makeWall(kind) {
	const img = new ImageData(TEX_SIZE, TEX_SIZE);
	const d = img.data;
	for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
		const n = noise(x, y, kind);
		let r = 0, g = 0, b = 0;
		if (kind === 1) {
			const panel = (Math.floor(x / 16) + Math.floor(y / 16)) % 2;
			const edge = x % 16 === 0 || y % 16 === 0 || x % 16 === 15 || y % 16 === 15;
			r = panel ? 40 : 52;
			g = panel ? 48 : 58;
			b = panel ? 62 : 74;
			if (edge) {
				r = 24;
				g = 28;
				b = 36;
			}
			if (y % 16 > 6 && y % 16 < 10 && x % 16 > 4 && x % 16 < 12) {
				r = 20;
				g = 22;
				b = 28;
			}
			r += n * 12;
			g += n * 12;
			b += n * 14;
		} else if (kind === 2) {
			const offset = Math.floor(y / 8) % 2 === 0 ? 0 : 8;
			const bx = (x + offset) % 16;
			const by = y % 8;
			const mortar = bx === 0 || by === 0;
			r = mortar ? 50 : 110 + n * 30;
			g = mortar ? 40 : 40 + n * 10;
			b = mortar ? 38 : 35 + n * 8;
			if (!mortar && n > .85) {
				r = 90;
				g = 20;
				b = 20;
			}
		} else if (kind === 3) {
			r = 70 + n * 40;
			g = 45 + n * 20;
			b = 35 + n * 15;
			if ((x + y) % 8 === 0) {
				r *= .7;
				g *= .7;
				b *= .7;
			}
			if (Math.abs(x - 32) < 2 || Math.abs(y - 32) < 2) {
				r = 40;
				g = 42;
				b = 48;
			}
		} else if (kind === 4) {
			r = 18;
			g = 28 + n * 10;
			b = 22;
			if (x % 8 === 0 || y % 8 === 0) {
				r = 20;
				g = 80;
				b = 50;
			}
			if (x % 16 === 4 && y % 16 < 10 || y % 16 === 4 && x % 16 < 10) {
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
			r = 90 + n * 40;
			g = 85 + n * 35;
			b = 75 + n * 30;
			if ((x * 3 + y * 5) % 17 === 0) {
				r *= .6;
				g *= .6;
				b *= .6;
			}
		} else if (Math.floor((x + y) / 8) % 2 === 0) {
			r = 200 + n * 20;
			g = 160 + n * 10;
			b = 20;
		} else {
			r = 20 + n * 10;
			g = 18 + n * 8;
			b = 16 + n * 8;
		}
		setPx(d, x, y, r, g, b);
	}
	return img;
}
function makeEnemy() {
	const img = new ImageData(TEX_SIZE, TEX_SIZE);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
	const cx = 32;
	const cy = 28;
	for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
		const dx = x - cx;
		const dy = y - cy;
		if (y > 40 && y < 60) {
			if (Math.abs(dx - 8) < 5 || Math.abs(dx + 8) < 5) setPx(d, x, y, 90, 30, 30, 255);
		}
		if (y > 18 && y < 44) {
			const w = 14 + (y - 18) * .15;
			if (Math.abs(dx) < w) {
				const shade = 100 + (dx + dy) * .5;
				setPx(d, x, y, shade, 35, 35, 255);
			}
		}
		if (dx * dx + (dy + 4) * (dy + 4) < 100 && y < 26) setPx(d, x, y, 120, 40, 40, 255);
		if (y >= 16 && y <= 19) {
			if (Math.abs(dx - 4) < 2 || Math.abs(dx + 4) < 2) setPx(d, x, y, 255, 200, 40, 255);
		}
		if (y >= 6 && y < 14) {
			if (Math.abs(dx - 10) < 2 || Math.abs(dx + 10) < 2) setPx(d, x, y, 80, 25, 25, 255);
		}
	}
	return img;
}
function makePickup(r, g, b, glyph) {
	const img = new ImageData(TEX_SIZE, TEX_SIZE);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
	for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) {
		const dx = x - 32;
		const dy = y - 32;
		if (dx * dx + dy * dy < 220) {
			const edge = dx * dx + dy * dy > 180;
			setPx(d, x, y, edge ? r * .5 : r, edge ? g * .5 : g, edge ? b * .5 : b, 255);
		}
	}
	if (glyph === "+") for (let i = -8; i <= 8; i++) {
		setPx(d, 32 + i, 32, 255, 255, 255, 255);
		setPx(d, 32, 32 + i, 255, 255, 255, 255);
		setPx(d, 32 + i, 31, 255, 255, 255, 255);
		setPx(d, 31, 32 + i, 255, 255, 255, 255);
	}
	else for (let y = 24; y < 40; y++) for (let x = 24; x < 40; x++) if (x >= 26 && x <= 28 || y >= 24 && y <= 26 && x <= 36 || y >= 30 && y <= 32 && x <= 34 || y >= 24 && x >= 34 && x <= 36) setPx(d, x, y, 20, 20, 20, 255);
	return img;
}
function makeExit() {
	const img = new ImageData(TEX_SIZE, TEX_SIZE);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
	for (let y = 8; y < 56; y++) for (let x = 12; x < 52; x++) if (x === 12 || x === 51 || y === 8 || y === 55) setPx(d, x, y, 40, 200, 100, 255);
	else if ((x + y) % 6 < 2) setPx(d, x, y, 20, 80, 50, 200);
	else setPx(d, x, y, 10, 40, 30, 180);
	for (let i = 0; i < 12; i++) {
		setPx(d, 28 + i, 28 + i, 80, 255, 140, 255);
		setPx(d, 40 - i, 28 + i, 80, 255, 140, 255);
	}
	return img;
}
function makeWeapon() {
	const img = new ImageData(TEX_SIZE, TEX_SIZE);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
	for (let y = 20; y < 44; y++) for (let x = 20; x < 44; x++) {
		const dx = x - 32;
		const dy = y - 32;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 14) {
			const t = 1 - dist / 14;
			setPx(d, x, y, 255, 200 + t * 55, 40, t * 255);
		}
	}
	return img;
}
var cached = null;
function getTextures() {
	if (cached) return cached;
	cached = {
		size: TEX_SIZE,
		walls: [
			1,
			2,
			3,
			4,
			5,
			6
		].map(makeWall),
		enemy: makeEnemy(),
		ammo: makePickup(200, 160, 40, "A"),
		health: makePickup(40, 180, 80, "+"),
		exit: makeExit(),
		weapon: makeWeapon()
	};
	return cached;
}
/** Sample wall texture with optional shade (0-1). Returns [r,g,b]. */
function sampleWall(atlas, texId, u, v, shade) {
	const tex = atlas.walls[Math.max(0, Math.min(atlas.walls.length - 1, texId - 1))];
	if (!tex) return [
		40,
		40,
		40
	];
	const size = atlas.size;
	const tx = Math.max(0, Math.min(size - 1, Math.floor(u * size))) | 0;
	const i = ((Math.max(0, Math.min(size - 1, Math.floor(v * size))) | 0) * size + tx) * 4;
	const d = tex.data;
	return [
		(d[i] ?? 0) * shade | 0,
		(d[i + 1] ?? 0) * shade | 0,
		(d[i + 2] ?? 0) * shade | 0
	];
}
function sampleSprite(img, u, v, shade) {
	const size = img.width;
	const tx = Math.max(0, Math.min(size - 1, Math.floor(u * size))) | 0;
	const i = ((Math.max(0, Math.min(size - 1, Math.floor(v * size))) | 0) * size + tx) * 4;
	const d = img.data;
	return [
		(d[i] ?? 0) * shade | 0,
		(d[i + 1] ?? 0) * shade | 0,
		(d[i + 2] ?? 0) * shade | 0,
		d[i + 3] ?? 0
	];
}
/** Lightweight WebAudio SFX — unlock on first user gesture. */
var ctx = null;
function getCtx() {
	if (typeof window === "undefined") return null;
	if (!ctx) try {
		ctx = new AudioContext();
	} catch {
		return null;
	}
	return ctx;
}
function unlockAudio() {
	const c = getCtx();
	if (c?.state === "suspended") c.resume();
}
function beep(freq, dur, type = "square", gain = .08, slide = 0) {
	const c = getCtx();
	if (!c) return;
	const t0 = c.currentTime;
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t0);
	if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
	g.gain.setValueAtTime(gain, t0);
	g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
	osc.connect(g);
	g.connect(c.destination);
	osc.start(t0);
	osc.stop(t0 + dur + .02);
}
function noiseBurst(dur, gain = .06) {
	const c = getCtx();
	if (!c) return;
	const n = c.sampleRate * dur | 0;
	const buf = c.createBuffer(1, n, c.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
	const src = c.createBufferSource();
	src.buffer = buf;
	const g = c.createGain();
	const f = c.createBiquadFilter();
	f.type = "lowpass";
	f.frequency.value = 1200;
	g.gain.setValueAtTime(gain, c.currentTime);
	g.gain.exponentialRampToValueAtTime(.001, c.currentTime + dur);
	src.connect(f);
	f.connect(g);
	g.connect(c.destination);
	src.start();
}
var sfx = {
	shoot: () => {
		noiseBurst(.08, .1);
		beep(180, .06, "sawtooth", .05, -80);
	},
	empty: () => beep(90, .05, "square", .04),
	hit: () => {
		beep(320, .04, "square", .06, -100);
		noiseBurst(.05, .04);
	},
	hurt: () => beep(120, .15, "sawtooth", .08, -60),
	pickup: () => {
		beep(440, .06, "square", .05);
		beep(660, .08, "square", .04);
	},
	enemyDie: () => {
		beep(200, .12, "sawtooth", .07, -150);
		noiseBurst(.15, .08);
	},
	win: () => {
		beep(440, .1, "square", .05);
		setTimeout(() => beep(554, .1, "square", .05), 100);
		setTimeout(() => beep(659, .18, "square", .06), 200);
	},
	click: () => beep(600, .03, "square", .03)
};
var MOVE_SPEED = 3.2;
var SPRINT_MULT = 1.55;
var ROT_SPEED = 2.4;
var MOUSE_SENS = .0022;
var PLAYER_RADIUS = .22;
var FIRE_INTERVAL = .18;
var MAX_AMMO = 99;
var ENEMY_SPEED = 1.35;
var ENEMY_RANGE = 1.1;
var ENEMY_DAMAGE = 12;
var ENEMY_ATTACK_CD = .9;
var HITSCAN_DAMAGE = 34;
function angleToDir(angle) {
	return {
		dirX: Math.cos(angle),
		dirY: Math.sin(angle)
	};
}
function setAngle(state, angle) {
	state.angle = angle;
	const { dirX, dirY } = angleToDir(angle);
	state.dirX = dirX;
	state.dirY = dirY;
	state.planeX = -dirY * state.planeLen;
	state.planeY = dirX * state.planeLen;
}
function createGameState(level) {
	const L = cloneLevel(level);
	const entities = L.entities.map((e) => ({
		id: e.id,
		type: e.type,
		x: e.x,
		y: e.y,
		hp: e.type === "enemy" ? 100 : 1,
		alive: true,
		hurtFlash: 0,
		attackCd: .5 + Math.random() * .5
	}));
	const totalEnemies = entities.filter((e) => e.type === "enemy").length;
	const state = {
		level: L,
		px: L.spawn.x,
		py: L.spawn.y,
		dirX: 1,
		dirY: 0,
		planeX: 0,
		planeY: .66,
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
		keys: /* @__PURE__ */ new Set(),
		pointerLocked: false,
		lookDX: 0,
		lookDY: 0,
		fireHeld: false,
		fireCd: 0,
		zBuffer: /* @__PURE__ */ new Float64Array(1),
		planeLen: .66
	};
	setAngle(state, L.spawn.angle);
	return state;
}
function isWall(state, x, y) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	if (ix < 0 || iy < 0 || ix >= state.level.width || iy >= state.level.height) return true;
	return (state.level.walls[iy]?.[ix] ?? 1) > 0;
}
function blocked(state, x, y) {
	return isWall(state, x - PLAYER_RADIUS, y - PLAYER_RADIUS) || isWall(state, x + PLAYER_RADIUS, y - PLAYER_RADIUS) || isWall(state, x - PLAYER_RADIUS, y + PLAYER_RADIUS) || isWall(state, x + PLAYER_RADIUS, y + PLAYER_RADIUS);
}
function tryMove(state, nx, ny) {
	if (!blocked(state, nx, state.py)) state.px = nx;
	if (!blocked(state, state.px, ny)) state.py = ny;
}
function hasLos(state, x0, y0, x1, y1) {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const steps = Math.ceil(Math.hypot(dx, dy) * 8);
	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		if (isWall(state, x0 + dx * t, y0 + dy * t)) return false;
	}
	return true;
}
function fireWeapon(state) {
	if (state.fireCd > 0 || state.mode !== "playing") return;
	if (state.ammo <= 0) {
		sfx.empty();
		state.fireCd = .25;
		return;
	}
	state.ammo -= 1;
	state.fireCd = FIRE_INTERVAL;
	state.muzzle = .08;
	state.shake = Math.max(state.shake, .35);
	sfx.shoot();
	const spread = (Math.random() - .5) * .04;
	const cos = Math.cos(spread);
	const sin = Math.sin(spread);
	const rdx = state.dirX * cos - state.dirY * sin;
	const rdy = state.dirX * sin + state.dirY * cos;
	let best = null;
	let bestDist = Infinity;
	for (const e of state.entities) {
		if (!e.alive || e.type !== "enemy") continue;
		const dx = e.x - state.px;
		const dy = e.y - state.py;
		const dist = Math.hypot(dx, dy);
		if (dist < .3 || dist > 18) continue;
		if (dx * rdx + dy * rdy < .2) continue;
		if (Math.abs(dx * -rdy + dy * rdx) > .35 + dist * .02) continue;
		if (!hasLos(state, state.px, state.py, e.x, e.y)) continue;
		if (dist < bestDist) {
			bestDist = dist;
			best = e;
		}
	}
	if (best) {
		best.hp -= HITSCAN_DAMAGE;
		best.hurtFlash = .15;
		state.hitmarker = .12;
		sfx.hit();
		if (best.hp <= 0) {
			best.alive = false;
			state.kills += 1;
			state.score += 100;
			sfx.enemyDie();
			if (state.kills >= state.totalEnemies && state.totalEnemies > 0) state.message = "All hostiles down — find the exit";
		}
	}
}
function updateEnemies(state, dt) {
	for (const e of state.entities) {
		if (!e.alive || e.type !== "enemy") continue;
		e.hurtFlash = Math.max(0, e.hurtFlash - dt);
		e.attackCd = Math.max(0, e.attackCd - dt);
		const dx = state.px - e.x;
		const dy = state.py - e.y;
		const dist = Math.hypot(dx, dy);
		if (dist > 14) continue;
		if (dist > ENEMY_RANGE && hasLos(state, e.x, e.y, state.px, state.py)) {
			const nx = e.x + dx / dist * ENEMY_SPEED * dt;
			const ny = e.y + dy / dist * ENEMY_SPEED * dt;
			if (!isWall(state, nx, e.y)) e.x = nx;
			if (!isWall(state, e.x, ny)) e.y = ny;
		}
		if (dist < ENEMY_RANGE && e.attackCd <= 0) {
			e.attackCd = ENEMY_ATTACK_CD;
			state.health -= ENEMY_DAMAGE;
			state.shake = Math.max(state.shake, .7);
			sfx.hurt();
			if (state.health <= 0) {
				state.health = 0;
				state.mode = "dead";
				state.message = "YOU DIED";
			}
		}
	}
}
function updatePickups(state) {
	for (const e of state.entities) {
		if (!e.alive) continue;
		if (Math.hypot(e.x - state.px, e.y - state.py) > .55) continue;
		if (e.type === "ammo") {
			e.alive = false;
			state.ammo = Math.min(MAX_AMMO, state.ammo + 15);
			state.score += 10;
			sfx.pickup();
		} else if (e.type === "health") {
			e.alive = false;
			state.health = Math.min(100, state.health + 25);
			state.score += 10;
			sfx.pickup();
		} else if (e.type === "exit") if (state.kills >= state.totalEnemies) {
			e.alive = false;
			state.mode = "won";
			state.message = "SECTOR CLEARED";
			state.score += 500;
			sfx.win();
		} else state.message = `Kill remaining hostiles (${state.totalEnemies - state.kills})`;
	}
}
function updateGame(state, dt) {
	if (state.mode !== "playing") return;
	const d = Math.min(dt, .1);
	if (state.lookDX !== 0 || state.lookDY !== 0) {
		setAngle(state, state.angle - state.lookDX * MOUSE_SENS);
		state.lookDX = 0;
		state.lookDY = 0;
	}
	let rot = 0;
	if (state.keys.has("ArrowLeft") || state.keys.has("KeyQ")) rot += 1;
	if (state.keys.has("ArrowRight") || state.keys.has("KeyE")) rot -= 1;
	if (rot !== 0) setAngle(state, state.angle + rot * ROT_SPEED * d);
	const speed = MOVE_SPEED * (state.keys.has("ShiftLeft") || state.keys.has("ShiftRight") ? SPRINT_MULT : 1) * d;
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
		mx = mx / len * speed;
		my = my / len * speed;
		tryMove(state, state.px + mx, state.py + my);
		state.walkDist += speed;
		state.bob = Math.sin(state.walkDist * 12) * 3;
	} else state.bob *= .85;
	state.fireCd = Math.max(0, state.fireCd - d);
	state.shake = Math.max(0, state.shake - d * 3);
	state.muzzle = Math.max(0, state.muzzle - d);
	state.hitmarker = Math.max(0, state.hitmarker - d);
	if (state.fireHeld || state.keys.has("Space")) fireWeapon(state);
	updateEnemies(state, d);
	updatePickups(state);
}
function getSpriteImg(type, atlas) {
	if (type === "enemy") return atlas.enemy;
	if (type === "ammo") return atlas.ammo;
	if (type === "health") return atlas.health;
	return atlas.exit;
}
function renderGame(ctx, state, width, height) {
	const atlas = getTextures();
	if (state.zBuffer.length !== width) state.zBuffer = new Float64Array(width);
	const shakeX = state.shake > 0 ? (Math.random() - .5) * state.shake * 8 : 0;
	const shakeY = state.shake > 0 ? (Math.random() - .5) * state.shake * 8 : 0;
	const bob = state.bob;
	const half = height / 2;
	ctx.fillStyle = state.level.ceilingColor;
	ctx.fillRect(0, 0, width, half + bob + shakeY);
	ctx.fillStyle = state.level.floorColor;
	ctx.fillRect(0, half + bob + shakeY, width, height);
	const grad = ctx.createLinearGradient(0, 0, 0, height);
	grad.addColorStop(0, "rgba(0,0,0,0.45)");
	grad.addColorStop(.45, "rgba(0,0,0,0)");
	grad.addColorStop(.55, "rgba(0,0,0,0)");
	grad.addColorStop(1, "rgba(0,0,0,0.5)");
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);
	const imgData = ctx.getImageData(0, 0, width, height);
	const pix = imgData.data;
	for (let col = 0; col < width; col++) {
		const cameraX = 2 * col / width - 1;
		const rayDirX = state.dirX + state.planeX * cameraX;
		const rayDirY = state.dirY + state.planeY * cameraX;
		let mapX = Math.floor(state.px);
		let mapY = Math.floor(state.py);
		const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
		const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);
		let stepX;
		let stepY;
		let sideDistX;
		let sideDistY;
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
			if (mapX < 0 || mapY < 0 || mapX >= state.level.width || mapY >= state.level.height) {
				hit = 1;
				texId = 1;
				break;
			}
			const cell = state.level.walls[mapY]?.[mapX] ?? 1;
			if (cell > 0) {
				hit = 1;
				texId = cell;
			}
		}
		let perpWallDist;
		if (side === 0) perpWallDist = (mapX - state.px + (1 - stepX) / 2) / rayDirX;
		else perpWallDist = (mapY - state.py + (1 - stepY) / 2) / rayDirY;
		if (perpWallDist < 1e-4) perpWallDist = 1e-4;
		state.zBuffer[col] = perpWallDist;
		const lineHeight = Math.floor(height / perpWallDist);
		let drawStart = Math.floor(-lineHeight / 2 + half + bob + shakeY);
		let drawEnd = Math.floor(lineHeight / 2 + half + bob + shakeY);
		if (drawStart < 0) drawStart = 0;
		if (drawEnd >= height) drawEnd = height - 1;
		let wallX;
		if (side === 0) wallX = state.py + perpWallDist * rayDirY;
		else wallX = state.px + perpWallDist * rayDirX;
		wallX -= Math.floor(wallX);
		let texX = Math.floor(wallX * atlas.size);
		if (side === 0 && rayDirX > 0) texX = atlas.size - texX - 1;
		if (side === 1 && rayDirY < 0) texX = atlas.size - texX - 1;
		const shade = Math.min(1, 1.2 / (1 + perpWallDist * .22)) * (side === 1 ? .72 : 1);
		const colX = Math.min(width - 1, Math.max(0, Math.floor(col + shakeX)));
		for (let y = drawStart; y <= drawEnd; y++) {
			const d = y * 256 - height * 128 + lineHeight * 128;
			const texY = Math.floor(d * atlas.size / lineHeight / 256);
			const u = texX / atlas.size;
			const v = texY / atlas.size;
			const [r, g, b] = sampleWall(atlas, texId, u, v, shade);
			const i = (y * width + colX) * 4;
			pix[i] = r;
			pix[i + 1] = g;
			pix[i + 2] = b;
			pix[i + 3] = 255;
		}
	}
	const sprites = [];
	for (const e of state.entities) {
		if (!e.alive) continue;
		const dist = (e.x - state.px) * (e.x - state.px) + (e.y - state.py) * (e.y - state.py);
		sprites.push({
			ent: e,
			dist
		});
	}
	sprites.sort((a, b) => b.dist - a.dist);
	for (const { ent } of sprites) {
		const spriteX = ent.x - state.px;
		const spriteY = ent.y - state.py;
		const invDet = 1 / (state.planeX * state.dirY - state.dirX * state.planeY);
		const transformX = invDet * (state.dirY * spriteX - state.dirX * spriteY);
		const transformY = invDet * (-state.planeY * spriteX + state.planeX * spriteY);
		if (transformY <= .05) continue;
		const spriteScreenX = Math.floor(width / 2 * (1 + transformX / transformY));
		const spriteH = Math.abs(Math.floor(height / transformY));
		const spriteW = spriteH;
		const drawStartY = Math.floor(-spriteH / 2 + half + bob + shakeY);
		const drawEndY = Math.floor(spriteH / 2 + half + bob + shakeY);
		const drawStartX = Math.floor(-spriteW / 2 + spriteScreenX + shakeX);
		const drawEndX = Math.floor(spriteW / 2 + spriteScreenX + shakeX);
		const img = getSpriteImg(ent.type, atlas);
		const shade = Math.min(1, 1.1 / (1 + transformY * .2));
		const flash = ent.hurtFlash > 0;
		for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
			if (stripe < 0 || stripe >= width) continue;
			if (transformY >= (state.zBuffer[stripe] ?? 0)) continue;
			const texX = (stripe - (-spriteW / 2 + spriteScreenX + shakeX)) / spriteW;
			for (let y = Math.max(0, drawStartY); y < Math.min(height, drawEndY); y++) {
				let [r, g, b, a] = sampleSprite(img, texX, (y - drawStartY) / spriteH, shade);
				if (a < 16) continue;
				if (flash) {
					r = Math.min(255, r + 120);
					g = Math.min(255, g + 40);
					b = Math.min(255, b + 40);
				}
				const i = (y * width + stripe) * 4;
				const alpha = a / 255;
				pix[i] = r * alpha + (pix[i] ?? 0) * (1 - alpha) | 0;
				pix[i + 1] = g * alpha + (pix[i + 1] ?? 0) * (1 - alpha) | 0;
				pix[i + 2] = b * alpha + (pix[i + 2] ?? 0) * (1 - alpha) | 0;
				pix[i + 3] = 255;
			}
		}
	}
	ctx.putImageData(imgData, 0, 0);
	drawWeapon(ctx, width, height, state);
	const cx = width / 2;
	const cy = height / 2 + bob * .3;
	ctx.strokeStyle = state.hitmarker > 0 ? "rgba(255,220,80,0.95)" : "rgba(232,228,220,0.75)";
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
		const v = ctx.createRadialGradient(cx, cy, height * .2, cx, cy, height * .7);
		v.addColorStop(0, "rgba(0,0,0,0)");
		v.addColorStop(1, `rgba(120,0,0,${.35 + (40 - state.health) * .01})`);
		ctx.fillStyle = v;
		ctx.fillRect(0, 0, width, height);
	}
}
function drawWeapon(ctx, width, height, state) {
	const bobX = Math.sin(state.walkDist * 8) * 6;
	const bobY = Math.abs(Math.sin(state.walkDist * 8)) * 4 + state.bob * .5;
	const kick = state.muzzle > 0 ? 12 : 0;
	const baseX = width * .58 + bobX;
	const baseY = height * .72 + bobY + kick;
	ctx.fillStyle = "rgba(0,0,0,0.35)";
	ctx.beginPath();
	ctx.ellipse(baseX + 20, height - 8, 70, 12, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.save();
	ctx.translate(baseX, baseY);
	ctx.fillStyle = "#3a3028";
	ctx.fillRect(-8, 40, 28, 55);
	ctx.fillStyle = "#2a221c";
	ctx.fillRect(-4, 48, 20, 40);
	ctx.fillStyle = "#5a5a62";
	ctx.fillRect(-20, 10, 90, 36);
	ctx.fillStyle = "#3e3e46";
	ctx.fillRect(-16, 14, 82, 12);
	ctx.fillStyle = "#2c2c32";
	ctx.fillRect(60, 18, 70, 14);
	ctx.fillStyle = "#1a1a1e";
	ctx.fillRect(125, 20, 18, 10);
	ctx.fillStyle = "#4a4038";
	ctx.fillRect(10, 40, 22, 28);
	ctx.fillStyle = "#8a6a50";
	ctx.fillRect(-18, 50, 24, 20);
	ctx.fillStyle = "#6a5040";
	ctx.fillRect(8, 55, 22, 16);
	if (state.muzzle > 0) {
		const atlas = getTextures();
		ctx.globalAlpha = Math.min(1, state.muzzle * 12);
		ctx.drawImage(imageDataToCanvas(atlas.weapon), 120, -10, 48, 48);
		ctx.globalAlpha = 1;
	}
	ctx.restore();
}
var _canvasCache = /* @__PURE__ */ new WeakMap();
function imageDataToCanvas(img) {
	let c = _canvasCache.get(img);
	if (!c) {
		c = document.createElement("canvas");
		c.width = img.width;
		c.height = img.height;
		c.getContext("2d").putImageData(img, 0, 0);
		_canvasCache.set(img, c);
	}
	return c;
}
function renderMinimap(ctx, state, size) {
	const { level } = state;
	const cell = size / Math.max(level.width, level.height);
	const w = level.width * cell;
	const h = level.height * cell;
	ctx.fillStyle = "rgba(10,10,12,0.75)";
	ctx.fillRect(0, 0, w, h);
	for (let y = 0; y < level.height; y++) for (let x = 0; x < level.width; x++) {
		const c = level.walls[y][x];
		if (c > 0) {
			ctx.fillStyle = [
				"",
				"#4a5568",
				"#8b3a3a",
				"#6b4a3a",
				"#2d6b4a",
				"#6b6b5a",
				"#a08a20"
			][c] ?? "#555";
			ctx.fillRect(x * cell, y * cell, cell + .5, cell + .5);
		}
	}
	for (const e of state.entities) {
		if (!e.alive) continue;
		if (e.type === "enemy") ctx.fillStyle = "#e04040";
		else if (e.type === "ammo") ctx.fillStyle = "#d4a017";
		else if (e.type === "health") ctx.fillStyle = "#40c060";
		else ctx.fillStyle = "#40e0a0";
		ctx.beginPath();
		ctx.arc(e.x * cell, e.y * cell, cell * .35, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = "#e8e4dc";
	ctx.beginPath();
	ctx.arc(state.px * cell, state.py * cell, cell * .4, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = "#c43c2c";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(state.px * cell, state.py * cell);
	ctx.lineTo((state.px + state.dirX * 1.2) * cell, (state.py + state.dirY * 1.2) * cell);
	ctx.stroke();
}
function attachControlsProbe(state) {
	if (typeof window === "undefined") return;
	window.__controlsTest = {
		getYaw: () => state.angle,
		getSpeed: () => {
			return state.keys.has("KeyW") || state.keys.has("KeyS") || state.keys.has("KeyA") || state.keys.has("KeyD") ? MOVE_SPEED : 0;
		},
		getPos: () => ({
			x: state.px,
			y: state.py
		}),
		getDir: () => ({
			x: state.dirX,
			y: state.dirY
		}),
		setKeys: (codes) => {
			state.keys.clear();
			for (const c of codes) state.keys.add(c);
		},
		look: (dx) => {
			state.lookDX += dx;
		}
	};
}
var INTERNAL_W = 480;
var INTERNAL_H = 300;
function PlayView({ level, onExit }) {
	const canvasRef = (0, import_react.useRef)(null);
	const miniRef = (0, import_react.useRef)(null);
	const stateRef = (0, import_react.useRef)(null);
	const rafRef = (0, import_react.useRef)(0);
	const lastRef = (0, import_react.useRef)(0);
	const [hud, setHud] = (0, import_react.useState)({
		health: 100,
		ammo: 40,
		score: 0,
		kills: 0,
		total: 0,
		mode: "playing",
		message: "",
		needClick: true
	});
	const [showMap, setShowMap] = (0, import_react.useState)(true);
	const touchRef = (0, import_react.useRef)({
		moveId: -1,
		lookId: -1,
		originX: 0,
		originY: 0,
		lookLastX: 0,
		lookLastY: 0
	});
	const restart = (0, import_react.useCallback)(() => {
		const s = createGameState(level);
		stateRef.current = s;
		attachControlsProbe(s);
		setHud({
			health: s.health,
			ammo: s.ammo,
			score: s.score,
			kills: s.kills,
			total: s.totalEnemies,
			mode: s.mode,
			message: "",
			needClick: true
		});
	}, [level]);
	(0, import_react.useEffect)(() => {
		restart();
	}, [restart]);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d", { alpha: false });
		if (!ctx) return;
		ctx.imageSmoothingEnabled = false;
		const onKeyDown = (e) => {
			const s = stateRef.current;
			if (!s) return;
			if (e.code === "Escape") {
				if (s.mode === "playing") s.mode = "paused";
				else if (s.mode === "paused") s.mode = "playing";
				e.preventDefault();
				return;
			}
			if (e.code === "KeyM") {
				setShowMap((v) => !v);
				return;
			}
			if (e.code === "KeyR" && (s.mode === "dead" || s.mode === "won")) {
				restart();
				return;
			}
			s.keys.add(e.code);
			if ([
				"Space",
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight"
			].includes(e.code)) e.preventDefault();
		};
		const onKeyUp = (e) => {
			stateRef.current?.keys.delete(e.code);
		};
		const onBlur = () => stateRef.current?.keys.clear();
		const onMouseMove = (e) => {
			const s = stateRef.current;
			if (!s || !s.pointerLocked || s.mode !== "playing") return;
			s.lookDX += e.movementX;
			s.lookDY += e.movementY;
		};
		const onPointerLockChange = () => {
			const s = stateRef.current;
			if (!s) return;
			s.pointerLocked = document.pointerLockElement === canvas;
			setHud((h) => ({
				...h,
				needClick: !s.pointerLocked && s.mode === "playing"
			}));
		};
		const onMouseDown = (e) => {
			const s = stateRef.current;
			if (!s) return;
			if (e.button === 0) {
				if (s.mode === "playing" && s.pointerLocked) s.fireHeld = true;
			}
		};
		const onMouseUp = (e) => {
			if (e.button === 0 && stateRef.current) stateRef.current.fireHeld = false;
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", onBlur);
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("pointerlockchange", onPointerLockChange);
		canvas.addEventListener("mousedown", onMouseDown);
		window.addEventListener("mouseup", onMouseUp);
		const loop = (t) => {
			const s = stateRef.current;
			if (!s) {
				rafRef.current = requestAnimationFrame(loop);
				return;
			}
			const dt = lastRef.current ? (t - lastRef.current) / 1e3 : 0;
			lastRef.current = t;
			updateGame(s, dt);
			renderGame(ctx, s, INTERNAL_W, INTERNAL_H);
			if (miniRef.current && showMap) {
				const mctx = miniRef.current.getContext("2d");
				if (mctx) {
					const ms = 140;
					miniRef.current.width = Math.ceil(s.level.width / Math.max(s.level.width, s.level.height) * ms);
					miniRef.current.height = Math.ceil(s.level.height / Math.max(s.level.width, s.level.height) * ms);
					renderMinimap(mctx, s, ms);
				}
			}
			setHud((prev) => {
				if (prev.health === s.health && prev.ammo === s.ammo && prev.score === s.score && prev.kills === s.kills && prev.mode === s.mode && prev.message === s.message && prev.needClick === (!s.pointerLocked && s.mode === "playing")) return prev;
				return {
					health: s.health,
					ammo: s.ammo,
					score: s.score,
					kills: s.kills,
					total: s.totalEnemies,
					mode: s.mode,
					message: s.message,
					needClick: !s.pointerLocked && s.mode === "playing"
				};
			});
			rafRef.current = requestAnimationFrame(loop);
		};
		rafRef.current = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(rafRef.current);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("pointerlockchange", onPointerLockChange);
			canvas.removeEventListener("mousedown", onMouseDown);
			window.removeEventListener("mouseup", onMouseUp);
			if (document.pointerLockElement === canvas) document.exitPointerLock();
		};
	}, [restart, showMap]);
	const requestPlay = () => {
		unlockAudio();
		const canvas = canvasRef.current;
		const s = stateRef.current;
		if (!canvas || !s) return;
		if (s.mode === "paused") s.mode = "playing";
		if (s.mode === "dead" || s.mode === "won") {
			restart();
			return;
		}
		const markUnlockedPlay = () => {
			s.pointerLocked = true;
			setHud((h) => ({
				...h,
				needClick: false
			}));
		};
		try {
			const p = canvas.requestPointerLock.call(canvas, { unadjustedMovement: true });
			if (p && typeof p.then === "function") p.then(() => {
				if (document.pointerLockElement !== canvas) markUnlockedPlay();
			}).catch(() => {
				try {
					canvas.requestPointerLock();
				} catch {}
				setTimeout(() => {
					if (document.pointerLockElement !== canvas) markUnlockedPlay();
				}, 100);
			});
			else setTimeout(() => {
				if (document.pointerLockElement !== canvas) markUnlockedPlay();
			}, 100);
		} catch {
			markUnlockedPlay();
		}
	};
	const onTouchStart = (e) => {
		unlockAudio();
		const s = stateRef.current;
		if (!s || s.mode !== "playing") return;
		if (!s.pointerLocked) {
			s.pointerLocked = true;
			setHud((h) => ({
				...h,
				needClick: false
			}));
		}
		const rect = e.currentTarget.getBoundingClientRect();
		for (let i = 0; i < e.changedTouches.length; i++) {
			const t = e.changedTouches[i];
			const x = t.clientX - rect.left;
			if (x < rect.width * .45) {
				touchRef.current.moveId = t.identifier;
				touchRef.current.originX = x;
				touchRef.current.originY = t.clientY - rect.top;
			} else {
				touchRef.current.lookId = t.identifier;
				touchRef.current.lookLastX = t.clientX;
				touchRef.current.lookLastY = t.clientY;
			}
		}
	};
	const onTouchMove = (e) => {
		const s = stateRef.current;
		if (!s) return;
		e.preventDefault();
		const rect = e.currentTarget.getBoundingClientRect();
		s.keys.delete("KeyW");
		s.keys.delete("KeyS");
		s.keys.delete("KeyA");
		s.keys.delete("KeyD");
		for (let i = 0; i < e.touches.length; i++) {
			const t = e.touches[i];
			if (t.identifier === touchRef.current.moveId) {
				const x = t.clientX - rect.left;
				const y = t.clientY - rect.top;
				const dx = x - touchRef.current.originX;
				const dy = y - touchRef.current.originY;
				const dead = 18;
				if (dy < -18) s.keys.add("KeyW");
				if (dy > dead) s.keys.add("KeyS");
				if (dx < -18) s.keys.add("KeyA");
				if (dx > dead) s.keys.add("KeyD");
			} else if (t.identifier === touchRef.current.lookId) {
				s.lookDX += (t.clientX - touchRef.current.lookLastX) * 1.6;
				s.lookDY += (t.clientY - touchRef.current.lookLastY) * 1.6;
				touchRef.current.lookLastX = t.clientX;
				touchRef.current.lookLastY = t.clientY;
			}
		}
	};
	const onTouchEnd = (e) => {
		const s = stateRef.current;
		for (let i = 0; i < e.changedTouches.length; i++) {
			const t = e.changedTouches[i];
			if (t.identifier === touchRef.current.moveId) {
				touchRef.current.moveId = -1;
				s?.keys.delete("KeyW");
				s?.keys.delete("KeyS");
				s?.keys.delete("KeyA");
				s?.keys.delete("KeyD");
			}
			if (t.identifier === touchRef.current.lookId) touchRef.current.lookId = -1;
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex h-[calc(100dvh-var(--grok-banner-h,0px))] w-full flex-col overflow-hidden bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onExit,
					className: "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden sm:inline",
						children: "Menu"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display truncate text-sm font-semibold tracking-wider text-fg uppercase",
					children: level.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setShowMap((v) => !v),
						className: "rounded-md p-2 text-muted hover:bg-surface-2 hover:text-fg",
						"aria-label": "Toggle minimap",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "size-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							const s = stateRef.current;
							if (s) s.mode = s.mode === "paused" ? "playing" : "paused";
						},
						className: "rounded-md p-2 text-muted hover:bg-surface-2 hover:text-fg",
						"aria-label": "Pause",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" })
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-0 min-h-0 flex-1 touch-none select-none overflow-hidden bg-black",
			onTouchStart,
			onTouchMove,
			onTouchEnd,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: canvasRef,
					width: INTERNAL_W,
					height: INTERNAL_H,
					className: "h-full w-full cursor-crosshair object-contain",
					style: { imageRendering: "pixelated" },
					onClick: requestPlay
				}),
				showMap && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: miniRef,
					className: "pointer-events-none absolute top-3 right-3 rounded border border-border/80 shadow-lg",
					style: { imageRendering: "pixelated" }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pt-10 pb-3 sm:px-5 sm:pb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 sm:gap-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HudStat, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-4 text-primary" }),
							label: "ARMOR",
							value: hud.health,
							danger: hud.health < 30
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HudStat, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4 text-accent" }),
							label: "AMMO",
							value: hud.ammo,
							danger: hud.ammo < 5
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 sm:gap-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HudStat, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-4 text-muted" }),
							label: "KILLS",
							value: `${hud.kills}/${hud.total}`
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HudStat, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, { className: "size-4 text-accent" }),
							label: "SCORE",
							value: hud.score
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "absolute right-4 bottom-24 z-10 flex size-16 items-center justify-center rounded-full border-2 border-primary/60 bg-primary/30 text-fg shadow-lg backdrop-blur-sm sm:hidden",
					"aria-label": "Fire",
					onTouchStart: (e) => {
						e.preventDefault();
						e.stopPropagation();
						unlockAudio();
						if (stateRef.current) {
							stateRef.current.pointerLocked = true;
							stateRef.current.fireHeld = true;
						}
						setHud((h) => ({
							...h,
							needClick: false
						}));
					},
					onTouchEnd: (e) => {
						e.preventDefault();
						if (stateRef.current) stateRef.current.fireHeld = false;
					},
					onMouseDown: () => {
						if (stateRef.current) stateRef.current.fireHeld = true;
					},
					onMouseUp: () => {
						if (stateRef.current) stateRef.current.fireHeld = false;
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-7" })
				}),
				hud.needClick && hud.mode === "playing" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: requestPlay,
					className: "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[2px]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border bg-surface/95 px-8 py-6 text-center shadow-2xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-xl font-bold tracking-widest text-fg uppercase",
								children: "Click to fight"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 max-w-xs text-sm text-muted",
								children: "WASD move · Mouse look · Click/Space shoot · Shift sprint · Esc pause"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-dim",
								children: "Touch: left stick move · right drag look · fire button"
							})
						]
					})
				}),
				hud.mode === "paused" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, {
					title: "Paused",
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-8 text-muted" }),
					actions: [
						{
							label: "Resume",
							onClick: requestPlay,
							primary: true
						},
						{
							label: "Restart",
							onClick: restart
						},
						{
							label: "Exit",
							onClick: onExit
						}
					]
				}),
				hud.mode === "dead" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, {
					title: "You Died",
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skull, { className: "size-8 text-primary" }),
					subtitle: `Score ${hud.score} · Kills ${hud.kills}/${hud.total}`,
					actions: [{
						label: "Retry",
						onClick: restart,
						primary: true,
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" })
					}, {
						label: "Exit",
						onClick: onExit
					}]
				}),
				hud.mode === "won" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, {
					title: "Sector Cleared",
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, { className: "size-8 text-accent" }),
					subtitle: `Score ${hud.score} · Kills ${hud.kills}/${hud.total}`,
					actions: [{
						label: "Play again",
						onClick: restart,
						primary: true,
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" })
					}, {
						label: "Exit",
						onClick: onExit
					}]
				}),
				hud.message && hud.mode === "playing" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-none absolute top-1/3 left-1/2 z-10 -translate-x-1/2 rounded bg-black/70 px-4 py-2 font-display text-sm tracking-wide text-accent uppercase",
					children: hud.message
				})
			]
		})]
	});
}
function HudStat({ icon, label, value, danger }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-1 text-[10px] tracking-widest text-dim uppercase",
			children: [icon, label]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `font-mono text-xl font-bold tabular-nums sm:text-2xl ${danger ? "text-primary" : "text-hud"}`,
			children: value
		})]
	});
}
function Overlay({ title, subtitle, icon, actions }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-3 flex justify-center",
					children: icon
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-display text-2xl font-bold tracking-wider text-fg uppercase",
					children: title
				}),
				subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: subtitle
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6 flex flex-col gap-2",
					children: actions.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: a.onClick,
						className: `flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${a.primary ? "bg-primary text-fg hover:bg-primary-hover" : "border border-border bg-surface-2 text-fg hover:border-muted"}`,
						children: [a.icon, a.label]
					}, a.label))
				})
			]
		})
	});
}
var TEX_COLORS = [
	"#1a1814",
	"#4a5568",
	"#8b3a3a",
	"#6b4a3a",
	"#2d6b4a",
	"#6b6b5a",
	"#a08a20"
];
function EditorView({ initial, onExit, onPlay }) {
	const [level, setLevel] = (0, import_react.useState)(() => initial ? cloneLevel(initial) : makeEmptyLevel("My Level", 24, 24));
	const [tool, setTool] = (0, import_react.useState)("paint");
	const [tex, setTex] = (0, import_react.useState)(1);
	const [cellSize, setCellSize] = (0, import_react.useState)(22);
	const [status, setStatus] = (0, import_react.useState)("");
	const [painting, setPainting] = (0, import_react.useState)(false);
	const fileRef = (0, import_react.useRef)(null);
	const canvasWrap = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const fit = () => {
			if (!canvasWrap.current) return;
			const maxW = canvasWrap.current.clientWidth - 16;
			const maxH = canvasWrap.current.clientHeight - 16;
			const cs = Math.max(10, Math.min(28, Math.floor(Math.min(maxW / level.width, maxH / level.height))));
			setCellSize(cs);
		};
		fit();
		window.addEventListener("resize", fit);
		return () => window.removeEventListener("resize", fit);
	}, [level.width, level.height]);
	const applyCell = (0, import_react.useCallback)((cx, cy) => {
		if (cx < 0 || cy < 0 || cx >= level.width || cy >= level.height) return;
		setLevel((prev) => {
			const next = cloneLevel(prev);
			if (tool === "paint") {
				next.walls[cy][cx] = tex;
				next.entities = next.entities.filter((e) => !(Math.floor(e.x) === cx && Math.floor(e.y) === cy) || next.walls[cy][cx] === 0);
				if (Math.floor(next.spawn.x) === cx && Math.floor(next.spawn.y) === cy && tex > 0) next.walls[cy][cx] = 0;
			} else if (tool === "erase") next.walls[cy][cx] = 0;
			else if (tool === "fill") {
				const target = next.walls[cy][cx];
				if (target === tex) return prev;
				floodFill(next.walls, cx, cy, target, tex, next.width, next.height);
			} else if (tool === "spawn") {
				if (next.walls[cy][cx] > 0) return prev;
				next.spawn = {
					x: cx + .5,
					y: cy + .5,
					angle: next.spawn.angle
				};
			} else {
				if (next.walls[cy][cx] > 0) return prev;
				const type = {
					enemy: "enemy",
					ammo: "ammo",
					health: "health",
					exit: "exit"
				}[tool];
				if (!type) return prev;
				if (type === "exit") next.entities = next.entities.filter((e) => e.type !== "exit");
				next.entities = next.entities.filter((e) => !(Math.floor(e.x) === cx && Math.floor(e.y) === cy));
				next.entities.push({
					id: uid(type.slice(0, 2)),
					type,
					x: cx + .5,
					y: cy + .5
				});
			}
			return next;
		});
	}, [
		level.width,
		level.height,
		tool,
		tex
	]);
	const cellFromEvent = (e) => {
		const rect = e.currentTarget.getBoundingClientRect();
		return {
			x: Math.floor((e.clientX - rect.left) / cellSize),
			y: Math.floor((e.clientY - rect.top) / cellSize)
		};
	};
	const entityAt = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const e of level.entities) map.set(`${Math.floor(e.x)},${Math.floor(e.y)}`, e);
		return map;
	}, [level.entities]);
	const saveLocal = () => {
		const name = level.name.trim() || "Untitled";
		const L = {
			...level,
			name
		};
		upsertCustomLevel(L);
		setLevel(L);
		setStatus(`Saved "${name}" to browser storage`);
		sfx.click();
	};
	const doExport = () => {
		downloadLevel(level);
		setStatus("Exported level JSON");
		sfx.click();
	};
	const doImport = async (file) => {
		const result = await importLevelFile(file);
		if (!result.ok) {
			setStatus(`Import failed: ${result.error}`);
			return;
		}
		setLevel(result.level);
		setStatus(`Imported "${result.level.name}"`);
		sfx.pickup();
	};
	const rotateSpawn = () => {
		setLevel((prev) => ({
			...prev,
			spawn: {
				...prev.spawn,
				angle: prev.spawn.angle + Math.PI / 2
			}
		}));
	};
	const copyJson = async () => {
		try {
			await navigator.clipboard.writeText(serializeLevel(level));
			setStatus("Level JSON copied to clipboard");
		} catch {
			setStatus("Clipboard unavailable — use Export instead");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-[calc(100dvh-var(--grok-banner-h,0px))] flex-col bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: onExit,
						className: "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "Menu"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: level.name,
						onChange: (e) => setLevel((l) => ({
							...l,
							name: e.target.value
						})),
						className: "min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 font-display text-sm font-semibold tracking-wide text-fg uppercase outline-none focus:border-primary sm:max-w-xs",
						"aria-label": "Level name"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolBtn, {
								active: tool === "paint",
								onClick: () => setTool("paint"),
								title: "Paint walls",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Paintbrush, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolBtn, {
								active: tool === "erase",
								onClick: () => setTool("erase"),
								title: "Erase",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eraser, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolBtn, {
								active: tool === "fill",
								onClick: () => setTool("fill"),
								title: "Flood fill",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Droplets, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolBtn, {
								active: tool === "spawn",
								onClick: () => setTool("spawn"),
								title: "Player spawn",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolBtn, {
								active: tool === "enemy",
								onClick: () => setTool("enemy"),
								title: "Enemy",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skull, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolBtn, {
								active: tool === "ammo",
								onClick: () => setTool("ammo"),
								title: "Ammo",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolBtn, {
								active: tool === "health",
								onClick: () => setTool("health"),
								title: "Health",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolBtn, {
								active: tool === "exit",
								onClick: () => setTool("exit"),
								title: "Exit",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DoorOpen, { className: "size-4" })
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex flex-wrap items-center gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: rotateSpawn,
								className: "rounded-md border border-border px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-fg",
								title: "Rotate spawn facing",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: saveLocal,
								className: "flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-fg hover:bg-surface-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: "Save"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: doExport,
								className: "flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-fg hover:bg-surface-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: "Export"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => fileRef.current?.click(),
								className: "flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-fg hover:bg-surface-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: "Import"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								ref: fileRef,
								type: "file",
								accept: "application/json,.json",
								className: "hidden",
								onChange: (e) => {
									const f = e.target.files?.[0];
									if (f) doImport(f);
									e.target.value = "";
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => onPlay(cloneLevel(level)),
								className: "flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-fg hover:bg-primary-hover",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5" }), "Test"]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 flex-1 flex-col sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-surface-2 p-2 sm:w-44 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "hidden text-[10px] tracking-widest text-dim uppercase sm:block",
							children: "Wall texture"
						}),
						Array.from({ length: 7 }, (_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setTex(i);
								if (i === 0) setTool("erase");
								else if (tool === "erase" || tool === "fill" || tool === "paint") setTool("paint");
							},
							className: `flex min-w-[4.5rem] items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors sm:min-w-0 sm:w-full ${tex === i && (tool === "paint" || tool === "fill" || tool === "erase") ? "border-primary bg-primary/15 text-fg" : "border-border text-muted hover:border-dim hover:text-fg"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "size-5 shrink-0 rounded-sm border border-black/40",
								style: { background: TEX_COLORS[i] }
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate",
								children: WALL_NAMES[i]
							})]
						}, i)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden space-y-1 border-t border-border pt-2 sm:block",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] tracking-widest text-dim uppercase",
									children: "Colors"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center justify-between gap-1 text-[11px] text-muted",
									children: ["Floor", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "color",
										value: toHex(level.floorColor),
										onChange: (e) => setLevel((l) => ({
											...l,
											floorColor: e.target.value
										})),
										className: "h-6 w-8 cursor-pointer border-0 bg-transparent"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center justify-between gap-1 text-[11px] text-muted",
									children: ["Ceiling", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "color",
										value: toHex(level.ceilingColor),
										onChange: (e) => setLevel((l) => ({
											...l,
											ceilingColor: e.target.value
										})),
										className: "h-6 w-8 cursor-pointer border-0 bg-transparent"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: copyJson,
									className: "mt-2 w-full rounded border border-border py-1 text-[11px] text-muted hover:text-fg",
									children: "Copy JSON"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										if (confirm("Reset to empty bordered map?")) setLevel(makeEmptyLevel(level.name, level.width, level.height));
									},
									className: "w-full rounded border border-border py-1 text-[11px] text-muted hover:text-primary",
									children: "Clear map"
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: canvasWrap,
					className: "relative min-h-0 flex-1 overflow-auto bg-[#0e0e12] p-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "relative mx-auto touch-none select-none",
						style: {
							width: level.width * cellSize,
							height: level.height * cellSize
						},
						onPointerDown: (e) => {
							e.currentTarget.setPointerCapture(e.pointerId);
							setPainting(true);
							const { x, y } = cellFromEvent(e);
							applyCell(x, y);
						},
						onPointerMove: (e) => {
							if (!painting && e.buttons === 0) return;
							const { x, y } = cellFromEvent(e);
							applyCell(x, y);
						},
						onPointerUp: () => setPainting(false),
						onPointerLeave: () => setPainting(false),
						onContextMenu: (e) => {
							e.preventDefault();
							const { x, y } = cellFromEvent(e);
							setLevel((prev) => {
								const next = cloneLevel(prev);
								next.walls[y][x] = 0;
								next.entities = next.entities.filter((ent) => !(Math.floor(ent.x) === x && Math.floor(ent.y) === y));
								return next;
							});
						},
						children: level.walls.map((row, y) => row.map((cell, x) => {
							const ent = entityAt.get(`${x},${y}`);
							const isSpawn = Math.floor(level.spawn.x) === x && Math.floor(level.spawn.y) === y;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute border border-black/30",
								style: {
									left: x * cellSize,
									top: y * cellSize,
									width: cellSize,
									height: cellSize,
									background: TEX_COLORS[cell] ?? "#333"
								},
								children: [isSpawn && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute inset-0 flex items-center justify-center text-[10px] font-bold text-fg",
									style: { transform: `rotate(${-level.spawn.angle * 180 / Math.PI}deg)` },
									title: "Spawn",
									children: "▶"
								}), ent && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "absolute inset-0 flex items-center justify-center text-[11px] text-fg",
									children: [
										ent.type === "enemy" && "☠",
										ent.type === "ammo" && "▣",
										ent.type === "health" && "+",
										ent.type === "exit" && "⎋"
									]
								})]
							}, `${x}-${y}`);
						}))
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 items-center justify-between gap-2 border-t border-border bg-surface px-3 py-1.5 text-[11px] text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						level.width,
						"×",
						level.height,
						" · ",
						level.entities.length,
						" entities · tool: ",
						tool
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate text-accent",
						children: status
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden sm:inline",
						children: "LMB paint · RMB erase · Test to play"
					})
				]
			})
		]
	});
}
function ToolBtn({ active, onClick, title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		title,
		onClick,
		className: `rounded-md p-2 transition-colors ${active ? "bg-primary/20 text-primary" : "text-muted hover:bg-surface-2 hover:text-fg"}`,
		children
	});
}
function floodFill(walls, x, y, target, replace, w, h) {
	if (target === replace) return;
	const stack = [[x, y]];
	const seen = /* @__PURE__ */ new Set();
	while (stack.length) {
		const [cx, cy] = stack.pop();
		const key = `${cx},${cy}`;
		if (seen.has(key)) continue;
		seen.add(key);
		if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
		if (walls[cy][cx] !== target) continue;
		walls[cy][cx] = replace;
		stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
		if (seen.size > w * h) break;
	}
}
function toHex(c) {
	if (c.startsWith("#") && (c.length === 7 || c.length === 4)) {
		if (c.length === 4) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
		return c;
	}
	return "#2a2420";
}
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled (default) -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
/** Render children only when a user is present (real session, or the disabled-auth dev user). */
function SignedIn({ children }) {
	const { user } = useCurrentUserState();
	return user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children }) : null;
}
/**
* Render children only once we KNOW the visitor is signed out (`isPending` has
* cleared and there is no user). Hidden while the session is still loading.
*/
function SignedOut({ children }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending || user) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of).
*/
function UserButton() {
	const user = useCurrentUser();
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => void signOut(),
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline",
				children: "Sign out"
			})
		]
	});
}
function GameApp() {
	const [screen, setScreen] = (0, import_react.useState)({ id: "menu" });
	const [customs, setCustoms] = (0, import_react.useState)([]);
	const importInput = (0, import_react.useRef)(null);
	const { isPending } = useCurrentUserState();
	const refreshCustoms = (0, import_react.useCallback)(() => {
		setCustoms(loadCustomLevels());
	}, []);
	(0, import_react.useEffect)(() => {
		refreshCustoms();
	}, [refreshCustoms]);
	if (screen.id === "play") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayView, {
		level: screen.level,
		onExit: () => {
			refreshCustoms();
			setScreen({ id: "menu" });
		}
	});
	if (screen.id === "editor") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorView, {
		initial: screen.level,
		onExit: () => {
			refreshCustoms();
			setScreen({ id: "menu" });
		},
		onPlay: (level) => setScreen({
			id: "play",
			level
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-[calc(100dvh-var(--grok-banner-h,0px))] overflow-y-auto bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 opacity-40",
				style: { background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgb(196 60 44 / 0.25), transparent), radial-gradient(ellipse 60% 40% at 80% 100%, rgb(212 160 23 / 0.08), transparent)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "scanlines absolute inset-0 opacity-30" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:py-12",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "flex items-start justify-between gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-mono text-[11px] tracking-[0.25em] text-primary uppercase",
								children: "Sector Nine · Raycast Engine"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "font-display mt-1 text-4xl font-bold tracking-wide text-fg uppercase sm:text-5xl",
								children: "Hellcast"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 max-w-md text-sm leading-relaxed text-muted",
								children: "Doom-style raycast FPS. Clear hostiles, grab the exit. Build your own maps in the editor — import & export JSON levels."
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex shrink-0 items-center gap-2",
							children: isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-8 animate-pulse rounded-full bg-surface-2" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedIn, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedOut, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/login",
								className: "flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-dim hover:text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3.5" }), "Sign in"]
							}) })] })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-5" }),
							title: "Quick play",
							desc: "Jump into Outpost 7",
							accent: true,
							onClick: () => setScreen({
								id: "play",
								level: cloneLevel(BUILTIN_LEVELS[0])
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-5" }),
							title: "Level editor",
							desc: "Paint walls, place demons, export JSON",
							onClick: () => setScreen({
								id: "editor",
								level: null
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "font-display mb-3 flex items-center gap-2 text-sm font-semibold tracking-widest text-muted uppercase",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "size-4 text-primary" }), "Missions"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-2",
						children: BUILTIN_LEVELS.map((lvl) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelRow, {
							level: lvl,
							badge: "Built-in",
							onPlay: () => setScreen({
								id: "play",
								level: cloneLevel(lvl)
							}),
							onEdit: () => setScreen({
								id: "editor",
								level: cloneLevel(lvl)
							}),
							onExport: () => downloadLevel(lvl)
						}, lvl.name))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center justify-between gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "font-display flex items-center gap-2 text-sm font-semibold tracking-widest text-muted uppercase",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skull, { className: "size-4 text-accent" }), "Your levels"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => importInput.current?.click(),
								className: "flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }), "Import JSON"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								ref: importInput,
								type: "file",
								accept: "application/json,.json",
								className: "hidden",
								onChange: async (e) => {
									const f = e.target.files?.[0];
									if (!f) return;
									const result = await importLevelFile(f);
									if (result.ok) setScreen({
										id: "editor",
										level: result.level
									});
									else alert(`Import failed: ${result.error}`);
									e.target.value = "";
								}
							})
						]
					}), customs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-lg border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-dim",
						children: "No saved maps yet. Open the editor, then hit Save — or import a .json level file."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-2",
						children: customs.map((lvl) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelRow, {
							level: lvl,
							badge: "Custom",
							onPlay: () => setScreen({
								id: "play",
								level: cloneLevel(lvl)
							}),
							onEdit: () => setScreen({
								id: "editor",
								level: cloneLevel(lvl)
							}),
							onExport: () => downloadLevel(lvl),
							onDelete: () => {
								if (confirm(`Delete "${lvl.name}"?`)) {
									deleteCustomLevel(lvl.name);
									refreshCustoms();
								}
							}
						}, lvl.name))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
						className: "border-t border-border pt-4 text-center text-[11px] text-dim",
						children: "Classic DDA raycasting · textured walls · billboard sprites · JSON level format v1"
					})
				]
			})
		]
	});
}
function ActionCard({ icon, title, desc, onClick, accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: `group flex items-start gap-4 rounded-lg border p-4 text-left transition-all ${accent ? "border-primary/40 bg-primary/10 hover:border-primary hover:bg-primary/15" : "border-border bg-surface hover:border-dim hover:bg-surface-2"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `flex size-10 shrink-0 items-center justify-center rounded-md ${accent ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted"}`,
				children: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-display block text-base font-semibold tracking-wide text-fg uppercase",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-0.5 block text-sm text-muted",
					children: desc
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-5 shrink-0 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg" })
		]
	});
}
function LevelRow({ level, badge, onPlay, onEdit, onExport, onDelete }) {
	const enemies = level.entities.filter((e) => e.type === "enemy").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 sm:flex-nowrap",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 flex-1 items-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex size-9 shrink-0 items-center justify-center rounded bg-surface-2 text-primary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-4" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display truncate font-semibold tracking-wide text-fg uppercase",
						children: level.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] tracking-wider text-dim uppercase",
						children: badge
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted",
					children: [
						level.width,
						"×",
						level.height,
						" · ",
						enemies,
						" hostiles"
					]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex shrink-0 items-center gap-1",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					title: "Play",
					onClick: onPlay,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					title: "Edit",
					onClick: onEdit,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					title: "Export JSON",
					onClick: onExport,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" })
				}),
				onDelete && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					title: "Delete",
					onClick: onDelete,
					danger: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
				})
			]
		})]
	});
}
function IconBtn({ children, onClick, title, danger }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		title,
		onClick,
		className: `rounded-md p-2 transition-colors ${danger ? "text-muted hover:bg-primary/15 hover:text-primary" : "text-muted hover:bg-surface-2 hover:text-fg"}`,
		children
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameApp, {});
}
//#endregion
export { Home as component };
