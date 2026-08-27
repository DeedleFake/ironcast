/** Tiny event Lisp: parse, format, highlight, evaluate. */

import { parsePickupShape, PLAYER_ID, texFromWallName } from "./types";

export type LispVal = (
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "sym"; v: string }
  | { k: "list"; v: LispVal[]; vec?: boolean }
  | { k: "map"; v: Map<string, LispVal>; keySpans?: Map<string, { start: number; end: number }> }
  | { k: "quote"; v: LispVal }
  | { k: "unquote"; v: LispVal }
  | { k: "splice"; v: LispVal }
  | { k: "comment"; v: string }
  | { k: "fn"; clauses: Clause[]; keys: string[]; env: Env }
) & { cmt?: string; blank?: boolean; broke?: boolean; span?: { start: number; end: number } };

export type Pattern =
  | { k: "bind"; name: string }
  | { k: "lit"; value: LispVal };

export type Params =
  | { k: "pos"; pats: Pattern[]; rest?: string }
  | { k: "key"; pats: { name: string; pat: Pattern }[] };

export type Clause = { params: Params; body: LispVal[]; paramsForm?: LispVal };

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
  "on",
  "after",
  "pipe",
  "eval",
  "defm",
  "let!",
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
  "symbol?",
  "symbol",
  "get",
  "set",
  "update",
  "get-prop",
  "set-prop",
  "update-prop",
  "merge",
  "say",
  "set-attr",
  "get-attr",
  "update-attr",
  "set-wall",
  "get-wall",
  "update-wall",
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
  start?: number;
  end?: number;
  constructor(message: string, start?: number, end?: number) {
    super(message);
    this.name = "LispError";
    this.start = start;
    this.end = end;
  }
}

const INTERN = new Map<string, LispVal>();

export function internSym(name: string): LispVal {
  let s = INTERN.get(name);
  if (!s) {
    s = Object.freeze({ k: "sym", v: name }) as LispVal;
    INTERN.set(name, s);
  }
  return s;
}

export const SYM_TRUE = internSym("true");
export const SYM_FALSE = internSym("false");
export const SYM_NIL = internSym("nil");

export function isNil(v: LispVal): boolean {
  return v.k === "sym" && v.v === "nil";
}
export function isTrueVal(v: LispVal): boolean {
  return v.k === "sym" && v.v === "true";
}
export function isFalseVal(v: LispVal): boolean {
  return v.k === "sym" && v.v === "false";
}
export function isBoolVal(v: LispVal): boolean {
  return isTrueVal(v) || isFalseVal(v);
}

export function nil(): LispVal {
  return SYM_NIL;
}
export function num(v: number): LispVal {
  return { k: "num", v };
}
export function str(v: string): LispVal {
  return { k: "str", v };
}
export function bool(v: boolean): LispVal {
  return v ? SYM_TRUE : SYM_FALSE;
}
export function sym(v: string): LispVal {
  return { k: "sym", v };
}

function reservedLit(v: LispVal): boolean {
  return isTrueVal(v) || isFalseVal(v) || isNil(v);
}

function isInterned(v: LispVal): v is { k: "sym"; v: string } {
  return v.k === "sym" && INTERN.get(v.v) === v;
}

