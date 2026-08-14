import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Crosshair,
  Pencil,
  Play,
  Trash2,
  User,
  ChevronRight,
  Skull,
  Map,
} from "lucide-react";
import type { GameLevel } from "./types";
import { cloneLevel } from "./types";
import {
  BUILTIN_LEVELS,
  deleteCustomLevel,
  loadCustomLevels,
} from "./levels";
import { PlayView } from "./PlayView";
import { EditorView } from "./EditorView";
import { ExportMenu, ImportMenu } from "./FileMenu";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type Screen =
  | { id: "menu" }
  | { id: "play"; level: GameLevel }
  | { id: "editor"; level?: GameLevel | null; testing?: GameLevel };

export function GameApp() {
  const [screen, setScreen] = useState<Screen>({ id: "menu" });
  const [customs, setCustoms] = useState<GameLevel[]>([]);
  const [ioNote, setIoNote] = useState("");
  const { isPending } = useCurrentUserState();

  const refreshCustoms = useCallback(() => {
    setCustoms(loadCustomLevels());
  }, []);

  useEffect(() => {
    refreshCustoms();
  }, [refreshCustoms]);

  if (screen.id === "play") {
    return (
      <PlayView
        level={screen.level}
        onExit={() => {
          refreshCustoms();
          setScreen({ id: "menu" });
        }}
      />
    );
  }

  if (screen.id === "editor") {
    return (
      <>
        <div className={screen.testing ? "hidden" : undefined}>
          <EditorView
            initial={screen.level}
            onExit={() => {
              refreshCustoms();
              setScreen({ id: "menu" });
            }}
            onPlay={(level) => setScreen({ ...screen, testing: level })}
          />
        </div>
        {screen.testing ? (
          <PlayView
            level={screen.testing}
            onExit={() => {
              refreshCustoms();
              setScreen({
                id: "editor",
                level: screen.level,
              });
            }}
            backLabel="Editor"
            exitLabel="Back to editor"
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="relative min-h-[calc(100dvh-var(--grok-banner-h,0px))] overflow-y-auto bg-bg">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgb(196 60 44 / 0.25), transparent), radial-gradient(ellipse 60% 40% at 80% 100%, rgb(212 160 23 / 0.08), transparent)",
        }}
      />
      <div className="scanlines absolute inset-0 opacity-30" />

      <div className="relative mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:py-12">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase">
              Sector Nine
            </p>
            <h1 className="font-display mt-1 text-4xl font-bold tracking-wide text-fg uppercase sm:text-5xl">
              Ironcast
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              Clear the demons. Find the exit. Or build a map of your own.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isPending ? (
              <div className="size-8 animate-pulse rounded-full bg-surface-2" />
            ) : (
              <>
                <SignedIn>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <Link
                    to="/login"
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-dim hover:text-fg"
                  >
                    <User className="size-3.5" />
                    Sign in
                  </Link>
                </SignedOut>
              </>
            )}
          </div>
        </header>

        <div>
          <ActionCard
            icon={<Pencil className="size-5" />}
            title="Level editor"
            desc="Draw a map, place enemies, and try it out"
            onClick={() => setScreen({ id: "editor", level: null })}
          />
        </div>

        <section>
          <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold tracking-widest text-muted uppercase">
            <Map className="size-4 text-primary" />
            Missions
          </h2>
          <div className="grid gap-2">
            {BUILTIN_LEVELS.map((lvl) => (
              <LevelRow
                key={lvl.name}
                level={lvl}
                badge="Official"
                onPlay={() => setScreen({ id: "play", level: cloneLevel(lvl) })}
                onEdit={() =>
                  setScreen({ id: "editor", level: cloneLevel(lvl) })
                }
                onStatus={setIoNote}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display flex items-center gap-2 text-sm font-semibold tracking-widest text-muted uppercase">
              <Skull className="size-4 text-accent" />
              Your levels
            </h2>
            <div className="flex items-center gap-2">
              {ioNote ? (
                <span className="max-w-[12rem] truncate text-[11px] text-accent">
                  {ioNote}
                </span>
              ) : null}
              <ImportMenu
                onLevel={(level) => setScreen({ id: "editor", level })}
                onStatus={setIoNote}
                onError={setIoNote}
              />
            </div>
          </div>
          {customs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-dim">
              No maps saved yet. Make one in the editor, or import a file.
            </div>
          ) : (
            <div className="grid gap-2">
              {customs.map((lvl) => (
                <LevelRow
                  key={lvl.name}
                  level={lvl}
                  badge="Custom"
                  onPlay={() =>
                    setScreen({ id: "play", level: cloneLevel(lvl) })
                  }
                  onEdit={() =>
                    setScreen({ id: "editor", level: cloneLevel(lvl) })
                  }
                  onStatus={setIoNote}
                  onDelete={() => {
                    if (confirm(`Delete "${lvl.name}"?`)) {
                      deleteCustomLevel(lvl.name);
                      refreshCustoms();
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-border pt-4 text-center text-[11px] text-dim">
          Move with WASD · look with the mouse · click to shoot
        </footer>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-start gap-4 rounded-lg border p-4 text-left transition-all ${
        accent
          ? "border-primary/40 bg-primary/10 hover:border-primary hover:bg-primary/15"
          : "border-border bg-surface hover:border-dim hover:bg-surface-2"
      }`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-md ${
          accent ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-base font-semibold tracking-wide text-fg uppercase">
          {title}
        </span>
        <span className="mt-0.5 block text-sm text-muted">{desc}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
    </button>
  );
}

function LevelRow({
  level,
  badge,
  onPlay,
  onEdit,
  onStatus,
  onDelete,
}: {
  level: GameLevel;
  badge: string;
  onPlay: () => void;
  onEdit: () => void;
  onStatus?: (msg: string) => void;
  onDelete?: () => void;
}) {
  const enemies = level.entities.filter((e) => e.type === "enemy").length;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 sm:flex-nowrap">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded bg-surface-2 text-primary">
          <Crosshair className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display truncate font-semibold tracking-wide text-fg uppercase">
              {level.name}
            </span>
            <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] tracking-wider text-dim uppercase">
              {badge}
            </span>
          </div>
          <p className="text-xs text-muted">
            {level.width}×{level.height} · {enemies}{" "}
            {enemies === 1 ? "enemy" : "enemies"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconBtn title="Play" onClick={onPlay}>
          <Play className="size-3.5" />
        </IconBtn>
        <IconBtn title="Edit" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </IconBtn>
        <ExportMenu compact level={level} onStatus={onStatus} />
        {onDelete && (
          <IconBtn title="Delete" onClick={onDelete} danger>
            <Trash2 className="size-3.5" />
          </IconBtn>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md p-2 transition-colors ${
        danger
          ? "text-muted hover:bg-primary/15 hover:text-primary"
          : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
