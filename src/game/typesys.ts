/** Static types for level scripts. See docs/script-types.md. */

import {
  BUILTINS,
  EVENT_ARGS,
  KEYWORDS,
  type LispVal,
  type Params,
  parseCallRaw,
  parseFn,
  parseIfArgs,
  parseLisp,
  parseParams,
} from "./lisp";
import {
  type EntityType,
  type GameLevel,
  PICKUP_SHAPES,
  PLAYER_ID,
  WALL_IDS,
} from "./types";

export type Diagnostic = {
  start: number;
  end: number;
  message: string;
};

export type TypeHint = {
  start: number;
  end: number;
  text: string;
};

export type CheckResult = {
  diagnostics: Diagnostic[];
  hints: TypeHint[];
};

export type Type =
  | { k: "none" }
  | { k: "any" }
  | { k: "nil" }
  | { k: "bool"; v?: boolean }
  | { k: "num" }
  | { k: "str"; v?: string }
  | { k: "ustr" }
  | { k: "empty_list" }
  | { k: "empty_map" }
  | { k: "list"; el: Type }
  | { k: "tuple"; items: Type[] }
  | { k: "map"; keys: Map<string, Type>; rest?: Type }
  | { k: "fn"; arrows: Arrow[] }
  | { k: "or"; ts: Type[] }
  | { k: "dyn"; t: Type };

export type Arrow =
  | { k: "pos"; args: Type[]; ret: Type }
  | { k: "key"; args: Map<string, Type>; ret: Type };

const ENTITY_KINDS: EntityType[] = [
  "enemy",
  "ammo",
  "health",
  "exit",
  "door",
  "teleport",
  "pickup",
  "button",
];

const ALL_ATTRS = [
  "locked",
  "open",
  "disabled",
  "dest",
  "label",
  "color",
  "variant",
  "shape",
  "type",
  "id",
  "health",
  "ammo",
  "inventory",
  "x",
  "y",
  "angle",
] as const;

const ATTR_KINDS: Record<string, string[] | "*"> = {
  type: "*",
  id: "*",
  locked: ["door"],
  open: ["door"],
  disabled: ["button"],
  dest: ["teleport"],
  label: ["pickup"],
  color: ["pickup"],
  shape: ["pickup"],
  variant: ["enemy"],
  health: ["player"],
  ammo: ["player"],
  inventory: ["player"],
  x: ["player"],
  y: ["player"],
  angle: ["player"],
};

export type TypeWorld = {
  ids: Set<string>;
  kinds: Map<string, string>;
};

export function worldFromLevel(level: GameLevel): TypeWorld {
  const ids = new Set<string>();
  const kinds = new Map<string, string>();
  for (const e of level.entities) {
    if (e.id) {
      ids.add(e.id);
      kinds.set(e.id, e.type);
    }
  }
  for (const z of level.zones ?? []) if (z.id) ids.add(z.id);
  for (const m of level.marks ?? []) if (m.id) ids.add(m.id);
  ids.add(PLAYER_ID);
  kinds.set(PLAYER_ID, "player");
  return { ids, kinds };
}

const tNone: Type = { k: "none" };
const tAny: Type = { k: "any" };
const tNil: Type = { k: "nil" };
const tNum: Type = { k: "num" };
const tBool: Type = { k: "bool" };
const tTrue: Type = { k: "bool", v: true };
const tFalse: Type = { k: "bool", v: false };
const tStr: Type = { k: "str" };
const tUStr: Type = { k: "ustr" };
const tEmptyList: Type = { k: "empty_list" };
const tEmptyMap: Type = { k: "empty_map" };

function tLit(s: string): Type {
  return { k: "str", v: s };
}

function tDyn(t: Type): Type {
  if (t.k === "dyn") return t;
  if (t.k === "none") return t;
  return { k: "dyn", t };
}

function tOr(ts: Type[]): Type {
  const flat: Type[] = [];
  for (const t of ts) {
    if (t.k === "none") continue;
    if (t.k === "any") return tAny;
    if (t.k === "or") flat.push(...t.ts);
    else flat.push(t);
  }
  const out: Type[] = [];
  for (const t of flat) {
    if (!out.some((u) => same(u, t))) out.push(t);
  }
  if (!out.length) return tNone;
  if (out.length === 1) return out[0]!;
  return { k: "or", ts: out };
}

function tList(el: Type): Type {
  return { k: "list", el };
}

function tTuple(items: Type[]): Type {
  if (!items.length) return tEmptyList;
  return { k: "tuple", items };
}

function tMap(keys: Map<string, Type>, rest?: Type): Type {
  if (!keys.size && rest === undefined) return tEmptyMap;
  return { k: "map", keys, rest };
}

function unwrap(t: Type): Type {
  return t.k === "dyn" ? t.t : t;
}

function fromUsage(t: Type): Type {
  const u = unwrap(t);
  if (u.k === "any") return tDyn(tAny);
  return u;
}

function collectAliases(v: LispVal, into: Map<string, string>) {
  if (v.k === "map") {
    for (const [k, val] of v.v) {
      if (val.k === "sym") into.set(k, val.v);
      else collectAliases(val, into);
    }
    return;
  }
  if (v.k === "list") {
    for (const x of v.v) collectAliases(x, into);
  }
}

function same(a: Type, b: Type): boolean {
  return printType(a) === printType(b);
}

function isNone(t: Type): boolean {
  return unwrap(t).k === "none";
}

export function printType(t: Type): string {
  switch (t.k) {
    case "none":
      return "none()";
    case "any":
      return "any()";
    case "nil":
      return "nil";
    case "bool":
      return t.v === undefined ? "bool()" : t.v ? "true" : "false";
    case "num":
      return "number()";
    case "str":
      return t.v === undefined ? "string()" : JSON.stringify(t.v);
    case "ustr":
      return "unknown_string()";
    case "empty_list":
      return "empty_list()";
    case "empty_map":
      return "empty_map()";
    case "list":
      return `list(${printType(t.el)})`;
    case "tuple":
      return `[${t.items.map(printType).join(" ")}]`;
    case "map": {
      const parts = [...t.keys.entries()].map(
        ([k, v]) => `${k}: ${printType(v)}`,
      );
      if (t.rest) parts.push(`*: ${printType(t.rest)}`);
      return parts.length ? `[${parts.join(" ")}]` : "empty_map()";
    }
    case "fn": {
      if (!t.arrows.length) return "fn";
      const parts: string[] = [];
      for (const ar of t.arrows) {
        const p = printArrow(ar);
        if (!parts.includes(p)) parts.push(p);
      }
      return parts.join(" and ");
    }
    case "or": {
      const lits: string[] = [];
      const rest: Type[] = [];
      for (const x of t.ts) {
        if (x.k === "str" && x.v !== undefined) lits.push(x.v);
        else rest.push(x);
      }
      const named = closedLitName(lits);
      const head = named ?? (lits.length > 4 ? "id()" : lits.map((v) => JSON.stringify(v)).join(" or "));
      const parts = [head, ...rest.map(printType)].filter(Boolean);
      return parts.join(" or ");
    }
    case "dyn":
      return `dynamic(${printType(t.t)})`;
  }
}

function printArrow(ar: Arrow): string {
  if (ar.k === "pos") {
    return `(${ar.args.map(printType).join(" ")}) -> ${printType(ar.ret)}`;
  }
  const keys = [...ar.args.entries()]
    .map(([k, v]) => `${k}: ${printType(v)}`)
    .join(" ");
  return `(${keys}) -> ${printType(ar.ret)}`;
}

