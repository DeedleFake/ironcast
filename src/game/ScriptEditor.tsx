import { useEffect, useMemo, useRef } from "react";
import { formatLisp, tokenize } from "./lisp";

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
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function highlightHtml(src: string): string {
  const body = tokenize(src || " ")
    .map((t) => {
      const text = escapeHtml(t.text);
      const cls = KIND_CLASS[t.kind];
      if (!cls) return text;
      return `<span class="${cls}">${text}</span>`;
    })
    .join("");
  // A trailing newline is eaten by <pre>; keep it so the layers stay lined up.
  return `${body}\n`;
}

export function ScriptEditor({
  value,
  onChange,
  onHelp,
  error,
}: {
  value: string;
  onChange: (src: string) => void;
  onHelp?: () => void;
  error?: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(() => highlightHtml(value), [value]);

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
      {error ? <p className="text-[11px] text-primary">{error}</p> : null}
    </div>
  );
}