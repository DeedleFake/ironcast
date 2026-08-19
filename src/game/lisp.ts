/** Tiny event Lisp: parse, format, highlight, evaluate. */

import { parsePickupShape, texFromWallName } from "./types";

export type LispVal = (
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "nil" }
  | { k: "sym"; v: string }
  | { k: "list"; v: LispVal[]; vec?: boolean }
  | { k: "map"; v: Map<string, LispVal> }
  | { k: "comment"; v: string }
  | { k: "fn"; clauses: Clause[]; keys: string[]; env: Env }
) & { cmt?: string; blank?: boolean; broke?: boolean };

export type Pattern =
  | { k: "bind"; name: string }
  | { k: "lit"; value: LispVal };

export type Params =
  | { k: "pos"; pats: Pattern[] }
  | { k: "key"; pats: { name: string; pat: Pattern }[] };

export type Clause = { params: Params; body: LispVal[] };

export type Env = {
  parent: Env | null;
  vars: Map<string, LispVal>;
};

export type TokenKind =
  | "ws"
  | "comment"
  | "paren"
  | "string"
  | "number"
  | "keyword"
  | "builtin"
  | "symbol";

export type Token = { kind: TokenKind; text: string };

export const KEYWORDS = new Set([
  "def",
  "fn",
  "let",
  "if",
  "else",
  "and",
  "or",
  "not",
  "quote",
  "on",
  "after",
  "pipe",
]);

export const BUILTINS = new Set([
  "+",
  "-",
  "*",
  "/",
  "mod",
  "abs",
  "min",
  "max",
  "floor",
  "ceil",
  "=",
  "/=",
  "<",
  ">",
  "<=",
  ">=",
  "str",
  "len",
  "cons",
  "first",
  "rest",
  "nth",
  "append",
  "map",
  "filter",
  "reduce",
  "pairs",
  "from-pairs",
  "keys",
  "vals",
  "empty?",
  "list?",
  "map?",
  "num?",
  "str?",
  "bool?",
  "nil?",
  "get",
  "set",
  "merge",
  "has",
  "give",
  "take",
  "say",
  "set-attr",
  "get-attr",
  "set-wall",
  "get-wall",
  "spawn",
  "spawn-fill",
  "remove",
  "teleport",
  "win",
  "lose",
  "true",
  "false",
  "nil",
]);

export class LispError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LispError";
  }
}

export function nil(): LispVal {
  return { k: "nil" };
}
export function num(v: number): LispVal {
  return { k: "num", v };
}
export function str(v: string): LispVal {
  return { k: "str", v };
}
export function bool(v: boolean): LispVal {
  return { k: "bool", v };
}
export function sym(v: string): LispVal {
  return { k: "sym", v };
}
export function list(v: LispVal[], vec = false): LispVal {
  return vec ? { k: "list", v, vec: true } : { k: "list", v };
}
export function mapFrom(entries: Iterable<[string, LispVal]>): LispVal {
  return { k: "map", v: new Map(entries) };
}

export function truthy(v: LispVal): boolean {
  if (v.k === "nil") return false;
  if (v.k === "bool") return v.v;
  return true;
}

export function asNum(v: LispVal, ctx: string): number {
  if (v.k !== "num") throw new LispError(`${ctx} needs a number`);
  return v.v;
}

export function asName(v: LispVal): string {
  if (v.k === "sym" || v.k === "str") return v.v;
  throw new LispError("expected a name");
}

function asIdList(v: LispVal): string[] {
  if (v.k === "list") return v.v.map(asName);
  return [asName(v)];
}

function isPoint(v: LispVal): boolean {
  return (
    v.k === "list" &&
    v.v.length === 2 &&
    v.v[0]?.k === "num" &&
    v.v[1]?.k === "num"
  );
}

function asPlace(
  v: LispVal,
  ctx: string,
): { at: string } | { x: number; y: number } {
  if (isPoint(v) && v.k === "list") {
    return { x: (v.v[0] as { k: "num"; v: number }).v, y: (v.v[1] as { k: "num"; v: number }).v };
  }
  if (v.k === "list") throw new LispError(`${ctx} needs a name or [x y]`);
  return { at: asName(v) };
}

function asPlaces(
  v: LispVal,
  ctx: string,
): ({ at: string } | { x: number; y: number })[] {
  if (isPoint(v) || v.k !== "list") return [asPlace(v, ctx)];
  if (!v.v.length) throw new LispError(`${ctx} needs a place`);
  return v.v.map((item) => asPlace(item, ctx));
}

function optionalMap(
  args: LispVal[],
  start: number,
  ctx: string,
): Map<string, LispVal> {
  if (args.length === start) return new Map();
  if (args.length === start + 1) {
    const m = args[start]!;
    if (m.k !== "map") throw new LispError(`${ctx} needs a map of fields`);
    return m.v;
  }
  throw new LispError(`${ctx} has too many arguments`);
}

function requireMap(
  args: LispVal[],
  start: number,
  ctx: string,
): Map<string, LispVal> {
  if (args.length !== start + 1 || args[start]?.k !== "map") {
    throw new LispError(`${ctx} needs a map of fields`);
  }
  return args[start]!.v;
}

function unknownKeys(
  attrs: Map<string, LispVal>,
  allowed: string[],
  ctx: string,
) {
  for (const key of attrs.keys()) {
    if (!allowed.includes(key)) throw new LispError(`${ctx}: unknown ${key}`);
  }
}

function asSeq(v: LispVal, ctx: string): LispVal[] {
  if (v.k === "list") return v.v;
  if (v.k === "map") {
    return [...v.v.entries()].map(([k, val]) => list([str(k), val], true));
  }
  throw new LispError(`${ctx} needs a list or a map`);
}

function asPair(v: LispVal, ctx: string): [string, LispVal] {
  if (v.k !== "list" || v.v.length !== 2) {
    throw new LispError(`${ctx} needs ["key" value] pairs`);
  }
  const key = v.v[0]!;
  if (key.k !== "str") throw new LispError(`${ctx} needs string keys`);
  return [key.v, v.v[1]!];
}

export function asColor(v: LispVal, ctx: string): number {
  if (v.k === "num") return (v.v | 0) & 0xffffff;
  if (v.k !== "str") throw new LispError(`${ctx} needs a color like "#rrggbb"`);
  const t = v.v.trim();
  const hex = t.startsWith("#") ? t : `#${t}`;
  if (/^#[0-9a-f]{6}$/i.test(hex)) return Number.parseInt(hex.slice(1), 16);
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const r = hex[1]!;
    const g = hex[2]!;
    const b = hex[3]!;
    return Number.parseInt(r + r + g + g + b + b, 16);
  }
  throw new LispError(`${ctx} needs a color like "#rrggbb"`);
}

