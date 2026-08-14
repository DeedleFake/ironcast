import { useCallback, useEffect, useRef, useState } from "react";
import type { GameLevel } from "./types";
import {
  attachControlsProbe,
  createGameState,
  renderGame,
  renderMinimap,
  unlockAudio,
  updateGame,
  type GameState,
} from "./engine";
import {
  Crosshair,
  Heart,
  Pause,
  RotateCcw,
  Trophy,
  Skull,
  ArrowLeft,
  Zap,
  Map as MapIcon,
} from "lucide-react";

type Props = {
  level: GameLevel;
  onExit: () => void;
  backLabel?: string;
  exitLabel?: string;
};

const INTERNAL_W = 480;
const INTERNAL_H = 300;

/** Free the mouse so overlays / menu chrome are clickable. */
function releasePointer(state?: GameState | null) {
  if (state) {
    state.pointerLocked = false;
    state.fireHeld = false;
    state.lookDX = 0;
    state.lookDY = 0;
    state.keys.clear();
  }
  if (typeof document !== "undefined" && document.pointerLockElement) {
    try {
      document.exitPointerLock();
    } catch {
      /* ignore */
    }
  }
}

function pauseGame(state?: GameState | null) {
  if (!state) return;
  if (state.mode === "playing") state.mode = "paused";
  releasePointer(state);
}

function requestLock(canvas: HTMLCanvasElement): Promise<void> {
  const lock = canvas.requestPointerLock as (
    opts?: PointerLockOptions,
  ) => Promise<void> | void;
  try {
    const p = lock.call(canvas, { unadjustedMovement: true });
    if (p && typeof (p as Promise<void>).then === "function") {
      return (p as Promise<void>).catch(() => {
        try {
          const p2 = canvas.requestPointerLock();
          if (p2 && typeof (p2 as Promise<void>).catch === "function") {
            return (p2 as Promise<void>).catch(() => undefined);
          }
        } catch {
          /* ignore rate-limit / unsupported */
        }
      });
    }
  } catch {
    try {
      canvas.requestPointerLock();
    } catch {
      /* ignore */
    }
  }
  return Promise.resolve();
}

