import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EditorTool,
  EnemyVariant,
  EntityType,
  GameLevel,
  LevelEntity,
} from "./types";
import {
  DEFAULT_CEIL,
  DEFAULT_FLOOR,
  DEFAULT_PICKUP,
  defaultWallColor,
  WALL_NAMES,
  WALL_TEXTURE_COUNT,
  cloneLevel,
  hexFromColor,
  makeEmptyLevel,
  MAP_MAX,
  MAP_MIN,
  parseHexColor,
  resizeLevel,
  seedWallColors,
  uid,
} from "./types";
import { upsertCustomLevel } from "./levels";
import { ExportMenu, ImportMenu } from "./FileMenu";
import { ScriptEditor } from "./ScriptEditor";
import { ScriptHelp } from "./ScriptHelp";
import { sfx } from "./audio";
import { compileProgram } from "./lisp";
import {
  ArrowLeft,
  BoxSelect,
  DoorClosed,
  Eraser,
  Heart,
  MapPin,
  Minus,
  MousePointer2,
  PaintBucket,
  Paintbrush,
  Pipette,
  Play,
  RotateCcw,
  Save,
  ScrollText,
  Skull,
  Square,
  Star,
  Tag,
  Undo2,
  Redo2,
  Zap,
  DoorOpen,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Spline,
} from "lucide-react";

type Props = {
  initial?: GameLevel | null;
  onExit: () => void;
  onPlay: (level: GameLevel) => void;
};

type ThingKind = "spawn" | EntityType | "zone" | "mark";

type Brush =
  | { kind: "none" }
  | { kind: "wall"; tex: number }
  | { kind: "thing"; thing: ThingKind };

type Drag = { x0: number; y0: number; x1: number; y1: number };

const TEX_COLORS = [
  "#1a1814",
  "#4a5568",
  "#8b3a3a",
  "#6b4a3a",
  "#2d6b4a",
  "#6b6b5a",
  "#a08a20",
];

const DRAW_TOOLS: {
  id: EditorTool;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  { id: "paint", label: "Paint", hint: "P", icon: <Paintbrush className="size-4" /> },
  { id: "fill", label: "Fill", hint: "F", icon: <PaintBucket className="size-4" /> },
  { id: "rect", label: "Box", hint: "O", icon: <BoxSelect className="size-4" /> },
  { id: "rectFill", label: "Box fill", hint: "B", icon: <Square className="size-4" /> },
  { id: "line", label: "Line", hint: "L", icon: <Minus className="size-4" /> },
];

const META_TOOLS: {
  id: EditorTool;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  { id: "select", label: "Select", hint: "V", icon: <MousePointer2 className="size-4" /> },
  { id: "erase", label: "Erase", hint: "E", icon: <Eraser className="size-4" /> },
  { id: "eyedrop", label: "Pick", hint: "I", icon: <Pipette className="size-4" /> },
];

const ALL_TOOLS = [...DRAW_TOOLS, ...META_TOOLS];

const THINGS: { id: ThingKind; label: string; icon: React.ReactNode }[] = [
  { id: "spawn", label: "Spawn", icon: <MapPin className="size-4" /> },
  { id: "enemy", label: "Enemy", icon: <Skull className="size-4" /> },
  { id: "ammo", label: "Ammo", icon: <Zap className="size-4" /> },
  { id: "health", label: "Health", icon: <Heart className="size-4" /> },
  { id: "exit", label: "Exit", icon: <DoorOpen className="size-4" /> },
  { id: "door", label: "Door", icon: <DoorClosed className="size-4" /> },
  { id: "teleport", label: "Pad", icon: <Spline className="size-4" /> },
  { id: "pickup", label: "Pickup", icon: <Star className="size-4" /> },
];

const AREAS: { id: "zone" | "mark"; label: string; icon: React.ReactNode }[] = [
  { id: "zone", label: "Zone", icon: <BoxSelect className="size-4" /> },
  { id: "mark", label: "Mark", icon: <Tag className="size-4" /> },
];

type SelItem =
  | { k: "cell"; x: number; y: number }
  | { k: "entity"; id: string }
  | { k: "mark"; x: number; y: number }
  | { k: "zone"; i: number }
  | { k: "spawn" };

function selKey(s: SelItem): string {
  switch (s.k) {
    case "cell":
      return `c:${s.x},${s.y}`;
    case "entity":
      return `e:${s.id}`;
    case "mark":
      return `m:${s.x},${s.y}`;
    case "zone":
      return `z:${s.i}`;
    case "spawn":
      return "spawn";
  }
}

function mergeSel(prev: SelItem[], next: SelItem[], add: boolean): SelItem[] {
  if (!add) {
    const seen = new Set<string>();
    const out: SelItem[] = [];
    for (const s of next) {
      const k = selKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    return out;
  }
  const map = new Map(prev.map((s) => [selKey(s), s] as const));
  for (const s of next) {
    const k = selKey(s);
    if (map.has(k)) map.delete(k);
    else map.set(k, s);
  }
  return [...map.values()];
}

function hitAt(level: GameLevel, x: number, y: number): SelItem {
  const ent = level.entities.find(
    (e) => Math.floor(e.x) === x && Math.floor(e.y) === y,
  );
  if (ent) return { k: "entity", id: ent.id };
  const mark = (level.marks ?? []).find((m) => m.x === x && m.y === y);
  if (mark) return { k: "mark", x, y };
  if (Math.floor(level.spawn.x) === x && Math.floor(level.spawn.y) === y) {
    return { k: "spawn" };
  }
  return { k: "cell", x, y };
}

function itemsInBox(level: GameLevel, d: Drag): SelItem[] {
  const x0 = Math.min(d.x0, d.x1);
  const x1 = Math.max(d.x0, d.x1);
  const y0 = Math.min(d.y0, d.y1);
  const y1 = Math.max(d.y0, d.y1);
  const out: SelItem[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= level.width || y >= level.height) continue;
      out.push({ k: "cell", x, y });
    }
  }
  for (const e of level.entities) {
    const x = Math.floor(e.x);
    const y = Math.floor(e.y);
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) out.push({ k: "entity", id: e.id });
  }
  for (const m of level.marks ?? []) {
    if (m.x >= x0 && m.x <= x1 && m.y >= y0 && m.y <= y1) {
      out.push({ k: "mark", x: m.x, y: m.y });
    }
  }
  (level.zones ?? []).forEach((z, i) => {
    if (z.x >= x0 && z.y >= y0 && z.x + z.w - 1 <= x1 && z.y + z.h - 1 <= y1) {
      out.push({ k: "zone", i });
    }
  });
  const sx = Math.floor(level.spawn.x);
  const sy = Math.floor(level.spawn.y);
  if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) out.push({ k: "spawn" });
  return out;
}

function pruneSel(level: GameLevel, sel: SelItem[]): SelItem[] {
  return sel.filter((s) => {
    if (s.k === "entity") return level.entities.some((e) => e.id === s.id);
    if (s.k === "mark") {
      return (level.marks ?? []).some((m) => m.x === s.x && m.y === s.y);
    }
    if (s.k === "zone") return Boolean((level.zones ?? [])[s.i]);
    if (s.k === "cell") {
      return s.x >= 0 && s.y >= 0 && s.x < level.width && s.y < level.height;
    }
    return true;
  });
}

type SelOpt =
  | "texture"
  | "floor"
  | "variant"
  | "name"
  | "dest"
  | "turn"
  | "label"
  | "color"
  | "wallColor";

function optsForItem(level: GameLevel, s: SelItem): Set<SelOpt> {
  if (s.k === "cell") {
    const wall = level.walls[s.y]?.[s.x] ?? 0;
    return wall === 0
      ? new Set<SelOpt>(["floor"])
      : new Set<SelOpt>(["texture", "wallColor"]);
  }
  if (s.k === "entity") {
    const e = level.entities.find((x) => x.id === s.id);
    if (!e) return new Set();
    if (e.type === "enemy") return new Set<SelOpt>(["variant", "name"]);
    if (e.type === "teleport") return new Set<SelOpt>(["name", "dest"]);
    if (e.type === "pickup") return new Set<SelOpt>(["name", "label", "color"]);
    return new Set<SelOpt>(["name"]);
  }
  if (s.k === "mark" || s.k === "zone") return new Set<SelOpt>(["name"]);
  return new Set<SelOpt>(["turn"]);
}