export function printVal(v: LispVal): string {
  switch (v.k) {
    case "nil":
      return "nil";
    case "num":
      return Number.isInteger(v.v) ? String(v.v) : String(v.v);
    case "str":
      return v.v;
    case "bool":
      return v.v ? "true" : "false";
    case "sym":
      return v.v;
    case "fn":
      return "#<fn>";
    case "list":
      return `[${v.v.map(printVal).join(" ")}]`;
    case "map": {
      if (v.v.size === 0) return "[:]";
      const inner = [...v.v.entries()]
        .map(([k, val]) => `${k}: ${printVal(val)}`)
        .join(" ");
      return `[${inner}]`;
    }
    case "comment":
      return v.v;
  }
}

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = src.length;
  const push = (kind: TokenKind, text: string) => out.push({ kind, text });
  while (i < n) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      let j = i + 1;
      while (j < n && " \t\n\r".includes(src[j]!)) j++;
      push("ws", src.slice(i, j));
      i = j;
      continue;
    }
    if (c === ";") {
      let j = i + 1;
      while (j < n && src[j] !== "\n") j++;
      push("comment", src.slice(i, j));
      i = j;
      continue;
    }
    if (c === "(" || c === ")" || c === "[" || c === "]") {
      push("paren", c);
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = '"';
      while (j < n) {
        const ch = src[j]!;
        s += ch;
        if (ch === "\\" && j + 1 < n) {
          s += src[j + 1];
          j += 2;
          continue;
        }
        j++;
        if (ch === '"') break;
      }
      push("string", s);
      i = j;
      continue;
    }
    let j = i + 1;
    while (j < n && !" \t\n\r();[]".includes(src[j]!)) j++;
    const word = src.slice(i, j);
    if (/^[+-]?\d+(\.\d+)?$/.test(word)) push("number", word);
    else if (word.endsWith(":")) push("keyword", word);
    else if (KEYWORDS.has(word)) push("keyword", word);
    else if (BUILTINS.has(word)) push("builtin", word);
    else push("symbol", word);
    i = j;
  }
  return out;
}

export type ParseResult =
  | { ok: true; forms: LispVal[] }
  | { ok: false; error: string };

export function parseLisp(src: string): ParseResult {
  try {
    const forms: LispVal[] = [];
    const p = { s: src, i: 0 };
    let nl = skipCount(p);
    while (p.i < p.s.length) {
      const form = read(p);
      if (nl >= 2) form.blank = true;
      forms.push(form);
      nl = skipCount(p);
    }
    return { ok: true, forms };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Parse error" };
  }
}

function skipCount(p: { s: string; i: number }): number {
  let nl = 0;
  while (p.i < p.s.length && " \t\n\r".includes(p.s[p.i]!)) {
    const c = p.s[p.i]!;
    if (c === "\n") nl += 1;
    else if (c === "\r") {
      nl += 1;
      if (p.s[p.i + 1] === "\n") p.i += 1;
    }
    p.i += 1;
  }
  return nl;
}

function skip(p: { s: string; i: number }) {
  while (p.i < p.s.length && " \t\n\r".includes(p.s[p.i]!)) p.i++;
}

function skipH(p: { s: string; i: number }) {
  while (p.i < p.s.length && (p.s[p.i] === " " || p.s[p.i] === "\t")) p.i++;
}

function readComment(p: { s: string; i: number }): LispVal {
  const start = p.i;
  while (p.i < p.s.length && p.s[p.i] !== "\n") p.i++;
  return { k: "comment", v: p.s.slice(start, p.i) };
}

function attachTrail(p: { s: string; i: number }, v: LispVal): LispVal {
  if (v.k === "comment") return v;
  skipH(p);
  if (p.s[p.i] !== ";") return v;
  const start = p.i;
  while (p.i < p.s.length && p.s[p.i] !== "\n") p.i++;
  v.cmt = p.s.slice(start, p.i);
  return v;
}

function readDelimited(p: { s: string; i: number }, close: ")" | "]"): LispVal {
  const open = p.i;
  p.i++;
  const xs: LispVal[] = [];
  for (;;) {
    skip(p);
    if (p.i >= p.s.length) throw new LispError(`missing ${close}`);
    const ch = p.s[p.i]!;
    if (ch === close) {
      p.i++;
      break;
    }
    if (ch === ")" || ch === "]") throw new LispError(`unexpected ${ch}`);
    xs.push(read(p));
  }
  const inner = close === "]" ? finishBracket(xs) : list(xs);
  const form = attachTrail(p, inner);
  if (p.s.slice(open, p.i).includes("\n")) form.broke = true;
  return form;
}

function finishBracket(xs: LispVal[]): LispVal {
  const items = xs.filter((x) => x.k !== "comment");
  if (items.length === 1 && items[0]!.k === "sym" && items[0]!.v === ":") {
    return mapFrom([]);
  }
  const pairs: [string, LispVal][] = [];
  let i = 0;
  let keys = 0;
  while (i < items.length) {
    const a = items[i]!;
    if (isKeySym(a)) {
      keys += 1;
      const val = items[i + 1];
      if (!val || isKeySym(val)) throw new LispError("map key needs a value");
      pairs.push([a.v.slice(0, -1), val]);
      i += 2;
    } else {
      i += 1;
    }
  }
  if (keys === 0) return list(xs, true);
  if (keys * 2 !== items.length) {
    throw new LispError("a map cannot mix keys and other items");
  }
  return mapFrom(pairs);
}

function read(p: { s: string; i: number }): LispVal {
  skip(p);
  if (p.i >= p.s.length) throw new LispError("unexpected end of script");
  const c = p.s[p.i]!;
  if (c === ";") return readComment(p);
  if (c === "(") return readDelimited(p, ")");
  if (c === "[") return readDelimited(p, "]");
  if (c === ")") throw new LispError("unexpected )");
  if (c === "]") throw new LispError("unexpected ]");
  if (c === "'") throw new LispError("unexpected '");
  if (c === '"') {
    p.i++;
    let out = "";
    while (p.i < p.s.length) {
      const ch = p.s[p.i]!;
      if (ch === '"') {
        p.i++;
        return attachTrail(p, str(out));
      }
      if (ch === "\\" && p.i + 1 < p.s.length) {
        const n = p.s[p.i + 1]!;
        out += n === "n" ? "\n" : n === "t" ? "\t" : n;
        p.i += 2;
        continue;
      }
      out += ch;
      p.i++;
    }
    throw new LispError("unterminated string");
  }
  let j = p.i + 1;
  while (j < p.s.length && !" \t\n\r();[]".includes(p.s[j]!)) j++;
  const word = p.s.slice(p.i, j);
  p.i = j;
  if (word === "true") return attachTrail(p, bool(true));
  if (word === "false") return attachTrail(p, bool(false));
  if (word === "nil") return attachTrail(p, nil());
  if (/^[+-]?\d+(\.\d+)?$/.test(word)) return attachTrail(p, num(Number(word)));
  if (!word) throw new LispError("empty token");
  return attachTrail(p, sym(word));
}

export function formatLisp(src: string): { ok: true; text: string } | { ok: false; error: string } {
  const parsed = parseLisp(src);
  if (!parsed.ok) return parsed;
  if (!parsed.forms.length) return { ok: true, text: "" };
  let text = formatVal(parsed.forms[0]!, 0);
  for (let i = 1; i < parsed.forms.length; i++) {
    const prev = parsed.forms[i - 1]!;
    const form = parsed.forms[i]!;
    const sep = prev.k === "comment" ? "\n" : form.blank ? "\n\n" : "\n";
    text += sep + formatVal(form, 0);
  }
  return { ok: true, text: text + "\n" };
}

const MAX_INLINE = 72;

const BODY_SPECIALS = new Set([
  "on",
  "def",
  "fn",
  "let",
  "if",
  "after",
  "pipe",
]);

type IfClause = { test: LispVal | null; not: boolean; body: LispVal[] };

function isElseSym(v: LispVal): boolean {
  return v.k === "sym" && v.v === "else";
}

function isIfSym(v: LispVal): boolean {
  return v.k === "sym" && v.v === "if";
}

function isNotSym(v: LispVal): boolean {
  return v.k === "sym" && v.v === "not";
}

function readIfTest(
  args: LispVal[],
  i: number,
  ctx: string,
): { test: LispVal; not: boolean; i: number } {
  if (i >= args.length) throw new LispError(`${ctx} needs a test`);
  if (isNotSym(args[i]!)) {
    i += 1;
    if (i >= args.length) throw new LispError(`${ctx} not needs a test`);
    return { test: args[i]!, not: true, i: i + 1 };
  }
  return { test: args[i]!, not: false, i: i + 1 };
}