function intersect(a: Type, b: Type): Type {
  if (a.k === "dyn") return tDyn(intersect(a.t, b));
  if (b.k === "dyn") return tDyn(intersect(a, b.t));
  if (a.k === "any") return b;
  if (b.k === "any") return a;
  if (a.k === "none" || b.k === "none") return tNone;
  if (a.k === "or") return tOr(a.ts.map((t) => intersect(t, b)));
  if (b.k === "or") return tOr(b.ts.map((t) => intersect(a, t)));
  if (a.k === "nil" && b.k === "nil") return tNil;
  if (a.k === "num" && b.k === "num") return tNum;
  if (a.k === "bool" && b.k === "bool") {
    if (a.v === undefined) return b;
    if (b.v === undefined) return a;
    return a.v === b.v ? a : tNone;
  }
  if (a.k === "ustr" && b.k === "ustr") return tUStr;
  if (a.k === "str" && b.k === "str") {
    if (a.v === undefined) return b;
    if (b.v === undefined) return a;
    return a.v === b.v ? a : tNone;
  }
  if (a.k === "ustr" && b.k === "str" && b.v === undefined) return tUStr;
  if (b.k === "ustr" && a.k === "str" && a.v === undefined) return tUStr;
  if (a.k === "empty_list") {
    if (b.k === "empty_list" || b.k === "list") return tEmptyList;
    return tNone;
  }
  if (b.k === "empty_list") {
    if (a.k === "list") return tEmptyList;
    return tNone;
  }
  if (a.k === "list" && b.k === "list") return tList(intersect(a.el, b.el));
  if (a.k === "tuple" && b.k === "tuple") {
    if (a.items.length !== b.items.length) return tNone;
    const items = a.items.map((t, i) => intersect(t, b.items[i]!));
    if (items.some(isNone)) return tNone;
    return tTuple(items);
  }
  if (a.k === "list" && b.k === "tuple") {
    const items = b.items.map((t) => intersect(t, a.el));
    if (items.some(isNone)) return tNone;
    return tTuple(items);
  }
  if (b.k === "list" && a.k === "tuple") {
    const items = a.items.map((t) => intersect(t, b.el));
    if (items.some(isNone)) return tNone;
    return tTuple(items);
  }
  if (a.k === "empty_map") {
    if (b.k === "empty_map") return tEmptyMap;
    if (b.k === "map" && !b.keys.size) return tEmptyMap;
    return tNone;
  }
  if (b.k === "empty_map") {
    if (a.k === "map" && !a.keys.size) return tEmptyMap;
    return tNone;
  }
  if (a.k === "map" && b.k === "map") {
    const keys = new Map<string, Type>();
    const names = new Set([...a.keys.keys(), ...b.keys.keys()]);
    for (const n of names) {
      const av = a.keys.get(n) ?? a.rest;
      const bv = b.keys.get(n) ?? b.rest;
      if (!av || !bv) continue;
      const iv = intersect(av, bv);
      if (!isNone(iv)) keys.set(n, iv);
    }
    let rest: Type | undefined;
    if (a.rest && b.rest) {
      const r = intersect(a.rest, b.rest);
      if (!isNone(r)) rest = r;
    }
    if (!keys.size && !rest) return tNone;
    return tMap(keys, rest);
  }
  if (a.k === "fn" && b.k === "fn") {
    return { k: "fn", arrows: [...a.arrows, ...b.arrows] };
  }
  return tNone;
}

function overlaps(got: Type, expected: Type): boolean {
  return !isNone(intersect(unwrap(got), unwrap(expected)));
}

/** True when every value of `a` is a value of `b`. */
function isSubtype(a: Type, b: Type): boolean {
  a = unwrap(a);
  b = unwrap(b);
  if (a.k === "none" || b.k === "any") return true;
  if (a.k === "any") return false;
  if (a.k === "or") return a.ts.every((t) => isSubtype(t, b));
  if (b.k === "or") return b.ts.some((t) => isSubtype(a, t));
  const hit = unwrap(intersect(a, b));
  if (isNone(hit)) return false;
  return same(hit, a);
}

function argFits(got: Type, domain: Type): boolean {
  if (got.k === "dyn") return overlaps(got, domain);
  return isSubtype(got, domain);
}

function pathWant(): Type {
  const key = tOr([tStr, tUStr]);
  return tOr([key, tEmptyList, tList(key), { k: "tuple", items: [key] }]);
}

function pathKeys(t: Type): string[] | "unknown" | null {
  t = unwrap(t);
  if (t.k === "str" && t.v !== undefined) return [t.v];
  if (t.k === "ustr" || t.k === "str") return "unknown";
  if (t.k === "tuple") {
    const keys: string[] = [];
    for (const item of t.items) {
      const u = unwrap(item);
      if (u.k === "str" && u.v !== undefined) keys.push(u.v);
      else return "unknown";
    }
    return keys.length ? keys : null;
  }
  if (t.k === "list") return "unknown";
  if (t.k === "empty_list") return null;
  return null;
}

function typeMapGet(m: Type, keys: string[]): Type {
  let cur = unwrap(m);
  for (const k of keys) {
    if (cur.k === "empty_map") return tNil;
    if (cur.k === "map") {
      if (cur.keys.has(k)) cur = unwrap(cur.keys.get(k)!);
      else if (cur.rest) cur = unwrap(cur.rest);
      else return tNil;
      continue;
    }
    if (cur.k === "any") return tDyn(tAny);
    return tDyn(tAny);
  }
  return cur;
}

function typeMapSet(m: Type, keys: string[], val: Type): Type {
  const setAt = (cur: Type, i: number): Type => {
    if (i === keys.length) return val;
    const k = keys[i]!;
    const inner = unwrap(cur);
    let keysMap = new Map<string, Type>();
    let rest: Type | undefined;
    if (inner.k === "map") {
      keysMap = new Map(inner.keys);
      rest = inner.rest;
    } else if (inner.k !== "empty_map" && inner.k !== "nil") {
      return tDyn(tMap(new Map(), tAny));
    }
    const child = keysMap.get(k) ?? rest ?? tEmptyMap;
    const next = setAt(isNone(child) || unwrap(child).k === "nil" ? tEmptyMap : child, i + 1);
    const leafNil = i === keys.length - 1 && unwrap(val).k === "nil" && val.k !== "dyn";
    if (leafNil) keysMap.delete(k);
    else keysMap.set(k, next);
    if (!keysMap.size && !rest) return tEmptyMap;
    return tMap(keysMap, rest);
  };
  return setAt(m, 0);
}

function propLeafType(writes: Type[], rest: string[]): Type {
  if (!rest.length) {
    return writes.length ? tDyn(tOr([...writes, tNil])) : tNil;
  }
  if (!writes.length) return tNil;
  return tDyn(tOr([...writes.map((w) => typeMapGet(w, rest)), tNil]));
}

function propWriteType(writes: Type[], rest: string[], val: Type): Type {
  if (!rest.length) return val;
  const bases = writes.length ? writes : [tEmptyMap];
  return tOr(bases.map((b) => typeMapSet(b, rest, val)));
}

function playerMapType(): Type {
  return tMap(
    new Map([
      ["id", tLit(PLAYER_ID)],
      ["type", tLit(PLAYER_ID)],
      ["health", tNum],
      ["ammo", tNum],
      ["inventory", tMap(new Map(), tNum)],
      ["x", tNum],
      ["y", tNum],
      ["angle", tNum],
    ]),
  );
}

function withoutFalsy(t: Type): Type {
  t = unwrap(t);
  if (t.k === "nil" || (t.k === "bool" && t.v === false)) return tNone;
  if (t.k === "bool" && t.v === undefined) return tTrue;
  if (t.k === "or") return tOr(t.ts.map(withoutFalsy));
  if (t.k === "any") return t;
  return t;
}

function onlyFalsy(t: Type): Type {
  return tOr([intersect(t, tNil), intersect(t, tFalse)]);
}

function spanOf(v: LispVal | undefined): { start: number; end: number } {
  if (v?.span) return v.span;
  return { start: 0, end: 0 };
}