function sharedOpts(level: GameLevel, sel: SelItem[]): Set<SelOpt> {
  if (!sel.length) return new Set();
  let acc = optsForItem(level, sel[0]!);
  for (const s of sel.slice(1)) {
    const next = optsForItem(level, s);
    acc = new Set([...acc].filter((o) => next.has(o)));
  }
  if (sel.length > 1) {
    acc.delete("name");
    acc.delete("dest");
  }
  return acc;
}

function isDrawTool(t: EditorTool) {
  return (
    t === "paint" ||
    t === "fill" ||
    t === "rect" ||
    t === "rectFill" ||
    t === "line"
  );
}
function isMetaTool(t: EditorTool) {
  return t === "select" || t === "erase" || t === "eyedrop";
}
function isAreaTool(t: EditorTool) {
  return t === "zone" || t === "mark";
}
function isZoneBrush(b: Brush) {
  return b.kind === "thing" && b.thing === "zone";
}
function isMarkBrush(b: Brush) {
  return b.kind === "thing" && b.thing === "mark";
}

const TOOL_KEY: Record<string, EditorTool> = {
  KeyP: "paint",
  KeyE: "erase",
  KeyF: "fill",
  KeyO: "rect",
  KeyB: "rectFill",
  KeyL: "line",
  KeyI: "eyedrop",
  KeyV: "select",
};