function parseIfArgs(args: LispVal[]): IfClause[] {
  if (!args.length) throw new LispError("(if test ...)");
  const clauses: IfClause[] = [];
  let cur = readIfTest(args, 0, "if");
  let body: LispVal[] = [];
  for (let i = cur.i; i < args.length; ) {
    const a = args[i]!;
    if (isElseSym(a)) {
      clauses.push({ test: cur.test, not: cur.not, body });
      i += 1;
      if (i < args.length && isIfSym(args[i]!)) {
        i += 1;
        cur = readIfTest(args, i, "else if");
        i = cur.i;
        body = [];
        continue;
      }
      clauses.push({ test: null, not: false, body: args.slice(i) });
      return clauses;
    }
    body.push(a);
    i += 1;
  }
  clauses.push({ test: cur.test, not: cur.not, body });
  return clauses;
}

function hasBreakComment(v: LispVal): boolean {
  if (v.k === "comment") return true;
  if (v.k === "map") {
    return [...v.v.values()].some(
      (x) => Boolean(x.cmt) || hasBreakComment(x),
    );
  }
  if (v.k !== "list") return false;
  return v.v.some((x, i) => {
    if (x.k === "comment") return true;
    if (x.cmt && i < v.v.length - 1) return true;
    return hasBreakComment(x);
  });
}

function suffixCmt(v: LispVal, text: string): string {
  return v.cmt ? `${text} ${v.cmt}` : text;
}

/** Shift continuation lines so a nested form keeps its own alignment. */
function prefixLines(prefix: string, text: string): string {
  const lines = text.split("\n");
  if (lines.length <= 1) return prefix + text;
  const pad = " ".repeat(prefix.length);
  return prefix + lines[0] + "\n" + lines.slice(1).map((l) => pad + l).join("\n");
}

function pushPrefixed(lines: string[], prefix: string, text: string) {
  lines.push(...prefixLines(prefix, text).split("\n"));
}

function formatVal(v: LispVal, indent: number): string {
  if (v.k === "comment") return v.v;
  if (v.k === "map") return formatMap(v, indent);
  if (v.k !== "list") return formatAtom(v);
  const empty = v.vec ? "[]" : "()";
  if (v.v.length === 0) return suffixCmt(v, empty);
  if (v.vec) {
    if (hasBreakComment(v) || v.broke) {
      return suffixCmt(v, formatVecBlock(v, indent));
    }
    const inline = formatInline(v);
    const col = indent * 2;
    if (inline.length + col <= MAX_INLINE) return inline;
    return suffixCmt(v, formatVecBlock(v, indent));
  }
  const headName = v.v[0]?.k === "sym" ? v.v[0].v : "";
  if (hasBreakComment(v) || (BODY_SPECIALS.has(headName) && v.broke)) {
    return suffixCmt(v, formatBlock(v, indent));
  }
  const inline = formatInline(v);
  const col = indent * 2;
  if (inline.length + col <= MAX_INLINE) return inline;
  return suffixCmt(v, formatBlock(v, indent));
}

/** Close parens hang off the last form — never on their own line. */
function closeOn(lines: string[], close = ")"): string {
  if (!lines.length) return close;
  const last = lines[lines.length - 1]!;
  const cmt = last.search(/ ;/);
  if (cmt >= 0) lines[lines.length - 1] = last.slice(0, cmt) + close + last.slice(cmt);
  else lines[lines.length - 1] = last + close;
  return lines.join("\n");
}

function formatVecBlock(v: { k: "list"; v: LispVal[] }, indent: number): string {
  if (!v.v.length) return "[]";
  const lines: string[] = [];
  pushPrefixed(lines, "[", formatVal(v.v[0]!, indent + 1));
  for (const item of v.v.slice(1)) {
    pushPrefixed(lines, "  ", formatVal(item, indent + 1));
  }
  return closeOn(lines, "]");
}

function formatMap(
  v: { k: "map"; v: Map<string, LispVal>; cmt?: string; broke?: boolean },
  indent: number,
): string {
  if (v.v.size === 0) return suffixCmt(v, "[:]");
  const pairs = [...v.v.entries()];
  const inline = `[${pairs.map(([k, val]) => `${k}: ${formatInline(val)}`).join(" ")}]`;
  const col = indent * 2;
  if (
    !hasBreakComment(v) &&
    !v.broke &&
    inline.length + col <= MAX_INLINE
  ) {
    return suffixCmt(v, inline);
  }
  const pairText = (k: string, val: LispVal) =>
    prefixLines(`${k}: `, formatVal(val, indent + 1));
  const lines: string[] = [];
  pushPrefixed(lines, "[", pairText(pairs[0]![0], pairs[0]![1]));
  for (const [k, val] of pairs.slice(1)) {
    pushPrefixed(lines, " ", pairText(k, val));
  }
  return suffixCmt(v, closeOn(lines, "]"));
}

function formatBlock(v: { k: "list"; v: LispVal[] }, indent: number): string {
  const body = "  ";
  const head = v.v[0]!;
  const headName = head.k === "sym" ? head.v : formatVal(head, indent);

  if (headName === "on") {
    const ev = v.v[1] ? formatVal(v.v[1], indent) : "";
    const params = v.v[2] ? formatInline(v.v[2]) : "()";
    const rest = v.v.slice(3);
    if (rest.length === 0) return `(on ${ev} ${params})`;
    const lines = [`(on ${ev} ${params}`];
    for (const item of rest) {
      pushPrefixed(lines, body, formatVal(item, indent + 1));
    }
    return closeOn(lines);
  }

  if (headName === "after") {
    let i = 1;
    let header = `(${headName}`;
    while (i < v.v.length && v.v[i]!.k !== "list") {
      header += " " + formatAtom(v.v[i]!);
      i++;
    }
    if (i >= v.v.length) return header + ")";
    const lines = [header];
    for (; i < v.v.length; i++) {
      pushPrefixed(lines, body, formatVal(v.v[i]!, indent + 1));
    }
    return closeOn(lines);
  }

  if (headName === "if") {
    try {
      const clauses = parseIfArgs(v.v.slice(1));
      const lines: string[] = [];
      clauses.forEach((c, i) => {
        if (i === 0) {
          const t = c.test ? formatVal(c.test, indent + 1) : "nil";
          pushPrefixed(lines, `(if ${c.not ? "not " : ""}`, t);
        } else if (c.test) {
          pushPrefixed(
            lines,
            `else if ${c.not ? "not " : ""}`,
            formatVal(c.test, indent + 1),
          );
        } else {
          lines.push("else");
        }
        for (const item of c.body) {
          pushPrefixed(lines, body, formatVal(item, indent + 1));
        }
      });
      if (!lines.length) return "(if)";
      return closeOn(lines);
    } catch {
      const cond = v.v[1] ? formatVal(v.v[1], indent + 1) : "nil";
      const lines: string[] = [];
      pushPrefixed(lines, "(if ", cond);
      for (const item of v.v.slice(2)) {
        pushPrefixed(lines, body, formatVal(item, indent + 1));
      }
      return closeOn(lines);
    }
  }

  if (headName === "def") {
    const nm = v.v[1] ? formatVal(v.v[1], indent) : "";
    const rest = v.v.slice(2);
    if (rest.length >= 2 && rest[0]?.k === "list") {
      const lines = [`(def ${nm} ${formatInline(rest[0]!)}`];
      for (const item of rest.slice(1)) {
        pushPrefixed(lines, body, formatVal(item, indent + 1));
      }
      return closeOn(lines);
    }
    if (rest.length === 0) return `(def ${nm})`;
    const lines = [`(def ${nm}`];
    for (const item of rest) {
      pushPrefixed(lines, body, formatVal(item, indent + 1));
    }
    return closeOn(lines);
  }

  if (headName === "fn") {
    const sig = v.v[1] ? " " + formatInline(v.v[1]) : "";
    const rest = v.v.slice(2);
    if (rest.length === 0) return `(${headName}${sig})`;
    const lines = [`(${headName}${sig}`];
    for (const item of rest) {
      pushPrefixed(lines, body, formatVal(item, indent + 1));
    }
    return closeOn(lines);
  }

  if (headName === "let") {
    const binds = v.v[1];
    const bindStr = binds ? formatVal(binds, indent + 1) : "[:]";
    const lines: string[] = [];
    pushPrefixed(lines, "(let ", bindStr);
    for (const item of v.v.slice(2)) {
      pushPrefixed(lines, body, formatVal(item, indent + 1));
    }
    return closeOn(lines);
  }

  if (headName === "pipe") {
    const rest = v.v.slice(1);
    if (rest.length === 0) return "(pipe)";
    const first = formatVal(rest[0]!, indent + 1);
    if (rest.length === 1) return prefixLines("(pipe ", first) + ")";
    const lines: string[] = [];
    pushPrefixed(lines, "(pipe ", first);
    for (const item of rest.slice(1)) {
      pushPrefixed(lines, body, formatVal(item, indent + 1));
    }
    return closeOn(lines);
  }

  // Regular call: keep key: value pairs together when wrapping
  const args = v.v.slice(1);
  if (args.length === 0) return `(${headName})`;
  const chunks: LispVal[][] = [];
  for (let i = 0; i < args.length; ) {
    const a = args[i]!;
    if (a.k === "sym" && a.v.endsWith(":") && a.v.length > 1 && args[i + 1]) {
      chunks.push([a, args[i + 1]!]);
      i += 2;
    } else {
      chunks.push([a]);
      i += 1;
    }
  }
  const fmtChunk = (c: LispVal[]) => {
    if (
      c.length === 2 &&
      c[0]!.k === "sym" &&
      c[0]!.v.endsWith(":")
    ) {
      return prefixLines(`${c[0]!.v} `, formatVal(c[1]!, indent + 1));
    }
    if (c.length === 1) return formatVal(c[0]!, indent + 1);
    return c.map((x) => formatVal(x, indent + 1)).join(" ");
  };
  const argPad = " ".repeat(headName.length + 2);
  const lines: string[] = [];
  pushPrefixed(lines, `(${headName} `, fmtChunk(chunks[0]!));
  for (const c of chunks.slice(1)) {
    pushPrefixed(lines, argPad, fmtChunk(c));
  }
  return closeOn(lines);
}

