import { useEffect, useMemo, useRef, useState } from "react";
import { formatLisp, tokenize } from "./lisp";
import type { Diagnostic } from "./typesys";

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
      piece = `<span class="rounded-sm bg-primary/20 underline decoration-wavy decoration-primary" title="${escapeHtml(hit.message)}">${piece}</span>`;
    }
    html += piece;
    i = end;
  }
  return `${html}\n`;
}

export function ScriptEditor({
  value,
  onChange,
  onHelp,
  diagnostics = [],
}: {
  value: string;
  onChange: (src: string) => void;
  onHelp?: () => void;
  diagnostics?: Diagnostic[];
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(() => highlightHtml(value, diagnostics), [value, diagnostics]);
  const [tip, setTip] = useState<string>("");

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
      const hit = diagnostics.find((d) => start >= d.start && start <= d.end);
      setTip(hit?.message ?? "");
    };
    ta.addEventListener("keyup", onMove);
    ta.addEventListener("click", onMove);
    return () => {
      ta.removeEventListener("keyup", onMove);
      ta.removeEventListener("click", onMove);
    };
  }, [diagnostics]);

  const format = () => {
    const result = formatLisp(value);
    if (result.ok) onChange(result.text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] tracking-widest text-dim uppercase">Script</p>
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
      <div className="relative min-h-[10rem] flex-1 overflow-hidden rounded-md border border-border bg-[#0e0e12]">
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
          className={`absolute inset-0 resize-none overflow-auto bg-transparent text-transparent caret-fg outline-none ${FACE}`}
        />
      </div>
      {tip || diagnostics.length ? (
        <p className="max-h-16 overflow-auto text-[11px] text-primary">
          {tip || diagnostics.map((d) => d.message).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