export function needsTicks(name: string): boolean {
  if (!name) return true;
  if (/[\s();[\]',@`]/.test(name)) return true;
  if (/^[+-]?\d+(\.\d+)?$/.test(name)) return true;
  return false;
}

export function formatSymName(name: string): string {
  if (!needsTicks(name)) return name;
  return "`" + name.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`";
}
export function list(v: LispVal[], vec = false): LispVal {
  return vec ? { k: "list", v, vec: true } : { k: "list", v };
}
export function mapFrom(
  entries: Iterable<[string, LispVal]>,
  keySpans?: Map<string, { start: number; end: number }>,
): LispVal {
  const m: Extract<LispVal, { k: "map" }> = { k: "map", v: new Map(entries) };
  if (keySpans?.size) m.keySpans = keySpans;
  return m;
}

export function truthy(v: LispVal): boolean {
  if (isNil(v) || isFalseVal(v)) return false;
  return true;
}

export function asNum(v: LispVal, ctx: string): number {
  if (v.k !== "num") throw new LispError(`${ctx} needs a number`);
  return v.v;
}

export function asName(v: LispVal): string {
  if (v.k === "str") return v.v;
  throw new LispError("expected a name");
}

function asPath(v: LispVal, ctx: string): string[] {
  if (v.k === "list") {
    if (!v.v.length) throw new LispError(`${ctx} needs a key`);
    return v.v.map(asName);
  }
  return [asName(v)];
}

function mapGetPath(m: LispVal, path: string[], ctx: string): LispVal {
  let cur = m;
  for (const k of path) {
    if (isNil(cur)) return nil();
    if (cur.k !== "map") throw new LispError(`${ctx} needs a map`);
    cur = cur.v.get(k) ?? nil();
  }
  return cur;
}

function mapSetPath(m: LispVal, path: string[], val: LispVal, ctx: string): LispVal {
  if (m.k !== "map") throw new LispError(`${ctx} needs a map`);
  const go = (cur: LispVal, i: number): LispVal => {
    if (i === path.length) return val;
    let base: Map<string, LispVal>;
    if (isNil(cur)) base = new Map();
    else if (cur.k === "map") base = new Map(cur.v);
    else throw new LispError(`${ctx}: not a map`);
    const k = path[i]!;
    const next = go(base.get(k) ?? nil(), i + 1);
    if (isNil(next) && i === path.length - 1) base.delete(k);
    else base.set(k, next);
    return { k: "map", v: base };
  };
  return go(m, 0);
}

function getPropPath(h: Host, path: string[], ctx: string): LispVal {
  const root = h.getVar(path[0]!);
  if (path.length === 1) return root;
  if (isNil(root)) return nil();
  return mapGetPath(root, path.slice(1), ctx);
}

function setPropPath(h: Host, path: string[], val: LispVal, ctx: string): LispVal {
  if (path.length === 1) {
    h.setVar(path[0]!, val);
    return val;
  }
  const root = h.getVar(path[0]!);
  const base: LispVal =
    isNil(root) ? { k: "map", v: new Map() } : root;
  h.setVar(path[0]!, mapSetPath(base, path.slice(1), val, ctx));
  return val;
}

function parseInventory(val: LispVal): Map<string, number> {
  if (val.k !== "map") throw new LispError("inventory needs a map");
  const inv = new Map<string, number>();
  for (const [k, v] of val.v) {
    if (isNil(v)) continue;
    if (v.k !== "num") throw new LispError("inventory values need to be numbers");
    inv.set(k, v.v);
  }
  return inv;
}

function fieldToPatch(field: string, val: LispVal): AttrPatch {
  switch (field) {
    case "locked":
      return { locked: truthy(val) };
    case "open":
      return { open: truthy(val) };
    case "disabled":
      return { disabled: truthy(val) };
    case "dest":
      return { dest: isNil(val) ? "" : asName(val) };
    case "label":
      return { label: isNil(val) ? "" : asName(val) };
    case "color":
      return { color: asColor(val, "color") };
    case "variant":
      return { variant: asName(val) };
    case "shape": {
      const parsed = parsePickupShape(asName(val));
      if (!parsed) throw new LispError(`unknown shape: ${asName(val)}`);
      return { shape: parsed };
    }
    case "health":
      return { health: asNum(val, "health") };
    case "ammo":
      return { ammo: asNum(val, "ammo") };
    case "x":
      return { x: asNum(val, "x") };
    case "y":
      return { y: asNum(val, "y") };
    case "angle":
      return { angle: asNum(val, "angle") };
    case "inventory":
      return { inventory: parseInventory(val) };
    case "type":
    case "id":
      throw new LispError(`cannot set ${field}`);
    default:
      throw new LispError(`unknown attr ${field}`);
  }
}

function mergePatch(into: AttrPatch, extra: AttrPatch) {
  Object.assign(into, extra);
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
    case "num":
      return Number.isInteger(v.v) ? String(v.v) : String(v.v);
    case "str":
      return v.v;
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
    case "quote":
      return "'" + printVal(v.v);
    case "unquote":
      return "," + printVal(v.v);
    case "splice":
      return "@" + printVal(v.v);
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
    if (c === "'" || c === "," || c === "@") {
      push("keyword", c);
      i++;
      continue;
    }
    if (c === "`") {
      let j = i + 1;
      let s = "`";
      while (j < n) {
        const ch = src[j]!;
        s += ch;
        if (ch === "\\" && j + 1 < n) {
          s += src[j + 1];
          j += 2;
          continue;
        }
        j++;
        if (ch === "`") break;
      }
      push("symbol", s);
      i = j;
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
    while (j < n && !" \t\n\r();[]',@`".includes(src[j]!)) j++;
    const word = src.slice(i, j);
    if (/^[+-]?\d+(\.\d+)?$/.test(word)) push("number", word);
    else if (/^#[1-9]\d*$/.test(word)) push("keyword", word);
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
  | { ok: false; error: string; start?: number; end?: number };

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
    if (e instanceof LispError) {
      const start = e.start;
      const end = e.end ?? (start != null ? Math.min(src.length, start + 1) : undefined);
      return { ok: false, error: e.message, start, end };
    }
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
  return { k: "comment", v: p.s.slice(start, p.i), span: { start, end: p.i } };
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

function withSpan(start: number, end: number, v: LispVal): LispVal {
  if (isInterned(v)) return { k: "sym", v: v.v, span: { start, end } };
  v.span = { start, end };
  return v;
}

function readDelimited(p: { s: string; i: number }, close: ")" | "]"): LispVal {
  const open = p.i;
  p.i++;
  const xs: LispVal[] = [];
  for (;;) {
    skip(p);
    if (p.i >= p.s.length) throw new LispError(`missing ${close}`, open, p.i);
    const ch = p.s[p.i]!;
    if (ch === close) {
      p.i++;
      break;
    }
    if (ch === ")" || ch === "]") throw new LispError(`unexpected ${ch}`, p.i, p.i + 1);
    xs.push(read(p));
  }
  const inner = close === "]" ? finishBracket(xs) : list(xs);
  const form = attachTrail(p, withSpan(open, p.i, inner));
  if (p.s.slice(open, p.i).includes("\n")) form.broke = true;
  return form;
}

function finishBracket(xs: LispVal[]): LispVal {
  const items = xs.filter((x) => x.k !== "comment");
  if (items.length === 1 && items[0]!.k === "sym" && items[0]!.v === ":") {
    return mapFrom([]);
  }
  const pairs: [string, LispVal][] = [];
  const keySpans = new Map<string, { start: number; end: number }>();
  let i = 0;
  let keys = 0;
  while (i < items.length) {
    const a = items[i]!;
    if (isKeySym(a)) {
      keys += 1;
      const val = items[i + 1];
      if (!val || isKeySym(val)) throw new LispError("map key needs a value");
      const name = a.v.slice(0, -1);
      pairs.push([name, val]);
      if (a.span) keySpans.set(name, a.span);
      i += 2;
    } else {
      i += 1;
    }
  }
  if (keys === 0) return list(xs, true);
  if (keys * 2 !== items.length) {
    throw new LispError("a map cannot mix keys and other items");
  }
  return mapFrom(pairs, keySpans);
}

function read(p: { s: string; i: number }): LispVal {
  skip(p);
  if (p.i >= p.s.length) throw new LispError("unexpected end of script", Math.max(0, p.i - 1), p.i);
  const start = p.i;
  const c = p.s[p.i]!;
  if (c === ";") return readComment(p);
  if (c === "(") return readDelimited(p, ")");
  if (c === "[") return readDelimited(p, "]");
  if (c === ")") throw new LispError("unexpected )", p.i, p.i + 1);
  if (c === "]") throw new LispError("unexpected ]", p.i, p.i + 1);
  if (c === "'" || c === "," || c === "@") {
    p.i++;
    const inner = read(p);
    const node: LispVal =
      c === "'"
        ? { k: "quote", v: inner }
        : c === ","
          ? { k: "unquote", v: inner }
          : { k: "splice", v: inner };
    const end = inner.span?.end ?? p.i;
    return attachTrail(p, withSpan(start, end, node));
  }
  if (c === "`") {
    p.i++;
    let out = "";
    while (p.i < p.s.length) {
      const ch = p.s[p.i]!;
      if (ch === "`") {
        p.i++;
        if (!out) throw new LispError("empty symbol", start, p.i);
        return attachTrail(p, withSpan(start, p.i, { k: "sym", v: out }));
      }
      if (ch === "\\" && p.i + 1 < p.s.length) {
        out += p.s[p.i + 1]!;
        p.i += 2;
        continue;
      }
      out += ch;
      p.i++;
    }
    throw new LispError("unterminated symbol", start, p.i);
  }
  if (c === '"') {
    p.i++;
    let out = "";
    while (p.i < p.s.length) {
      const ch = p.s[p.i]!;
      if (ch === '"') {
        p.i++;
        return attachTrail(p, withSpan(start, p.i, str(out)));
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
    throw new LispError("unterminated string", start, p.i);
  }
  let j = p.i + 1;
  while (j < p.s.length && !" \t\n\r();[]',@`".includes(p.s[j]!)) j++;
  const word = p.s.slice(p.i, j);
  p.i = j;
  if (word === "true" || word === "false" || word === "nil") {
    return attachTrail(p, withSpan(start, j, { k: "sym", v: word }));
  }
  if (/^[+-]?\d+(\.\d+)?$/.test(word)) return attachTrail(p, withSpan(start, j, num(Number(word))));
  if (!word) throw new LispError("empty token", start, j);
  return attachTrail(p, withSpan(start, j, sym(word)));
}

export function formatLisp(src: string): { ok: true; text: string } | { ok: false; error: string } {
  const parsed = parseLisp(src);
  if (!parsed.ok) return parsed;
  if (!parsed.forms.length) return { ok: true, text: "" };
  fmtSrc = src;
  try {
    let text = formatVal(parsed.forms[0]!, 0);
    for (let i = 1; i < parsed.forms.length; i++) {
      const prev = parsed.forms[i - 1]!;
      const form = parsed.forms[i]!;
      const sep = prev.k === "comment" ? "\n" : form.blank ? "\n\n" : "\n";
      text += sep + formatVal(form, 0);
    }
    return { ok: true, text: text + "\n" };
  } finally {
    fmtSrc = "";
  }
}

const MAX_INLINE = 72;

let fmtSrc = "";

function originalAtom(v: LispVal): string | undefined {
  if (!fmtSrc || !v.span) return undefined;
  const s = fmtSrc.slice(v.span.start, v.span.end);
  return s || undefined;
}

const BODY_SPECIALS = new Set([
  "on",
  "def",
  "fn",
  "let",
  "if",
  "after",
  "pipe",
  "let!",
  "defm",
]);

export type IfClause = { test: LispVal | null; not: boolean; body: LispVal[] };

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

export function parseIfArgs(args: LispVal[]): IfClause[] {
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

function fnIsMulti(v: { k: "list"; v: LispVal[] }): boolean {
  if (v.v[0]?.k !== "sym" || v.v[0].v !== "fn") return false;
  try {
    const parsed = parseFn(v.v.slice(1));
    return parsed.kind === "long" && parsed.clauses.length > 1;
  } catch {
    return false;
  }
}

function hasBreakComment(v: LispVal): boolean {
  if (v.k === "comment") return true;
  if (v.k === "quote" || v.k === "unquote" || v.k === "splice") {
    return Boolean(v.v.cmt) || hasBreakComment(v.v);
  }
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
  if (v.k === "quote" || v.k === "unquote" || v.k === "splice") {
    const mark = v.k === "quote" ? "'" : v.k === "unquote" ? "," : "@";
    return suffixCmt(v, prefixLines(mark, formatVal(v.v, indent)));
  }
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
  if (hasBreakComment(v) || (BODY_SPECIALS.has(headName) && v.broke) || fnIsMulti(v)) {
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

  if (headName === "def" || headName === "defm") {
    const head = v.v[1] ? formatInline(v.v[1]) : "()";
    const rest = v.v.slice(2);
    if (rest.length === 0) return `(${headName} ${head})`;
    const lines = [`(${headName} ${head}`];
    for (const item of rest) {
      pushPrefixed(lines, body, formatVal(item, indent + 1));
    }
    return closeOn(lines);
  }

  if (headName === "fn") {
    const rest = v.v.slice(1);
    let parsed: FnParsed | undefined;
    try {
      parsed = parseFn(rest);
    } catch {
      parsed = undefined;
    }
    if (parsed?.kind === "long") {
      const lines: string[] = [];
      parsed.clauses.forEach((c, i) => {
        const sig = c.paramsForm ? formatInline(c.paramsForm) : "()";
        if (i === 0) lines.push(`(fn ${sig}`);
        else lines.push(` fn ${sig}`);
        for (const item of c.body) {
          pushPrefixed(lines, body, formatVal(item, indent + 1));
        }
      });
      if (!lines.length) return "(fn)";
      return closeOn(lines);
    }
    const sig = v.v[1] ? " " + formatInline(v.v[1]) : "";
    const after = v.v.slice(2);
    if (after.length === 0) return `(${headName}${sig})`;
    const lines = [`(${headName}${sig}`];
    for (const item of after) {
      pushPrefixed(lines, body, formatVal(item, indent + 1));
    }
    return closeOn(lines);
  }

  if (headName === "let" || headName === "let!") {
    const binds = v.v[1];
    const bindStr = binds ? formatVal(binds, indent + 1) : "[:]";
    const lines: string[] = [];
    pushPrefixed(lines, `(${headName} `, bindStr);
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
  if (v.k === "quote" || v.k === "unquote" || v.k === "splice") {
    const mark = v.k === "quote" ? "'" : v.k === "unquote" ? "," : "@";
    return mark + formatInline(v.v);
  }
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
  if (v.k === "quote" || v.k === "unquote" || v.k === "splice") {
    const mark = v.k === "quote" ? "'" : v.k === "unquote" ? "," : "@";
    return mark + formatCore(v.v);
  }
  if (v.k === "list") return formatInline(v);
  if (v.k === "map") return formatMap(v, 0);
  return formatAtomCore(v);
}

function formatAtomCore(v: LispVal): string {
  switch (v.k) {
    case "num":
      return String(v.v);
    case "str":
      return JSON.stringify(v.v);
    case "sym":
      return originalAtom(v) ?? (reservedLit(v) ? v.v : formatSymName(v.v));
    case "fn":
      return "#<fn>";
    case "comment":
      return v.v;
    case "list":
      return formatInline(v);
    case "map":
      return formatMap(v, 0);
    case "quote":
      return "'" + formatAtomCore(v.v);
    case "unquote":
      return "," + formatAtomCore(v.v);
    case "splice":
      return "@" + formatAtomCore(v.v);
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
  health?: number;
  ammo?: number;
  inventory?: Map<string, number>;
  x?: number;
  y?: number;
  angle?: number;
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
  getVar: (key: string) => LispVal;
  setVar: (key: string, val: LispVal) => void;
  setAttr: (id: string, patch: AttrPatch) => boolean;
  getAttr: (id: string) => LispVal | undefined;
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
  nameForm?: LispVal;
};

export type Program = {
  handlers: Handler[];
  boot: LispVal[];
  fns: NamedFn[];
  macros: NamedFn[];
};

const BUDGET = 8000;

export function compileProgram(src: string): { ok: true; program: Program } | { ok: false; error: string } {
  const parsed = parseLisp(src);
  if (!parsed.ok) return parsed;
  try {
    return { ok: true, program: compileForms(parsed.forms) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid script" };
  }
}

export function compileForms(forms: LispVal[]): Program {
  const onMap = new Map<string, Clause[]>();
  const fnMap = new Map<string, Clause[]>();
  const fnNameForm = new Map<string, LispVal>();
  const macroMap = new Map<string, Clause[]>();
  const macroNameForm = new Map<string, LispVal>();
  const eventForm = new Map<string, LispVal>();
  const boot: LispVal[] = [];
  let last: { t: "on" | "fn" | "macro"; name: string } | null = null;
  const breakAdj = () => {
    last = null;
  };

  const addFn = (
    map: Map<string, Clause[]>,
    kind: "fn" | "macro",
    name: string,
    params: Params,
    body: LispVal[],
    paramsForm: LispVal,
    nameForm: LispVal,
    adj: boolean,
  ) => {
    if (adj && map.has(name) && !(last?.t === kind && last.name === name)) {
      const who = kind === "macro" ? "defm" : "def";
      throw new LispError(`(${who} ${name} ...) must sit next to the last (${who} ${name} ...)`);
    }
    const list = map.get(name) ?? [];
    if (unreachableBy(list, params)) {
      throw new LispError(`unreachable clause for ${name}`);
    }
    list.push({ params, body, paramsForm });
    map.set(name, list);
    last = { t: kind, name };
    if (kind === "fn") fnNameForm.set(name, nameForm);
    else macroNameForm.set(name, nameForm);
  };

  for (const form of forms) {
    if (form.k === "comment") continue;
    let got: DefHead | null;
    if (form.k === "list" && form.v[0]?.k === "sym" && form.v[0].v === "on") {
      const ev = form.v[1];
      if (!ev || ev.k !== "sym") {
        throw new LispError("(on event (args...) body) needs an event name");
      }
      const paramsForm = form.v[2];
      if (!paramsForm || paramsForm.k !== "list") {
        throw new LispError("(on event (args...) body) needs a parameter list");
      }
      if (onMap.has(ev.v) && !(last?.t === "on" && last.name === ev.v)) {
        throw new LispError(`(on ${ev.v} ...) must sit next to the last (on ${ev.v} ...)`);
      }
      const params = parseParams(paramsForm, "on");
      const list = onMap.get(ev.v) ?? [];
      if (unreachableBy(list, params)) {
        throw new LispError(`unreachable clause for ${ev.v}`);
      }
      list.push({ params, body: form.v.slice(3), paramsForm });
      onMap.set(ev.v, list);
      eventForm.set(ev.v, ev);
      last = { t: "on", name: ev.v };
      continue;
    }
    if ((got = asDefForm(form, "def"))) {
      if (macroMap.has(got.name)) {
        throw new LispError(`${got.name} cannot be both a function and a macro`);
      }
      addFn(fnMap, "fn", got.name, got.params, got.body, got.paramsForm, got.nameForm, true);
      continue;
    }
    if ((got = asDefForm(form, "defm"))) {
      if (fnMap.has(got.name)) {
        throw new LispError(`${got.name} cannot be both a function and a macro`);
      }
      if (KEYWORDS.has(got.name) || BUILTINS.has(got.name)) {
        throw new LispError(`cannot redefine ${got.name}`);
      }
      addFn(macroMap, "macro", got.name, got.params, got.body, got.paramsForm, got.nameForm, true);
      continue;
    }
    breakAdj();
    boot.push(form);
  }

  const env = makeEnv();
  const fns: NamedFn[] = [];
  for (const [name, clauses] of fnMap) {
    fns.push({ name, clauses, nameForm: fnNameForm.get(name) });
  }
  const macros: NamedFn[] = [];
  for (const [name, clauses] of macroMap) {
    macros.push({ name, clauses, nameForm: macroNameForm.get(name) });
  }
  installFns(fns, env);
  const macroTable = toMacroTable(macros);
  const ctx: Ctx = {
    budget: BUDGET,
    host: dummyHost(),
    macros: macroTable,
    macroEnv: env,
  };

  const expandBody = (clauses: Clause[]) => {
    for (const c of clauses) {
      c.body = c.body.map((b) => expandVal(b, env, ctx));
    }
  };

  const takeExpanded = (form: LispVal) => {
    let got: DefHead | null;
    if ((got = asDefForm(form, "def"))) {
      if (macroTable.has(got.name) || macroMap.has(got.name)) {
        throw new LispError(`${got.name} cannot be both a function and a macro`);
      }
      addFn(fnMap, "fn", got.name, got.params, got.body, got.paramsForm, got.nameForm, false);
      env.vars.set(got.name, makeFnVal(fnMap.get(got.name)!, env));
      return true;
    }
    if ((got = asDefForm(form, "defm"))) {
      if (fnMap.has(got.name)) {
        throw new LispError(`${got.name} cannot be both a function and a macro`);
      }
      addFn(macroMap, "macro", got.name, got.params, got.body, got.paramsForm, got.nameForm, false);
      macroTable.set(got.name, macroMap.get(got.name)!);
      return true;
    }
    if (form.k === "list" && form.v[0]?.k === "sym" && form.v[0].v === "on") {
      const ev = form.v[1];
      if (!ev || ev.k !== "sym") {
        throw new LispError("(on event (args...) body) needs an event name");
      }
      const paramsForm = form.v[2];
      if (!paramsForm || paramsForm.k !== "list") {
        throw new LispError("(on event (args...) body) needs a parameter list");
      }
      const params = parseParams(paramsForm, "on");
      const list = onMap.get(ev.v) ?? [];
      if (unreachableBy(list, params)) {
        throw new LispError(`unreachable clause for ${ev.v}`);
      }
      list.push({ params, body: form.v.slice(3), paramsForm });
      onMap.set(ev.v, list);
      return true;
    }
    return false;
  };

  const newBoot: LispVal[] = [];
  last = null;
  for (const form of boot) {
    const ex = expandVal(form, env, ctx);
    if (takeExpanded(ex)) continue;
    newBoot.push(ex);
  }
  for (const clauses of fnMap.values()) expandBody(clauses);
  for (const clauses of onMap.values()) expandBody(clauses);

  const handlers: Handler[] = [];
  for (const [event, clauses] of onMap) handlers.push({ event, clauses });
  const outFns: NamedFn[] = [];
  for (const [name, clauses] of fnMap) {
    outFns.push({ name, clauses, nameForm: fnNameForm.get(name) });
  }
  const outMacros: NamedFn[] = [];
  for (const [name, clauses] of macroMap) {
    outMacros.push({ name, clauses, nameForm: macroNameForm.get(name) });
  }
  return { handlers, boot: newBoot, fns: outFns, macros: outMacros };
}

export type DefHead = {
  name: string;
  nameForm: LispVal;
  params: Params;
  paramsForm: LispVal;
  body: LispVal[];
  headForm: LispVal;
};

/** `(def (name args…) body…)` / `(defm (name args…) body…)`. Null if the head is not that keyword. */
export function asDefForm(form: LispVal, kw: "def" | "defm"): DefHead | null {
  if (form.k !== "list" || form.v[0]?.k !== "sym" || form.v[0].v !== kw) return null;
  return parseDefHead(form, kw);
}

export function parseDefHead(form: LispVal, kw: "def" | "defm"): DefHead {
  const hint = `(${kw} (name args...) body)`;
  if (form.k !== "list" || form.v[0]?.k !== "sym" || form.v[0].v !== kw) {
    throw new LispError(hint);
  }
  const head = form.v[1];
  if (!head || head.k !== "list" || head.vec) {
    throw new LispError(hint);
  }
  const nameForm = head.v[0];
  if (!nameForm || nameForm.k !== "sym" || !nameForm.v || nameForm.v.endsWith(":")) {
    throw new LispError(`${hint} needs a name`);
  }
  if (nameForm.v === "true" || nameForm.v === "false" || nameForm.v === "nil") {
    throw new LispError(`cannot redefine ${nameForm.v}`);
  }
  const paramsForm: LispVal = { k: "list", v: head.v.slice(1), span: head.span };
  return {
    name: nameForm.v,
    nameForm,
    params: parseParams(paramsForm, kw),
    paramsForm,
    body: form.v.slice(2),
    headForm: head,
  };
}

function isLit(v: LispVal): boolean {
  return v.k === "num" || v.k === "str" || reservedLit(v);
}

function asPattern(v: LispVal): Pattern {
  if (v.k === "sym") {
    if (reservedLit(v)) return { k: "lit", value: internSym(v.v) };
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
  if (form.vec) throw new LispError(`${ctx} needs a parameter list in (...)`);
  let mode: "pos" | "key" | null = null;
  const pos: Pattern[] = [];
  const keys: { name: string; pat: Pattern }[] = [];
  const seen: string[] = [];
  let rest: string | undefined;
  for (let i = 0; i < form.v.length; ) {
    const p = form.v[i]!;
    if (p.k === "comment") {
      i += 1;
      continue;
    }
    if (p.k === "splice") {
      if (ctx !== "defm") {
        throw new LispError("only defm can use @rest");
      }
      if (mode === "key") {
        throw new LispError("do not mix positional and keyword parameters");
      }
      if (rest) throw new LispError("only one @rest parameter is allowed");
      if (p.v.k !== "sym" || !p.v.v || p.v.v.endsWith(":")) {
        throw new LispError("@rest needs a name");
      }
      if (i !== form.v.length - 1 && form.v.slice(i + 1).some((x) => x.k !== "comment")) {
        throw new LispError("@rest must be last");
      }
      mode = "pos";
      rest = p.v.v;
      if (seen.includes(rest)) throw new LispError(`duplicate parameter ${rest}`);
      seen.push(rest);
      i += 1;
      continue;
    }
    if (rest) throw new LispError("@rest must be last");
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
      if (next && !isKeySym(next) && next.k !== "comment") {
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
  return { k: "pos", pats: pos, rest };
}

type CallParts = { pos: LispVal[]; keys: Map<string, LispVal> };

export function parseCallRaw(raw: LispVal[]): { pos: LispVal[]; keys: { name: string; raw: LispVal }[] } {
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
  const pos: LispVal[] = [];
  const keys = new Map<string, LispVal>();
  let keyed = false;
  for (let i = 0; i < raw.length; ) {
    const a = raw[i]!;
    if (a.k === "comment") {
      i += 1;
      continue;
    }
    if (a.k === "splice") {
      if (keyed) throw new LispError("positional argument after key:");
      pos.push(...asSpliceList(spliceInner(a.v, env, ctx, false), a));
      i += 1;
      continue;
    }
    if (a.k === "sym" && a.v.endsWith(":") && a.v.length > 1) {
      keyed = true;
      const name = a.v.slice(0, -1);
      const val = raw[i + 1];
      if (!val) throw new LispError(`missing value for ${a.v}`);
      if (keys.has(name)) throw new LispError(`duplicate ${a.v}`);
      keys.set(name, evalVal(val, env, ctx));
      i += 2;
      continue;
    }
    if (keyed) throw new LispError("positional argument after key:");
    pos.push(evalVal(a, env, ctx));
    i += 1;
  }
  return { pos, keys };
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
    if (!earlier.rest) {
      if (later.rest) return false;
      if (earlier.pats.length !== later.pats.length) return false;
      return earlier.pats.every((p, i) => patCovers(p, later.pats[i]));
    }
    if (later.pats.length < earlier.pats.length) return false;
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

const SLOT_RE = /^#([1-9]\d*)$/;

export function isFnSep(v: LispVal): boolean {
  return v.k === "sym" && v.v === "fn";
}

function isFnCall(v: LispVal): boolean {
  if (v.k !== "list" || v.vec) return false;
  const xs = v.v.filter((x) => x.k !== "comment");
  return xs[0]?.k === "sym" && xs[0].v === "fn";
}

function walkSlots(
  v: LispVal,
  onSlot: (name: string, node: LispVal) => void,
) {
  if (v.k === "comment") return;
  if (v.k === "sym") {
    if (v.v.startsWith("#")) onSlot(v.v, v);
    return;
  }
  if (v.k === "quote" || v.k === "unquote" || v.k === "splice") {
    walkSlots(v.v, onSlot);
    return;
  }
  if (v.k === "list") {
    if (isFnCall(v)) return;
    for (const x of v.v) walkSlots(x, onSlot);
    return;
  }
  if (v.k === "map") {
    for (const x of v.v.values()) walkSlots(x, onSlot);
  }
}

function maxSlot(args: LispVal[]): number {
  let max = 0;
  for (const a of args) {
    walkSlots(a, (name, node) => {
      if (!SLOT_RE.test(name)) {
        throw new LispError(`bad slot ${name}`, node.span?.start, node.span?.end);
      }
      max = Math.max(max, Number(name.slice(1)));
    });
  }
  return max;
}

function hasNestedFn(args: LispVal[]): boolean {
  const walk = (v: LispVal): boolean => {
    if (v.k === "quote" || v.k === "unquote" || v.k === "splice") return walk(v.v);
    if (v.k === "list") {
      if (isFnCall(v)) return true;
      return v.v.some(walk);
    }
    if (v.k === "map") return [...v.v.values()].some(walk);
    return false;
  };
  return args.some(walk);
}

function slotParams(n: number): Params {
  const pats: Pattern[] = [];
  for (let i = 1; i <= n; i++) pats.push({ k: "bind", name: `#${i}` });
  return { k: "pos", pats };
}

function shortFnBody(args: LispVal[]): LispVal[] {
  const xs = args.filter((a) => a.k !== "comment");
  if (xs.length <= 1) return xs;
  return [list(xs)];
}

export type FnParsed = {
  kind: "short" | "long";
  clauses: { params: Params; body: LispVal[]; paramsForm?: LispVal }[];
};

export function parseFn(args: LispVal[]): FnParsed {
  const n = maxSlot(args);
  if (n > 0) {
    if (hasNestedFn(args)) {
      throw new LispError("a short fn cannot contain another fn");
    }
    return {
      kind: "short",
      clauses: [{ params: slotParams(n), body: shortFnBody(args) }],
    };
  }
  if (!args.length) throw new LispError("(fn (args...) body)");
  const clauses: FnParsed["clauses"] = [];
  let i = 0;
  while (i < args.length) {
    const paramsForm = args[i];
    if (!paramsForm || paramsForm.k !== "list") {
      throw new LispError("(fn (args...) body)");
    }
    const params = parseParams(paramsForm, "fn");
    i += 1;
    const body: LispVal[] = [];
    while (i < args.length && !isFnSep(args[i]!)) {
      body.push(args[i]!);
      i += 1;
    }
    if (unreachableBy(clauses, params)) {
      throw new LispError("unreachable clause");
    }
    clauses.push({ params, body, paramsForm });
    if (i < args.length && isFnSep(args[i]!)) {
      i += 1;
      if (i >= args.length) throw new LispError("fn after fn needs a parameter list");
    }
  }
  return { kind: "long", clauses };
}

function bindPat(pat: Pattern, val: LispVal, env: Env): boolean {
  if (pat.k === "lit") return eq(pat.value, val);
  env.vars.set(pat.name, val);
  return true;
}

function tryBind(params: Params, call: CallParts, env: Env): boolean {
  if (params.k === "pos") {
    if (call.keys.size) return false;
    if (params.rest) {
      if (call.pos.length < params.pats.length) return false;
      for (let i = 0; i < params.pats.length; i++) {
        if (!bindPat(params.pats[i]!, call.pos[i]!, env)) return false;
      }
      env.vars.set(params.rest, list(call.pos.slice(params.pats.length), true));
      return true;
    }
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
  macros: Map<string, Clause[]> = new Map(),
): LispVal {
  const ctx: Ctx = { budget: BUDGET, host, macros, macroEnv: env };
  let last: LispVal = nil();
  for (const f of forms) last = evalVal(f, env, ctx);
  return last;
}

type Ctx = {
  budget: number;
  host: Host;
  macros: Map<string, Clause[]>;
  macroEnv: Env;
};

export function toMacroTable(macros: NamedFn[]): Map<string, Clause[]> {
  const m = new Map<string, Clause[]>();
  for (const x of macros) m.set(x.name, x.clauses);
  return m;
}

function dummyHost(): Host {
  return {
    say: () => {},
    getVar: () => nil(),
    setVar: () => {},
    setAttr: () => false,
    getAttr: () => undefined,
    setWall: () => false,
    getWall: () => undefined,
    spawn: () => null,
    remove: () => false,
    teleport: () => false,
    win: () => {},
    lose: () => {},
    after: () => {},
  };
}

function collectImported(v: LispVal, into: Set<LispVal>) {
  if (into.has(v)) return;
  into.add(v);
  if (v.k === "list") {
    for (const x of v.v) collectImported(x, into);
    return;
  }
  if (v.k === "map") {
    for (const x of v.v.values()) collectImported(x, into);
    return;
  }
  if (v.k === "quote" || v.k === "unquote" || v.k === "splice") {
    collectImported(v.v, into);
  }
}

let hygSeq = 0;
function freshName(name: string): string {
  hygSeq += 1;
  return `${name}#m${hygSeq}`;
}

function hygienic(
  v: LispVal,
  imported: Set<LispVal>,
  subst: Map<string, string>,
): LispVal {
  if (imported.has(v)) return v;
  if (v.k === "sym") {
    const n = subst.get(v.v);
    return n ? { ...v, v: n } : v;
  }
  if (v.k === "quote" || v.k === "unquote" || v.k === "splice") {
    return { ...v, v: hygienic(v.v, imported, subst) };
  }
  if (v.k === "map") {
    const m = new Map<string, LispVal>();
    for (const [k, val] of v.v) m.set(k, hygienic(val, imported, subst));
    return { ...v, v: m };
  }
  if (v.k !== "list") return v;
  const head = v.v[0];
  const name = head?.k === "sym" ? head.v : "";
  if ((name === "let" || name === "let!") && v.v.length >= 1) {
    const exported = name === "let!";
    const binds = v.v[1];
    let next = subst;
    let newBinds = binds;
    if (binds && !imported.has(binds) && binds.k === "map" && !exported) {
      next = new Map(subst);
      const m = new Map<string, LispVal>();
      for (const [k, val] of binds.v) {
        const nk = freshName(k);
        next.set(k, nk);
        m.set(nk, hygienic(val, imported, subst));
      }
      newBinds = { ...binds, v: m };
    } else if (binds) {
      newBinds = hygienic(binds, imported, subst);
    }
    const body = v.v.slice(2).map((x) => hygienic(x, imported, next));
    const newHead = head && head.k === "sym" ? { ...head, v: "let" } : sym("let");
    return { ...v, v: [newHead, ...(newBinds ? [newBinds] : []), ...body] };
  }
  if (name === "fn" || name === "def" || name === "defm" || name === "on") {
    return hygienicFnLike(v, imported, subst, name);
  }
  return { ...v, v: v.v.map((x) => hygienic(x, imported, subst)) };
}

function renameParamForm(
  form: LispVal,
  imported: Set<LispVal>,
  subst: Map<string, string>,
): { form: LispVal; subst: Map<string, string> } {
  if (imported.has(form) || form.k !== "list") {
    return { form: hygienic(form, imported, subst), subst };
  }
  const next = new Map(subst);
  const out: LispVal[] = [];
  for (const p of form.v) {
    if (p.k === "splice" && p.v.k === "sym") {
      const nk = freshName(p.v.v);
      next.set(p.v.v, nk);
      out.push({ ...p, v: { ...p.v, v: nk } });
      continue;
    }
    if (p.k === "sym" && !p.v.endsWith(":")) {
      if (reservedLit(p)) {
        out.push(p);
        continue;
      }
      const nk = freshName(p.v);
      next.set(p.v, nk);
      out.push({ ...p, v: nk });
      continue;
    }
    if (isKeySym(p)) {
      const raw = p.v.slice(0, -1);
      const nk = freshName(raw);
      next.set(raw, nk);
      out.push({ ...p, v: `${nk}:` });
      continue;
    }
    out.push(hygienic(p, imported, subst));
  }
  return { form: { ...form, v: out }, subst: next };
}

function hygienicFnLike(
  v: Extract<LispVal, { k: "list" }>,
  imported: Set<LispVal>,
  subst: Map<string, string>,
  name: string,
): LispVal {
  const xs = v.v;
  if (name === "fn") {
    try {
      const parsed = parseFn(xs.slice(1));
      const rebuilt: LispVal[] = [xs[0]!];
      for (const c of parsed.clauses) {
        if (c.paramsForm) {
          const r = renameParamForm(c.paramsForm, imported, subst);
          rebuilt.push(r.form);
          rebuilt.push(...c.body.map((b) => hygienic(b, imported, r.subst)));
        } else {
          rebuilt.push(...c.body.map((b) => hygienic(b, imported, subst)));
        }
        rebuilt.push(sym("fn"));
      }
      const last = rebuilt[rebuilt.length - 1];
      if (last?.k === "sym" && last.v === "fn") {
        rebuilt.pop();
      }
      return { ...v, v: rebuilt };
    } catch {
      return { ...v, v: xs.map((x) => hygienic(x, imported, subst)) };
    }
  }
  const nm = xs[1];
  const params = name === "on" ? xs[2] : undefined;
  const head = xs[0] ? hygienic(xs[0], imported, subst) : xs[0];
  if (name === "def" || name === "defm") {
    if (!nm || nm.k !== "list" || !nm.v.length) {
      return { ...v, v: xs.map((x) => hygienic(x, imported, subst)) };
    }
    const nameForm = nm.v[0]!;
    const paramsOnly: LispVal = { k: "list", v: nm.v.slice(1), span: nm.span };
    const r = renameParamForm(paramsOnly, imported, subst);
    const renamed = r.form.k === "list" ? r.form.v : [];
    const newHead: LispVal = { ...nm, v: [nameForm, ...renamed] };
    const body = xs.slice(2).map((b) => hygienic(b, imported, r.subst));
    return { ...v, v: [head!, newHead, ...body] };
  }
  const keptName = nm;
  if (!params) {
    return { ...v, v: xs.map((x) => hygienic(x, imported, subst)) };
  }
  const r = renameParamForm(params, imported, subst);
  const body = xs.slice(3).map((b) => hygienic(b, imported, r.subst));
  return { ...v, v: [head!, keptName!, r.form, ...body] };
}

function applyMacro(
  name: string,
  clauses: Clause[],
  raw: LispVal[],
  ctx: Ctx,
  call: LispVal,
): LispVal {
  let parts: { pos: LispVal[]; keys: Map<string, LispVal> };
  try {
    const parsed = parseCallRaw(raw);
    parts = {
      pos: parsed.pos,
      keys: new Map(parsed.keys.map((k) => [k.name, k.raw])),
    };
  } catch (e) {
    if (e instanceof LispError && e.start == null && call.span) {
      e.start = call.span.start;
      e.end = call.span.end;
    }
    throw e;
  }
  const allPos = clauses.every((c) => c.params.k === "pos");
  const allKey = clauses.every((c) => c.params.k === "key");
  if (allPos && parts.keys.size) {
    throw new LispError("this macro does not take keyword arguments", call.span?.start, call.span?.end);
  }
  if (allKey && parts.pos.length) {
    throw new LispError("this macro needs key: arguments", call.span?.start, call.span?.end);
  }
  for (const clause of clauses) {
    const child = makeEnv(ctx.macroEnv);
    if (!tryBind(clause.params, parts, child)) continue;
    let last: LispVal = nil();
    for (const b of clause.body) last = evalVal(b, child, ctx);
    const imported = new Set<LispVal>();
    for (const a of raw) collectImported(a, imported);
    hygSeq = 0;
    const out = hygienic(last, imported, new Map());
    if (out.span == null && call.span) {
      if (isInterned(out)) return { k: "sym", v: out.v, span: call.span };
      out.span = call.span;
    }
    return out;
  }
  throw new LispError(`no matching clause for ${name}`, call.span?.start, call.span?.end);
}

function expandVal(v: LispVal, env: Env, ctx: Ctx): LispVal {
  if (--ctx.budget <= 0) throw new LispError("script ran too long");
  if (v.k === "comment" || v.k === "num" || v.k === "str" || v.k === "fn") {
    return v;
  }
  if (v.k === "quote" || v.k === "unquote" || v.k === "splice") return v;
  if (v.k === "sym") return v;
  if (v.k === "map") {
    const out = new Map<string, LispVal>();
    for (const [k, val] of v.v) out.set(k, expandVal(val, env, ctx));
    return { ...v, v: out };
  }
  if (v.k !== "list") return v;
  if (v.vec) {
    return { ...v, v: v.v.map((x) => expandVal(x, env, ctx)) };
  }
  const xs = v.v.filter((x) => x.k !== "comment");
  if (!xs.length) return v;
  const head = xs[0]!;
  if (head.k === "sym") {
    const clauses = ctx.macros.get(head.v);
    if (clauses) {
      const expanded = applyMacro(head.v, clauses, xs.slice(1), ctx, v);
      return expandVal(expanded, env, ctx);
    }
  }
  return { ...v, v: v.v.map((x) => expandVal(x, env, ctx)) };
}

function evalVal(v: LispVal, env: Env, ctx: Ctx): LispVal {
  if (--ctx.budget <= 0) throw new LispError("script ran too long");
  if (v.k === "comment") return nil();
  if (v.k === "num" || v.k === "str" || v.k === "fn") {
    return v;
  }
  if (v.k === "quote") return evalQuote(v.v, env, ctx, 1);
  if (v.k === "unquote") {
    throw new LispError("comma not inside quote", v.span?.start, v.span?.end);
  }
  if (v.k === "splice") {
    throw new LispError("@ needs a list to insert into", v.span?.start, v.span?.end);
  }
  if (v.k === "sym") {
    if (reservedLit(v)) return internSym(v.v);
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
    return list(evalSpread(v.v, env, ctx, false), true);
  }
  const xs = v.v.filter((x) => x.k !== "comment");
  if (!xs.length) return nil();
  const head = xs[0]!;
  if (head.k !== "splice" && head.k === "sym") {
    const sf = special(head.v, xs.slice(1), env, ctx);
    if (sf !== undefined) return sf;
    const mac = ctx.macros.get(head.v);
    if (mac) {
      return evalVal(expandVal(v, env, ctx), env, ctx);
    }
    if (BUILTINS.has(head.v) && head.v !== "true" && head.v !== "false" && head.v !== "nil") {
      return callBuiltin(head.v, evalCallRaw(xs.slice(1), env, ctx), ctx);
    }
  }
  if (head.k === "splice") {
    const parts = evalSpread(xs, env, ctx, false);
    if (!parts.length) return nil();
    return applyFn(parts[0]!, { pos: parts.slice(1), keys: new Map() }, env, ctx);
  }
  const fn = evalVal(head, env, ctx);
  return applyFn(fn, evalCallRaw(xs.slice(1), env, ctx), env, ctx);
}

function spliceInner(v: LispVal, env: Env, ctx: Ctx, inQuote: boolean): LispVal {
  if (v.k === "unquote") {
    if (!inQuote) {
      throw new LispError("comma not inside quote", v.span?.start, v.span?.end);
    }
    return evalVal(v.v, env, ctx);
  }
  return evalVal(v, env, ctx);
}

function asSpliceList(v: LispVal, at?: LispVal): LispVal[] {
  if (v.k !== "list") {
    throw new LispError("@ needs a list", at?.span?.start, at?.span?.end);
  }
  return v.v.filter((x) => x.k !== "comment");
}

function evalSpread(
  items: LispVal[],
  env: Env,
  ctx: Ctx,
  inQuote: boolean,
): LispVal[] {
  const out: LispVal[] = [];
  for (const a of items) {
    if (a.k === "comment") continue;
    if (a.k === "splice") {
      out.push(...asSpliceList(spliceInner(a.v, env, ctx, inQuote), a));
    } else {
      out.push(evalVal(a, env, ctx));
    }
  }
  return out;
}

function evalQuote(v: LispVal, env: Env, ctx: Ctx, depth: number): LispVal {
  if (v.k === "unquote") {
    if (depth === 1) return evalVal(v.v, env, ctx);
    return { k: "unquote", v: evalQuote(v.v, env, ctx, depth - 1) };
  }
  if (v.k === "quote") {
    return { k: "quote", v: evalQuote(v.v, env, ctx, depth + 1) };
  }
  if (v.k === "splice") {
    if (depth !== 1) {
      return { k: "splice", v: evalQuote(v.v, env, ctx, depth) };
    }
    const xs = asSpliceList(spliceInner(v.v, env, ctx, true), v);
    return list(xs);
  }
  if (v.k === "list") {
    const out: LispVal[] = [];
    for (const item of v.v) {
      if (item.k === "comment") {
        out.push(item);
        continue;
      }
      if (item.k === "splice" && depth === 1) {
        out.push(...asSpliceList(spliceInner(item.v, env, ctx, true), item));
      } else {
        out.push(evalQuote(item, env, ctx, depth));
      }
    }
    return list(out, v.vec);
  }
  if (v.k === "map") {
    const out = new Map<string, LispVal>();
    for (const [k, val] of v.v) out.set(k, evalQuote(val, env, ctx, depth));
    return { k: "map", v: out };
  }
  if (v.k === "sym") return internSym(v.v);
  return v;
}

function special(
  name: string,
  args: LispVal[],
  env: Env,
  ctx: Ctx,
): LispVal | undefined {
  switch (name) {
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
    case "let!":
      return evalLet(args, env, ctx);
    case "defm":
      throw new LispError("(defm ...) only works at the top of a script");
    case "pipe":
      return evalPipe(args, env, ctx);
    case "eval": {
      if (args.length !== 1) throw new LispError("eval needs one form");
      return evalVal(evalVal(args[0]!, env, ctx), env, ctx);
    }
    case "after": {
      const sec = asNum(evalVal(args[0] ?? num(0), env, ctx), "after");
      const body = args.slice(1);
      const later: Ctx = {
        budget: BUDGET,
        host: ctx.host,
        macros: ctx.macros,
        macroEnv: ctx.macroEnv,
      };
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
  const parsed = parseFn(args);
  return makeFnVal(
    parsed.clauses.map((c) => ({ params: c.params, body: c.body })),
    env,
  );
}

function evalDef(args: LispVal[], env: Env, ctx: Ctx): LispVal {
  const form: LispVal = { k: "list", v: [sym("def"), ...args] };
  const d = parseDefHead(form, "def");
  const fn = makeFnVal([{ params: d.params, body: d.body }], env);
  env.vars.set(d.name, fn);
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
  return { k: "quote", v };
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
  if (id && asName(id) === PLAYER_ID) {
    throw new LispError(`id "${PLAYER_ID}" is reserved`);
  }
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

function evalGetAttr(args: LispVal[], h: Host): LispVal {
  if (!args.length) throw new LispError("get-attr needs an id");
  const full = h.getAttr(asName(args[0]!)) ?? nil();
  if (args.length === 1) return full;
  if (isNil(full)) return nil();
  return mapGetPath(full, asPath(args[1]!, "get-attr"), "get-attr");
}

function evalSetAttr(args: LispVal[], h: Host): LispVal {
  if (!args.length) throw new LispError("set-attr needs an id");
  const ids = asIdList(args[0]!);
  if (args.length === 2 && args[1]?.k === "map") {
    const attrs = args[1].v;
    const patch: AttrPatch = {};
    if (!attrs.size) throw new LispError("set-attr needs a field");
    for (const [k, val] of attrs) mergePatch(patch, fieldToPatch(k, val));
    let ok = true;
    for (const name of ids) {
      if (!h.setAttr(name, patch)) ok = false;
    }
    return bool(ok);
  }
  if (args.length === 3) {
    const path = asPath(args[1]!, "set-attr");
    const val = args[2]!;
    let ok = true;
    for (const name of ids) {
      if (!setAttrPath(h, name, path, val)) ok = false;
    }
    return bool(ok);
  }
  throw new LispError("set-attr needs a map of fields, or a key and a value");
}

function setAttrPath(h: Host, id: string, path: string[], val: LispVal): boolean {
  if (path.length === 1) return h.setAttr(id, fieldToPatch(path[0]!, val));
  const full = h.getAttr(id);
  if (!full || full.k !== "map") return false;
  const next = mapSetPath(full, path, val, "set-attr");
  const top = path[0]!;
  const topVal = next.k === "map" ? (next.v.get(top) ?? nil()) : nil();
  return h.setAttr(id, fieldToPatch(top, topVal));
}

function evalUpdateAttr(args: LispVal[], h: Host, ctx: Ctx): LispVal {
  if (args.length < 3) {
    throw new LispError("update-attr needs an id, a key, and a function");
  }
  const path = asPath(args[1]!, "update-attr");
  const f = args[2]!;
  let ok = true;
  for (const id of asIdList(args[0]!)) {
    const full = h.getAttr(id) ?? nil();
    const cur = isNil(full) ? nil() : mapGetPath(full, path, "update-attr");
    const next = callPos(f, [cur], ctx);
    if (!setAttrPath(h, id, path, next)) ok = false;
  }
  return bool(ok);
}

function evalUpdateWall(args: LispVal[], h: Host, ctx: Ctx): LispVal {
  if (args.length < 3) {
    throw new LispError("update-wall needs a place, a field, and a function");
  }
  const field = asName(args[1]!);
  if (!["type", "color", "floor", "ceiling"].includes(field)) {
    throw new LispError(`unknown attr ${field}`);
  }
  const f = args[2]!;
  let ok = true;
  for (const place of asPlaces(args[0]!, "update-wall")) {
    const cur = h.getWall(place, field) ?? nil();
    const next = callPos(f, [cur], ctx);
    const opts: SetWallOpts = { ...place };
    if (field === "type") {
      if (texFromWallName(asName(next)) === null) {
        throw new LispError(`unknown type: ${asName(next)}`);
      }
      opts.type = asName(next);
    } else if (field === "color") opts.color = asColor(next, "color");
    else if (field === "floor") opts.floor = asColor(next, "floor");
    else opts.ceiling = asColor(next, "ceiling");
    if (!h.setWall(opts)) ok = false;
  }
  return bool(ok);
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
        isNil(args[0]!) ||
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
      return bool(!!args[0] && isBoolVal(args[0]));
    case "nil?":
      return bool(!!args[0] && isNil(args[0]));
    case "symbol?":
      return bool(args[0]?.k === "sym");
    case "symbol": {
      const a = args[0];
      if (!a) throw new LispError("symbol needs a string");
      if (a.k === "sym") return internSym(a.v);
      if (a.k === "str") return internSym(a.v);
      throw new LispError("symbol needs a string");
    }
    case "get": {
      if (args.length < 2) throw new LispError("get needs a map and a key");
      const m = args[0]!;
      if (m.k !== "map") throw new LispError("get needs a map");
      return mapGetPath(m, asPath(args[1]!, "get"), "get");
    }
    case "set": {
      if (args.length < 3) throw new LispError("set needs a map, a key, and a value");
      const m = args[0]!;
      if (m.k !== "map") throw new LispError("set needs a map");
      return mapSetPath(m, asPath(args[1]!, "set"), args[2]!, "set");
    }
    case "update": {
      if (args.length < 3) throw new LispError("update needs a map, a key, and a function");
      const m = args[0]!;
      if (m.k !== "map") throw new LispError("update needs a map");
      const path = asPath(args[1]!, "update");
      const cur = mapGetPath(m, path, "update");
      const next = callPos(args[2]!, [cur], ctx);
      return mapSetPath(m, path, next, "update");
    }
    case "get-prop": {
      const path = asPath(args[0] ?? nil(), "get-prop");
      return getPropPath(h, path, "get-prop");
    }
    case "set-prop": {
      const path = asPath(args[0] ?? nil(), "set-prop");
      return setPropPath(h, path, args[1] ?? nil(), "set-prop");
    }
    case "update-prop": {
      if (args.length < 2) throw new LispError("update-prop needs a name and a function");
      const path = asPath(args[0]!, "update-prop");
      const cur = getPropPath(h, path, "update-prop");
      const next = callPos(args[1]!, [cur], ctx);
      setPropPath(h, path, next, "update-prop");
      return next;
    }
    case "merge": {
      const out = new Map<string, LispVal>();
      for (const a of args) {
        if (a.k !== "map") throw new LispError("merge needs maps");
        for (const [k, val] of a.v) out.set(k, val);
      }
      return { k: "map", v: out };
    }
    case "say":
      h.say(args.map(printVal).join(""));
      return nil();
    case "set-attr":
      return evalSetAttr(args, h);
    case "get-attr":
      return evalGetAttr(args, h);
    case "update-attr":
      return evalUpdateAttr(args, h, ctx);
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
    case "update-wall":
      return evalUpdateWall(args, h, ctx);
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
        if (name === PLAYER_ID) throw new LispError(`cannot remove "${PLAYER_ID}"`);
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
  if (a === b) return true;
  if (a.k !== b.k) return false;
  if (a.k === "fn") return false;
  if (a.k === "quote" || a.k === "unquote" || a.k === "splice") {
    return b.k === a.k && eq(a.v, (b as { v: LispVal }).v);
  }
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

export const EVENT_ARGS: Record<string, string[]> = {
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
        evalForms(clause.body, payloadEnv, host, toMacroTable(program.macros));
      } catch (e) {
        host.say(e instanceof Error ? e.message : "Script error");
      }
      return;
    }
  }
}