function formatInline(v: LispVal): string {
  if (v.k !== "list") return formatAtom(v);
  const open = v.vec ? "[" : "(";
  const close = v.vec ? "]" : ")";
  if (!v.v.length) return suffixCmt(v, open + close);
  const last = v.v[v.v.length - 1]!;
  const parts = v.v.map((x, i) =>
    i === v.v.length - 1 ? formatCore(x) : formatInline(x),
  );
  let text = `${open}${parts.join(" ")}${close}`;
  if (last.cmt) text += ` ${last.cmt}`;
  return suffixCmt(v, text);
}

function formatCore(v: LispVal): string {
  if (v.k === "comment") return v.v;
  if (v.k === "list") return formatInline(v);
  if (v.k === "map") return formatMap(v, 0);
  return formatAtomCore(v);
}

function formatAtomCore(v: LispVal): string {
  switch (v.k) {
    case "nil":
      return "nil";
    case "bool":
      return v.v ? "true" : "false";
    case "num":
      return String(v.v);
    case "str":
      return JSON.stringify(v.v);
    case "sym":
      return v.v;
    case "fn":
      return "#<fn>";
    case "comment":
      return v.v;
    case "list":
      return formatInline(v);
    case "map":
      return formatMap(v, 0);
  }
}

function formatAtom(v: LispVal): string {
  return suffixCmt(v, formatAtomCore(v));
}

export type AttrPatch = {
  locked?: boolean;
  open?: boolean;
  disabled?: boolean;
  dest?: string;
  label?: string;
  color?: number;
  shape?: string;
  variant?: string;
};

export type SetWallOpts = {
  at?: string;
  x?: number;
  y?: number;
  type?: string;
  color?: number;
  floor?: number;
  ceiling?: number;
};

export type Host = {
  say: (msg: string) => void;
  give: (what: string, n?: number) => boolean;
  take: (what: string, n?: number) => boolean;
  has: (what: string) => boolean;
  getVar: (key: string) => LispVal;
  setVar: (key: string, val: LispVal) => void;
  setAttr: (id: string, patch: AttrPatch) => boolean;
  getAttr: (id: string, attr?: string) => LispVal | undefined;
  setWall: (opts: SetWallOpts) => boolean;
  getWall: (
    loc: { at: string } | { x: number; y: number },
    attr?: string,
  ) => LispVal | undefined;
  spawn: (opts: {
    type: string;
    places: ({ at: string } | { x: number; y: number })[];
    fill?: boolean;
    id?: string;
    variant?: string;
    dest?: string;
    label?: string;
    color?: number;
    locked?: boolean;
    disabled?: boolean;
    shape?: string;
  }) => string | string[] | null;
  remove: (name: string) => boolean;
  teleport: (who: string, dest: LispVal) => boolean;
  win: () => void;
  lose: () => void;
  after: (sec: number, thunk: () => void) => void;
};

export type Handler = {
  event: string;
  clauses: Clause[];
};

export type NamedFn = {
  name: string;
  clauses: Clause[];
};

export type Program = {
  handlers: Handler[];
  boot: LispVal[];
  fns: NamedFn[];
};

const BUDGET = 8000;

export function compileProgram(src: string): { ok: true; program: Program } | { ok: false; error: string } {
  const parsed = parseLisp(src);
  if (!parsed.ok) return parsed;
  const onMap = new Map<string, Clause[]>();
  const fnMap = new Map<string, Clause[]>();
  const boot: LispVal[] = [];
  let last: { t: "on"; name: string } | { t: "fn"; name: string } | null = null;
  const breakAdj = () => {
    last = null;
  };
  for (const form of parsed.forms) {
    if (form.k === "comment") continue;
    if (form.k === "list" && form.v[0]?.k === "sym" && form.v[0].v === "on") {
      const ev = form.v[1];
      if (!ev || ev.k !== "sym") {
        return { ok: false, error: "(on event (args...) body) needs an event name" };
      }
      const paramsForm = form.v[2];
      if (!paramsForm || paramsForm.k !== "list") {
        return { ok: false, error: "(on event (args...) body) needs a parameter list" };
      }
      if (onMap.has(ev.v) && !(last?.t === "on" && last.name === ev.v)) {
        return {
          ok: false,
          error: `(on ${ev.v} ...) must sit next to the last (on ${ev.v} ...)`,
        };
      }
      try {
        const params = parseParams(paramsForm, "on");
        const list = onMap.get(ev.v) ?? [];
        if (unreachableBy(list, params)) {
          return { ok: false, error: `unreachable clause for ${ev.v}` };
        }
        list.push({ params, body: form.v.slice(3) });
        onMap.set(ev.v, list);
        last = { t: "on", name: ev.v };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Invalid on parameters",
        };
      }
      continue;
    }
    if (form.k === "list" && form.v[0]?.k === "sym" && form.v[0].v === "def") {
      if (!isTopFnDef(form)) {
        return { ok: false, error: "(def name (args...) body)" };
      }
      const name = form.v[1].v;
      if (fnMap.has(name) && !(last?.t === "fn" && last.name === name)) {
        return {
          ok: false,
          error: `(def ${name} ...) must sit next to the last (def ${name} ...)`,
        };
      }
      try {
        const params = parseParams(form.v[2], "def");
        const list = fnMap.get(name) ?? [];
        if (unreachableBy(list, params)) {
          return { ok: false, error: `unreachable clause for ${name}` };
        }
        list.push({ params, body: form.v.slice(3) });
        fnMap.set(name, list);
        last = { t: "fn", name };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Invalid def parameters",
        };
      }
      continue;
    }
    breakAdj();
    boot.push(form);
  }
  const handlers: Handler[] = [];
  for (const [event, clauses] of onMap) handlers.push({ event, clauses });
  const fns: NamedFn[] = [];
  for (const [name, clauses] of fnMap) fns.push({ name, clauses });
  return { ok: true, program: { handlers, boot, fns } };
}