function kindOf(v: LispVal): Type {
  switch (v.k) {
    case "nil":
      return tNil;
    case "num":
      return tNum;
    case "bool":
      return v.v ? tTrue : tFalse;
    case "str":
      return tLit(v.v);
    case "sym":
      if (v.v === "true") return tTrue;
      if (v.v === "false") return tFalse;
      if (v.v === "nil") return tNil;
      return tUStr;
    case "list":
      if (v.vec) {
        const items = v.v.filter((x) => x.k !== "comment").map(kindOf);
        return items.length ? tTuple(items) : tEmptyList;
      }
      return tAny;
    case "map":
      if (!v.v.size) return tEmptyMap;
      return tMap(
        new Map([...v.v.entries()].map(([k, val]) => [k, kindOf(val)])),
      );
    case "fn":
      return { k: "fn", arrows: [] };
    case "comment":
      return tNil;
  }
}

const WALL_TYPE = tOr(WALL_IDS.map(tLit));
const ENTITY_TYPE = tOr(ENTITY_KINDS.map(tLit));
const SHAPE_TYPE = tOr(PICKUP_SHAPES.map((s) => tLit(s)));
const VARIANT_TYPE = tOr([tLit("grunt"), tLit("bruiser")]);
const COLOR_TYPE = tOr([tNum, tStr, tUStr]);

function closedLitName(lits: string[]): string | undefined {
  const table: [string, readonly string[]][] = [
    ["wall_type()", WALL_IDS],
    ["thing_type()", ENTITY_KINDS],
    ["shape_type()", PICKUP_SHAPES],
  ];
  for (const [name, closed] of table) {
    if (lits.length === closed.length && closed.every((x) => lits.includes(x))) return name;
  }
  return undefined;
}

function idType(world: TypeWorld): Type {
  if (!world.ids.size) return tNone;
  return tOr([...world.ids].map(tLit));
}

function placeType(world: TypeWorld): Type {
  const name = tOr([idType(world), tUStr]);
  const point = tTuple([tNum, tNum]);
  return tOr([name, point, tList(tOr([name, point]))]);
}

function nameType(world: TypeWorld): Type {
  return tOr([idType(world), tUStr]);
}

type Env = Map<string, Type>;

class Checker {
  diags: Diagnostic[] = [];
  hints: TypeHint[] = [];
  hintAt = new Map<string, TypeHint>();
  world: TypeWorld;
  props = new Map<string, Type[]>();
  fns = new Map<string, Type>();
  pass = 0;
  env: Env = new Map();

  constructor(world: TypeWorld) {
    this.world = world;
  }

  err(v: LispVal | undefined, message: string) {
    if (this.pass === 0) return;
    const s = spanOf(v);
    this.diags.push({ start: s.start, end: Math.max(s.end, s.start + 1), message });
  }

  note(v: LispVal | undefined, t: Type, name?: string) {
    if (this.pass === 0) return;
    const s = v?.span;
    if (!s || s.end <= s.start) return;
    const text = name ? `${name} : ${printType(t)}` : printType(t);
    const key = `${s.start}:${s.end}`;
    const last = this.hintAt.get(key);
    if (last) {
      last.text = text;
      return;
    }
    const hint: TypeHint = { start: s.start, end: s.end, text };
    this.hintAt.set(key, hint);
    this.hints.push(hint);
  }

  noteParams(form: LispVal | undefined, env: Env) {
    if (!form || form.k !== "list") return;
    for (const p of form.v) {
      if (p.k !== "sym") continue;
      const name = p.v.endsWith(":") ? p.v.slice(0, -1) : p.v;
      const t = env.get(name);
      if (t) this.note(p, t, name);
    }
  }

  noteLetKeys(map: LispVal, env: Env) {
    if (map.k !== "map" || !map.keySpans) return;
    for (const [k, span] of map.keySpans) {
      const t = env.get(k);
      if (t) this.note({ k: "sym", v: k, span }, t, k);
    }
  }

  expect(got: Type, want: Type, at: LispVal | undefined, ctx: string): Type {
    const ok = got.k === "dyn" ? overlaps(got, want) : isSubtype(got, want);
    if (!ok) {
      this.err(at, `${ctx}: got ${printType(got)}, need ${printType(want)}`);
      return tDyn(want);
    }
    if (at?.k === "sym") this.refine(this.env, at.v, unwrap(want));
    const hit = intersect(unwrap(got), unwrap(want));
    return got.k === "dyn" ? tDyn(hit) : got;
  }

  lookup(env: Env, name: string): Type | undefined {
    if (env.has(name)) return env.get(name);
    if (this.fns.has(name)) return this.fns.get(name);
    return undefined;
  }

  refine(env: Env, name: string, t: Type) {
    const cur = env.get(name);
    if (!cur) return;
    const next = intersect(cur, t);
    if (!isNone(next)) env.set(name, next);
  }

  typeForm(v: LispVal, env: Env): Type {
    const prev = this.env;
    this.env = env;
    try {
      const t = this.infer(v, env);
      if (v.k === "comment") return t;
      const name =
        v.k === "sym"
          ? v.v
          : v.k === "bool"
            ? v.v
              ? "true"
              : "false"
            : v.k === "nil"
              ? "nil"
              : undefined;
      this.note(v, t, name);
      return t;
    } finally {
      this.env = prev;
    }
  }

  infer(v: LispVal, env: Env): Type {
    if (v.k === "comment") return tNil;
    if (v.k === "num") return tNum;
    if (v.k === "bool") return v.v ? tTrue : tFalse;
    if (v.k === "nil") return tNil;
    if (v.k === "str") return tLit(v.v);
    if (v.k === "fn") return { k: "fn", arrows: [] };
    if (v.k === "sym") {
      if (v.v === "true") return tTrue;
      if (v.v === "false") return tFalse;
      if (v.v === "nil") return tNil;
      const found = this.lookup(env, v.v);
      if (!found) {
        if (KEYWORDS.has(v.v) || BUILTINS.has(v.v)) return tAny;
        this.err(v, `unknown name ${v.v}`);
        return tDyn(tAny);
      }
      return found;
    }
    if (v.k === "map") {
      if (!v.v.size) return tEmptyMap;
      const keys = new Map<string, Type>();
      for (const [k, val] of v.v) keys.set(k, this.typeForm(val, env));
      if (v.keySpans) {
        for (const [k, span] of v.keySpans) {
          const kt = keys.get(k);
          if (kt) this.note({ k: "sym", v: k, span }, kt, k);
        }
      }
      return tMap(keys);
    }
    if (v.k !== "list") return tAny;
    if (v.vec) {
      const items = v.v.filter((x) => x.k !== "comment");
      if (!items.length) return tEmptyList;
      return tTuple(items.map((x) => this.typeForm(x, env)));
    }
    const xs = v.v.filter((x) => x.k !== "comment");
    if (!xs.length) return tNil;
    const head = xs[0]!;
    if (head.k === "sym") {
      const spec = this.special(head.v, xs.slice(1), env, v);
      if (spec !== undefined) return spec;
      if (BUILTINS.has(head.v) && head.v !== "true" && head.v !== "false" && head.v !== "nil") {
        return this.callBuiltin(head.v, xs.slice(1), env, v);
      }
    }
    const fnT = this.typeForm(head, env);
    return this.apply(fnT, xs.slice(1), env, v);
  }

  forms(body: LispVal[], env: Env): Type {
    let last: Type = tNil;
    for (const a of body) last = this.typeForm(a, env);
    return last;
  }

