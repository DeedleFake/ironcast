import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { formatLisp, tokenize } from "./lisp";
import type { Diagnostic, TypeHint } from "./typesys";

const KIND_CLASS: Record<string, string> = {
  comment: "text-dim",
  paren: "text-muted",
  string: "text-accent",
  number: "text-fg",
  keyword: "text-primary",
  builtin: "text-success",
  symbol: "text-fg",
  ws: "",
};

const FACE =
  "box-border m-0 block h-full w-full p-2 font-mono text-xs leading-5 [tab-size:2] break-normal whitespace-pre";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "\u0026amp;";
    if (ch === "<") return "\u0026lt;";
    if (ch === ">") return "\u0026gt;";
    return "\u0026quot;";
  });
}

function mergeDiags(diags: Diagnostic[]): Diagnostic[] {
  if (!diags.length) return [];
  const sorted = [...diags].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Diagnostic[] = [];
  for (const d of sorted) {
    const last = out[out.length - 1];
    if (last && d.start <= last.end) {
      last.end = Math.max(last.end, d.end);
      if (!last.message.includes(d.message)) last.message += " · " + d.message;
    } else out.push({ ...d });
  }
  return out;
}

function highlightHtml(src: string, diags: Diagnostic[]): string {
  const ranges = mergeDiags(diags);
  const tokens = tokenize(src || " ");
  let i = 0;
  let html = "";
  for (const t of tokens) {
    const start = i;
    const end = i + t.text.length;
    const text = escapeHtml(t.text);
    const cls = KIND_CLASS[t.kind];
    const hit = ranges.find((r) => r.start < end && r.end > start);
    let piece = cls ? `<span class="${cls}">${text}</span>` : text;
    if (hit) {
      piece = `<span class="rounded-sm bg-primary/20 underline decoration-wavy decoration-primary">${piece}</span>`;
    }
    html += piece;
    i = end;
  }
  return `${html}\n`;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function charOffsetAt(
  ta: HTMLTextAreaElement,
  clientX: number,
  clientY: number,
): number | null {
  const style = getComputedStyle(ta);
  const padL = Number.parseFloat(style.paddingLeft) || 0;
  const padT = Number.parseFloat(style.paddingTop) || 0;
  const lh = Number.parseFloat(style.lineHeight) || 20;
  const tabSize = 2;
  const rect = ta.getBoundingClientRect();
  const x = clientX - rect.left + ta.scrollLeft - padL;
  const y = clientY - rect.top + ta.scrollTop - padT;
  const lines = ta.value.split("\n");
  const rawLine = Math.floor(y / lh);
  if (rawLine < 0 || rawLine >= lines.length) return null;
  if (x < -1) return null;
  if (!measureCtx) {
    const c = document.createElement("canvas");
    measureCtx = c.getContext("2d");
  }
  if (!measureCtx) return null;
  measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const space = measureCtx.measureText(" ").width;
  const text = lines[rawLine] ?? "";
  let col = 0;
  let w = 0;
  while (col < text.length) {
    const ch = text[col]!;
    const cw = ch === "\t" ? space * tabSize : measureCtx.measureText(ch).width;
    if (w + cw > x) break;
    w += cw;
    col += 1;
  }
  if (col >= text.length && x > w + space * 0.5) return null;
  let offset = 0;
  for (let i = 0; i < rawLine; i++) offset += (lines[i]?.length ?? 0) + 1;
  return offset + col;
}

function tipAt(offset: number, hints: TypeHint[], diags: Diagnostic[]): {
  hint?: TypeHint;
  text: string;
} {
  let best: TypeHint | undefined;
  let bestLen = Infinity;
  let bestNamed = false;
  for (const h of hints) {
    if (offset < h.start || offset >= h.end) continue;
    const len = h.end - h.start;
    const named = h.text.includes(" : ");
    if (len < bestLen || (len === bestLen && named && !bestNamed)) {
      best = h;
      bestLen = len;
      bestNamed = named;
    }
  }
  const err = diags.find((d) => offset >= d.start && offset < d.end);
  if (best && err) return { hint: best, text: `${best.text}\n${err.message}` };
  if (best) return { hint: best, text: best.text };
  return { text: err?.message ?? "" };
}

function TipBody({ text }: { text: string }) {
  const nl = text.indexOf("\n");
  const head = nl >= 0 ? text.slice(0, nl) : text;
  const rest = nl >= 0 ? text.slice(nl + 1) : "";
  const sep = head.indexOf(" : ");
  return (
    <>
      {sep >= 0 ? (
        <>
          <span className="text-accent">{head.slice(0, sep)}</span>
          <span className="text-dim"> : </span>
          <span>{head.slice(sep + 3)}</span>
        </>
      ) : (
        head
      )}
      {rest ? (
        <>
          {"\n"}
          <span className="text-primary">{rest}</span>
        </>
      ) : null}
    </>
  );
}

export function ScriptEditor({
  value,
  onChange,
  onHelp,
  diagnostics = [],
  hints = [],
}: {
  value: string;
  onChange: (src: string) => void;
  onHelp?: () => void;
  diagnostics?: Diagnostic[];
  hints?: TypeHint[];
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [tip, setTip] = useState("");
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(
    null,
  );

  const html = useMemo(() => highlightHtml(value, diagnostics), [value, diagnostics]);

  const syncScroll = () => {
    const ta = taRef.current;
    const pre = preRef.current;
    if (!ta || !pre) return;
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  };

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.addEventListener("scroll", syncScroll);
    return () => ta.removeEventListener("scroll", syncScroll);
  }, []);

  useEffect(() => {
    syncScroll();
  }, [value]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const onMove = () => {
      const start = ta.selectionStart ?? 0;
      setTip(tipAt(start, hints, diagnostics).text);
    };
    ta.addEventListener("keyup", onMove);
    ta.addEventListener("click", onMove);
    onMove();
    return () => {
      ta.removeEventListener("keyup", onMove);
      ta.removeEventListener("click", onMove);
    };
  }, [diagnostics, hints, value]);

  const format = () => {
    const result = formatLisp(value);
    if (result.ok) onChange(result.text);
  };

  const onMouseMove = (e: MouseEvent<HTMLTextAreaElement>) => {
    const ta = taRef.current;
    if (!ta) return;
    const off = charOffsetAt(ta, e.clientX, e.clientY);
    if (off == null) {
      setHover(null);
      return;
    }
    const hit = tipAt(off, hints, diagnostics);
    if (!hit.text) {
      setHover(null);
      return;
    }
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + 18;
    if (x > window.innerWidth - 280) x = e.clientX - 12;
    if (y > window.innerHeight - 64) y = e.clientY - 36;
    setHover({
      x: Math.max(8, x),
      y: Math.max(8, y),
      text: hit.text,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-[10px] tracking-widest text-dim uppercase">Script</p>
          <p
            className={`text-[11px] ${diagnostics.length ? "text-danger" : "text-success"}`}
          >
            {diagnostics.length === 1 ? "1 error" : `${diagnostics.length} errors`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {onHelp ? (
            <button
              type="button"
              onClick={onHelp}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:bg-surface-2 hover:text-fg"
            >
              Tutorial
            </button>
          ) : null}
          <button
            type="button"
            onClick={format}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:bg-surface-2 hover:text-fg"
          >
            Format
          </button>
        </div>
      </div>
      <div
        className="relative min-h-[10rem] flex-1 overflow-hidden rounded-md border border-border bg-[#0e0e12]"
      >
        <pre
          ref={preRef}
          aria-hidden
          className={`pointer-events-none absolute inset-0 overflow-hidden text-fg ${FACE}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <textarea
          ref={taRef}
          value={value}
          spellCheck={false}
          wrap="off"
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHover(null)}
          className={`absolute inset-0 resize-none overflow-auto bg-transparent text-transparent caret-fg outline-none ${FACE}`}
        />
      </div>
      {hover
        ? createPortal(
            <div
              data-script-type-tip
              className="pointer-events-none fixed z-50 max-w-[min(28rem,calc(100vw-1.5rem))] rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-[11px] leading-4 whitespace-pre-wrap text-fg shadow-lg"
              style={{ left: hover.x, top: hover.y }}
            >
              <TipBody text={hover.text} />
            </div>,
            document.body,
          )
        : null}
      {tip ? (
        <p className="max-h-16 overflow-auto text-[11px] text-muted">{tip}</p>
      ) : null}
    </div>
  );
}