function isTopFnDef(
  form: LispVal,
): form is { k: "list"; v: [LispVal, { k: "sym"; v: string }, LispVal, ...LispVal[]] } {
  return (
    form.k === "list" &&
    form.v[0]?.k === "sym" &&
    form.v[0].v === "def" &&
    form.v[1]?.k === "sym" &&
    form.v[2]?.k === "list" &&
    form.v.length >= 3
  );
}

function isLit(v: LispVal): boolean {
  return v.k === "num" || v.k === "str" || v.k === "bool" || v.k === "nil";
}

function asPattern(v: LispVal): Pattern {
  if (v.k === "sym") {
    if (v.v.endsWith(":") && v.v.length > 1) {
      throw new LispError("parameter must be a name or a literal");
    }
    if (!v.v) throw new LispError("empty parameter name");
    return { k: "bind", name: v.v };
  }
  if (isLit(v)) return { k: "lit", value: v };
  throw new LispError("parameter must be a name or a literal");
}

function isKeySym(v: LispVal): v is { k: "sym"; v: string } {
  return v.k === "sym" && v.v.endsWith(":") && v.v.length > 1;
}

export function parseParams(form: LispVal, ctx: string): Params {
  if (form.k !== "list") throw new LispError(`${ctx} needs a parameter list`);
  let mode: "pos" | "key" | null = null;
  const pos: Pattern[] = [];
  const keys: { name: string; pat: Pattern }[] = [];
  const seen: string[] = [];
  for (let i = 0; i < form.v.length; ) {
    const p = form.v[i]!;
    if (isKeySym(p)) {
      if (mode === "pos") {
        throw new LispError("do not mix positional and keyword parameters");
      }
      mode = "key";
      const name = p.v.slice(0, -1);
      if (!name) throw new LispError("empty parameter name");
      if (seen.includes(name)) throw new LispError(`duplicate parameter ${name}`);
      seen.push(name);
      const next = form.v[i + 1];
      if (next && !isKeySym(next)) {
        keys.push({ name, pat: asPattern(next) });
        i += 2;
      } else {
        keys.push({ name, pat: { k: "bind", name } });
        i += 1;
      }
      continue;
    }
    if (mode === "key") {
      throw new LispError("do not mix positional and keyword parameters");
    }
    mode = "pos";
    pos.push(asPattern(p));
    i += 1;
  }
  if (mode === "key") return { k: "key", pats: keys };
  return { k: "pos", pats: pos };
}

type CallParts = { pos: LispVal[]; keys: Map<string, LispVal> };

function parseCallRaw(raw: LispVal[]): { pos: LispVal[]; keys: { name: string; raw: LispVal }[] } {
  const pos: LispVal[] = [];
  const keys: { name: string; raw: LispVal }[] = [];
  let keyed = false;
  for (let i = 0; i < raw.length; ) {
    const a = raw[i]!;
    if (a.k === "sym" && a.v.endsWith(":") && a.v.length > 1) {
      keyed = true;
      const name = a.v.slice(0, -1);
      const val = raw[i + 1];
      if (!val) throw new LispError(`missing value for ${a.v}`);
      if (keys.some((k) => k.name === name)) {
        throw new LispError(`duplicate ${a.v}`);
      }
      keys.push({ name, raw: val });
      i += 2;
      continue;
    }
    if (keyed) throw new LispError("positional argument after key:");
    pos.push(a);
    i += 1;
  }
  return { pos, keys };
}

function evalCallRaw(
  raw: LispVal[],
  env: Env,
  ctx: Ctx,
): CallParts {
  const parts = parseCallRaw(raw);
  const keys = new Map<string, LispVal>();
  for (const k of parts.keys) keys.set(k.name, evalVal(k.raw, env, ctx));
  return {
    pos: parts.pos.map((a) => evalVal(a, env, ctx)),
    keys,
  };
}

function clauseKeys(params: Params): string[] {
  return params.k === "key" ? params.pats.map((p) => p.name) : [];
}

function unionKeys(clauses: Clause[]): string[] {
  const s = new Set<string>();
  for (const c of clauses) for (const k of clauseKeys(c.params)) s.add(k);
  return [...s];
}

function patCovers(earlier: Pattern, later: Pattern | undefined): boolean {
  if (earlier.k === "bind") return true;
  if (!later || later.k === "bind") return false;
  return eq(earlier.value, later.value);
}

/** True when every call that matches `later` also matches `earlier`. */
function clauseCovers(earlier: Params, later: Params): boolean {
  if (earlier.k !== later.k) return false;
  if (earlier.k === "pos" && later.k === "pos") {
    if (earlier.pats.length !== later.pats.length) return false;
    return earlier.pats.every((p, i) => patCovers(p, later.pats[i]));
  }
  if (earlier.k === "key" && later.k === "key") {
    const laterBy = new Map(later.pats.map((p) => [p.name, p.pat]));
    return earlier.pats.every((p) => patCovers(p.pat, laterBy.get(p.name)));
  }
  return false;
}

function unreachableBy(prev: Clause[], next: Params): boolean {
  return prev.some((c) => clauseCovers(c.params, next));
}

function bindPat(pat: Pattern, val: LispVal, env: Env): boolean {
  if (pat.k === "lit") return eq(pat.value, val);
  env.vars.set(pat.name, val);
  return true;
}

function tryBind(params: Params, call: CallParts, env: Env): boolean {
  if (params.k === "pos") {
    if (call.keys.size) return false;
    if (call.pos.length !== params.pats.length) return false;
    for (let i = 0; i < params.pats.length; i++) {
      if (!bindPat(params.pats[i]!, call.pos[i]!, env)) return false;
    }
    return true;
  }
  if (call.pos.length) return false;
  for (const { name, pat } of params.pats) {
    const val = call.keys.get(name) ?? nil();
    if (!bindPat(pat, val, env)) return false;
    if (pat.k === "lit") env.vars.set(name, val);
    else if (pat.name !== name) env.vars.set(name, val);
  }
  return true;
}

export function makeFnVal(clauses: Clause[], env: Env): LispVal {
  return { k: "fn", clauses, keys: unionKeys(clauses), env };
}

export function installFns(fns: NamedFn[], env: Env) {
  for (const f of fns) env.vars.set(f.name, makeFnVal(f.clauses, env));
}

export function makeEnv(parent: Env | null = null): Env {
  return { parent, vars: new Map() };
}

export function lookup(env: Env, name: string): LispVal {
  let cur: Env | null = env;
  while (cur) {
    const v = cur.vars.get(name);
    if (cur.vars.has(name)) return cur.vars.get(name)!;
    cur = cur.parent;
  }
  throw new LispError(`unknown name: ${name}`);
}