export function PlayView({
  level,
  onExit,
  backLabel = "Menu",
  exitLabel = "Exit",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const lastModeRef = useRef<GameState["mode"]>("playing");
  const hadPointerLockRef = useRef(false);
  const [hud, setHud] = useState({
    health: 100,
    ammo: 40,
    score: 0,
    kills: 0,
    total: 0,
    mode: "playing" as GameState["mode"],
    message: "",
    needClick: true,
    useHint: "",
  });
  const [showMap, setShowMap] = useState(true);
  const touchRef = useRef({
    moveId: -1,
    lookId: -1,
    originX: 0,
    originY: 0,
    lookLastX: 0,
    lookLastY: 0,
  });

  const exitToMenu = useCallback(() => {
    releasePointer(stateRef.current);
    onExit();
  }, [onExit]);

  const restart = useCallback(() => {
    releasePointer(stateRef.current);
    const s = createGameState(level);
    stateRef.current = s;
    lastModeRef.current = s.mode;
    hadPointerLockRef.current = false;
    attachControlsProbe(s);
    setHud({
      health: s.health,
      ammo: s.ammo,
      score: s.score,
      kills: s.kills,
      total: s.totalEnemies,
      mode: s.mode,
      message: "",
      needClick: true,
      useHint: "",
    });
  }, [level]);

  useEffect(() => {
    restart();
  }, [restart]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const onKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s) return;
      if (e.code === "Escape") {
        // Escape only pauses — never toggles back. Resume is a click.
        if (s.mode === "playing") pauseGame(s);
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
      if (s.mode !== "playing") return;
      s.keys.add(e.code);
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      stateRef.current?.keys.delete(e.code);
    };
    const onBlur = () => {
      const s = stateRef.current;
      if (s && s.mode === "playing") pauseGame(s);
    };

    const onMouseMove = (e: MouseEvent) => {
      const s = stateRef.current;
      if (!s || !s.pointerLocked || s.mode !== "playing") return;
      s.lookDX += e.movementX;
      s.lookDY += e.movementY;
    };

    const onPointerLockChange = () => {
      const s = stateRef.current;
      if (!s) return;
      const locked = document.pointerLockElement === canvas;
      // Losing a real pointer lock mid-fight = pause (Esc, alt-tab, click outside)
      if (hadPointerLockRef.current && !locked && s.mode === "playing") {
        pauseGame(s);
      }
      hadPointerLockRef.current = locked;
      if (s.mode === "playing") {
        s.pointerLocked = locked || s.pointerLocked;
      } else {
        s.pointerLocked = false;
      }
      if (!locked) s.fireHeld = false;
      setHud((h) => ({
        ...h,
        needClick: !s.pointerLocked && s.mode === "playing",
      }));
    };

    const onMouseDown = (e: MouseEvent) => {
      const s = stateRef.current;
      if (!s) return;
      if (e.button === 0) {
        if (s.mode === "playing" && s.pointerLocked) {
          s.fireHeld = true;
        }
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && stateRef.current) stateRef.current.fireHeld = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    const loop = (t: number) => {
      const s = stateRef.current;
      if (!s) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = lastRef.current ? (t - lastRef.current) / 1000 : 0;
      lastRef.current = t;
      updateGame(s, dt);

      // Release mouse as soon as we leave pure gameplay (win / death / pause)
      if (s.mode !== lastModeRef.current) {
        if (s.mode !== "playing") {
          releasePointer(s);
          hadPointerLockRef.current = false;
        }
        lastModeRef.current = s.mode;
      } else if (s.mode !== "playing" && document.pointerLockElement) {
        releasePointer(s);
        hadPointerLockRef.current = false;
      }

      renderGame(ctx, s, INTERNAL_W, INTERNAL_H);

      if (miniRef.current && showMap) {
        const mctx = miniRef.current.getContext("2d");
        if (mctx) {
          const ms = 140;
          miniRef.current.width = Math.ceil(
            (s.level.width / Math.max(s.level.width, s.level.height)) * ms,
          );
          miniRef.current.height = Math.ceil(
            (s.level.height / Math.max(s.level.width, s.level.height)) * ms,
          );
          renderMinimap(mctx, s, ms);
        }
      }

      setHud((prev) => {
        if (
          prev.health === s.health &&
          prev.ammo === s.ammo &&
          prev.score === s.score &&
          prev.kills === s.kills &&
          prev.mode === s.mode &&
          prev.message === s.message &&
          prev.useHint === s.useHint &&
          prev.needClick === (!s.pointerLocked && s.mode === "playing")
        ) {
          return prev;
        }
        return {
          health: s.health,
          ammo: s.ammo,
          score: s.score,
          kills: s.kills,
          total: s.totalEnemies,
          mode: s.mode,
          message: s.message,
          needClick: !s.pointerLocked && s.mode === "playing",
          useHint: s.useHint,
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
      releasePointer(stateRef.current);
    };
  }, [restart, showMap]);

  const requestPlay = () => {
    unlockAudio();
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;
    if (s.mode === "dead" || s.mode === "won") {
      restart();
      return;
    }
    s.mode = "playing";
    const markUnlockedPlay = () => {
      // Keyboard / touch play when pointer lock is unavailable
      if (document.pointerLockElement !== canvas && s.mode === "playing") {
        s.pointerLocked = true;
        setHud((h) => ({ ...h, needClick: false, mode: "playing" }));
      }
    };
    void requestLock(canvas).then(() => {
      setTimeout(markUnlockedPlay, 50);
    });
  };

  const togglePause = () => {
    const s = stateRef.current;
    if (!s) return;
    if (s.mode === "playing") pauseGame(s);
    // Paused already — Resume on the overlay is the way back in
  };

  const onTouchStart = (e: React.TouchEvent) => {
    unlockAudio();
    const s = stateRef.current;
    if (!s || s.mode !== "playing") return;
    if (!s.pointerLocked) {
      s.pointerLocked = true;
      setHud((h) => ({ ...h, needClick: false }));
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      const x = t.clientX - rect.left;
      if (x < rect.width * 0.45) {
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

  const onTouchMove = (e: React.TouchEvent) => {
    const s = stateRef.current;
    if (!s || s.mode !== "playing") return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    s.keys.delete("KeyW");
    s.keys.delete("KeyS");
    s.keys.delete("KeyA");
    s.keys.delete("KeyD");
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]!;
      if (t.identifier === touchRef.current.moveId) {
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        const dx = x - touchRef.current.originX;
        const dy = y - touchRef.current.originY;
        const dead = 18;
        if (dy < -dead) s.keys.add("KeyW");
        if (dy > dead) s.keys.add("KeyS");
        if (dx < -dead) s.keys.add("KeyA");
        if (dx > dead) s.keys.add("KeyD");
      } else if (t.identifier === touchRef.current.lookId) {
        s.lookDX += (t.clientX - touchRef.current.lookLastX) * 1.6;
        s.lookDY += (t.clientY - touchRef.current.lookLastY) * 1.6;
        touchRef.current.lookLastX = t.clientX;
        touchRef.current.lookLastY = t.clientY;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = stateRef.current;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      if (t.identifier === touchRef.current.moveId) {
        touchRef.current.moveId = -1;
        s?.keys.delete("KeyW");
        s?.keys.delete("KeyS");
        s?.keys.delete("KeyA");
        s?.keys.delete("KeyD");
      }
      if (t.identifier === touchRef.current.lookId) {
        touchRef.current.lookId = -1;
      }
    }
  };

  return (
    <div className="relative flex h-[calc(100dvh-var(--grok-banner-h,0px))] w-full flex-col overflow-hidden bg-bg">
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
        <button
          type="button"
          onClick={exitToMenu}
          aria-label={backLabel}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">{backLabel}</span>
        </button>
        <h2 className="font-display truncate text-sm font-semibold tracking-wider text-fg uppercase">
          {level.name}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Toggle minimap"
          >
            <MapIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={togglePause}
            className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Pause"
          >
            <Pause className="size-4" />
          </button>
        </div>
      </div>

      <div
        className="relative z-0 min-h-0 flex-1 touch-none select-none overflow-hidden bg-black"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={INTERNAL_W}
          height={INTERNAL_H}
          className="h-full w-full cursor-crosshair object-contain"
          style={{ imageRendering: "pixelated" }}
          onClick={requestPlay}
        />

        {showMap && (
          <canvas
            ref={miniRef}
            className="pointer-events-none absolute top-3 right-3 rounded border border-border/80 shadow-lg"
            style={{ imageRendering: "pixelated" }}
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pt-10 pb-3 sm:px-5 sm:pb-4">
          <div className="flex items-center gap-3 sm:gap-5">
            <HudStat
              icon={<Heart className="size-4 text-primary" />}
              label="ARMOR"
              value={hud.health}
              danger={hud.health < 30}
            />
            <HudStat
              icon={<Zap className="size-4 text-accent" />}
              label="AMMO"
              value={hud.ammo}
              danger={hud.ammo < 5}
            />
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <HudStat
              icon={<Crosshair className="size-4 text-muted" />}
              label="KILLS"
              value={`${hud.kills}/${hud.total}`}
            />
            <HudStat
              icon={<Trophy className="size-4 text-accent" />}
              label="SCORE"
              value={hud.score}
            />
          </div>
        </div>

        <button
          type="button"
          className="absolute right-4 bottom-24 z-10 flex size-16 items-center justify-center rounded-full border-2 border-primary/60 bg-primary/30 text-fg shadow-lg backdrop-blur-sm sm:hidden"
          aria-label="Fire"
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            unlockAudio();
            if (stateRef.current?.mode === "playing") {
              stateRef.current.pointerLocked = true;
              stateRef.current.fireHeld = true;
            }
            setHud((h) => ({ ...h, needClick: false }));
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            if (stateRef.current) stateRef.current.fireHeld = false;
          }}
          onMouseDown={() => {
            if (stateRef.current?.mode === "playing") {
              stateRef.current.fireHeld = true;
            }
          }}
          onMouseUp={() => {
            if (stateRef.current) stateRef.current.fireHeld = false;
          }}
        >
          <Crosshair className="size-7" />
        </button>

        {hud.needClick && hud.mode === "playing" && (
          <button
            type="button"
            onClick={requestPlay}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[2px]"
          >
            <div className="rounded-lg border border-border bg-surface/95 px-8 py-6 text-center shadow-2xl">
              <p className="font-display text-xl font-bold tracking-widest text-fg uppercase">
                Click to play
              </p>
              <p className="mt-2 max-w-xs text-sm text-muted">
                WASD to move, mouse to look, click to shoot. E uses doors.
              </p>
              <p className="mt-1 text-xs text-dim">
                Shift sprints. Esc pauses.
              </p>
            </div>
          </button>
        )}

        {hud.mode === "paused" && (
          <Overlay
            title="Paused"
            icon={<Pause className="size-8 text-muted" />}
            actions={[
              { label: "Resume", onClick: requestPlay, primary: true },
              { label: "Restart", onClick: restart },
              { label: exitLabel, onClick: exitToMenu },
            ]}
          />
        )}
        {hud.mode === "dead" && (
          <Overlay
            title="You Died"
            icon={<Skull className="size-8 text-primary" />}
            subtitle={`Score ${hud.score} · Kills ${hud.kills}/${hud.total}`}
            actions={[
              {
                label: "Retry",
                onClick: restart,
                primary: true,
                icon: <RotateCcw className="size-4" />,
              },
              { label: exitLabel, onClick: exitToMenu },
            ]}
          />
        )}
        {hud.mode === "won" && (
          <Overlay
            title="Sector Cleared"
            icon={<Trophy className="size-8 text-accent" />}
            subtitle={`Score ${hud.score} · Kills ${hud.kills}/${hud.total}`}
            actions={[
              {
                label: "Play again",
                onClick: restart,
                primary: true,
                icon: <RotateCcw className="size-4" />,
              },
              { label: exitLabel, onClick: exitToMenu },
            ]}
          />
        )}

        {hud.message && hud.mode === "playing" && (
          <div className="pointer-events-none absolute top-1/3 left-1/2 z-10 -translate-x-1/2 rounded bg-black/70 px-4 py-2 font-display text-sm tracking-wide text-accent uppercase">
            {hud.message}
          </div>
        )}
        {hud.useHint && hud.mode === "playing" && !hud.needClick && (
          <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded border border-border bg-surface/90 px-3 py-1 font-mono text-xs tracking-wide text-fg">
            {hud.useHint}
          </div>
        )}
      </div>
    </div>
  );
}

function HudStat({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-[10px] tracking-widest text-dim uppercase">
        {icon}
        {label}
      </div>
      <div
        className={`font-mono text-xl font-bold tabular-nums sm:text-2xl ${
          danger ? "text-primary" : "text-hud"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Overlay({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  actions: {
    label: string;
    onClick: () => void;
    primary?: boolean;
    icon?: React.ReactNode;
  }[];
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-2xl">
        <div className="mb-3 flex justify-center">{icon}</div>
        <h3 className="font-display text-2xl font-bold tracking-wider text-fg uppercase">
          {title}
        </h3>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6 flex flex-col gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={`flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
                a.primary
                  ? "bg-primary text-fg hover:bg-primary-hover"
                  : "border border-border bg-surface-2 text-fg hover:border-muted"
              }`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