export function EditorView({ initial, onExit, onPlay }: Props) {
  const [level, setLevel] = useState<GameLevel>(() =>
    initial ? cloneLevel(initial) : makeEmptyLevel("My Level", 24, 24),
  );
  const [tool, setTool] = useState<EditorTool>("paint");
  const [brush, setBrush] = useState<Brush>({ kind: "wall", tex: 1 });
  const [wallTex, setWallTex] = useState(1);
  const [wallColor, setWallColor] = useState(() => defaultWallColor(1));
  const [thingName, setThingName] = useState("");
  const [thingDest, setThingDest] = useState("");
  const [thingLabel, setThingLabel] = useState("?");
  const [thingColor, setThingColor] = useState(DEFAULT_PICKUP);
  const [variant, setVariant] = useState<EnemyVariant>("grunt");
  const [emptyFloor, setEmptyFloor] = useState(DEFAULT_FLOOR);
  const [emptyCeil, setEmptyCeil] = useState(DEFAULT_CEIL);
  const [sizeW, setSizeW] = useState(level.width);
  const [sizeH, setSizeH] = useState(level.height);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptH, setScriptH] = useState(224);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cellSize, setCellSize] = useState(22);
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selection, setSelection] = useState<SelItem[]>([]);
  const [clearArmed, setClearArmed] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const nameRef = useRef(thingName);
  nameRef.current = thingName;
  const destRef = useRef(thingDest);
  destRef.current = thingDest;
  const labelRef = useRef(thingLabel);
  labelRef.current = thingLabel;
  const colorRef = useRef(thingColor);
  colorRef.current = thingColor;
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const floorRef = useRef(emptyFloor);
  floorRef.current = emptyFloor;
  const wallColorRef = useRef(wallColor);
  wallColorRef.current = wallColor;
  const ceilRef = useRef(emptyCeil);
  ceilRef.current = emptyCeil;
  const lastDrawRef = useRef<EditorTool>("paint");
  const lastBrushRef = useRef<Brush>({ kind: "wall", tex: 1 });
  const pastRef = useRef<GameLevel[]>([]);
  const futureRef = useRef<GameLevel[]>([]);
  const strokeBaseRef = useRef<GameLevel | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const scriptDragRef = useRef<{ y: number; h: number } | null>(null);

  const syncHist = () => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  };

  const beginStroke = useCallback(() => {
    if (!strokeBaseRef.current) {
      strokeBaseRef.current = cloneLevel(levelRef.current);
    }
  }, []);

  const endStroke = useCallback(() => {
    const base = strokeBaseRef.current;
    strokeBaseRef.current = null;
    if (!base) return;
    if (sameMap(base, levelRef.current)) return;
    pastRef.current = [...pastRef.current, base].slice(-80);
    futureRef.current = [];
    syncHist();
  }, []);

  const commitEdit = useCallback((next: GameLevel) => {
    const prev = levelRef.current;
    if (sameMap(prev, next) && prev.name === next.name) return false;
    pastRef.current = [...pastRef.current, cloneLevel(prev)].slice(-80);
    futureRef.current = [];
    setLevel(next);
    syncHist();
    return true;
  }, []);

  const sizeWRef = useRef(sizeW);
  sizeWRef.current = sizeW;
  const sizeHRef = useRef(sizeH);
  sizeHRef.current = sizeH;

  const applySize = useCallback((rawW?: number, rawH?: number) => {
    const srcW = rawW ?? sizeWRef.current;
    const srcH = rawH ?? sizeHRef.current;
    const w = Math.max(MAP_MIN, Math.min(MAP_MAX, (srcW | 0) || 0));
    const h = Math.max(MAP_MIN, Math.min(MAP_MAX, (srcH | 0) || 0));
    setSizeW(w);
    setSizeH(h);
    const cur = levelRef.current;
    if (w === cur.width && h === cur.height) return;
    commitEdit(resizeLevel(cur, w, h));
    setStatus(`Map is now ${w}×${h}`);
  }, [commitEdit]);

  const onSizeW = (raw: number) => {
    setSizeW(raw);
    if (Number.isInteger(raw) && raw >= MAP_MIN && raw <= MAP_MAX) {
      applySize(raw, sizeHRef.current);
    }
  };

  const onSizeH = (raw: number) => {
    setSizeH(raw);
    if (Number.isInteger(raw) && raw >= MAP_MIN && raw <= MAP_MAX) {
      applySize(sizeWRef.current, raw);
    }
  };

  useEffect(() => {
    setSizeW(level.width);
    setSizeH(level.height);
  }, [level.width, level.height]);

  const undo = useCallback(() => {
    if (strokeBaseRef.current) endStroke();
    const past = pastRef.current;
    if (!past.length) return;
    const prev = past[past.length - 1]!;
    pastRef.current = past.slice(0, -1);
    futureRef.current = [...futureRef.current, cloneLevel(levelRef.current)];
    setLevel(cloneLevel(prev));
    syncHist();
    setStatus("Undid last change");
  }, [endStroke]);

  const redo = useCallback(() => {
    if (strokeBaseRef.current) endStroke();
    const future = futureRef.current;
    if (!future.length) return;
    const next = future[future.length - 1]!;
    futureRef.current = future.slice(0, -1);
    pastRef.current = [...pastRef.current, cloneLevel(levelRef.current)];
    setLevel(cloneLevel(next));
    syncHist();
    setStatus("Redid last change");
  }, [endStroke]);

  const chooseDrawTool = useCallback((t: EditorTool) => {
    lastDrawRef.current = t;
    setTool(t);
    setBrush((b) => {
      if (b.kind === "none" || isZoneBrush(b) || isMarkBrush(b)) {
        const last = lastBrushRef.current;
        return last.kind === "none" || isZoneBrush(last) || isMarkBrush(last)
          ? { kind: "wall", tex: 1 }
          : last;
      }
      return b;
    });
  }, []);

  const chooseMetaTool = useCallback((t: EditorTool) => {
    setTool(t);
    setBrush({ kind: "none" });
  }, []);

  const chooseAreaTool = useCallback((kind: "zone" | "mark") => {
    setTool(kind);
    setBrush({ kind: "thing", thing: kind });
  }, []);

  const chooseBrush = useCallback((b: Brush) => {
    lastBrushRef.current = b;
    setBrush(b);
    setTool((t) =>
      isMetaTool(t) || isAreaTool(t) ? lastDrawRef.current : t,
    );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.code === "Escape") {
        setClearArmed(false);
        setDrag(null);
        dragRef.current = null;
        strokeBaseRef.current = null;
        setSelection([]);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        if (e.code === "KeyZ" && e.shiftKey) {
          e.preventDefault();
          redo();
        } else if (e.code === "KeyZ") {
          e.preventDefault();
          undo();
        } else if (e.code === "KeyY") {
          e.preventDefault();
          redo();
        }
        return;
      }
      const nextTool = TOOL_KEY[e.code];
      if (nextTool) {
        e.preventDefault();
        if (isMetaTool(nextTool)) chooseMetaTool(nextTool);
        else chooseDrawTool(nextTool);
        return;
      }
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n === 0) {
          e.preventDefault();
          chooseBrush({ kind: "wall", tex: 0 });
        } else if (n >= 1 && n <= WALL_TEXTURE_COUNT) {
          e.preventDefault();
          setWallTex(n);
          setWallColor(defaultWallColor(n));
          chooseBrush({ kind: "wall", tex: n });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, chooseDrawTool, chooseMetaTool, chooseBrush]);

  useEffect(() => {
    if (tool !== "select") setSelection([]);
  }, [tool]);

  useEffect(() => {
    const wrap = canvasWrap.current;
    if (!wrap) return;
    const fit = () => {
      const maxW = wrap.clientWidth - 16;
      const maxH = wrap.clientHeight - 16;
      if (maxW < 8 || maxH < 8) return;
      const cs = Math.max(
        10,
        Math.min(
          28,
          Math.floor(Math.min(maxW / level.width, maxH / level.height)),
        ),
      );
      setCellSize(cs);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [level.width, level.height]);

  const applyCells = useCallback((cells: { x: number; y: number }[], erase: boolean) => {
    if (!cells.length) return;
    setLevel((prev) => {
      const next = cloneLevel(prev);
      const b = brushRef.current;
      const extra = {
        name: nameRef.current,
        dest: destRef.current,
        label: labelRef.current,
        color: colorRef.current,
        variant: variantRef.current,
        floor: floorRef.current,
        ceil: ceilRef.current,
        wallColor: wallColorRef.current,
      };
      for (const c of cells) applyBrushTo(next, c.x, c.y, b, erase, extra);
      return next;
    });
  }, []);

  const stampCells = useCallback(
    (cells: { x: number; y: number }[], erase: boolean) => {
      if (!cells.length) return;
      const next = cloneLevel(levelRef.current);
      const b = brushRef.current;
      const extra = {
        name: nameRef.current,
        dest: destRef.current,
        label: labelRef.current,
        color: colorRef.current,
        variant: variantRef.current,
        floor: floorRef.current,
        ceil: ceilRef.current,
        wallColor: wallColorRef.current,
      };
      for (const c of cells) applyBrushTo(next, c.x, c.y, b, erase, extra);
      commitEdit(next);
    },
    [commitEdit],
  );

  const pickFrom = useCallback((x: number, y: number) => {
    const L = levelRef.current;
    if (x < 0 || y < 0 || x >= L.width || y >= L.height) return;
    if (Math.floor(L.spawn.x) === x && Math.floor(L.spawn.y) === y) {
      chooseBrush({ kind: "thing", thing: "spawn" });
      setStatus("Picked spawn");
      return;
    }
    const ent = L.entities.find(
      (e) => Math.floor(e.x) === x && Math.floor(e.y) === y,
    );
    if (ent) {
      chooseBrush({ kind: "thing", thing: ent.type });
      setThingName(ent.name || "");
      setThingDest(ent.dest || "");
      setThingLabel(ent.label || "?");
      setThingColor(ent.color ?? DEFAULT_PICKUP);
      setVariant(ent.variant === "bruiser" ? "bruiser" : "grunt");
      setStatus(`Picked ${ent.name || ent.type}`);
      return;
    }
    const mark = (L.marks ?? []).find((m) => m.x === x && m.y === y);
    if (mark) {
      chooseAreaTool("mark");
      setThingName(mark.name);
      setStatus(`Picked mark ${mark.name}`);
      return;
    }
    const tex = L.walls[y]![x] ?? 0;
    if (tex === 0) {
      setEmptyFloor(L.floors[y]?.[x] ?? DEFAULT_FLOOR);
      setEmptyCeil(L.ceils[y]?.[x] ?? DEFAULT_CEIL);
    } else {
      setWallTex(tex);
      setWallColor(L.wallColors?.[y]?.[x] || defaultWallColor(tex));
    }
    chooseBrush({ kind: "wall", tex });
    setStatus(`Picked ${tex === 0 ? "Empty" : (WALL_NAMES[tex] ?? "wall")}`);
  }, [chooseBrush, chooseAreaTool]);

  const cellFromEvent = (e: React.MouseEvent | React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    return {
      x: clamp(x, 0, level.width - 1),
      y: clamp(y, 0, level.height - 1),
    };
  };

  const entityAt = useMemo(() => {
    const map = new Map<string, LevelEntity>();
    for (const e of level.entities) {
      map.set(`${Math.floor(e.x)},${Math.floor(e.y)}`, e);
    }
    return map;
  }, [level.entities]);

  const previewCells = useMemo(() => {
    if (!drag) return [];
    if (tool === "select") return rectCells(drag, false);
    if (tool === "zone" || isZoneBrush(brush)) return rectCells(drag, true);
    if (tool === "rect") return rectCells(drag, true);
    if (tool === "rectFill") return rectCells(drag, false);
    if (tool === "line") return lineCells(drag.x0, drag.y0, drag.x1, drag.y1);
    return [];
  }, [drag, tool, brush]);

  const saveLocal = () => {
    const name = level.name.trim() || "Untitled";
    const L = { ...level, name };
    upsertCustomLevel(L);
    setLevel(L);
    setStatus(`Saved “${name}”`);
    sfx.click();
  };

  const clearMap = () => {
    const blank = makeEmptyLevel(level.name, level.width, level.height);
    if (!commitEdit(blank)) {
      setStatus("Map is already empty");
    } else {
      setStatus("Cleared map");
      sfx.click();
    }
    setClearArmed(false);
  };

  const rotateSpawn = () => {
    const prev = levelRef.current;
    commitEdit({
      ...cloneLevel(prev),
      spawn: {
        ...prev.spawn,
        angle: prev.spawn.angle + Math.PI / 2,
      },
    });
  };

  const brushLabel =
    brush.kind === "none"
      ? ""
      : brush.kind === "wall"
        ? brush.tex === 0
          ? "Empty"
          : "Wall"
        : [...THINGS, ...AREAS].find((t) => t.id === brush.thing)?.label ?? "Thing";
  const toolLabel =
    ALL_TOOLS.find((t) => t.id === tool)?.label ??
    AREAS.find((t) => t.id === tool)?.label ??
    tool;
  const nameKind =
    brush.kind === "thing" && brush.thing !== "spawn" ? brush.thing : null;
  const namePlaceholder = nameKind ? autoName(level, nameKind) : "name";
  const showBrushInspector =
    tool !== "select" &&
    (brush.kind === "thing" || brush.kind === "wall");
  const liveSel = pruneSel(level, selection);
  const can = sharedOpts(level, liveSel);
  const selCells = liveSel.filter((s) => s.k === "cell");
  const selEnts = liveSel
    .filter((s): s is { k: "entity"; id: string } => s.k === "entity")
    .map((s) => level.entities.find((e) => e.id === s.id))
    .filter((e): e is LevelEntity => Boolean(e));
  const selEnemies = selEnts.filter((e) => e.type === "enemy");
  const selEmpties = selCells.filter(
    (s) => (level.walls[s.y]?.[s.x] ?? 0) === 0,
  );
  const groundEmpties: { x: number; y: number }[] = [];
  let occupantsOnEmpty = true;
  let occupantCount = 0;
  for (const s of liveSel) {
    let x = -1;
    let y = -1;
    if (s.k === "entity") {
      const e = level.entities.find((ent) => ent.id === s.id);
      if (!e) continue;
      x = Math.floor(e.x);
      y = Math.floor(e.y);
    } else if (s.k === "spawn") {
      x = Math.floor(level.spawn.x);
      y = Math.floor(level.spawn.y);
    } else if (s.k === "mark") {
      x = s.x;
      y = s.y;
    } else {
      continue;
    }
    occupantCount += 1;
    if ((level.walls[y]?.[x] ?? 0) !== 0) {
      occupantsOnEmpty = false;
      continue;
    }
    groundEmpties.push({ x, y });
  }
  const floorCells =
    can.has("floor")
      ? selEmpties
      : occupantCount > 0 && occupantsOnEmpty
        ? groundEmpties
        : [];
  const showFloor = floorCells.length > 0;
  const hasThingOpts =
    can.has("name") ||
    can.has("dest") ||
    can.has("texture") ||
    can.has("variant") ||
    can.has("turn") ||
    can.has("label") ||
    can.has("color") ||
    can.has("wallColor");
  const floorTitle = occupantCount > 0 ? "Ground" : "Empty";
  const hasSpawn = liveSel.some((s) => s.k === "spawn");
  const singleEnt = liveSel.length === 1 && liveSel[0]!.k === "entity" ? selEnts[0] : null;
  const singleMark =
    liveSel.length === 1 && liveSel[0]!.k === "mark"
      ? (level.marks ?? []).find(
          (m) => m.x === (liveSel[0] as { x: number; y: number }).x &&
            m.y === (liveSel[0] as { x: number; y: number }).y,
        )
      : null;
  const singleZone =
    liveSel.length === 1 && liveSel[0]!.k === "zone"
      ? (level.zones ?? [])[(liveSel[0] as { i: number }).i]
      : null;

  const editSel = (mut: (next: GameLevel) => void) => {
    const next = cloneLevel(levelRef.current);
    mut(next);
    commitEdit(next);
  };

  const selTitle =
    liveSel.length === 0
      ? "Selected"
      : liveSel.length === 1
        ? singleEnt
          ? singleEnt.name || singleEnt.type
          : singleMark
            ? singleMark.name
            : singleZone
              ? singleZone.name
              : hasSpawn
                ? "Spawn"
                : selCells[0] && (level.walls[selCells[0].y]?.[selCells[0].x] ?? 0) === 0
                  ? "Empty"
                  : "Wall"
        : `${liveSel.length} selected`;

  return (
    <div className="flex h-[calc(100dvh-var(--grok-banner-h,0px))] flex-col bg-bg">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Menu
        </button>
        <input
          value={level.name}
          onChange={(e) => setLevel((l) => ({ ...l, name: e.target.value }))}
          className="min-w-0 w-36 rounded-md border border-border bg-surface-2 px-2 py-1.5 font-display text-sm font-semibold tracking-wide text-fg uppercase outline-none focus:border-primary sm:w-48"
          aria-label="Level name"
        />
        <div className="flex items-center gap-1.5">
          <SizeField
            value={sizeW}
            min={MAP_MIN}
            max={MAP_MAX}
            ariaLabel="Map width"
            title={`Width (${MAP_MIN}–${MAP_MAX})`}
            onChange={onSizeW}
            onCommit={() => applySize()}
          />
          <span className="text-sm text-muted">×</span>
          <SizeField
            value={sizeH}
            min={MAP_MIN}
            max={MAP_MAX}
            ariaLabel="Map height"
            title={`Height (${MAP_MIN}–${MAP_MAX})`}
            onChange={onSizeH}
            onCommit={() => applySize()}
          />
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn
            title="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 className="size-4" />
          </IconBtn>
          <IconBtn
            title="Redo (Ctrl+Y)"
            onClick={redo}
            disabled={!canRedo}
          >
            <Redo2 className="size-4" />
          </IconBtn>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setScriptOpen((v) => !v)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs ${
              scriptOpen
                ? "border-primary bg-primary/15 text-fg"
                : "border-border text-fg hover:bg-surface-2"
            }`}
          >
            <ScrollText className="size-3.5" />
            <span className="hidden sm:inline">Script</span>
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-fg"
            title="Script tutorial"
          >
            <BookOpen className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={saveLocal}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-fg hover:bg-surface-2"
          >
            <Save className="size-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
          <ExportMenu level={level} onStatus={setStatus} />
          <ImportMenu
            onLevel={(lvl) => {
              commitEdit(lvl);
              sfx.pickup();
            }}
            onStatus={setStatus}
          />
          <button
            type="button"
            onClick={() => onPlay(cloneLevel(level))}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-fg hover:bg-primary-hover"
          >
            <Play className="size-3.5" />
            Play
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex max-h-[42vh] shrink-0 flex-col overflow-y-auto border-b border-border bg-surface-2 md:max-h-none md:w-52 md:border-r md:border-b-0">
          <div className="flex flex-col gap-3 p-2">
            <p className="text-[10px] tracking-widest text-dim uppercase">
              Palette
            </p>

            <Section title="Draw">
              <div className="grid grid-cols-3 gap-1">
                {DRAW_TOOLS.map((t) => (
                  <ToolCell
                    key={t.id}
                    tool={t}
                    active={tool === t.id}
                    onClick={() => chooseDrawTool(t.id)}
                  />
                ))}
              </div>
            </Section>

            <Section title="Erase & pick">
              <div className="grid grid-cols-3 gap-1">
                {META_TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    title={`${t.label} (${t.hint})`}
                    onClick={() => chooseMetaTool(t.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] transition-colors ${
                      tool === t.id
                        ? "bg-primary/20 text-primary"
                        : "text-muted hover:bg-surface hover:text-fg"
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Areas">
              <div className="grid grid-cols-2 gap-1">
                {AREAS.map((t) => {
                  const active = tool === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => chooseAreaTool(t.id)}
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-fg"
                          : "border-transparent text-muted hover:border-border hover:text-fg"
                      }`}
                    >
                      {t.icon}
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Walls">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => chooseBrush({ kind: "wall", tex: 0 })}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                    brush.kind === "wall" && brush.tex === 0
                      ? "border-primary bg-primary/15 text-fg"
                      : "border-transparent text-muted hover:border-border hover:text-fg"
                  }`}
                >
                  <span
                    className="size-4 shrink-0 rounded-sm border border-black/40"
                    style={{ background: hexFromColor(emptyFloor) }}
                  />
                  <span className="truncate">Empty</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWallColor(defaultWallColor(wallTex));
                    chooseBrush({ kind: "wall", tex: wallTex });
                  }}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                    brush.kind === "wall" && brush.tex > 0
                      ? "border-primary bg-primary/15 text-fg"
                      : "border-transparent text-muted hover:border-border hover:text-fg"
                  }`}
                >
                  <span
                    className="size-4 shrink-0 rounded-sm border border-black/40"
                    style={{ background: hexFromColor(wallColor) }}
                  />
                  <span className="truncate">Wall</span>
                </button>
              </div>
            </Section>

            <Section title="Things">
              <div className="grid grid-cols-2 gap-1">
                {THINGS.map((t) => {
                  const active = brush.kind === "thing" && brush.thing === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => chooseBrush({ kind: "thing", thing: t.id })}
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-fg"
                          : "border-transparent text-muted hover:border-border hover:text-fg"
                      }`}
                    >
                      {t.icon}
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          </div>

          {tool === "select" ? (
            <div className="flex flex-col gap-3 border-t border-border p-2">
              <p className="text-[10px] tracking-widest text-dim uppercase">
                Selected
              </p>
              {liveSel.length === 0 || hasThingOpts || (liveSel.length > 0 && !showFloor && !hasThingOpts) ? (
              <Section title={selTitle}>
                {liveSel.length === 0 ? (
                  <p className="text-[10px] leading-snug text-dim">
                    Click a thing, or drag a box. Hold Shift to add or remove.
                  </p>
                ) : null}
                {liveSel.length > 0 && !hasThingOpts && !showFloor ? (
                  <p className="text-[10px] leading-snug text-dim">
                    No shared options for this mix.
                  </p>
                ) : null}
                {can.has("name") ? (
                  <label className="block text-[11px] text-muted">
                    Name
                    <input
                      value={
                        singleEnt?.name ??
                        singleMark?.name ??
                        singleZone?.name ??
                        ""
                      }
                      onChange={(e) => {
                        const name = e.target.value;
                        const item = liveSel[0]!;
                        editSel((L) => {
                          if (item.k === "entity") {
                            const ent = L.entities.find((x) => x.id === item.id);
                            if (ent) ent.name = name;
                          } else if (item.k === "mark") {
                            const m = (L.marks ?? []).find(
                              (x) => x.x === item.x && x.y === item.y,
                            );
                            if (m) m.name = name;
                          } else if (item.k === "zone") {
                            const z = (L.zones ?? [])[item.i];
                            if (z) z.name = name;
                          }
                        });
                      }}
                      className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-fg outline-none focus:border-primary"
                    />
                  </label>
                ) : null}
                {can.has("dest") && singleEnt?.type === "teleport" ? (
                  <label className="block text-[11px] text-muted">
                    Destination
                    <input
                      value={singleEnt.dest ?? ""}
                      onChange={(e) => {
                        const dest = e.target.value;
                        const id = singleEnt.id;
                        editSel((L) => {
                          const ent = L.entities.find((x) => x.id === id);
                          if (ent) ent.dest = dest;
                        });
                      }}
                      placeholder="name of a mark"
                      className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-fg outline-none focus:border-primary"
                    />
                  </label>
                ) : null}
                {can.has("label") ? (
                  <label className="block text-[11px] text-muted">
                    Text
                    <input
                      value={
                        selEnts.find((e) => e.type === "pickup")?.label ?? "?"
                      }
                      maxLength={3}
                      onChange={(e) => {
                        const label = e.target.value.slice(0, 3);
                        const ids = new Set(
                          selEnts.filter((x) => x.type === "pickup").map((x) => x.id),
                        );
                        editSel((L) => {
                          for (const ent of L.entities) {
                            if (ids.has(ent.id)) ent.label = label;
                          }
                        });
                      }}
                      placeholder="?"
                      className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-fg outline-none focus:border-primary"
                    />
                  </label>
                ) : null}
                {can.has("color") ? (
                  <ColorPick
                    label="Color"
                    value={
                      selEnts.find((e) => e.type === "pickup")?.color ??
                      DEFAULT_PICKUP
                    }
                    onChange={(n) => {
                      const ids = new Set(
                        selEnts.filter((x) => x.type === "pickup").map((x) => x.id),
                      );
                      editSel((L) => {
                        for (const ent of L.entities) {
                          if (ids.has(ent.id)) ent.color = n;
                        }
                      });
                    }}
                  />
                ) : null}
                {can.has("wallColor") ? (
                  <ColorPick
                    label="Color"
                    value={
                      selCells
                        .map((s) => level.wallColors?.[s.y]?.[s.x] ?? 0)
                        .find((n) => n > 0) || defaultWallColor(1)
                    }
                    onChange={(n) => {
                      editSel((L) => {
                        if (!L.wallColors) L.wallColors = seedWallColors(L.walls);
                        for (const s of selCells) {
                          if ((L.walls[s.y]?.[s.x] ?? 0) > 0) {
                            L.wallColors[s.y]![s.x] = n;
                          }
                        }
                      });
                    }}
                  />
                ) : null}
                {can.has("texture") ? (
                  <div className="grid gap-0.5">
                    {Array.from({ length: WALL_TEXTURE_COUNT }, (_, i) => {
                      const tex = i + 1;
                      const allThis =
                        selCells.length > 0 &&
                        selCells.every(
                          (s) => (level.walls[s.y]?.[s.x] ?? 0) === tex,
                        );
                      return (
                        <button
                          key={tex}
                          type="button"
                          onClick={() =>
                            editSel((L) => {
                              if (!L.wallColors) {
                                L.wallColors = seedWallColors(L.walls);
                              }
                              for (const s of selCells) {
                                if ((L.walls[s.y]?.[s.x] ?? 0) > 0) {
                                  L.walls[s.y]![s.x] = tex;
                                  L.wallColors[s.y]![s.x] = defaultWallColor(tex);
                                }
                              }
                            })
                          }
                          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                            allThis
                              ? "border-primary bg-primary/15 text-fg"
                              : "border-transparent text-muted hover:border-border hover:text-fg"
                          }`}
                        >
                          <span
                            className="size-4 shrink-0 rounded-sm border border-black/40"
                            style={{ background: TEX_COLORS[tex] }}
                          />
                          <span className="truncate">{WALL_NAMES[tex]}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {can.has("variant") ? (
                  <div className="flex gap-1">
                    {(["grunt", "bruiser"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          editSel((L) => {
                            for (const e of L.entities) {
                              if (
                                e.type === "enemy" &&
                                selEnemies.some((s) => s.id === e.id)
                              ) {
                                e.variant = v;
                              }
                            }
                          })
                        }
                        className={`flex-1 rounded-md border px-2 py-1 text-[11px] capitalize ${
                          selEnemies.every((e) => (e.variant ?? "grunt") === v)
                            ? "border-primary bg-primary/15 text-fg"
                            : "border-border text-muted"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                ) : null}
                {can.has("turn") ? (
                  <button
                    type="button"
                    onClick={rotateSpawn}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted hover:bg-surface hover:text-fg"
                    title="Rotate spawn facing"
                  >
                    <RotateCcw className="size-3.5" />
                    Turn spawn
                  </button>
                ) : null}
              </Section>
              ) : null}
              {showFloor ? (
                <Section title={floorTitle}>
                  <ColorPick
                    label="Ceiling"
                    value={
                      level.ceils[floorCells[0]!.y]?.[floorCells[0]!.x] ??
                      DEFAULT_CEIL
                    }
                    onChange={(n) => {
                      editSel((L) => {
                        for (const s of floorCells) {
                          if ((L.walls[s.y]?.[s.x] ?? 0) === 0) {
                            L.ceils[s.y]![s.x] = n;
                          }
                        }
                      });
                    }}
                  />
                  <ColorPick
                    label="Floor"
                    value={
                      level.floors[floorCells[0]!.y]?.[floorCells[0]!.x] ??
                      DEFAULT_FLOOR
                    }
                    onChange={(n) => {
                      editSel((L) => {
                        for (const s of floorCells) {
                          if ((L.walls[s.y]?.[s.x] ?? 0) === 0) {
                            L.floors[s.y]![s.x] = n;
                          }
                        }
                      });
                    }}
                  />
                </Section>
              ) : null}
            </div>
          ) : null}

          {showBrushInspector ? (
            <div className="flex flex-col gap-3 border-t border-border p-2">
              <p className="text-[10px] tracking-widest text-dim uppercase">
                Selected
              </p>
              <Section title={brushLabel}>
                {brush.kind === "wall" && brush.tex === 0 ? (
                  <>
                    <ColorPick
                      label="Ceiling"
                      value={emptyCeil}
                      onChange={setEmptyCeil}
                    />
                    <ColorPick
                      label="Floor"
                      value={emptyFloor}
                      onChange={setEmptyFloor}
                    />
                    <p className="text-[10px] leading-snug text-dim">
                      Paint empty cells to apply these colors.
                    </p>
                  </>
                ) : null}
                {brush.kind === "wall" && brush.tex > 0 ? (
                  <>
                    <ColorPick
                      label="Color"
                      value={wallColor}
                      onChange={setWallColor}
                    />
                    <div className="grid gap-0.5">
                    {Array.from({ length: WALL_TEXTURE_COUNT }, (_, i) => {
                      const tex = i + 1;
                      const active = brush.tex === tex;
                      return (
                        <button
                          key={tex}
                          type="button"
                          onClick={() => {
                            setWallTex(tex);
                            setWallColor(defaultWallColor(tex));
                            chooseBrush({ kind: "wall", tex });
                          }}
                          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                            active
                              ? "border-primary bg-primary/15 text-fg"
                              : "border-transparent text-muted hover:border-border hover:text-fg"
                          }`}
                        >
                          <span
                            className="size-4 shrink-0 rounded-sm border border-black/40"
                            style={{ background: TEX_COLORS[tex] }}
                          />
                          <span className="truncate">{WALL_NAMES[tex]}</span>
                        </button>
                      );
                    })}
                    </div>
                  </>
                ) : null}
                {brush.kind === "thing" && brush.thing === "spawn" ? (
                  <button
                    type="button"
                    onClick={rotateSpawn}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted hover:bg-surface hover:text-fg"
                    title="Rotate spawn facing"
                  >
                    <RotateCcw className="size-3.5" />
                    Turn spawn
                  </button>
                ) : null}
                {nameKind ? (
                  <>
                    <label className="block text-[11px] text-muted">
                      Name
                      <input
                        value={thingName}
                        onChange={(e) => setThingName(e.target.value)}
                        placeholder={namePlaceholder}
                        className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-fg outline-none focus:border-primary"
                      />
                    </label>
                    <p className="text-[10px] leading-snug text-dim">
                      Leave blank to use {namePlaceholder}.
                    </p>
                  </>
                ) : null}
                {brush.kind === "thing" && brush.thing === "enemy" ? (
                  <div className="flex gap-1">
                    {(["grunt", "bruiser"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVariant(v)}
                        className={`flex-1 rounded-md border px-2 py-1 text-[11px] capitalize ${
                          variant === v
                            ? "border-primary bg-primary/15 text-fg"
                            : "border-border text-muted"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                ) : null}
                {brush.kind === "thing" && brush.thing === "teleport" ? (
                  <label className="block text-[11px] text-muted">
                    Destination
                    <input
                      value={thingDest}
                      onChange={(e) => setThingDest(e.target.value)}
                      placeholder="name of a mark"
                      className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-fg outline-none focus:border-primary"
                    />
                  </label>
                ) : null}
                {brush.kind === "thing" && brush.thing === "pickup" ? (
                  <>
                    <label className="block text-[11px] text-muted">
                      Text
                      <input
                        value={thingLabel}
                        maxLength={3}
                        onChange={(e) => setThingLabel(e.target.value.slice(0, 3))}
                        placeholder="?"
                        className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-fg outline-none focus:border-primary"
                      />
                    </label>
                    <ColorPick
                      label="Color"
                      value={thingColor}
                      onChange={setThingColor}
                    />
                  </>
                ) : null}
                {isZoneBrush(brush) ? (
                  <p className="text-[10px] leading-snug text-dim">
                    Drag a box to name a region.
                  </p>
                ) : null}
                {isMarkBrush(brush) ? (
                  <p className="text-[10px] leading-snug text-dim">
                    Click one cell to name it.
                  </p>
                ) : null}
              </Section>
            </div>
          ) : null}

          <div className="mt-auto p-2">
            {clearArmed ? (
              <div className="space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-2">
                <p className="text-[11px] text-primary">Erase everything?</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setClearArmed(false)}
                    className="flex-1 rounded-md border border-border py-1.5 text-[11px] text-muted hover:bg-surface hover:text-fg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={clearMap}
                    className="flex-1 rounded-md border border-primary/50 bg-primary/15 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/25"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setClearArmed(true)}
                className="w-full rounded-md border border-border py-1.5 text-[11px] text-muted hover:border-primary/40 hover:text-primary"
              >
                Clear map
              </button>
            )}
          </div>
        </aside>

        <div
          ref={canvasWrap}
          className="relative min-h-0 flex-1 overflow-auto bg-[#0e0e12] p-2"
        >
          <div
            className="relative mx-auto touch-none select-none"
            style={{
              width: level.width * cellSize,
              height: level.height * cellSize,
            }}
            onPointerDown={(e) => {
              if (e.button === 2) return;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              const { x, y } = cellFromEvent(e);
              const t = toolRef.current;
              const b = brushRef.current;
              if (t === "select") {
                const d = { x0: x, y0: y, x1: x, y1: y };
                dragRef.current = d;
                setDrag(d);
                return;
              }
              if (t === "eyedrop" || e.altKey) {
                pickFrom(x, y);
                return;
              }
              if (t === "erase") {
                beginStroke();
                applyCells([{ x, y }], true);
                return;
              }
              if (isZoneBrush(b)) {
                const d = { x0: x, y0: y, x1: x, y1: y };
                dragRef.current = d;
                setDrag(d);
                return;
              }
              if (isMarkBrush(b)) {
                stampCells([{ x, y }], false);
                return;
              }
              if (t === "fill") {
                const cells = floodCells(levelRef.current, x, y);
                stampCells(cells, false);
                return;
              }
              if (t === "rect" || t === "rectFill" || t === "line") {
                const d = { x0: x, y0: y, x1: x, y1: y };
                dragRef.current = d;
                setDrag(d);
                return;
              }
              beginStroke();
              applyCells([{ x, y }], false);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 0) return;
              const { x, y } = cellFromEvent(e);
              const t = toolRef.current;
              const b = brushRef.current;
              if (t === "eyedrop") {
                pickFrom(x, y);
                return;
              }
              if (t === "select") {
                const cur = dragRef.current;
                if (!cur) return;
                const next = { ...cur, x1: x, y1: y };
                dragRef.current = next;
                setDrag(next);
                return;
              }
              if (isZoneBrush(b) && t !== "erase") {
                const cur = dragRef.current;
                if (!cur) return;
                const next = { ...cur, x1: x, y1: y };
                dragRef.current = next;
                setDrag(next);
                return;
              }
              if (isMarkBrush(b) && t !== "erase") return;
              if (t === "rect" || t === "rectFill" || t === "line") {
                const cur = dragRef.current;
                if (!cur) return;
                const next = { ...cur, x1: x, y1: y };
                dragRef.current = next;
                setDrag(next);
                return;
              }
              if (t === "fill") return;
              if (t === "erase") return;
              applyCells([{ x, y }], false);
            }}
            onPointerUp={(e) => {
              const t = toolRef.current;
              const b = brushRef.current;
              const d = dragRef.current;
              dragRef.current = null;
              setDrag(null);
              if (t === "select" && d) {
                const L = levelRef.current;
                const same = d.x0 === d.x1 && d.y0 === d.y1;
                const items = same
                  ? [hitAt(L, d.x0, d.y0)]
                  : itemsInBox(L, d);
                setSelection((prev) => mergeSel(prev, items, e.shiftKey));
                return;
              }
              if (d && isZoneBrush(b) && t !== "erase" && t !== "eyedrop") {
                const x0 = Math.min(d.x0, d.x1);
                const y0 = Math.min(d.y0, d.y1);
                const w = Math.abs(d.x1 - d.x0) + 1;
                const h = Math.abs(d.y1 - d.y0) + 1;
                const name = resolveName(
                  levelRef.current,
                  "zone",
                  nameRef.current,
                );
                const next = cloneLevel(levelRef.current);
                next.zones = [...(next.zones ?? []), { name, x: x0, y: y0, w, h }];
                commitEdit(next);
                return;
              }
              if (d && (t === "rect" || t === "rectFill" || t === "line")) {
                if (isMarkBrush(b) || isZoneBrush(b)) return;
                const cells =
                  t === "line"
                    ? lineCells(d.x0, d.y0, d.x1, d.y1)
                    : rectCells(d, t === "rect");
                stampCells(cells, false);
                return;
              }
              if (t !== "fill" && t !== "eyedrop") endStroke();
            }}
            onPointerCancel={() => {
              dragRef.current = null;
              setDrag(null);
              endStroke();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              const { x, y } = cellFromEvent(e);
              const next = cloneLevel(levelRef.current);
              applyBrushTo(next, x, y, brushRef.current, true, {
                name: nameRef.current,
                dest: destRef.current,
                label: labelRef.current,
                color: colorRef.current,
                variant: variantRef.current,
                floor: floorRef.current,
                ceil: ceilRef.current,
                wallColor: wallColorRef.current,
              });
              commitEdit(next);
            }}
          >
            {level.walls.map((row, y) =>
              row.map((cell, x) => {
                const ent = entityAt.get(`${x},${y}`);
                const isSpawn =
                  Math.floor(level.spawn.x) === x &&
                  Math.floor(level.spawn.y) === y;
                return (
                  <div
                    key={`${x}-${y}`}
                    className="absolute border border-black/30"
                    style={{
                      left: x * cellSize,
                      top: y * cellSize,
                      width: cellSize,
                      height: cellSize,
                      background:
                        cell === 0
                          ? hexFromColor(level.floors[y]?.[x] ?? DEFAULT_FLOOR)
                          : hexFromColor(
                              level.wallColors?.[y]?.[x] ||
                                defaultWallColor(cell),
                            ),
                    }}
                  >
                    {cell === 0 ? (
                      <span
                        className="absolute inset-x-0 top-0"
                        style={{
                          height: 3,
                          background: hexFromColor(
                            level.ceils[y]?.[x] ?? DEFAULT_CEIL,
                          ),
                        }}
                      />
                    ) : null}
                    {isSpawn && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-fg"
                        style={{
                          transform: `rotate(${(level.spawn.angle * 180) / Math.PI}deg)`,
                        }}
                        title="Spawn"
                      >
                        ▶
                      </span>
                    )}
                    {ent && (
                      <>
                        <span
                          className="absolute inset-0 flex items-center justify-center text-[11px] text-fg"
                          style={
                            ent.type === "pickup"
                              ? { color: hexFromColor(ent.color ?? DEFAULT_PICKUP) }
                              : ent.type === "door"
                                ? { color: "#c4a050" }
                                : undefined
                          }
                        >
                          {ent.type === "enemy" && "☠"}
                          {ent.type === "ammo" && "▣"}
                          {ent.type === "health" && "+"}
                          {ent.type === "exit" && "⎋"}
                          {ent.type === "door" && "▯"}
                          {ent.type === "teleport" && "◎"}
                          {ent.type === "pickup" && (ent.label || "?")}
                        </span>
                        {ent.name ? (
                          <span
                            title={ent.name}
                            className="absolute bottom-0 left-0 max-w-full truncate rounded-sm bg-black/70 px-0.5 font-mono text-[8px] leading-tight text-fg"
                          >
                            {ent.name}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              }),
            )}
            {previewCells.map((c) => (
              <div
                key={`p-${c.x}-${c.y}`}
                className="pointer-events-none absolute bg-primary/35 ring-1 ring-primary/80"
                style={{
                  left: c.x * cellSize,
                  top: c.y * cellSize,
                  width: cellSize,
                  height: cellSize,
                }}
              />
            ))}
            {liveSel.map((s) => {
              if (s.k === "zone") {
                const z = (level.zones ?? [])[s.i];
                if (!z) return null;
                return (
                  <div
                    key={selKey(s)}
                    className="pointer-events-none absolute ring-2 ring-accent"
                    style={{
                      left: z.x * cellSize,
                      top: z.y * cellSize,
                      width: z.w * cellSize,
                      height: z.h * cellSize,
                    }}
                  />
                );
              }
              let x = 0;
              let y = 0;
              if (s.k === "cell" || s.k === "mark") {
                x = s.x;
                y = s.y;
              } else if (s.k === "spawn") {
                x = Math.floor(level.spawn.x);
                y = Math.floor(level.spawn.y);
              } else {
                const ent = level.entities.find((e) => e.id === s.id);
                if (!ent) return null;
                x = Math.floor(ent.x);
                y = Math.floor(ent.y);
              }
              return (
                <div
                  key={selKey(s)}
                  className="pointer-events-none absolute ring-2 ring-primary"
                  style={{
                    left: x * cellSize,
                    top: y * cellSize,
                    width: cellSize,
                    height: cellSize,
                  }}
                />
              );
            })}
            {(level.zones ?? []).map((z, i) => (
              <div
                key={`z-${z.name}-${i}`}
                className="pointer-events-none absolute border border-accent/60 bg-accent/15"
                style={{
                  left: z.x * cellSize,
                  top: z.y * cellSize,
                  width: z.w * cellSize,
                  height: z.h * cellSize,
                }}
              >
                <span
                  className={`absolute top-0 left-0 bg-accent/80 px-1 font-mono text-[9px] text-bg ${
                    tool === "select" ? "pointer-events-auto cursor-pointer" : ""
                  }`}
                  onPointerDown={(e) => {
                    if (tool !== "select") return;
                    e.stopPropagation();
                    setSelection((prev) =>
                      mergeSel(prev, [{ k: "zone", i }], e.shiftKey),
                    );
                  }}
                >
                  {z.name}
                </span>
              </div>
            ))}
            {(level.marks ?? []).map((m) => (
              <div
                key={`m-${m.name}-${m.x}-${m.y}`}
                className="pointer-events-none absolute flex items-start justify-end"
                style={{
                  left: m.x * cellSize,
                  top: m.y * cellSize,
                  width: cellSize,
                  height: cellSize,
                }}
              >
                <span className="rounded-sm bg-primary px-0.5 font-mono text-[8px] text-fg">
                  {m.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {scriptOpen ? (
        <div
          className="flex shrink-0 flex-col border-t border-border bg-surface"
          style={{ height: scriptH }}
        >
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize script editor"
            className="flex h-3 shrink-0 cursor-row-resize items-center justify-center hover:bg-surface-2"
            onPointerDown={(e) => {
              e.preventDefault();
              scriptDragRef.current = { y: e.clientY, h: scriptH };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = scriptDragRef.current;
              if (!d) return;
              const max = Math.floor(window.innerHeight * 0.7);
              const next = Math.max(140, Math.min(max, d.h + (d.y - e.clientY)));
              setScriptH(next);
            }}
            onPointerUp={() => {
              scriptDragRef.current = null;
            }}
            onPointerCancel={() => {
              scriptDragRef.current = null;
            }}
          >
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
            <ScriptEditor
              value={level.script ?? ""}
              onChange={(src) => setLevel((l) => ({ ...l, script: src }))}
              error={
                (level.script ?? "").trim()
                  ? (() => {
                      const r = compileProgram(level.script ?? "");
                      return r.ok ? "" : r.error;
                    })()
                  : ""
              }
            />
          </div>
        </div>
      ) : null}

      {helpOpen ? (
        <ScriptHelp onClose={() => setHelpOpen(false)} />
      ) : null}

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-surface px-3 py-1.5 text-[11px] text-muted">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {level.entities.length} placed ·{" "}
            {tool === "select"
            ? liveSel.length
              ? `Select · ${liveSel.length} selected · Shift adds`
              : "Select · click or drag a box · Shift adds"
            : isAreaTool(tool)
              ? toolLabel
              : brushLabel
                ? `${toolLabel} · ${brushLabel}`
                : toolLabel}
          </span>
        </span>
        <span className="min-w-0 truncate text-accent">{status}</span>
        <span className="hidden sm:inline">Right-click erases · Alt-click picks</span>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] tracking-widest text-dim uppercase">{title}</p>
      {children}
    </div>
  );
}

function ToolCell({
  tool,
  active,
  onClick,
}: {
  tool: { id: string; label: string; hint: string; icon: React.ReactNode };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={`${tool.label} (${tool.hint})`}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[9px] tracking-wide uppercase transition-colors ${
        active
          ? "bg-primary/20 text-primary"
          : "text-muted hover:bg-surface hover:text-fg"
      }`}
    >
      {tool.icon}
      <span className="leading-none">{tool.label}</span>
    </button>
  );
}

function SizeField({
  value,
  min,
  max,
  ariaLabel,
  title,
  onChange,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  title: string;
  onChange: (n: number) => void;
  onCommit: () => void;
}) {
  const bump = (dir: 1 | -1) => {
    const cur = Number.isFinite(value) ? value : min;
    onChange(Math.max(min, Math.min(max, (cur | 0) + dir)));
  };
  return (
    <div className="flex overflow-hidden rounded-md border border-border bg-surface-2 focus-within:border-primary">
      <input
        type="number"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="spin-none w-10 bg-transparent px-1.5 py-1.5 text-center font-mono text-sm text-fg outline-none"
        aria-label={ariaLabel}
        title={title}
      />
      <div className="flex w-5 flex-col border-l border-border">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${ariaLabel.toLowerCase()}`}
          onClick={() => bump(1)}
          className="flex flex-1 items-center justify-center text-muted hover:bg-surface hover:text-fg"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Decrease ${ariaLabel.toLowerCase()}`}
          onClick={() => bump(-1)}
          className="flex flex-1 items-center justify-center border-t border-border text-muted hover:bg-surface hover:text-fg"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  );
}

function ColorPick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const hex = hexFromColor(value);
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-muted">
      {label}
      <span className="flex min-w-0 items-center gap-1.5">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(parseHexColor(e.target.value))}
          className="h-6 w-8 shrink-0 cursor-pointer border-0 bg-transparent"
        />
        <span className="font-mono text-[10px] uppercase tracking-wide text-fg">
          {hex}
        </span>
      </span>
    </label>
  );
}