export function evalForms(
  forms: LispVal[],
  env: Env,
  host: Host,
): LispVal {
  const ctx = { budget: BUDGET, host };
  let last: LispVal = nil();
  for (const f of forms) last = evalVal(f, env, ctx);
  return last;
}

type Ctx = { budget: number; host: Host };

function evalVal(v: LispVal, env: Env, ctx: Ctx): LispVal {
  if (--ctx.budget <= 0) throw new LispError("script ran too long");
  if (v.k === "comment") return nil();
  if (v.k === "num" || v.k === "str" || v.k === "bool" || v.k === "nil" || v.k === "fn") {
    return v;
  }
  if (v.k === "sym") {
    if (v.v === "true") return bool(true);
    if (v.v === "false") return bool(false);
    if (v.v === "nil") return nil();
    return lookup(env, v.v);
  }
  if (v.k === "map") {
    const out = new Map<string, LispVal>();
    for (const [k, val] of v.v) {
      out.set(k, evalVal(val, env, ctx));
    }
    return { k: "map", v: out };
  }
  if (v.k !== "list" || v.v.length === 0) return v;
  if (v.vec) {
    const items = v.v.filter((x) => x.k !== "comment");
    return list(
      items.map((x) => evalVal(x, env, ctx)),
      true,
    );
  }
  const xs = v.v.filter((x) => x.k !== "comment");
  if (!xs.length) return nil();
  const head = xs[0]!;
  if (head.k === "sym") {
    const sf = special(head.v, xs.slice(1), env, ctx);
    if (sf !== undefined) return sf;
    if (BUILTINS.has(head.v) && head.v !== "true" && head.v !== "false" && head.v !== "nil") {
      return callBuiltin(head.v, evalCallRaw(xs.slice(1), env, ctx), ctx);
    }
  }
  const fn = evalVal(head, env, ctx);
  return applyFn(fn, evalCallRaw(xs.slice(1), env, ctx), env, ctx);
}

function special(
  name: string,
  args: LispVal[],
  env: Env,
  ctx: Ctx,
): LispVal | undefined {
  switch (name) {
    case "quote":
      return args[0] ?? nil();
    case "if": {
      const clauses = parseIfArgs(args);
      for (const c of clauses) {
        const pass =
          c.test === null ||
          (c.not
            ? !truthy(evalVal(c.test, env, ctx))
            : truthy(evalVal(c.test, env, ctx)));
        if (pass) {
          let last: LispVal = nil();
          for (const a of c.body) last = evalVal(a, env, ctx);
          return last;
        }
      }
      return nil();
    }
    case "and": {
      let last: LispVal = bool(true);
      for (const a of args) {
        last = evalVal(a, env, ctx);
        if (!truthy(last)) return last;
      }
      return last;
    }
    case "or": {
      let last: LispVal = bool(false);
      for (const a of args) {
        last = evalVal(a, env, ctx);
        if (truthy(last)) return last;
      }
      return last;
    }
    case "not":
      return bool(!truthy(evalVal(args[0] ?? nil(), env, ctx)));
    case "def":
      return evalDef(args, env, ctx);
    case "fn":
      return makeFn(args, env);
    case "let":
      return evalLet(args, env, ctx);
    case "pipe":
      return evalPipe(args, env, ctx);
    case "after": {
      const sec = asNum(evalVal(args[0] ?? num(0), env, ctx), "after");
      const body = args.slice(1);
      const later = { budget: BUDGET, host: ctx.host };
      ctx.host.after(sec, () => {
        try {
          for (const b of body) evalVal(b, env, later);
        } catch (e) {
          ctx.host.say(e instanceof Error ? e.message : "Script error");
        }
      });
      return nil();
    }
    case "on":
      throw new LispError("(on ...) only works at the top of a script");
    default:
      return undefined;
  }
}

function makeFn(args: LispVal[], env: Env): LispVal {
  const paramsForm = args[0];
  if (!paramsForm || paramsForm.k !== "list") {
    throw new LispError("(fn (args...) body)");
  }
  const params = parseParams(paramsForm, "fn");
  return makeFnVal([{ params, body: args.slice(1) }], env);
}

function evalDef(args: LispVal[], env: Env, ctx: Ctx): LispVal {
  const head = args[0];
  if (!head || head.k !== "sym") {
    throw new LispError("(def name (args...) body)");
  }
  if (!args[1] || args[1].k !== "list") {
    throw new LispError("(def name (args...) body)");
  }
  const fn = makeFnVal(
    [{ params: parseParams(args[1], "def"), body: args.slice(2) }],
    env,
  );
  env.vars.set(head.v, fn);
  return fn;
}

function evalLet(args: LispVal[], env: Env, ctx: Ctx): LispVal {
  const raw = args[0];
  if (!raw) throw new LispError("(let map body...)");
  const m = evalVal(raw, env, ctx);
  if (m.k !== "map") throw new LispError("let needs a map");
  const child = makeEnv(env);
  for (const [k, val] of m.v) child.vars.set(k, val);
  let last: LispVal = nil();
  for (const a of args.slice(1)) last = evalVal(a, child, ctx);
  return last;
}

function quotedVal(v: LispVal): LispVal {
  return list([sym("quote"), v]);
}

function pipeStepForm(step: LispVal, cur: LispVal): LispVal {
  const q = quotedVal(cur);
  if (step.k === "sym") return list([step, q]);
  if (step.k !== "list" || step.vec) {
    throw new LispError("pipe step must be a call or a name");
  }
  const xs = step.v.filter((x) => x.k !== "comment");
  if (!xs.length) throw new LispError("pipe step must be a call or a name");
  for (const a of xs.slice(1)) {
    if (isKeySym(a)) throw new LispError("pipe steps cannot use name: arguments");
  }
  return list([xs[0]!, q, ...xs.slice(1)]);
}

function evalPipe(args: LispVal[], env: Env, ctx: Ctx): LispVal {
  const steps = args.filter((a) => a.k !== "comment");
  if (steps.length < 2) {
    throw new LispError("pipe needs a value and at least one step");
  }
  let cur = evalVal(steps[0]!, env, ctx);
  for (const step of steps.slice(1)) {
    cur = evalVal(pipeStepForm(step, cur), env, ctx);
  }
  return cur;
}

function applyFn(fn: LispVal, call: CallParts, env: Env, ctx: Ctx): LispVal {
  if (fn.k === "fn") {
    if (fn.keys.length) {
      for (const key of call.keys.keys()) {
        if (!fn.keys.includes(key)) throw new LispError(`unknown ${key}:`);
      }
    }
    const allPos = fn.clauses.every((c) => c.params.k === "pos");
    const allKey = fn.clauses.every((c) => c.params.k === "key");
    if (allPos && call.keys.size) {
      throw new LispError("this function does not take keyword arguments");
    }
    if (allKey && call.pos.length) {
      throw new LispError("this function needs key: arguments");
    }
    for (const clause of fn.clauses) {
      const child = makeEnv(fn.env);
      if (!tryBind(clause.params, call, child)) continue;
      let last: LispVal = nil();
      for (const b of clause.body) last = evalVal(b, child, ctx);
      return last;
    }
    throw new LispError("no matching clause");
  }
  if (fn.k === "sym") return callBuiltin(fn.v, call, ctx);
  throw new LispError("not a function");
}

function posArgs(name: string, call: CallParts): LispVal[] {
  if (call.keys.size) {
    throw new LispError(`${name} does not take keyword arguments`);
  }
  return call.pos;
}

function callPos(fn: LispVal, args: LispVal[], ctx: Ctx): LispVal {
  return applyFn(fn, { pos: args, keys: new Map() }, makeEnv(null), ctx);
}

