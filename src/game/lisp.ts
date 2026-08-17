/** Tiny event Lisp: parse, format, highlight, evaluate. */

export type LispVal =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "nil" }
  | { k: "sym"; v: string }
  | { k: "list"; v: LispVal[] }
  | { k: "fn"; params: Params; body: LispVal[]; env: Env };

export type Params =
  | { k: "pos"; names: string[] }
  | { k: "key"; names: string[] };

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
  "list",
  "cons",
  "first",
  "rest",
  "nth",
  "append",
  "empty?",
  "list?",
  "num?",
  "str?",
  "bool?",
  "nil?",
  "get",
  "set",
  "has",
  "give",
  "take",
  "say",
  "open",
  "close",
  "lock",
  "unlock",
  "locked?",
  "open?",
  "set-wall",
  "spawn",
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
export function list(v: LispVal[]): LispVal {
  return { k: "list", v };
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
      return `(${v.v.map(printVal).join(" ")})`;
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
    if (c === "(" || c === ")") {
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
    while (j < n && !" \t\n\r();".includes(src[j]!)) j++;
    const word = src.slice(i, j);
    if (/^[+-]?\d+(\.\d+)?$/.test(word)) push("number", word);
    else if (word.endsWith(":") && word.length > 1) push("keyword", word);
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
    skip(p);
    while (p.i < p.s.length) {
      forms.push(read(p));
      skip(p);
    }
    return { ok: true, forms };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Parse error" };
  }
}

function skip(p: { s: string; i: number }) {
  for (;;) {
    while (p.i < p.s.length && " \t\n\r".includes(p.s[p.i]!)) p.i++;
    if (p.s[p.i] === ";") {
      while (p.i < p.s.length && p.s[p.i] !== "\n") p.i++;
      continue;
    }
    break;
  }
}