  special(
    name: string,
    args: LispVal[],
    env: Env,
    form: LispVal,
  ): Type | undefined {
    switch (name) {
      case "quote":
        return args[0] ? kindOf(args[0]) : tNil;
      case "if":
        return this.typeIf(args, env, form);
      case "and": {
        let last: Type = tTrue;
        for (const a of args) last = this.typeForm(a, env);
        return tDyn(tOr([last, tFalse, tNil]));
      }
      case "or": {
        let last: Type = tFalse;
        for (const a of args) last = this.typeForm(a, env);
        return tDyn(tOr([last, tFalse, tNil]));
      }
      case "not":
        this.typeForm(args[0] ?? { k: "nil" }, env);
        return tBool;
      case "fn":
        return this.typeFn(args, env, form);
      case "def":
        this.err(form, "(def ...) only works at the top of a script");
        return tNil;
      case "let":
        return this.typeLet(args, env, form);
      case "pipe":
        return this.typePipe(args, env, form);
      case "after": {
        this.expect(this.typeForm(args[0] ?? { k: "nil" }, env), tNum, args[0], "after");
        this.forms(args.slice(1), env);
        return tNil;
      }
      case "on":
        this.err(form, "(on ...) only works at the top of a script");
        return tNil;
      default:
        return undefined;
    }
  }

  typeIf(args: LispVal[], env: Env, form: LispVal): Type {
    let clauses;
    try {
      clauses = parseIfArgs(args);
    } catch (e) {
      this.err(form, e instanceof Error ? e.message : "bad if");
      return tDyn(tAny);
    }
    const results: Type[] = [];
    for (const c of clauses) {
      const child = new Map(env);
      if (c.test) {
        this.typeForm(c.test, env);
        this.narrow(c.test, c.not, child);
      }
      results.push(this.forms(c.body, child));
    }
    return tOr(results);
  }

  narrow(test: LispVal, not: boolean, env: Env) {
    const apply = (name: string, whenTrue: Type, whenFalse: Type) => {
      const cur = env.get(name);
      if (!cur) return;
      env.set(name, not ? whenFalse : whenTrue);
    };
    if (test.k === "sym") {
      const cur = env.get(test.v);
      if (!cur) return;
      apply(test.v, withoutFalsy(cur), onlyFalsy(cur));
      return;
    }
    if (test.k !== "list" || test.vec) return;
    const xs = test.v.filter((x) => x.k !== "comment");
    const op = xs[0];
    const arg = xs[1];
    if (!op || op.k !== "sym" || !arg || arg.k !== "sym") return;
    const cur = env.get(arg.v);
    if (!cur) return;
    const pred: Record<string, Type> = {
      "str?": tOr([tStr, tUStr]),
      "num?": tNum,
      "bool?": tBool,
      "nil?": tNil,
      "list?": tOr([tEmptyList, tList(tAny), { k: "tuple", items: [tAny] }]),
      "map?": tOr([tEmptyMap, tMap(new Map(), tAny)]),
    };
    const want = pred[op.v];
    if (!want) return;
    const yes = fromUsage(intersect(cur, want));
    const no = cur; // subtracting is optional; keep loose on the false side
    apply(arg.v, isNone(yes) ? cur : yes, no);
  }

  typeLet(args: LispVal[], env: Env, form: LispVal): Type {
    if (!args[0]) {
      this.err(form, "let needs a map");
      return tNil;
    }
    const mt = this.typeForm(args[0], env);
    const inner = unwrap(mt);
    const mapWant = tOr([tEmptyMap, tMap(new Map(), tAny)]);
    if (mt.k === "dyn") {
      if (!overlaps(mt, mapWant)) {
        this.err(args[0], `let needs a map, got ${printType(mt)}`);
      }
    } else if (inner.k !== "map" && inner.k !== "empty_map") {
      this.err(args[0], `let needs a map, got ${printType(mt)}`);
    }
    const child = new Map(env);
    const letNames = new Set<string>();
    if (inner.k === "map") {
      for (const [k, t] of inner.keys) {
        child.set(k, t);
        letNames.add(k);
      }
    }
    const body = args.slice(1);
    const saved = this.pass;
    this.pass = 0;
    this.forms(body, child);
    this.pass = saved;
    for (const [k, t] of child) {
      if (!letNames.has(k) && env.has(k)) env.set(k, t);
    }
    for (const k of letNames) {
      const t = child.get(k);
      if (t) child.set(k, fromUsage(t));
    }
    const aliases = new Map<string, string>();
    collectAliases(args[0], aliases);
    for (const [k, src] of aliases) {
      if (!letNames.has(k)) continue;
      const t = child.get(k);
      if (!t) continue;
      const cur = child.get(src) ?? env.get(src);
      if (!cur) continue;
      const next = fromUsage(intersect(cur, t));
      if (isNone(next)) continue;
      child.set(src, next);
      if (env.has(src)) env.set(src, next);
    }
    const ret = this.forms(body, child);
    this.noteLetKeys(args[0], child);
    return ret;
  }

  typeFn(args: LispVal[], env: Env, form: LispVal): Type {
    try {
      const parsed = parseFn(args);
      return {
        k: "fn",
        arrows: parsed.clauses.map((c) =>
          this.typeClause(c.params, c.body, env, c.paramsForm),
        ),
      };
    } catch (e) {
      this.err(form, e instanceof Error ? e.message : "bad fn");
      return tDyn(tAny);
    }
  }

  typePipe(args: LispVal[], env: Env, form: LispVal): Type {
    const steps = args.filter((a) => a.k !== "comment");
    if (steps.length < 2) {
      this.err(form, "pipe needs a value and at least one step");
      return tDyn(tAny);
    }
    let cur = this.typeForm(steps[0]!, env);
    for (const step of steps.slice(1)) {
      if (step.k === "sym") {
        const fnT = this.lookup(env, step.v);
        if (fnT) this.note(step, fnT, step.v);
        cur = this.applyTypeToCall(step.v, [cur], new Map(), step, env);
        continue;
      }
      if (step.k !== "list" || step.vec) {
        this.err(step, "pipe step must be a call or a name");
        continue;
      }
      const xs = step.v.filter((x) => x.k !== "comment");
      const head = xs[0];
      if (!head || head.k !== "sym") {
        this.err(step, "pipe step must be a call or a name");
        continue;
      }
      const rest = xs.slice(1).map((a) => this.typeForm(a, env));
      cur = this.applyTypeToCall(head.v, [cur, ...rest], new Map(), step, env);
    }
    return cur;
  }

  bindParams(params: Params, env: Env) {
    if (params.k === "pos") {
      for (const p of params.pats) {
        if (p.k === "bind") env.set(p.name, tDyn(tAny));
      }
      return;
    }
    for (const { name, pat } of params.pats) {
      if (pat.k === "bind") env.set(pat.name, tDyn(tAny));
      else env.set(name, kindOf(pat.value));
    }
  }

  promoteBinds(params: Params, env: Env) {
    const bump = (name: string) => {
      const t = env.get(name);
      if (!t) return;
      env.set(name, fromUsage(t));
    };
    if (params.k === "pos") {
      for (const p of params.pats) {
        if (p.k === "bind") bump(p.name);
      }
      return;
    }
    for (const { pat } of params.pats) {
      if (pat.k === "bind") bump(pat.name);
    }
  }

  typeClause(
    params: Params,
    body: LispVal[],
    parent: Env,
    paramsForm?: LispVal,
  ): Arrow {
    const e = new Map(parent);
    this.bindParams(params, e);
    const saved = this.pass;
    this.pass = 0;
    this.forms(body, e);
    this.pass = saved;
    this.promoteBinds(params, e);
    const ret = this.forms(body, e);
    this.noteParams(paramsForm, e);
    return this.arrowFrom(params, e, ret);
  }

  arrowFrom(params: Params, env: Env, ret: Type): Arrow {
    if (params.k === "pos") {
      const args = params.pats.map((p) => {
        if (p.k === "lit") return kindOf(p.value);
        return env.get(p.name) ?? tAny;
      });
      return { k: "pos", args, ret };
    }
    const args = new Map<string, Type>();
    for (const { name, pat } of params.pats) {
      if (pat.k === "lit") args.set(name, kindOf(pat.value));
      else args.set(name, env.get(pat.name) ?? tAny);
    }
    return { k: "key", args, ret };
  }

