import { useEffect, useRef, useState } from "react";
import { ChevronDown, ClipboardPaste, Copy, Download, Upload } from "lucide-react";
import type { GameLevel } from "./types";
import {
  copyLevelToClipboard,
  downloadLevel,
  importLevelFile,
  parseLevel,
} from "./levelIO";

type MenuId = "export" | "import" | null;

export function ExportMenu({
  level,
  onStatus,
  compact,
}: {
  level: GameLevel;
  onStatus?: (msg: string) => void;
  compact?: boolean;
}) {
  const open = useMenu();
  return (
    <Drop
      open={open.id === "export"}
      onToggle={() => open.toggle("export")}
      align={compact ? "right" : "right"}
      trigger={
        compact ? (
          <span className="flex items-center">
            <Download className="size-3.5" />
          </span>
        ) : (
          <>
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="size-3 opacity-70" />
          </>
        )
      }
      triggerClass={
        compact
          ? "rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          : "flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-fg hover:bg-surface-2"
      }
      title="Export"
    >
      <Item
        icon={<Download className="size-3.5" />}
        label="Download file"
        onClick={() => {
          downloadLevel(level);
          const safe =
            level.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "level";
          onStatus?.(`Downloading ${safe}.json`);
          open.close();
        }}
      />
      <Item
        icon={<Copy className="size-3.5" />}
        label="Copy to clipboard"
        onClick={async () => {
          const ok = await copyLevelToClipboard(level);
          onStatus?.(ok ? "Copied map to clipboard" : "Couldn’t copy to clipboard");
          open.close();
        }}
      />
    </Drop>
  );
}

export function ImportMenu({
  onLevel,
  onStatus,
  onError,
  compact,
}: {
  onLevel: (level: GameLevel) => void;
  onStatus?: (msg: string) => void;
  onError?: (msg: string) => void;
  compact?: boolean;
}) {
  const open = useMenu();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  return (
    <>
      <Drop
        open={open.id === "import"}
        onToggle={() => open.toggle("import")}
        trigger={
          compact ? (
            <span className="flex items-center">
              <Upload className="size-3.5" />
            </span>
          ) : (
            <>
              <Upload className="size-3.5" />
              <span className="hidden sm:inline">Import</span>
              <ChevronDown className="size-3 opacity-70" />
            </>
          )
        }
        triggerClass={
          compact
            ? "rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            : "flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-fg hover:bg-surface-2"
        }
        title="Import"
      >
        <Item
          icon={<Upload className="size-3.5" />}
          label="From file"
          onClick={() => {
            fileRef.current?.click();
            open.close();
          }}
        />
        <Item
          icon={<ClipboardPaste className="size-3.5" />}
          label="From clipboard"
          onClick={() => {
            open.close();
            setPasteOpen(true);
          }}
        />
      </Drop>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            const result = await importLevelFile(f);
            if (result.ok) {
              onLevel(result.level);
              onStatus?.(
                result.errors.length
                  ? `Opened “${result.level.name}” · ${result.errors[0]}`
                  : `Opened “${result.level.name}”`,
              );
            } else {
              (onError ?? onStatus)?.(result.error);
            }
          }
          e.target.value = "";
        }}
      />
      {pasteOpen ? (
        <PasteMapModal
          onCancel={() => setPasteOpen(false)}
          onImport={(level) => {
            onLevel(level);
            onStatus?.(`Opened “${level.name}”`);
            setPasteOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function useMenu() {
  const [id, setId] = useState<MenuId>(null);
  return {
    id,
    toggle: (next: Exclude<MenuId, null>) =>
      setId((cur) => (cur === next ? null : next)),
    close: () => setId(null),
  };
}

function Drop({
  open,
  onToggle,
  trigger,
  triggerClass,
  title,
  children,
  align = "right",
}: {
  open: boolean;
  onToggle: () => void;
  trigger: React.ReactNode;
  triggerClass: string;
  title: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        const btn = root.current?.querySelector("button");
        btn?.blur();
        onToggle();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onToggle();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onToggle]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={triggerClass}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-40 mt-1 min-w-[12.5rem] rounded-md border border-border bg-surface py-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Item({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-fg hover:bg-surface-2"
    >
      <span className="text-muted">{icon}</span>
      {label}
    </button>
  );
}

function PasteMapModal({
  onCancel,
  onImport,
}: {
  onCancel: () => void;
  onImport: (level: GameLevel) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = () => {
    const result = parseLevel(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onImport(result.level);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-labelledby="paste-map-title"
        className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-2xl"
      >
        <div>
          <h3
            id="paste-map-title"
            className="font-display text-lg font-semibold tracking-wide text-fg uppercase"
          >
            Paste a map
          </h3>
          <p className="mt-1 text-sm text-muted">
            Paste the map text here, then import.
          </p>
        </div>
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          spellCheck={false}
          placeholder="{ … }"
          className="h-48 w-full resize-y rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs leading-relaxed text-fg outline-none placeholder:text-dim focus:border-primary"
        />
        {error ? <p className="text-xs text-primary">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-fg hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