function read(p: { s: string; i: number }): LispVal {
  skip(p);
  if (p.i >= p.s.length) throw new LispError("unexpected end of script");
  const c = p.s[p.i]!;
  if (c === "(") {
    p.i++;
    const xs: LispVal[] = [];
    for (;;) {
      skip(p);
      if (p.i >= p.s.length) throw new LispError("missing )");
      if (p.s[p.i] === ")") {
        p.i++;
        break;
      }
      xs.push(read(p));
    }
    return list(xs);
  }
  if (c === ")") throw new LispError("unexpected )");
  if (c === "'") throw new LispError("unexpected '");
  if (c === '"') {
    p.i++;
    let out = "";
    while (p.i < p.s.length) {
      const ch = p.s[p.i]!;
      if (ch === '"') {
        p.i++;
        return str(out);
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
  while (j < p.s.length && !" \t\n\r();".includes(p.s[j]!)) j++;
  const word = p.s.slice(p.i, j);
  p.i = j;
  if (word === "true") return bool(true);
  if (word === "false") return bool(false);
  if (word === "nil") return nil();
  if (/^[+-]?\d+(\.\d+)?$/.test(word)) return num(Number(word));
  if (!word) throw new LispError("empty token");
  return sym(word);
}

export function formatLisp(src: string): { ok: true; text: string } | { ok: false; error: string } {
  const parsed = parseLisp(src);
  if (!parsed.ok) return parsed;
  const body = parsed.forms.map((f) => formatVal(f, 0)).join("\n\n");
  return { ok: true, text: body ? body + "\n" : "" };
}

const MAX_INLINE = 72;

const BODY_SPECIALS = new Set([
  "on",
  "def",
  "fn",
  "let",
  "if",
  "after",
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

function formatVal(v: LispVal, indent: number): string {
  if (v.k !== "list") return formatAtom(v);
  if (v.v.length === 0) return "()";
  const headName = v.v[0]?.k === "sym" ? v.v[0].v : "";
  const inline = formatInline(v);
  const col = indent * 2;
  if (!BODY_SPECIALS.has(headName) && inline.length + col <= MAX_INLINE) {
    return inline;
  }
  return formatBlock(v, indent);
}

/** Close parens hang off the last form — never on their own line. */
function closeOn(lines: string[]): string {
  if (!lines.length) return ")";
  lines[lines.length - 1] += ")";
  return lines.join("\n");
}

function formatBlock(v: { k: "list"; v: LispVal[] }, indent: number): string {
  const pad = "  ".repeat(indent);
  const body = pad + "  ";
  const head = v.v[0]!;
  const headName = head.k === "sym" ? head.v : formatVal(head, indent);

  if (headName === "on") {
    const ev = v.v[1] ? formatVal(v.v[1], indent) : "";
    const params = v.v[2] ? formatInline(v.v[2]) : "()";
    const rest = v.v.slice(3);
    if (rest.length === 0) return `(on ${ev} ${params})`;
    const lines = [`(on ${ev} ${params}`];
    for (const item of rest) {
      lines.push(body + formatVal(item, indent + 1));
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
      lines.push(body + formatVal(v.v[i]!, indent + 1));
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
          lines.push(`(if ${c.not ? "not " : ""}${t}`);
        } else if (c.test) {
          lines.push(
            `${pad}else if ${c.not ? "not " : ""}${formatVal(c.test, indent + 1)}`,
          );
        } else {
          lines.push(`${pad}else`);
        }
        for (const item of c.body) {
          lines.push(body + formatVal(item, indent + 1));
        }
      });
      if (!lines.length) return "(if)";
      return closeOn(lines);
    } catch {
      const cond = v.v[1] ? formatVal(v.v[1], indent + 1) : "nil";
      const lines = [`(if ${cond}`];
      for (const item of v.v.slice(2)) {
        lines.push(body + formatVal(item, indent + 1));
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
        lines.push(body + formatVal(item, indent + 1));
      }
      return closeOn(lines);
    }
    if (rest.length === 0) return `(def ${nm})`;
    const lines = [`(def ${nm}`];
    for (const item of rest) lines.push(body + formatVal(item, indent + 1));
    return closeOn(lines);
  }

  if (headName === "fn") {
    const sig = v.v[1] ? " " + formatInline(v.v[1]) : "";
    const rest = v.v.slice(2);
    if (rest.length === 0) return `(${headName}${sig})`;
    const lines = [`(${headName}${sig}`];
    for (const item of rest) lines.push(body + formatVal(item, indent + 1));
    return closeOn(lines);
  }

  if (headName === "if") {
    const cond = v.v[1] ? formatVal(v.v[1], indent + 1) : "nil";
    const thenPad = pad + "    ";
    const lines = [`(if ${cond}`];
    for (const item of v.v.slice(2)) {
      lines.push(thenPad + formatVal(item, indent + 2));
    }
    return closeOn(lines);
  }

  if (headName === "let") {
    const binds = v.v[1];
    let bindStr = "()";
    if (binds && binds.k === "list") {
      if (binds.v.length <= 1) {
        bindStr = formatInline(binds);
      } else {
        const bindPad = pad + "     "; // align under first binding after "(let "
        bindStr = binds.v
          .map((b, i) => (i === 0 ? formatInline(b) : bindPad + formatInline(b)))
          .join("\n");
        bindStr = `(${bindStr})`;
      }
    }
    const lines = [`(let ${bindStr}`];
    for (const item of v.v.slice(2)) {
      lines.push(body + formatVal(item, indent + 1));
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
  const fmtChunk = (c: LispVal[]) =>
    c.map((x) => formatVal(x, indent)).join(" ");
  const fnW = headName.length;
  const argPad = pad + " ".repeat(fnW + 2);
  const lines = [`(${headName} ${fmtChunk(chunks[0]!)}`];
  for (const c of chunks.slice(1)) {
    lines.push(argPad + fmtChunk(c));
  }
  return closeOn(lines);
}

function formatInline(v: LispVal): string {
  if (v.k !== "list") return formatAtom(v);
  return `(${v.v.map(formatInline).join(" ")})`;
}

function formatAtom(v: LispVal): string {
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
    case "list":
      return formatInline(v);
  }
}

export type Host = {
  say: (msg: string) => void;
  give: (what: string, n?: number) => boolean;
  take: (what: string, n?: number) => boolean;
  has: (what: string) => boolean;
  getVar: (key: string) => LispVal;
  setVar: (key: string, val: LispVal) => void;
  open: (name: string) => boolean;
  close: (name: string) => boolean;
  lock: (name: string) => boolean;
  unlock: (name: string) => boolean;
  isLocked: (name: string) => boolean;
  isOpen: (name: string) => boolean;
  setWall: (a: LispVal, b?: LispVal, c?: LispVal) => boolean;
  spawn: (type: string, x: number, y: number, name?: string, variant?: string) => string;
  remove: (name: string) => boolean;
  teleport: (who: string, dest: LispVal, y?: LispVal) => boolean;
  win: () => void;
  lose: () => void;
  after: (sec: number, thunk: () => void) => void;
};

export type Handler = {
  event: string;
  params: Params;
  body: LispVal[];
};

export type Program = {
  handlers: Handler[];
  boot: LispVal[];
};

const BUDGET = 8000;

export function compileProgram(src: string): { ok: true; program: Program } | { ok: false; error: string } {
  const parsed = parseLisp(src);
  if (!parsed.ok) return parsed;
  const handlers: Handler[] = [];
  const boot: LispVal[] = [];
  for (const form of parsed.forms) {
    if (form.k === "list" && form.v[0]?.k === "sym" && form.v[0].v === "on") {
      const ev = form.v[1];
      if (!ev || ev.k !== "sym") {
        return { ok: false, error: "(on event (args...) body) needs an event name" };
      }
      const paramsForm = form.v[2];
      if (!paramsForm || paramsForm.k !== "list") {
        return { ok: false, error: "(on event (args...) body) needs a parameter list" };
      }
      try {
        const params = parseParams(paramsForm, "on");
        handlers.push({ event: ev.v, params, body: form.v.slice(3) });
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Invalid on parameters",
        };
      }
    } else {
      boot.push(form);
    }
  }
  return { ok: true, program: { handlers, boot } };
}

export function parseParams(form: LispVal, ctx: string): Params {
  if (form.k !== "list") throw new LispError(`${ctx} needs a parameter list`);
  const names: string[] = [];
  let mode: "pos" | "key" | null = null;
  for (const p of form.v) {
    if (p.k !== "sym") throw new LispError("parameter must be a name");
    const isKey = p.v.endsWith(":") && p.v.length > 1;
    if (mode && (isKey ? mode !== "key" : mode !== "pos")) {
      throw new LispError("do not mix positional and keyword parameters");
    }
    mode = isKey ? "key" : "pos";
    const name = isKey ? p.v.slice(0, -1) : p.v;
    if (!name) throw new LispError("empty parameter name");
    if (names.includes(name)) throw new LispError(`duplicate parameter ${name}`);
    names.push(name);
  }
  return { k: mode ?? "pos", names };
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

function bindParams(params: Params, call: CallParts, env: Env) {
  if (params.k === "pos") {
    if (call.keys.size) {
      throw new LispError("this function does not take keyword arguments");
    }
    if (call.pos.length !== params.names.length) {
      throw new LispError(
        `expected ${params.names.length} args, got ${call.pos.length}`,
      );
    }
    params.names.forEach((p, i) => env.vars.set(p, call.pos[i]!));
    return;
  }
  if (call.pos.length) {
    throw new LispError("this function needs key: arguments");
  }
  for (const key of call.keys.keys()) {
    if (!params.names.includes(key)) {
      throw new LispError(`unknown ${key}:`);
    }
  }
  for (const n of params.names) {
    env.vars.set(n, call.keys.get(n) ?? nil());
  }
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
  if (v.k === "num" || v.k === "str" || v.k === "bool" || v.k === "nil" || v.k === "fn") {
    return v;
  }
  if (v.k === "sym") {
    if (v.v === "true") return bool(true);
    if (v.v === "false") return bool(false);
    if (v.v === "nil") return nil();
    return lookup(env, v.v);
  }
  if (v.k !== "list" || v.v.length === 0) return v;
  const head = v.v[0]!;
  if (head.k === "sym") {
    const sf = special(head.v, v.v.slice(1), env, ctx);
    if (sf !== undefined) return sf;
    if (BUILTINS.has(head.v) && head.v !== "true" && head.v !== "false" && head.v !== "nil") {
      return callBuiltin(head.v, evalCallRaw(v.v.slice(1), env, ctx), ctx);
    }
  }
  const fn = evalVal(head, env, ctx);
  return applyFn(fn, evalCallRaw(v.v.slice(1), env, ctx), env, ctx);
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
    case "after": {
      const sec = asNum(evalVal(args[0] ?? num(0), env, ctx), "after");
      const body = args.slice(1);
      ctx.host.after(sec, () => {
        try {
          for (const b of body) evalVal(b, env, ctx);
        } catch {
          /* swallow timer errors */
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
  return { k: "fn", params: parseParams(paramsForm, "fn"), body: args.slice(1), env };
}

function evalDef(args: LispVal[], env: Env, ctx: Ctx): LispVal {
  const head = args[0];
  if (!head || head.k !== "sym") {
    throw new LispError("(def name value) or (def name (args...) body)");
  }
  if (args.length >= 3 && args[1]?.k === "list") {
    const fn: LispVal = {
      k: "fn",
      params: parseParams(args[1], "def"),
      body: args.slice(2),
      env,
    };
    env.vars.set(head.v, fn);
    return fn;
  }
  const val = evalVal(args[1] ?? nil(), env, ctx);
  env.vars.set(head.v, val);
  return val;
}

function evalLet(args: LispVal[], env: Env, ctx: Ctx): LispVal {
  const binds = args[0];
  if (!binds || binds.k !== "list") throw new LispError("(let ((n v)...) body)");
  const child = makeEnv(env);
  for (const b of binds.v) {
    if (b.k !== "list" || b.v[0]?.k !== "sym") {
      throw new LispError("let binding must be (name value)");
    }
    child.vars.set(b.v[0].v, evalVal(b.v[1] ?? nil(), env, ctx));
  }
  let last: LispVal = nil();
  for (const a of args.slice(1)) last = evalVal(a, child, ctx);
  return last;
}

function applyFn(fn: LispVal, call: CallParts, env: Env, ctx: Ctx): LispVal {
  if (fn.k === "fn") {
    const child = makeEnv(fn.env);
    bindParams(fn.params, call, child);
    let last: LispVal = nil();
    for (const b of fn.body) last = evalVal(b, child, ctx);
    return last;
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

function callBuiltin(name: string, call: CallParts, ctx: Ctx): LispVal {
  const h = ctx.host;
  const args = name === "spawn" ? call.pos : posArgs(name, call);
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
      throw new LispError("len needs a string or list");
    }
    case "list":
      return list(args);
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
    case "empty?":
      return bool(
        args[0]?.k === "nil" ||
          (args[0]?.k === "list" && args[0].v.length === 0) ||
          (args[0]?.k === "str" && args[0].v.length === 0),
      );
    case "list?":
      return bool(args[0]?.k === "list");
    case "num?":
      return bool(args[0]?.k === "num");
    case "str?":
      return bool(args[0]?.k === "str");
    case "bool?":
      return bool(args[0]?.k === "bool");
    case "nil?":
      return bool(args[0]?.k === "nil");
    case "get":
      return h.getVar(asName(args[0] ?? nil()));
    case "set": {
      const val = args[1] ?? nil();
      h.setVar(asName(args[0] ?? nil()), val);
      return val;
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
    case "open":
      return bool(h.open(asName(args[0] ?? nil())));
    case "close":
      return bool(h.close(asName(args[0] ?? nil())));
    case "lock":
      return bool(h.lock(asName(args[0] ?? nil())));
    case "unlock":
      return bool(h.unlock(asName(args[0] ?? nil())));
    case "locked?":
      return bool(h.isLocked(asName(args[0] ?? nil())));
    case "open?":
      return bool(h.isOpen(asName(args[0] ?? nil())));
    case "set-wall":
      return bool(h.setWall(args[0] ?? nil(), args[1], args[2]));
    case "spawn": {
      if (call.pos.length) {
        throw new LispError("spawn needs type: x: y:");
      }
      for (const key of call.keys.keys()) {
        if (!["type", "x", "y", "name", "variant"].includes(key)) {
          throw new LispError(`unknown ${key}:`);
        }
      }
      const type = call.keys.get("type");
      const x = call.keys.get("x");
      const y = call.keys.get("y");
      if (!type || !x || !y) throw new LispError("spawn needs type: x: y:");
      const nm = call.keys.get("name");
      const variant = call.keys.get("variant");
      return str(
        h.spawn(
          asName(type),
          asNum(x, "spawn"),
          asNum(y, "spawn"),
          nm ? asName(nm) : undefined,
          variant ? asName(variant) : undefined,
        ),
      );
    }
    case "remove":
      return bool(h.remove(asName(args[0] ?? nil())));
    case "teleport":
      return bool(
        h.teleport(asName(args[0] ?? sym("player")), args[1] ?? nil(), args[2]),
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
  for (const h of program.handlers) {
    if (h.event !== event) continue;
    const payloadEnv = makeEnv(env);
    if (h.params.k === "key") {
      for (const n of h.params.names) {
        payloadEnv.vars.set(n, named[n] ?? nil());
      }
    } else {
      const order = EVENT_ARGS[event] ?? [];
      h.params.names.forEach((p, i) => {
        const key = order[i];
        payloadEnv.vars.set(p, key ? (named[key] ?? nil()) : nil());
      });
    }
    try {
      evalForms(h.body, payloadEnv, host);
    } catch (e) {
      host.say(e instanceof Error ? e.message : "Script error");
    }
  }
}