  apply(fnT: Type, raw: LispVal[], env: Env, form: LispVal): Type {
    let parts;
    try {
      parts = parseCallRaw(raw);
    } catch (e) {
      this.err(form, e instanceof Error ? e.message : "bad call");
      return tDyn(tAny);
    }
    const pos = parts.pos.map((a) => this.typeForm(a, env));
    const keys = new Map<string, Type>();
    for (const k of parts.keys) keys.set(k.name, this.typeForm(k.raw, env));
    const inner = unwrap(fnT);
    if (fnT.k === "dyn") return tDyn(tAny);
    if (inner.k === "any") return tDyn(tAny);
    if (inner.k !== "fn") {
      this.err(form, `not a function: ${printType(fnT)}`);
      return tDyn(tAny);
    }
    const ret = this.applyArrows(inner.arrows, pos, keys, form);
    this.refineCall(inner.arrows, parts.pos, parts.keys, env);
    return ret;
  }

  applyFnType(fnT: Type, pos: Type[], form: LispVal): Type {
    if (fnT.k === "dyn") return tDyn(tAny);
    const inner = unwrap(fnT);
    if (inner.k === "any") return tDyn(tAny);
    if (inner.k !== "fn") {
      this.err(form, `not a function: ${printType(fnT)}`);
      return tDyn(tAny);
    }
    return this.applyArrows(inner.arrows, pos, new Map(), form);
  }

  applyArrows(
    arrows: Arrow[],
    pos: Type[],
    keys: Map<string, Type>,
    form: LispVal,
  ): Type {
    const rets: Type[] = [];
    for (const ar of arrows) {
      if (ar.k === "pos") {
        if (keys.size) continue;
        if (ar.args.length !== pos.length) continue;
        if (ar.args.every((t, i) => argFits(pos[i]!, t))) rets.push(ar.ret);
        continue;
      }
      if (pos.length) continue;
      let ok = true;
      for (const [name, t] of ar.args) {
        const got = keys.get(name) ?? tNil;
        if (!argFits(got, tOr([t, tNil]))) ok = false;
      }
      if (ok) rets.push(ar.ret);
    }
    if (!rets.length) {
      this.err(form, "no matching clause");
      return tDyn(tAny);
    }
    const u = tOr(rets);
    return rets.length > 1 ? tDyn(u) : u;
  }

  refineCall(
    arrows: Arrow[],
    posRaw: LispVal[],
    keyRaw: { name: string; raw: LispVal }[],
    env: Env,
  ) {
    const posAr = arrows.filter(
      (a): a is Extract<Arrow, { k: "pos" }> => a.k === "pos" && a.args.length === posRaw.length,
    );
    for (let i = 0; i < posRaw.length; i++) {
      const arg = posRaw[i];
      if (!arg || arg.k !== "sym") continue;
      const wants = posAr.map((a) => a.args[i]!);
      if (!wants.length || wants.some((t) => unwrap(t).k === "any")) continue;
      this.refine(env, arg.v, tOr(wants.map(unwrap)));
    }
    if (posRaw.length) return;
    const keyAr = arrows.filter((a): a is Extract<Arrow, { k: "key" }> => a.k === "key");
    for (const { name, raw } of keyRaw) {
      if (raw.k !== "sym") continue;
      const wants = keyAr.map((a) => a.args.get(name)).filter((t): t is Type => !!t);
      if (!wants.length || wants.some((t) => unwrap(t).k === "any")) continue;
      this.refine(env, raw.v, tOr(wants.map(unwrap)));
    }
  }

  applyTypeToCall(
    name: string,
    pos: Type[],
    keys: Map<string, Type>,
    at: LispVal,
    env: Env,
  ): Type {
    if (BUILTINS.has(name) && name !== "true" && name !== "false" && name !== "nil") {
      return this.callBuiltinTyped(name, pos, at, env);
    }
    const fnT = this.lookup(env, name);
    if (!fnT) {
      this.err(at, `unknown name ${name}`);
      return tDyn(tAny);
    }
    const inner = unwrap(fnT);
    if (inner.k !== "fn") {
      this.err(at, `not a function: ${printType(fnT)}`);
      return tDyn(tAny);
    }
    return this.applyArrows(inner.arrows, pos, keys, at);
  }

  callBuiltin(name: string, raw: LispVal[], env: Env, form: LispVal): Type {
    let parts;
    try {
      parts = parseCallRaw(raw);
    } catch (e) {
      this.err(form, e instanceof Error ? e.message : "bad call");
      return tDyn(tAny);
    }
    if (parts.keys.length) {
      this.err(form, `${name} does not take keyword arguments`);
    }
    const pos = parts.pos.map((a) => this.typeForm(a, env));
    return this.callBuiltinTyped(name, pos, form, env, parts.pos);
  }

