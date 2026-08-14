import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EditorTool,
  EnemyVariant,
  EntityType,
  GameLevel,
  LevelEntity,
} from "./types";
import {
  WALL_NAMES,
  WALL_TEXTURE_COUNT,
  cloneLevel,
  makeEmptyLevel,
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
  Spline,
} from "lucide-react";

type Props = {
  initial?: GameLevel | null;
  onExit: () => void;
  onPlay: (level: GameLevel) => void;
};

type ThingKind = "spawn" | EntityType | "zone" | "mark";

type Brush =
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
  { id: "zone", label: "Zone", icon: <BoxSelect className="size-4" /> },
  { id: "mark", label: "Mark", icon: <Tag className="size-4" /> },
];

const TOOL_KEY: Record<string, EditorTool> = {
  KeyP: "paint",
  KeyE: "erase",
  KeyF: "fill",
  KeyO: "rect",
  KeyB: "rectFill",
  KeyL: "line",
  KeyI: "eyedrop",
};

export function EditorView({ initial, onExit, onPlay }: Props) {
  const [level, setLevel] = useState<GameLevel>(() =>
    initial ? cloneLevel(initial) : makeEmptyLevel("My Level", 24, 24),
  );
  const [tool, setTool] = useState<EditorTool>("paint");
  const [brush, setBrush] = useState<Brush>({ kind: "wall", tex: 1 });
  const [thingName, setThingName] = useState("");
  const [thingDest, setThingDest] = useState("");
  const [variant, setVariant] = useState<EnemyVariant>("grunt");
  const [scriptOpen, setScriptOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cellSize, setCellSize] = useState(22);
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState<Drag | null>(null);
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
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const pastRef = useRef<GameLevel[]>([]);
  const futureRef = useRef<GameLevel[]>([]);
  const strokeBaseRef = useRef<GameLevel | null>(null);
  const dragRef = useRef<Drag | null>(null);

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
        setTool(nextTool);
        return;
      }
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 0 && n <= WALL_TEXTURE_COUNT) {
          e.preventDefault();
          setBrush({ kind: "wall", tex: n });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

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
        variant: variantRef.current,
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
        variant: variantRef.current,
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
      setBrush({ kind: "thing", thing: "spawn" });
      setStatus("Picked spawn");
      return;
    }
    const ent = L.entities.find(
      (e) => Math.floor(e.x) === x && Math.floor(e.y) === y,
    );
    if (ent) {
      setBrush({ kind: "thing", thing: ent.type });
      setThingName(ent.name || "");
      setThingDest(ent.dest || "");
      setVariant(ent.variant === "bruiser" ? "bruiser" : "grunt");
      setStatus(`Picked ${ent.name || ent.type}`);
      return;
    }
    const mark = (L.marks ?? []).find((m) => m.x === x && m.y === y);
    if (mark) {
      setBrush({ kind: "thing", thing: "mark" });
      setThingName(mark.name);
      setStatus(`Picked mark ${mark.name}`);
      return;
    }
    const tex = L.walls[y]![x] ?? 0;
    setBrush({ kind: "wall", tex });
    setStatus(`Picked ${WALL_NAMES[tex] ?? "wall"}`);
  }, []);

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
    const zoneBrush = brush.kind === "thing" && brush.thing === "zone";
    if (tool === "rect" || zoneBrush) return rectCells(drag, true);
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
    brush.kind === "wall"
      ? (WALL_NAMES[brush.tex] ?? "Wall")
      : THINGS.find((t) => t.id === brush.thing)?.label ?? "Thing";
  const toolLabel = ALL_TOOLS.find((t) => t.id === tool)?.label ?? tool;

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
          className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 font-display text-sm font-semibold tracking-wide text-fg uppercase outline-none focus:border-primary sm:max-w-xs"
          aria-label="Level name"
        />
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
        <aside className="flex max-h-[42vh] shrink-0 flex-col gap-3 overflow-y-auto border-b border-border bg-surface-2 p-2 md:max-h-none md:w-52 md:border-r md:border-b-0">
          <Section title="Draw">
            <div className="grid grid-cols-3 gap-1">
              {DRAW_TOOLS.map((t) => (
                <ToolCell
                  key={t.id}
                  tool={t}
                  active={tool === t.id}
                  onClick={() => setTool(t.id)}
                />
              ))}
            </div>
          </Section>

          <Section title="Erase & pick">
            <div className="grid grid-cols-2 gap-1">
              {META_TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={`${t.label} (${t.hint})`}
                  onClick={() => setTool(t.id)}
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

          <Section title="Walls">
            <div className="grid gap-0.5">
              {Array.from({ length: WALL_TEXTURE_COUNT + 1 }, (_, i) => {
                const active = brush.kind === "wall" && brush.tex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBrush({ kind: "wall", tex: i })}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary/15 text-fg"
                        : "border-transparent text-muted hover:border-border hover:text-fg"
                    }`}
                  >
                    <span
                      className="size-4 shrink-0 rounded-sm border border-black/40"
                      style={{ background: TEX_COLORS[i] }}
                    />
                    <span className="truncate">{WALL_NAMES[i]}</span>
                    <span className="ml-auto font-mono text-[10px] text-dim">
                      {i}
                    </span>
                  </button>
                );
              })}
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
                    onClick={() => setBrush({ kind: "thing", thing: t.id })}
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
            <button
              type="button"
              onClick={rotateSpawn}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted hover:bg-surface hover:text-fg"
              title="Rotate spawn facing"
            >
              <RotateCcw className="size-3.5" />
              Turn spawn
            </button>
            <label className="mt-1 block text-[11px] text-muted">
              Name
              <input
                value={thingName}
                onChange={(e) => setThingName(e.target.value)}
                placeholder="door-armory"
                className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-fg outline-none focus:border-primary"
              />
            </label>
            {brush.kind === "thing" && brush.thing === "teleport" ? (
              <label className="block text-[11px] text-muted">
                Destination
                <input
                  value={thingDest}
                  onChange={(e) => setThingDest(e.target.value)}
                  placeholder="yard"
                  className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-fg outline-none focus:border-primary"
                />
              </label>
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
            {(level.zones ?? []).length > 0 ? (
              <div className="space-y-0.5">
                {(level.zones ?? []).map((z, i) => (
                  <button
                    key={`${z.name}-${i}`}
                    type="button"
                    onClick={() => {
                      const next = cloneLevel(level);
                      next.zones = (next.zones ?? []).filter((_, j) => j !== i);
                      commitEdit(next);
                    }}
                    className="flex w-full items-center justify-between rounded px-1 py-0.5 font-mono text-[10px] text-dim hover:bg-surface hover:text-primary"
                    title="Remove zone"
                  >
                    <span>{z.name}</span>
                    <span>
                      {z.w}×{z.h}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </Section>

          <Section title="Look">
            <label className="flex items-center justify-between gap-1 text-[11px] text-muted">
              Floor
              <input
                type="color"
                value={toHex(level.floorColor)}
                onFocus={beginStroke}
                onChange={(e) =>
                  setLevel((l) => ({ ...l, floorColor: e.target.value }))
                }
                onBlur={endStroke}
                className="h-6 w-8 cursor-pointer border-0 bg-transparent"
              />
            </label>
            <label className="flex items-center justify-between gap-1 text-[11px] text-muted">
              Ceiling
              <input
                type="color"
                value={toHex(level.ceilingColor)}
                onFocus={beginStroke}
                onChange={(e) =>
                  setLevel((l) => ({ ...l, ceilingColor: e.target.value }))
                }
                onBlur={endStroke}
                className="h-6 w-8 cursor-pointer border-0 bg-transparent"
              />
            </label>
          </Section>

          {clearArmed ? (
            <div className="mt-auto space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-2">
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
              className="mt-auto rounded-md border border-border py-1.5 text-[11px] text-muted hover:border-primary/40 hover:text-primary"
            >
              Clear map
            </button>
          )}
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
              const zoneBrush =
                brushRef.current.kind === "thing" &&
                brushRef.current.thing === "zone";
              if (t === "eyedrop" || e.altKey) {
                pickFrom(x, y);
                return;
              }
              if (t === "fill" && !zoneBrush) {
                const cells = floodCells(levelRef.current, x, y);
                stampCells(cells, false);
                return;
              }
              if (t === "rect" || t === "rectFill" || t === "line" || zoneBrush) {
                const d = { x0: x, y0: y, x1: x, y1: y };
                dragRef.current = d;
                setDrag(d);
                return;
              }
              beginStroke();
              applyCells([{ x, y }], t === "erase");
              dragRef.current = { x0: x, y0: y, x1: x, y1: y };
              setDrag(null);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 0) return;
              const { x, y } = cellFromEvent(e);
              const t = toolRef.current;
              if (t === "eyedrop") {
                pickFrom(x, y);
                return;
              }
              if (
                t === "rect" ||
                t === "rectFill" ||
                t === "line" ||
                (brushRef.current.kind === "thing" &&
                  brushRef.current.thing === "zone")
              ) {
                const cur = dragRef.current;
                if (!cur) return;
                const next = { ...cur, x1: x, y1: y };
                dragRef.current = next;
                setDrag(next);
                return;
              }
              if (t === "fill") return;
              applyCells([{ x, y }], t === "erase");
            }}
            onPointerUp={() => {
              const t = toolRef.current;
              const d = dragRef.current;
              dragRef.current = null;
              setDrag(null);
              if (d) {
                const zoneBrush =
                  brushRef.current.kind === "thing" &&
                  brushRef.current.thing === "zone";
                if (zoneBrush) {
                  const x0 = Math.min(d.x0, d.x1);
                  const y0 = Math.min(d.y0, d.y1);
                  const w = Math.abs(d.x1 - d.x0) + 1;
                  const h = Math.abs(d.y1 - d.y0) + 1;
                  const name =
                    nameRef.current.trim() ||
                    `zone-${(levelRef.current.zones ?? []).length + 1}`;
                  const next = cloneLevel(levelRef.current);
                  next.zones = [...(next.zones ?? []), { name, x: x0, y: y0, w, h }];
                  commitEdit(next);
                  return;
                }
                if (t === "rect" || t === "rectFill" || t === "line") {
                  const cells =
                    t === "line"
                      ? lineCells(d.x0, d.y0, d.x1, d.y1)
                      : rectCells(d, t === "rect");
                  stampCells(cells, false);
                  return;
                }
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
                variant: variantRef.current,
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
                      background: TEX_COLORS[cell] ?? "#333",
                    }}
                  >
                    {isSpawn && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-fg"
                        style={{
                          transform: `rotate(${(-level.spawn.angle * 180) / Math.PI}deg)`,
                        }}
                        title="Spawn"
                      >
                        ▶
                      </span>
                    )}
                    {ent && (
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] text-fg">
                        {ent.type === "enemy" && "☠"}
                        {ent.type === "ammo" && "▣"}
                        {ent.type === "health" && "+"}
                        {ent.type === "exit" && "⎋"}
                        {ent.type === "door" && "▣"}
                        {ent.type === "teleport" && "◎"}
                        {ent.type === "pickup" && "◆"}
                      </span>
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
                <span className="absolute top-0 left-0 bg-accent/80 px-1 font-mono text-[9px] text-bg">
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
        <div className="flex h-56 shrink-0 flex-col border-t border-border bg-surface p-2">
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
      ) : null}

      {helpOpen ? (
        <ScriptHelp
          onClose={() => setHelpOpen(false)}
          onInsert={(src) => {
            setLevel((l) => ({ ...l, script: src }));
            setScriptOpen(true);
            setHelpOpen(false);
          }}
        />
      ) : null}

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-surface px-3 py-1.5 text-[11px] text-muted">
        <span>
          {level.width}×{level.height} · {level.entities.length} placed ·{" "}
          {toolLabel} · {brushLabel}
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

function applyBrushTo(
  level: GameLevel,
  x: number,
  y: number,
  brush: Brush,
  erase: boolean,
  extra: { name: string; dest: string; variant: EnemyVariant } = {
    name: "",
    dest: "",
    variant: "grunt",
  },
) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return;
  if (erase) {
    level.walls[y]![x] = 0;
    removeEntityAt(level, x, y);
    level.marks = (level.marks ?? []).filter((m) => !(m.x === x && m.y === y));
    return;
  }
  if (brush.kind === "wall") {
    const isSpawn =
      Math.floor(level.spawn.x) === x && Math.floor(level.spawn.y) === y;
    if (brush.tex > 0 && isSpawn) return;
    level.walls[y]![x] = brush.tex;
    if (brush.tex > 0) removeEntityAt(level, x, y);
    return;
  }
  if (brush.thing === "mark") {
    const name = extra.name.trim() || `mark-${x}-${y}`;
    level.marks = [
      ...(level.marks ?? []).filter((m) => !(m.x === x && m.y === y)),
      { name, x, y },
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
  const name =
    extra.name.trim() ||
    (brush.thing === "door"
      ? `door-${x}-${y}`
      : brush.thing === "pickup"
        ? `item-${x}-${y}`
        : brush.thing === "teleport"
          ? `pad-${x}-${y}`
          : undefined);
  level.entities.push({
    id: uid(brush.thing.slice(0, 2)),
    type: brush.thing,
    x: x + 0.5,
    y: y + 0.5,
    name,
    dest: brush.thing === "teleport" ? extra.dest.trim() || undefined : undefined,
    variant: brush.thing === "enemy" ? extra.variant : undefined,
    locked: brush.thing === "door" ? false : undefined,
  });
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
  if (
    a.floorColor !== b.floorColor ||
    a.ceilingColor !== b.ceilingColor ||
    a.fogColor !== b.fogColor
  ) {
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
    }
  }
  const key = (e: LevelEntity) => `${e.type}:${e.x}:${e.y}`;
  const ae = a.entities.map(key).sort().join("|");
  const be = b.entities.map(key).sort().join("|");
  return ae === be;
}

function toHex(c: string): string {
  if (c.startsWith("#") && (c.length === 7 || c.length === 4)) {
    if (c.length === 4) {
      return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    }
    return c;
  }
  return "#2a2420";
}