function parseThingAttrs(
  kind: string,
  attrs: Map<string, LispVal>,
  ctx: string,
): {
  id?: string;
  variant?: string;
  dest?: string;
  label?: string;
  color?: number;
  locked?: boolean;
  disabled?: boolean;
  shape?: string;
} {
  unknownKeys(
    attrs,
    ["id", "variant", "dest", "label", "color", "locked", "disabled", "shape"],
    ctx,
  );
  const variant = attrs.get("variant");
  const dest = attrs.get("dest");
  const label = attrs.get("label");
  const color = attrs.get("color");
  const locked = attrs.get("locked");
  const disabled = attrs.get("disabled");
  const shape = attrs.get("shape");
  const id = attrs.get("id");
  if (variant && kind !== "enemy") {
    throw new LispError("variant is only for enemy");
  }
  if (dest && kind !== "teleport") {
    throw new LispError("dest is only for teleport");
  }
  if ((label || color || shape) && kind !== "pickup") {
    throw new LispError("label, color, and shape are only for pickup");
  }
  if (locked && kind !== "door") {
    throw new LispError("locked is only for door");
  }
  if (disabled && kind !== "button") {
    throw new LispError("disabled is only for button");
  }
  if (shape && parsePickupShape(asName(shape)) === null) {
    throw new LispError(`unknown shape: ${asName(shape)}`);
  }
  return {
    id: id ? asName(id) : undefined,
    variant: variant ? asName(variant) : undefined,
    dest: dest ? asName(dest) : undefined,
    label: label ? asName(label) : undefined,
    color: color ? asColor(color, "color") : undefined,
    locked: locked ? truthy(locked) : undefined,
    disabled: disabled ? truthy(disabled) : undefined,
    shape: shape ? asName(shape) : undefined,
  };
}

function callBuiltin(name: string, call: CallParts, ctx: Ctx): LispVal {
  const h = ctx.host;
  const args = posArgs(name, call);
  const nums = () => args.map((a) => asNum(a, name));
  switch (name) {
    case "+":
      return num(nums().reduce((a, b) => a + b, 0));
    case "-":
      if (args.length === 1) return num(-asNum(args[0]!, name));
      return num(nums().slice(1).reduce((a, b) => a - b, asNum(args[0]!, name)));
    case "*":
      return num(nums().reduce((a, b) => a * b, 1));
    case "/":
      return num(nums().slice(1).reduce((a, b) => a / (b || 1e-12), asNum(args[0]!, "/")));
    case "mod":
      return num(asNum(args[0]!, name) % asNum(args[1] ?? num(1), name));
    case "abs":
      return num(Math.abs(asNum(args[0]!, name)));
    case "min":
      return num(Math.min(...nums()));
    case "max":
      return num(Math.max(...nums()));
    case "floor":
      return num(Math.floor(asNum(args[0]!, name)));
    case "ceil":
      return num(Math.ceil(asNum(args[0]!, name)));
    case "=":
      return bool(args[1] ? eq(args[0]!, args[1]) : false);
    case "/=":
      return bool(args[1] ? !eq(args[0]!, args[1]) : true);
    case "<":
      return bool(asNum(args[0]!, name) < asNum(args[1] ?? num(0), name));
    case ">":
      return bool(asNum(args[0]!, name) > asNum(args[1] ?? num(0), name));
    case "<=":
      return bool(asNum(args[0]!, name) <= asNum(args[1] ?? num(0), name));
    case ">=":
      return bool(asNum(args[0]!, name) >= asNum(args[1] ?? num(0), name));
    case "str":
      return str(args.map(printVal).join(""));
    case "len": {
      const a = args[0];
      if (a?.k === "str") return num(a.v.length);
      if (a?.k === "list") return num(a.v.length);
      if (a?.k === "map") return num(a.v.size);
      throw new LispError("len needs a string, a list, or a map");
    }
    case "cons":
      if (args[1]?.k === "list") return list([args[0]!, ...args[1].v]);
      return list([args[0]!, args[1] ?? nil()]);
    case "first":
      if (args[0]?.k === "list") return args[0].v[0] ?? nil();
      return nil();
    case "rest":
      if (args[0]?.k === "list") return list(args[0].v.slice(1));
      return nil();
    case "nth": {
      const i = Math.floor(asNum(args[1] ?? num(0), "nth"));
      if (args[0]?.k === "list") return args[0].v[i] ?? nil();
      return nil();
    }
    case "append": {
      const out: LispVal[] = [];
      for (const a of args) {
        if (a.k === "list") out.push(...a.v);
        else out.push(a);
      }
      return list(out);
    }
    case "map": {
      if (args.length < 2) throw new LispError("map needs a list or map, and a function");
      const f = args[1]!;
      return list(
        asSeq(args[0]!, "map").map((item) => callPos(f, [item], ctx)),
        true,
      );
    }
    case "filter": {
      if (args.length < 2) throw new LispError("filter needs a list or map, and a function");
      const f = args[1]!;
      return list(
        asSeq(args[0]!, "filter").filter((item) =>
          truthy(callPos(f, [item], ctx)),
        ),
        true,
      );
    }
    case "reduce": {
      if (args.length < 3) {
        throw new LispError("reduce needs a list or map, an init, and a function");
      }
      const f = args[2]!;
      let acc = args[1]!;
      for (const item of asSeq(args[0]!, "reduce")) {
        acc = callPos(f, [acc, item], ctx);
      }
      return acc;
    }
    case "pairs": {
      const m = args[0];
      if (!m || m.k !== "map") throw new LispError("pairs needs a map");
      return list(
        [...m.v.entries()].map(([k, val]) => list([str(k), val], true)),
        true,
      );
    }
    case "from-pairs": {
      const xs = args[0];
      if (!xs || xs.k !== "list") throw new LispError("from-pairs needs a list");
      const out = new Map<string, LispVal>();
      for (const p of xs.v) {
        const [k, val] = asPair(p, "from-pairs");
        out.set(k, val);
      }
      return { k: "map", v: out };
    }
    case "keys": {
      const m = args[0];
      if (!m || m.k !== "map") throw new LispError("keys needs a map");
      return list([...m.v.keys()].map(str), true);
    }
    case "vals": {
      const m = args[0];
      if (!m || m.k !== "map") throw new LispError("vals needs a map");
      return list([...m.v.values()], true);
    }
    case "empty?":
      return bool(
        args[0]?.k === "nil" ||
          (args[0]?.k === "list" && args[0].v.length === 0) ||
          (args[0]?.k === "map" && args[0].v.size === 0) ||
          (args[0]?.k === "str" && args[0].v.length === 0),
      );
    case "list?":
      return bool(args[0]?.k === "list");
    case "map?":
      return bool(args[0]?.k === "map");
    case "num?":
      return bool(args[0]?.k === "num");
    case "str?":
      return bool(args[0]?.k === "str");
    case "bool?":
      return bool(args[0]?.k === "bool");
    case "nil?":
      return bool(args[0]?.k === "nil");
    case "get":
      if (args.length >= 2) {
        const m = args[0]!;
        if (m.k !== "map") throw new LispError("get needs a map");
        return m.v.get(asName(args[1]!)) ?? nil();
      }
      return h.getVar(asName(args[0] ?? nil()));
    case "set": {
      const val = args[1] ?? nil();
      h.setVar(asName(args[0] ?? nil()), val);
      return val;
    }
    case "merge": {
      const out = new Map<string, LispVal>();
      for (const a of args) {
        if (a.k !== "map") throw new LispError("merge needs maps");
        for (const [k, val] of a.v) out.set(k, val);
      }
      return { k: "map", v: out };
    }
    case "has":
      return bool(h.has(asName(args[0] ?? nil())));
    case "give":
      return bool(
        h.give(
          asName(args[0] ?? nil()),
          args[1]?.k === "num" ? args[1].v : undefined,
        ),
      );
    case "take":
      return bool(
        h.take(
          asName(args[0] ?? nil()),
          args[1]?.k === "num" ? args[1].v : undefined,
        ),
      );
    case "say":
      h.say(args.map(printVal).join(""));
      return nil();
    case "set-attr": {
      if (args.length < 1) throw new LispError("set-attr needs an id");
      const attrs = requireMap(args, 1, "set-attr");
      unknownKeys(
        attrs,
        ["locked", "open", "disabled", "dest", "label", "color", "variant", "shape"],
        "set-attr",
      );
      const patch: AttrPatch = {};
      if (attrs.has("locked")) patch.locked = truthy(attrs.get("locked")!);
      if (attrs.has("open")) patch.open = truthy(attrs.get("open")!);
      if (attrs.has("disabled")) patch.disabled = truthy(attrs.get("disabled")!);
      const dest = attrs.get("dest");
      if (dest) patch.dest = asName(dest);
      const label = attrs.get("label");
      if (label) patch.label = asName(label);
      const color = attrs.get("color");
      if (color) patch.color = asColor(color, "color");
      const variant = attrs.get("variant");
      if (variant) patch.variant = asName(variant);
      const shape = attrs.get("shape");
      if (shape) {
        const parsed = parsePickupShape(asName(shape));
        if (!parsed) throw new LispError(`unknown shape: ${asName(shape)}`);
        patch.shape = parsed;
      }
      if (
        patch.locked === undefined &&
        patch.open === undefined &&
        patch.disabled === undefined &&
        !dest &&
        !label &&
        !color &&
        !variant &&
        !shape
      ) {
        throw new LispError("set-attr needs a field");
      }
      let ok = true;
      for (const name of asIdList(args[0]!)) {
        if (!h.setAttr(name, patch)) ok = false;
      }
      return bool(ok);
    }
    case "get-attr": {
      if (args.length === 1) {
        return h.getAttr(asName(args[0]!)) ?? nil();
      }
      if (args.length < 2) throw new LispError("get-attr needs an id");
      const attr = asName(args[1]!);
      const ok = [
        "locked",
        "open",
        "disabled",
        "dest",
        "label",
        "color",
        "variant",
        "type",
        "id",
        "shape",
      ];
      if (!ok.includes(attr)) throw new LispError(`unknown attr ${attr}`);
      return h.getAttr(asName(args[0]!), attr) ?? nil();
    }
    case "set-wall": {
      if (args.length < 1) throw new LispError("set-wall needs a place");
      const attrs = requireMap(args, 1, "set-wall");
      unknownKeys(attrs, ["type", "color", "floor", "ceiling"], "set-wall");
      const type = attrs.get("type");
      if (type && texFromWallName(asName(type)) === null) {
        throw new LispError(`unknown type: ${asName(type)}`);
      }
      const color = attrs.get("color");
      const floor = attrs.get("floor");
      const ceiling = attrs.get("ceiling");
      if (!type && !color && !floor && !ceiling) {
        throw new LispError("set-wall needs a field");
      }
      let ok = true;
      for (const place of asPlaces(args[0]!, "set-wall")) {
        if (
          !h.setWall({
            ...place,
            type: type ? asName(type) : undefined,
            color: color ? asColor(color, "color") : undefined,
            floor: floor ? asColor(floor, "floor") : undefined,
            ceiling: ceiling ? asColor(ceiling, "ceiling") : undefined,
          })
        ) {
          ok = false;
        }
      }
      return bool(ok);
    }
    case "get-wall": {
      if (args.length === 1) {
        return h.getWall(asPlace(args[0]!, "get-wall")) ?? nil();
      }
      if (args.length !== 2) {
        throw new LispError("get-wall needs a place, or a place and an attr");
      }
      const attr = asName(args[1]!);
      if (!["type", "color", "floor", "ceiling"].includes(attr)) {
        throw new LispError(`unknown attr ${attr}`);
      }
      return h.getWall(asPlace(args[0]!, "get-wall"), attr) ?? nil();
    }
    case "spawn": {
      if (args.length < 2) throw new LispError("spawn needs a place and a type");
      const kind = asName(args[1]!);
      const attrs = optionalMap(args, 2, "spawn");
      const made = h.spawn({
        type: kind,
        places: asPlaces(args[0]!, "spawn"),
        ...parseThingAttrs(kind, attrs, "spawn"),
      });
      if (typeof made !== "string") throw new LispError("spawn place not found");
      return str(made);
    }
    case "spawn-fill": {
      if (args.length < 2) throw new LispError("spawn-fill needs a place and a type");
      const kind = asName(args[1]!);
      const attrs = optionalMap(args, 2, "spawn-fill");
      const made = h.spawn({
        type: kind,
        places: asPlaces(args[0]!, "spawn-fill"),
        fill: true,
        ...parseThingAttrs(kind, attrs, "spawn-fill"),
      });
      if (made === null) throw new LispError("spawn-fill place not found");
      if (Array.isArray(made)) return list(made.map(str), true);
      return list([str(made)], true);
    }
    case "remove": {
      let ok = true;
      for (const name of asIdList(args[0] ?? nil())) {
        if (!h.remove(name)) ok = false;
      }
      return bool(ok);
    }
    case "teleport":
      return bool(
        h.teleport(asName(args[0] ?? sym("player")), args[1] ?? nil()),
      );
    case "win":
      h.win();
      return nil();
    case "lose":
      h.lose();
      return nil();
    default:
      throw new LispError(`unknown function: ${name}`);
  }
}