  callBuiltinTyped(
    name: string,
    pos: Type[],
    form: LispVal,
    env: Env,
    raw?: LispVal[],
  ): Type {
    const nums = () => {
      for (let i = 0; i < pos.length; i++) {
        this.expect(pos[i]!, tNum, raw?.[i] ?? form, name);
        const a = raw?.[i];
        if (a?.k === "sym") this.refine(env, a.v, tNum);
      }
      return tNum;
    };
    const namesh = (i: number) => this.expect(pos[i]!, tOr([tStr, tUStr]), raw?.[i] ?? form, name);
    switch (name) {
      case "+":
      case "*":
      case "min":
      case "max":
        return nums();
      case "-":
      case "/":
        return nums();
      case "mod":
        return nums();
      case "abs":
      case "floor":
      case "ceil":
        this.expect(pos[0] ?? tNil, tNum, raw?.[0] ?? form, name);
        if (raw?.[0]?.k === "sym") this.refine(env, raw[0].v, tNum);
        return tNum;
      case "=":
      case "/=":
        return tBool;
      case "<":
      case ">":
      case "<=":
      case ">=":
        this.expect(pos[0] ?? tNil, tNum, raw?.[0] ?? form, name);
        this.expect(pos[1] ?? tNil, tNum, raw?.[1] ?? form, name);
        if (raw?.[0]?.k === "sym") this.refine(env, raw[0].v, tNum);
        if (raw?.[1]?.k === "sym") this.refine(env, raw[1].v, tNum);
        return tBool;
      case "str": {
        const parts = pos.map(unwrap);
        if (parts.every((t) => t.k === "str" && t.v !== undefined)) {
          return tLit(parts.map((t) => (t.k === "str" ? t.v! : "")).join(""));
        }
        return tUStr;
      }
      case "len":
        this.expect(
          pos[0] ?? tNil,
          tOr([tStr, tUStr, tEmptyList, tList(tAny), { k: "tuple", items: [tAny] }, tEmptyMap, tMap(new Map(), tAny)]),
          raw?.[0] ?? form,
          name,
        );
        return tNum;
      case "cons": {
        const el = pos[0] ?? tAny;
        const xs = unwrap(pos[1] ?? tEmptyList);
        if (xs.k === "empty_list") return tTuple([el]);
        if (xs.k === "tuple") return tTuple([el, ...xs.items]);
        if (xs.k === "list") return tList(tOr([el, xs.el]));
        return tList(el);
      }
      case "first": {
        const xs = unwrap(pos[0] ?? tNil);
        if (xs.k === "tuple") return xs.items[0] ?? tNil;
        if (xs.k === "list") return tOr([xs.el, tNil]);
        if (xs.k === "empty_list") return tNil;
        return tDyn(tAny);
      }
      case "rest": {
        const xs = unwrap(pos[0] ?? tNil);
        if (xs.k === "tuple") return tTuple(xs.items.slice(1));
        if (xs.k === "list") return xs;
        if (xs.k === "empty_list") return tEmptyList;
        return tDyn(tList(tAny));
      }
      case "nth": {
        this.expect(pos[1] ?? tNil, tNum, raw?.[1] ?? form, "nth");
        const xs = unwrap(pos[0] ?? tNil);
        if (xs.k === "list") return tOr([xs.el, tNil]);
        if (xs.k === "tuple") return tDyn(tOr([...xs.items, tNil]));
        return tDyn(tAny);
      }
      case "append":
        return tList(tAny);
      case "map":
      case "filter":
        return tList(tDyn(tAny));
      case "reduce":
        return tDyn(pos[1] ?? tAny);
      case "pairs":
        this.expect(pos[0] ?? tNil, tOr([tEmptyMap, tMap(new Map(), tAny)]), raw?.[0] ?? form, name);
        return tList(tTuple([tStr, tAny]));
      case "from-pairs":
        return tDyn(tMap(new Map(), tAny));
      case "keys":
        this.expect(pos[0] ?? tNil, tOr([tEmptyMap, tMap(new Map(), tAny)]), raw?.[0] ?? form, name);
        return tList(tOr([tStr, tUStr]));
      case "vals":
        this.expect(pos[0] ?? tNil, tOr([tEmptyMap, tMap(new Map(), tAny)]), raw?.[0] ?? form, name);
        return tList(tAny);
      case "empty?":
      case "list?":
      case "map?":
      case "num?":
      case "str?":
      case "bool?":
      case "nil?":
        this.typePred(name, pos[0], raw?.[0], env);
        return tBool;
      case "get": {
        if (pos.length < 2) {
          this.err(form, "get needs a map and a key");
          return tDyn(tAny);
        }
        this.expect(pos[0]!, tOr([tEmptyMap, tMap(new Map(), tAny)]), raw?.[0] ?? form, "get");
        this.expect(pos[1]!, pathWant(), raw?.[1] ?? form, "get");
        const m = unwrap(pos[0]!);
        const keys = pathKeys(pos[1]!);
        if (keys === null) return tNil;
        if (keys === "unknown") {
          if (m.k === "map") {
            const vals = [...m.keys.values()];
            if (m.rest) vals.push(m.rest);
            return tDyn(tOr([...vals, tNil]));
          }
          return tDyn(tAny);
        }
        if (m.k === "empty_map") return tNil;
        if (m.k === "map") return typeMapGet(m, keys);
        return tDyn(tAny);
      }
      case "set": {
        if (pos.length < 3) {
          this.err(form, "set needs a map, a key, and a value");
          return tDyn(tAny);
        }
        this.expect(pos[0]!, tOr([tEmptyMap, tMap(new Map(), tAny)]), raw?.[0] ?? form, "set");
        this.expect(pos[1]!, pathWant(), raw?.[1] ?? form, "set");
        const keys = pathKeys(pos[1]!);
        const val = pos[2]!;
        if (keys === null) return pos[0]!;
        if (keys === "unknown") return tDyn(tMap(new Map(), tAny));
        return typeMapSet(pos[0]!, keys, val);
      }
      case "update": {
        if (pos.length < 3) {
          this.err(form, "update needs a map, a key, and a function");
          return tDyn(tAny);
        }
        this.expect(pos[0]!, tOr([tEmptyMap, tMap(new Map(), tAny)]), raw?.[0] ?? form, "update");
        this.expect(pos[1]!, pathWant(), raw?.[1] ?? form, "update");
        const keys = pathKeys(pos[1]!);
        const cur =
          keys === null
            ? tNil
            : keys === "unknown"
              ? tDyn(tAny)
              : typeMapGet(unwrap(pos[0]!), keys);
        const ret = this.applyFnType(pos[2]!, [cur], form);
        if (keys === null) return pos[0]!;
        if (keys === "unknown") return tDyn(tMap(new Map(), tAny));
        return typeMapSet(pos[0]!, keys, ret);
      }
      case "get-prop": {
        this.expect(pos[0] ?? tNil, pathWant(), raw?.[0] ?? form, "get-prop");
        const keys = pathKeys(pos[0] ?? tNil);
        if (keys === null) return tNil;
        if (keys === "unknown") return tDyn(tAny);
        return propLeafType(this.props.get(keys[0]!) ?? [], keys.slice(1));
      }
      case "set-prop": {
        this.expect(pos[0] ?? tNil, pathWant(), raw?.[0] ?? form, "set-prop");
        const val = pos[1] ?? tNil;
        const keys = pathKeys(pos[0] ?? tNil);
        if (keys && keys !== "unknown" && this.pass === 0) {
          const root = keys[0]!;
          const list = this.props.get(root) ?? [];
          list.push(propWriteType(list, keys.slice(1), val));
          this.props.set(root, list);
        }
        return val;
      }
      case "update-prop":
        return this.typeUpdateProp(pos, form, raw);
      case "merge": {
        let acc: Type = tEmptyMap;
        for (let i = 0; i < pos.length; i++) {
          this.expect(pos[i]!, tOr([tEmptyMap, tMap(new Map(), tAny)]), raw?.[i] ?? form, "merge");
          const m = unwrap(pos[i]!);
          if (acc.k === "empty_map" && m.k === "map") acc = m;
          else if (m.k === "empty_map") continue;
          else if (acc.k === "map" && m.k === "map") {
            const keys = new Map(acc.keys);
            for (const [k, v] of m.keys) keys.set(k, v);
            acc = tMap(keys, m.rest ?? acc.rest);
          } else acc = tDyn(tMap(new Map(), tAny));
        }
        return acc;
      }
      case "say":
        return tNil;
      case "set-attr":
        return this.typeSetAttr(pos, form, raw);
      case "get-attr":
        return this.typeGetAttr(pos, form, raw);
      case "update-attr":
        return this.typeUpdateAttr(pos, form, raw);
      case "set-wall":
        return this.typeSetWall(pos, form, raw);
      case "get-wall":
        return this.typeGetWall(pos, form, raw);
      case "update-wall":
        return this.typeUpdateWall(pos, form, raw);
      case "spawn":
        return this.typeSpawn(pos, form, raw, false);
      case "spawn-fill":
        return this.typeSpawn(pos, form, raw, true);
      case "remove": {
        const ids = [...this.world.ids].filter((id) => id !== PLAYER_ID);
        const one = ids.length ? tOr([...ids.map(tLit), tUStr]) : tUStr;
        this.expect(pos[0] ?? tNil, tOr([one, tList(one)]), raw?.[0] ?? form, name);
        return tBool;
      }
      case "teleport":
        this.expect(pos[0] ?? tNil, nameType(this.world), raw?.[0] ?? form, name);
        this.expect(pos[1] ?? tNil, placeType(this.world), raw?.[1] ?? form, name);
        return tBool;
      case "win":
      case "lose":
        return tNil;
      default:
        this.err(form, `unknown function: ${name}`);
        return tDyn(tAny);
    }
  }

  typePred(name: string, got: Type | undefined, at: LispVal | undefined, env: Env) {
    if (at?.k === "sym" && got) {
      const pred: Record<string, Type> = {
        "str?": tOr([tStr, tUStr]),
        "num?": tNum,
        "bool?": tBool,
        "nil?": tNil,
      };
      const want = pred[name];
      if (want) this.refine(env, at.v, tAny);
    }
  }

  typeSetAttr(pos: Type[], form: LispVal, raw?: LispVal[]): Type {
    if (!pos.length) {
      this.err(form, "set-attr needs an id");
      return tBool;
    }
    this.expect(
      pos[0]!,
      tOr([nameType(this.world), tList(nameType(this.world))]),
      raw?.[0] ?? form,
      "set-attr",
    );
    if (pos.length === 2) {
      const fields = unwrap(pos[1]!);
      if (fields.k !== "map" && fields.k !== "empty_map") {
        this.err(raw?.[1] ?? form, "set-attr needs a map of fields");
        return tBool;
      }
      if (fields.k === "map") this.checkAttrKeys(fields, pos[0]!, raw?.[1] ?? form);
      return tBool;
    }
    if (pos.length === 3) {
      this.expect(pos[1]!, pathWant(), raw?.[1] ?? form, "set-attr");
      const keys = pathKeys(pos[1]!);
      if (keys && keys !== "unknown" && keys.length >= 1) {
        const dummy = tMap(new Map([[keys[0]!, pos[2]!]]));
        if (dummy.k === "map") this.checkAttrKeys(dummy, pos[0]!, raw?.[1] ?? form);
      }
      return tBool;
    }
    this.err(form, "set-attr needs a map of fields, or a key and a value");
    return tBool;
  }