function IconBtn({
  onClick,
  title,
  children,
  disabled,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-2 transition-colors ${
        disabled
          ? "cursor-not-allowed text-dim/50"
          : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

const NAME_PREFIX: Record<string, string> = {
  door: "door",
  teleport: "pad",
  pickup: "item",
  enemy: "enemy",
  ammo: "ammo",
  health: "health",
  exit: "exit",
  zone: "zone",
  mark: "mark",
};

function usedNames(level: GameLevel): Set<string> {
  const names = new Set<string>();
  for (const e of level.entities) {
    if (e.name) names.add(e.name);
  }
  for (const z of level.zones ?? []) names.add(z.name);
  for (const m of level.marks ?? []) names.add(m.name);
  return names;
}

function autoName(level: GameLevel, kind: string): string {
  const prefix = NAME_PREFIX[kind] ?? kind;
  const used = usedNames(level);
  let n = 1;
  while (used.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

function resolveName(level: GameLevel, kind: string, typed: string): string {
  const name = typed.trim();
  return name || autoName(level, kind);
}

function applyBrushTo(
  level: GameLevel,
  x: number,
  y: number,
  brush: Brush,
  erase: boolean,
  extra: {
    name: string;
    dest: string;
    label: string;
    color: number;
    variant: EnemyVariant;
    floor: number;
    ceil: number;
    wallColor: number;
  } = {
    name: "",
    dest: "",
    label: "?",
    color: DEFAULT_PICKUP,
    variant: "grunt",
    floor: DEFAULT_FLOOR,
    ceil: DEFAULT_CEIL,
    wallColor: defaultWallColor(1),
  },
) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return;
  if (erase) {
    eraseOnce(level, x, y);
    return;
  }
  if (brush.kind === "none") return;
  if (brush.kind === "wall") {
    const isSpawn =
      Math.floor(level.spawn.x) === x && Math.floor(level.spawn.y) === y;
    if (brush.tex > 0 && isSpawn) return;
    level.walls[y]![x] = brush.tex;
    if (!level.wallColors) level.wallColors = seedWallColors(level.walls);
    if (brush.tex === 0) {
      level.floors[y]![x] = extra.floor;
      level.ceils[y]![x] = extra.ceil;
    } else {
      level.wallColors[y]![x] = extra.wallColor;
      removeEntityAt(level, x, y);
    }
    return;
  }
  if (brush.thing === "mark") {
    level.marks = [
      ...(level.marks ?? []).filter((m) => !(m.x === x && m.y === y)),
      { name: resolveName(level, "mark", extra.name), x, y },
    ];
    return;
  }
  if (brush.thing === "zone") return;
  level.walls[y]![x] = 0;
  if (brush.thing === "spawn") {
    level.spawn = { x: x + 0.5, y: y + 0.5, angle: level.spawn.angle };
    return;
  }
  removeEntityAt(level, x, y);
  if (brush.thing === "exit") {
    level.entities = level.entities.filter((e) => e.type !== "exit");
  }
  const name = resolveName(level, brush.thing, extra.name);
  level.entities.push({
    id: uid(brush.thing.slice(0, 2)),
    type: brush.thing,
    x: x + 0.5,
    y: y + 0.5,
    name,
    dest: brush.thing === "teleport" ? extra.dest.trim() || undefined : undefined,
    label:
      brush.thing === "pickup"
        ? (extra.label.trim() || "?").slice(0, 3)
        : undefined,
    color: brush.thing === "pickup" ? extra.color : undefined,
    variant: brush.thing === "enemy" ? extra.variant : undefined,
    locked: brush.thing === "door" ? false : undefined,
  });
}

function eraseOnce(level: GameLevel, x: number, y: number) {
  const wall = level.walls[y]![x] ?? 0;
  const hasEnt = level.entities.some(
    (e) => Math.floor(e.x) === x && Math.floor(e.y) === y,
  );
  if (wall > 0 || hasEnt) {
    level.walls[y]![x] = 0;
    removeEntityAt(level, x, y);
    return;
  }
  const mark = (level.marks ?? []).find((m) => m.x === x && m.y === y);
  if (mark) {
    level.marks = (level.marks ?? []).filter((m) => !(m.x === x && m.y === y));
    return;
  }
  const zones = level.zones ?? [];
  let hit = -1;
  let area = Infinity;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i]!;
    if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) {
      const a = z.w * z.h;
      if (a <= area) {
        area = a;
        hit = i;
      }
    }
  }
  if (hit >= 0) {
    level.zones = zones.filter((_, i) => i !== hit);
  }
}

function removeEntityAt(level: GameLevel, x: number, y: number) {
  level.entities = level.entities.filter(
    (e) => !(Math.floor(e.x) === x && Math.floor(e.y) === y),
  );
}

function cellKey(level: GameLevel, x: number, y: number): string {
  const wall = level.walls[y]![x] ?? 0;
  if (Math.floor(level.spawn.x) === x && Math.floor(level.spawn.y) === y) {
    return `s:${wall}`;
  }
  const ent = level.entities.find(
    (e) => Math.floor(e.x) === x && Math.floor(e.y) === y,
  );
  if (ent) return `e:${ent.type}:${wall}`;
  if (wall === 0) {
    return `w:0:${level.floors[y]?.[x] ?? 0}:${level.ceils[y]?.[x] ?? 0}`;
  }
  return `w:${wall}`;
}

function floodCells(
  level: GameLevel,
  x: number,
  y: number,
): { x: number; y: number }[] {
  const target = cellKey(level, x, y);
  const out: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    const id = `${cx},${cy}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (cx < 0 || cy < 0 || cx >= level.width || cy >= level.height) continue;
    if (cellKey(level, cx, cy) !== target) continue;
    out.push({ x: cx, y: cy });
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    if (out.length > level.width * level.height) break;
  }
  return out;
}

function rectCells(d: Drag, outline: boolean): { x: number; y: number }[] {
  const x0 = Math.min(d.x0, d.x1);
  const x1 = Math.max(d.x0, d.x1);
  const y0 = Math.min(d.y0, d.y1);
  const y1 = Math.max(d.y0, d.y1);
  const cells: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (outline && x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

function lineCells(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    cells.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (cells.length > 4096) break;
  }
  return cells;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function sameMap(a: GameLevel, b: GameLevel): boolean {
  if (a.fogColor !== b.fogColor) {
    return false;
  }
  if (
    a.spawn.x !== b.spawn.x ||
    a.spawn.y !== b.spawn.y ||
    a.spawn.angle !== b.spawn.angle
  ) {
    return false;
  }
  if (a.width !== b.width || a.height !== b.height) return false;
  if (a.entities.length !== b.entities.length) return false;
  if ((a.script ?? "") !== (b.script ?? "")) return false;
  if ((a.zones ?? []).length !== (b.zones ?? []).length) return false;
  if ((a.marks ?? []).length !== (b.marks ?? []).length) return false;
  for (let y = 0; y < a.height; y++) {
    const ar = a.walls[y]!;
    const br = b.walls[y]!;
    for (let x = 0; x < a.width; x++) {
      if (ar[x] !== br[x]) return false;
      if ((a.floors?.[y]?.[x] ?? 0) !== (b.floors?.[y]?.[x] ?? 0)) return false;
      if ((a.ceils?.[y]?.[x] ?? 0) !== (b.ceils?.[y]?.[x] ?? 0)) return false;
      if ((a.wallColors?.[y]?.[x] ?? 0) !== (b.wallColors?.[y]?.[x] ?? 0)) {
        return false;
      }
    }
  }
  const key = (e: LevelEntity) =>
    [
      e.id,
      e.type,
      e.x,
      e.y,
      e.name ?? "",
      e.dest ?? "",
      e.label ?? "",
      e.color ?? "",
      e.variant ?? "",
      e.locked ? 1 : 0,
    ].join(":");
  const ae = a.entities.map(key).sort().join("|");
  const be = b.entities.map(key).sort().join("|");
  if (ae !== be) return false;
  const za = (a.zones ?? [])
    .map((z) => `${z.name}:${z.x}:${z.y}:${z.w}:${z.h}`)
    .join("|");
  const zb = (b.zones ?? [])
    .map((z) => `${z.name}:${z.x}:${z.y}:${z.w}:${z.h}`)
    .join("|");
  if (za !== zb) return false;
  const ma = (a.marks ?? []).map((m) => `${m.name}:${m.x}:${m.y}`).join("|");
  const mb = (b.marks ?? []).map((m) => `${m.name}:${m.x}:${m.y}`).join("|");
  return ma === mb;
}