function eq(a: LispVal, b: LispVal): boolean {
  if (a.k !== b.k) {
    if ((a.k === "sym" || a.k === "str") && (b.k === "sym" || b.k === "str")) {
      return a.v === b.v;
    }
    return false;
  }
  if (a.k === "nil") return true;
  if (a.k === "fn") return a === b;
  if (a.k === "list") {
    if (b.k !== "list" || a.v.length !== b.v.length) return false;
    return a.v.every((x, i) => eq(x, b.v[i]!));
  }
  if (a.k === "map") {
    if (b.k !== "map" || a.v.size !== b.v.size) return false;
    for (const [k, val] of a.v) {
      const other = b.v.get(k);
      if (other === undefined || !eq(val, other)) return false;
    }
    return true;
  }
  return (a as { v: unknown }).v === (b as { v: unknown }).v;
}

const EVENT_ARGS: Record<string, string[]> = {
  start: [],
  enter: ["zone"],
  leave: ["zone"],
  use: ["target", "x", "y"],
  shoot: ["target", "x", "y"],
  die: ["enemy", "x", "y"],
  pickup: ["target"],
  teleport: ["pad"],
  hurt: ["target", "amount"],
};

export function fireHandlers(
  program: Program,
  env: Env,
  host: Host,
  event: string,
  named: Record<string, LispVal>,
) {
  const keys = new Map<string, LispVal>();
  for (const [k, v] of Object.entries(named)) keys.set(k, v);
  for (const h of program.handlers) {
    if (h.event !== event) continue;
    for (const clause of h.clauses) {
      const call: CallParts =
        clause.params.k === "key"
          ? { pos: [], keys }
          : {
              pos: clause.params.pats.map((_, i) => {
                const order = EVENT_ARGS[event] ?? [];
                const key = order[i];
                return key ? (named[key] ?? nil()) : nil();
              }),
              keys: new Map(),
            };
      const payloadEnv = makeEnv(env);
      if (!tryBind(clause.params, call, payloadEnv)) continue;
      try {
        evalForms(clause.body, payloadEnv, host);
      } catch (e) {
        host.say(e instanceof Error ? e.message : "Script error");
      }
      return;
    }
  }
}