  typeGetAttr(pos: Type[], form: LispVal, raw?: LispVal[]): Type {
    if (!pos.length) {
      this.err(form, "get-attr needs an id");
      return tDyn(tAny);
    }
    this.expect(pos[0]!, nameType(this.world), raw?.[0] ?? form, "get-attr");
    const id = unwrap(pos[0]!);
    const full = id.k === "str" && id.v === PLAYER_ID ? playerMapType() : tDyn(tMap(new Map(), tAny));
    if (pos.length === 1) return full;
    this.expect(pos[1]!, pathWant(), raw?.[1] ?? form, "get-attr");
    const keys = pathKeys(pos[1]!);
    if (keys === null) return tNil;
    if (keys === "unknown") return tDyn(tAny);
    if (id.k === "str" && id.v === PLAYER_ID) return typeMapGet(playerMapType(), keys);
    if (keys.length === 1) {
      const attr = keys[0]!;
      if (!ALL_ATTRS.includes(attr as (typeof ALL_ATTRS)[number])) {
        this.err(raw?.[1] ?? form, `unknown attr ${attr}`);
      }
      if (id.k === "str" && id.v !== undefined) {
        const kind = this.world.kinds.get(id.v);
        if (kind && !attrAllowed(attr, kind)) {
          this.err(raw?.[1] ?? form, `${attr} is not a field of ${kind}`);
        }
      }
    }
    return tDyn(tAny);
  }

  typeUpdateAttr(pos: Type[], form: LispVal, raw?: LispVal[]): Type {
    if (pos.length < 3) {
      this.err(form, "update-attr needs an id, a key, and a function");
      return tBool;
    }
    this.expect(
      pos[0]!,
      tOr([nameType(this.world), tList(nameType(this.world))]),
      raw?.[0] ?? form,
      "update-attr",
    );
    this.expect(pos[1]!, pathWant(), raw?.[1] ?? form, "update-attr");
    const idT = unwrap(pos[0]!);
    const cur =
      idT.k === "list"
        ? tDyn(tAny)
        : this.typeGetAttr([pos[0]!, pos[1]!], form, raw);
    this.applyFnType(pos[2]!, [cur], form);
    return tBool;
  }

  typeUpdateWall(pos: Type[], form: LispVal, raw?: LispVal[]): Type {
    if (pos.length < 3) {
      this.err(form, "update-wall needs a place, a field, and a function");
      return tBool;
    }
    this.expect(pos[0]!, placeType(this.world), raw?.[0] ?? form, "update-wall");
    this.expect(pos[1]!, tOr([tLit("type"), tLit("color"), tLit("floor"), tLit("ceiling"), tUStr]), raw?.[1] ?? form, "update-wall");
    const field = unwrap(pos[1]!);
    const cur =
      field.k === "str" && field.v === "type"
        ? tOr([WALL_TYPE, tUStr])
        : field.k === "str" && ["color", "floor", "ceiling"].includes(field.v ?? "")
          ? COLOR_TYPE
          : tDyn(tAny);
    this.applyFnType(pos[2]!, [cur], form);
    return tBool;
  }

  typeUpdateProp(pos: Type[], form: LispVal, raw?: LispVal[]): Type {
    if (pos.length < 2) {
      this.err(form, "update-prop needs a name and a function");
      return tDyn(tAny);
    }
    this.expect(pos[0]!, pathWant(), raw?.[0] ?? form, "update-prop");
    const keys = pathKeys(pos[0]!);
    let cur: Type = tDyn(tAny);
    let root: string | undefined;
    let rest: string[] = [];
    if (keys === null) cur = tNil;
    else if (keys !== "unknown") {
      root = keys[0];
      rest = keys.slice(1);
      cur = propLeafType(this.props.get(root) ?? [], rest);
    }
    const fnT = pos[1]!;
    const ret = this.applyFnType(fnT, [cur], form);
    if (root && this.pass === 0) {
      const inner = unwrap(fnT);
      const written =
        inner.k === "fn" && inner.arrows.length
          ? tOr(inner.arrows.map((a) => a.ret))
          : ret;
      const list = this.props.get(root) ?? [];
      list.push(propWriteType(list, rest, written));
      this.props.set(root, list);
    }
    return ret;
  }

  checkAttrKeys(fields: Extract<Type, { k: "map" }>, idT: Type, at: LispVal) {
    const id = unwrap(idT);
    const kind = id.k === "str" && id.v !== undefined ? this.world.kinds.get(id.v) : undefined;
    for (const key of fields.keys.keys()) {
      if (!ALL_ATTRS.includes(key as (typeof ALL_ATTRS)[number])) {
        this.err(at, `unknown attr ${key}`);
        continue;
      }
      if (kind && !attrAllowed(key, kind)) {
        this.err(at, `${key} is not a field of ${kind}`);
      }
    }
  }

  typeSetWall(pos: Type[], form: LispVal, raw?: LispVal[]): Type {
    this.expect(pos[0] ?? tNil, placeType(this.world), raw?.[0] ?? form, "set-wall");
    const fields = pos[1] ? unwrap(pos[1]) : tNone;
    if (fields.k !== "map") {
      this.err(raw?.[1] ?? form, "set-wall needs a map of fields");
      return tBool;
    }
    for (const key of fields.keys.keys()) {
      if (!["type", "color", "floor", "ceiling"].includes(key)) {
        this.err(raw?.[1] ?? form, `unknown ${key}`);
      }
    }
    const ty = fields.keys.get("type");
    if (ty) this.expect(ty, tOr([WALL_TYPE, tUStr]), raw?.[1] ?? form, "set-wall type");
    return tBool;
  }

  typeGetWall(pos: Type[], form: LispVal, raw?: LispVal[]): Type {
    this.expect(pos[0] ?? tNil, placeType(this.world), raw?.[0] ?? form, "get-wall");
    if (pos.length === 1) {
      return tMap(
        new Map([
          ["type", tOr([WALL_TYPE, tUStr])],
          ["color", COLOR_TYPE],
          ["floor", COLOR_TYPE],
          ["ceiling", COLOR_TYPE],
        ]),
      );
    }
    const attr = unwrap(pos[1] ?? tNil);
    if (attr.k === "str" && attr.v !== undefined) {
      if (!["type", "color", "floor", "ceiling"].includes(attr.v)) {
        this.err(raw?.[1] ?? form, `unknown attr ${attr.v}`);
      }
      if (attr.v === "type") return tOr([WALL_TYPE, tUStr]);
      return COLOR_TYPE;
    }
    this.expect(pos[1] ?? tNil, tOr([tStr, tUStr]), raw?.[1] ?? form, "get-wall");
    return tDyn(tAny);
  }

