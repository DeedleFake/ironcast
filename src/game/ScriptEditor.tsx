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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function highlightHtml(src: string): string {
  return tokenize(src || " ")
    .map((t) => {
      const text = escapeHtml(t.text);
      const cls = KIND_CLASS[t.kind];
      if (!cls) return text;
      return `<span class="${cls}">${text}</span>`;
    })
    .join("");
}

export function ScriptEditor({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (src: string) => void;
  error?: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(() => highlightHtml(value), [value]);

  useEffect(() => {
    const ta = taRef.current;
    const pre = preRef.current;
    if (!ta || !pre) return;
    const sync = () => {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener("scroll", sync);
    return () => ta.removeEventListener("scroll", sync);
  }, []);

  const format = () => {
    const result = formatLisp(value);
    if (result.ok) onChange(result.text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] tracking-widest text-dim uppercase">Script</p>
        <button
          type="button"
          onClick={format}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:bg-surface-2 hover:text-fg"
        >
          Format
        </button>
      </div>
      <div className="relative min-h-[10rem] flex-1 overflow-hidden rounded-md border border-border bg-[#0e0e12]">
        <pre
          ref={preRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-auto p-2 font-mono text-xs leading-5 whitespace-pre"
          dangerouslySetInnerHTML={{ __html: html || " " }}
        />
        <textarea
          ref={taRef}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 resize-none overflow-auto bg-transparent p-2 font-mono text-xs leading-5 text-transparent caret-fg outline-none"
        />
      </div>
      {error ? <p className="text-[11px] text-primary">{error}</p> : null}
    </div>
  );
}