  typeSpawn(pos: Type[], form: LispVal, raw: LispVal[] | undefined, fill: boolean): Type {
    const ctx = fill ? "spawn-fill" : "spawn";
    if (pos.length < 2) {
      this.err(form, `${ctx} needs a place and a type`);
      return fill ? tList(tUStr) : tUStr;
    }
    this.expect(pos[0]!, placeType(this.world), raw?.[0] ?? form, ctx);
    this.expect(pos[1]!, tOr([ENTITY_TYPE, tUStr]), raw?.[1] ?? form, ctx);
    const kindT = unwrap(pos[1]!);
    const kind = kindT.k === "str" ? kindT.v : undefined;
    const fields = pos[2] ? unwrap(pos[2]) : tEmptyMap;
    if (pos[2] && fields.k !== "map" && fields.k !== "empty_map") {
      this.err(raw?.[2] ?? form, `${ctx} needs a map of fields`);
    }
    let idT: Type = tUStr;
    if (fields.k === "map") {
      for (const key of fields.keys.keys()) {
        if (!["id", "variant", "dest", "label", "color", "locked", "disabled", "shape"].includes(key)) {
          this.err(raw?.[2] ?? form, `unknown ${key}`);
        }
        if (kind && !spawnFieldOk(key, kind)) {
          this.err(raw?.[2] ?? form, `${key} is only for ${fieldOwner(key)}`);
        }
      }
      const id = fields.keys.get("id");
      if (id) {
        const u = unwrap(id);
        if (u.k === "str" && u.v !== undefined) {
          if (u.v === PLAYER_ID) this.err(raw?.[2] ?? form, `id "${PLAYER_ID}" is reserved`);
          else idT = tLit(u.v);
        } else idT = tUStr;
      }
      const shape = fields.keys.get("shape");
      if (shape) this.expect(shape, tOr([SHAPE_TYPE, tUStr]), raw?.[2] ?? form, "shape");
      const variant = fields.keys.get("variant");
      if (variant) this.expect(variant, tOr([VARIANT_TYPE, tUStr]), raw?.[2] ?? form, "variant");
    }
    return fill ? tList(idT) : idT;
  }
}

function attrAllowed(attr: string, kind: string): boolean {
  const ks = ATTR_KINDS[attr];
  if (!ks) return false;
  if (ks === "*") return true;
  return ks.includes(kind);
}

function spawnFieldOk(key: string, kind: string): boolean {
  if (key === "id") return true;
  if (key === "variant") return kind === "enemy";
  if (key === "dest") return kind === "teleport";
  if (key === "label" || key === "color" || key === "shape") return kind === "pickup";
  if (key === "locked") return kind === "door";
  if (key === "disabled") return kind === "button";
  return true;
}

function fieldOwner(key: string): string {
  if (key === "variant") return "enemy";
  if (key === "dest") return "teleport";
  if (key === "label" || key === "color" || key === "shape") return "pickup";
  if (key === "locked") return "door";
  if (key === "disabled") return "button";
  return "this type";
}

function collectSpawnIds(forms: LispVal[], world: TypeWorld) {
  const walk = (v: LispVal) => {
    if (v.k === "map") {
      for (const val of v.v.values()) walk(val);
      return;
    }
    if (v.k !== "list") return;
    for (const x of v.v) walk(x);
    const xs = v.v.filter((x) => x.k !== "comment");
    const head = xs[0];
    if (!head || head.k !== "sym") return;
    if (head.v !== "spawn" && head.v !== "spawn-fill") return;
    const typeArg = xs[2];
    let kind: string | undefined;
    if (typeArg?.k === "str") kind = typeArg.v;
    const fields = xs[3];
    if (fields?.k === "map") {
      const id = fields.v.get("id");
      if (id?.k === "str") {
        if (id.v === PLAYER_ID) return;
        world.ids.add(id.v);
        if (kind) world.kinds.set(id.v, kind);
      }
    }
  };
  for (const f of forms) walk(f);
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

export function checkScript(src: string, world: TypeWorld): CheckResult {
  if (!src.trim()) return { diagnostics: [], hints: [] };
  const parsed = parseLisp(src);
  if (!parsed.ok) {
    return {
      diagnostics: [
        {
          start: parsed.start ?? 0,
          end: parsed.end ?? Math.min(src.length, (parsed.start ?? 0) + 1),
          message: parsed.error,
        },
      ],
      hints: [],
    };
  }
  collectSpawnIds(parsed.forms, world);
  const chk = new Checker(world);
  const env: Env = new Map();

  type FnForm = {
    name: string;
    nameForm: LispVal;
    form: LispVal;
    params: Params;
    body: LispVal[];
    paramsForm: LispVal;
  };
  const fnForms: FnForm[] = [];
  const onForms: {
    event: string;
    form: LispVal;
    params: Params;
    body: LispVal[];
    paramsForm: LispVal;
  }[] = [];
  const boot: LispVal[] = [];

  for (const form of parsed.forms) {
    if (form.k === "comment") continue;
    if (form.k === "list" && form.v[0]?.k === "sym" && form.v[0].v === "on") {
      const ev = form.v[1];
      if (!ev || ev.k !== "sym") {
        chk.err(form, "(on event (args...) body) needs an event name");
        continue;
      }
      if (!EVENT_ARGS[ev.v]) chk.err(ev, `unknown event ${ev.v}`);
      const paramsForm = form.v[2];
      if (!paramsForm || paramsForm.k !== "list") {
        chk.err(form, "(on event (args...) body) needs a parameter list");
        continue;
      }
      try {
        const params = parseParams(paramsForm, "on");
        onForms.push({ event: ev.v, form, params, body: form.v.slice(3), paramsForm });
      } catch (e) {
        chk.err(form, e instanceof Error ? e.message : "bad on");
      }
      continue;
    }
    if (form.k === "list" && form.v[0]?.k === "sym" && form.v[0].v === "def") {
      if (form.v[1]?.k !== "sym" || form.v[2]?.k !== "list") {
        chk.err(form, "(def name (args...) body)");
        continue;
      }
      try {
        const params = parseParams(form.v[2], "def");
        fnForms.push({
          name: form.v[1].v,
          nameForm: form.v[1],
          form,
          params,
          body: form.v.slice(3),
          paramsForm: form.v[2],
        });
      } catch (e) {
        chk.err(form, e instanceof Error ? e.message : "bad def");
      }
      continue;
    }
    boot.push(form);
  }

  const byName = new Map<string, FnForm[]>();
  for (const f of fnForms) {
    const list = byName.get(f.name) ?? [];
    list.push(f);
    byName.set(f.name, list);
  }
  for (const [name, list] of byName) {
    chk.fns.set(name, {
      k: "fn",
      arrows: list.map((f) => {
        const e = new Map(env);
        chk.bindParams(f.params, e);
        return chk.arrowFrom(f.params, e, tDyn(tAny));
      }),
    });
  }

  const typeFnBodies = () => {
    for (const [name, list] of byName) {
      const arrows: Arrow[] = [];
      for (const f of list) {
        arrows.push(chk.typeClause(f.params, f.body, env, f.paramsForm));
      }
      chk.fns.set(name, { k: "fn", arrows });
    }
  };

  chk.pass = 0;
  const runBodies = () => {
    for (const f of boot) chk.typeForm(f, env);
    typeFnBodies();
    if (chk.pass === 1) {
      for (const f of fnForms) {
        const t = chk.fns.get(f.name);
        if (t) chk.note(f.nameForm, t, f.name);
      }
    }
    for (const o of onForms) {
      const e = new Map(env);
      chk.bindParams(o.params, e);
      bindEvent(o.event, o.params, e, world);
      chk.noteParams(o.paramsForm, e);
      chk.forms(o.body, e);
    }
  };
  runBodies();
  chk.pass = 1;
  runBodies();
  return { diagnostics: mergeDiags(chk.diags), hints: chk.hints };
}

function bindEvent(event: string, params: Params, env: Env, world: TypeWorld) {
  const names = EVENT_ARGS[event] ?? [];
  const zone = tOr([tOr([...world.ids].map(tLit)), tUStr]);
  const payload: Record<string, Type> = {
    zone,
    target: tOr([tLit(""), nameType(world)]),
    enemy: nameType(world),
    pad: nameType(world),
    x: tNum,
    y: tNum,
    amount: tNum,
  };
  if (params.k === "key") {
    for (const { name, pat } of params.pats) {
      if (pat.k === "bind") env.set(pat.name, payload[name] ?? tAny);
    }
    return;
  }
  params.pats.forEach((p, i) => {
    const key = names[i];
    if (p.k === "bind" && key) env.set(p.name, payload[key] ?? tAny);
  });
}
