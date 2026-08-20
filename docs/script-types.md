# Script types

This is the type system for map scripts. Read it as the contract. The editor checker implements this. Where the checker is still looser than the contract, the text says so.

You do not write types in a script. The checker infers them. It runs about 1.5 seconds after you stop typing. It marks the bad text. Hover a mark, or put the caret on it, to read the message.

**Rule.** The checker reports an error only when a value **cannot** be what a command needs. If the value might still be right, the checker stays quiet.

A value of type `A` is accepted where type `B` is needed when `A` and `B` share at least one possible value. That shared part is the type used after the check.

```
(+ 1 2)              ; 1 is number(), + needs number(). Fine.
(+ 1 "x")            ; "x" and number() share nothing. Error.
(+ 1 (get-prop "n")) ; get-prop is dynamic(number() or nil).
                     ; That shares number() with +. Fine.
```

---

## Types

A type is a set of values. This is every type the checker has.

### Bottom and top

| Type | Meaning |
| --- | --- |
| `none()` | The empty set. No value has this type. A check that lands here is an error. |
| `any()` | Every value. Accepted everywhere. A parameter starts as `any()` until the body tightens it. |

### Nil

| Type | Values |
| --- | --- |
| `nil` | Only `nil`. |

`nil` is false in `if`, `and`, `or`, and `not`.

### Booleans

| Type | Values |
| --- | --- |
| `true` | Only `true`. |
| `false` | Only `false`. |
| `bool()` | `true` and `false`. |

`true` and `false` are subsets of `bool()`. `false` is false in `if`. `true` is true in `if`.

### Numbers

| Type | Values |
| --- | --- |
| `number()` | Every number. |

The checker does **not** keep exact numbers. `0` and `3.5` are both `number()`. A clause `(0)` and a clause `(n)` have the same argument type.

### Strings

| Type | Values |
| --- | --- |
| `"door-cell"` | Only that exact text. |
| `unknown_string()` | A string whose text the checker cannot name. |
| `string()` | Every string: every exact text, and `unknown_string()`. |

Exact text is **not** a subtype of `unknown_string()`. They only meet under `string()`.

```
"a" and "a"                 ; same type
"a" and "b"                 ; share nothing
"a" and unknown_string()    ; share nothing
"a" and string()            ; share "a"
unknown_string() and string() ; share unknown_string()
```

`(str "a" "b")` is `"ab"`. If any part is not exact text, the result is `unknown_string()`.

### Names on this map

`id()` is not a separate kind of value. It is the union of the exact strings that name things, marks, and zones on **this** map, plus names created by `spawn` / `spawn-fill` when `id:` is exact text.

If the map has `door-cell` and `panel`:

```
id() = "door-cell" or "panel"
```

A command that wants a name accepts:

```
name = id() or unknown_string()
```

| Value | Against `name` |
| --- | --- |
| `"door-cell"` (on the map) | Fine. Shares `"door-cell"`. |
| `"door-cel"` (not on the map) | Error. Exact text that is not in `id()`, and not `unknown_string()`. |
| `(str "door-" x)` | Fine. That is `unknown_string()`. |
| `(spawn … [id: "warden"])` | The result is `"warden"`. That name is added to `id()` for the rest of the script. |

`"player"` is a name only for `teleport` and for the `hurt` event. It is not in `id()`.

### Lists

| Type | Values |
| --- | --- |
| `empty_list()` | Only `[]`. |
| `[T1 T2 … Tn]` | A list of length `n` whose slots have those types. |
| `list(T)` | A list of any length whose items have type `T`. Includes `[]`. |

```
[]              ; empty_list()
[11.5 6.5]      ; [number() number()]
(cons 1 [])     ; [number()]
(rest [1 2 3])  ; [number() number()]
```

`empty_list()` meets `list(T)`. It does not meet a fixed-length `[T1 T2]`.

Two fixed lists meet only when they have the same length and each slot meets.

### Maps

Keys are always strings. The checker tracks a type per **known** key. A map may also have a rest type `*: T` for unknown keys.

| Type | Values |
| --- | --- |
| `empty_map()` | Only `[:]`. |
| `[a: Ta b: Tb]` | A map that has those keys with those types. |
| `[a: Ta *: T]` | Those known keys, plus other keys of type `T`. |

```
[:]                     ; empty_map()
[a: "example" b: 2]     ; [a: "example" b: number()]
(set [:] "hits" 0)      ; [hits: number()]
(merge [a: 1] [b: "x"]) ; [a: number() b: "x"]
```

`(merge a b)` keeps keys from both. On the same key, `b` wins.

`empty_map()` meets a map with no known keys. It does not meet `[a: T]`.

### Functions

| Type | Values |
| --- | --- |
| `fn` | A function. Printed as `fn`. Internally it is a list of arrows. |

An arrow is one clause:

```
(number()) -> nil
(target: "panel") -> nil
```

The type of a function is **all** of its arrows at once. It is not one combined arrow.

```
; This function
(def announce (msg) (say (str ">> " msg)))

; is
(any()) -> nil
; then the body uses msg with str, so it tightens to
(string() or unknown_string() or …) -> nil
; in practice, msg starts as any() and str accepts it.
```

Two clauses:

```
(def explode (target: "server") …)
(def explode (target:) …)

; arrows
(target: "server") -> …
(target: any()) -> …
```

A call matches an arrow when the arguments share values with that arrow. If several arrows match, the result is `dynamic(union of those results)`. If none match, that is an error.

Keyword arrows also accept a missing key as `nil`.

### Unions

```
A or B or C
```

A value of a union is a value of at least one member. A union meets `B` when any member meets `B`. The shared part is that member (or the union of the members that meet).

`any()` in a union collapses the whole union to `any()`. `none()` members are dropped.

### `dynamic(T)`

This is the part that was missing.

`dynamic(T)` is not a new set of values. The values are the same as `T`. The wrapper means: **the checker cannot prove that the value is a specific member of `T`. Treat uses as “might be any member of `T`.”**

#### Check

When a command needs `B` and the value is `dynamic(T)`:

1. Look at `T`, not at the wrapper.
2. Find the shared part of `T` and `B`.
3. If that part is `none()`, error.
4. If it is some `S`, the use is fine. The type of **that use** stays `dynamic(S)`.

The same three steps also run for a plain union `T`. The difference is step 4.

| Value type | Needed | Shared | Type after the use |
| --- | --- | --- | --- |
| `number() or nil` | `number()` | `number()` | `number()` |
| `dynamic(number() or nil)` | `number()` | `number()` | `dynamic(number())` |
| `dynamic(number() or nil)` | `string()` | `none()` | error |
| `nil` | `number()` | `none()` | error |

So `dynamic` does **not** make a bad use legal. `(+ "x" 1)` is still an error. `dynamic` stops the checker from pretending a later use is a tighter type than it proved.

That is why `get-prop` returns `dynamic`. `(get-prop "hits")` might be `nil` (never written yet, or written then cleared). It might be `number()` (you wrote a number). Passing it to `+` is legal because it **might** be a number. The checker does not then treat the name `"hits"` as a number forever.

#### Where `dynamic` comes from

| Source | Result |
| --- | --- |
| `(get-prop "hits")` after some `(set-prop "hits" …)` | `dynamic(union of those writes or nil)` |
| `(get-prop k)` when `k` is not exact text | `dynamic(any())` |
| A call that matches more than one `def` / `fn` / `on` clause | `dynamic(union of those results)` |
| `(and …)` / `(or …)` | `dynamic(last-arg or false or nil)` |
| `(map …)` / `(filter …)` | `list(dynamic(any()))` |
| `(reduce xs init f)` | `dynamic(type of init)` |
| `(nth xs i)` on a fixed list | `dynamic(slot types or nil)` |
| `(get m k)` when `k` is not exact text | `dynamic(value types or nil)` |
| `(set m k v)` when `k` is not exact text | `dynamic` map |
| `(from-pairs …)` | `dynamic` map |
| `(first xs)` / `(rest xs)` when `xs` is not a known list | `dynamic(…)` |
| `(get-attr …)` | `dynamic(any())` today (looser than the field table below) |
| A failed check, to keep going | `dynamic(needed type)` or `dynamic(any())` |
| Unknown name | `dynamic(any())` |

`any()` and `none()` are never wrapped. `dynamic(dynamic(T))` is `dynamic(T)`.

#### Worked example

```
(on start ()
  (set-prop "hits" 0))

(on hurt (target: "player")
  (set-prop "hits" (+ (get-prop "hits") 1)))
```

1. The first walk records that `"hits"` is written as `number()`.
2. `(get-prop "hits")` is `dynamic(number() or nil)`. The `nil` is there because a read can happen before a write, or on a path that never wrote.
3. `+` needs `number()`. Shared part is `number()`. Fine.
4. `(set-prop "hits" …)` writes `number()` again.

If nothing ever writes `"hits"`, `(get-prop "hits")` is `nil`, not `dynamic`. Then `(+ (get-prop "hits") 1)` is an error.

---

## Literals and other syntax

Every form the parser accepts, and the type it gets.

| Syntax | Type |
| --- | --- |
| `0`, `1`, `-2`, `3.5` | `number()` |
| `true` | `true` |
| `false` | `false` |
| `nil` | `nil` |
| `"text"` | `"text"` |
| `[]` | `empty_list()` |
| `[a b c]` | `[type of a, type of b, type of c]` |
| `[:]` | `empty_map()` |
| `[k: v …]` | `[k: type of v …]` |
| `; comment` | Ignored. A comment form types as `nil`. |
| `name` (symbol) | Lookup. `true` / `false` / `nil` as above. Else a parameter, `def`, or error (`unknown name`). |
| `(f …)` | A call. Type of the result of `f`. |
| `k:` in a call or param list | A keyword argument name, not a value. |

A map cannot mix plain items and `k:` pairs. That is a parse error.

`name:` in a parameter list is a keyword parameter. `(target: "panel")` means: the key `target` must be the exact string `"panel"`. `(target:)` means: bind the key `target` to a name `target`.

---

## Shared argument types

These names are used below. They are aliases, not extra types.

```
name     = id() or unknown_string()
who      = name or "player"
point    = [number() number()]
place    = name or point or list(name or point)
thing    = "enemy" or "ammo" or "health" or "exit"
           or "door" or "teleport" or "pickup" or "button"
           or unknown_string()
wall     = "empty" or "tech-panel" or "blood-brick" or "rust-metal"
           or "circuit" or "stone" or "hazard"
           or unknown_string()
variant  = "grunt" or "bruiser" or unknown_string()
shape    = "diamond" or "square" or "star" or "explosion"
           or "circle" or "triangle" or "cross"
           or unknown_string()
color    = number() or string() or unknown_string()
stringy  = string() or unknown_string()
mapy     = empty_map() or a map
listy    = empty_list() or list(T) or [T1 T2 …]
```

Runtime `color` also accepts `"#rrggbb"` and `"#rgb"`. The checker treats any `string()` as a color. A bad hex string is a runtime error, not a type error.

---

## Keywords

Keywords are special forms. They are not called as functions. They do not take `k:` arguments unless the text below says so.

### `def`

```
(def name (params…) body…)
```

Only at the top of the script. Defines a function `name`. Several `def` forms with the same `name` must sit next to each other. They are clauses of one function, first match wins.

`params` is either all positional (`n`, `0`, `"x"`) or all keyword (`target:`, `target: "server"`). Do not mix.

A bind parameter starts as `any()`. A literal parameter has the type of that literal. If the body uses a bind as a number, the checker tightens it to `number()`.

The result of the clause is the type of the last form in `body`. An empty body is `nil`.

A `def` that is not at the top is an error.

### `fn`

```
(fn (params…) body…)
```

Same parameter rules as `def`. Result type is `fn` with one arrow. Closures see the names around them.

### `on`

```
(on event (params…) body…)
```

Only at the top of the script. Same clause rules as `def`. `event` must be one of the events in the event table. Unknown event: error.

The result of an `on` body is not used.

### `let`

```
(let map body…)
```

`map` must be a map (`empty_map()` or `[k: T …]`). Each key becomes a name in `body` with that key’s type. Result is the last form of `body`.

```
(let [v: (get-prop "hits")]
  …)   ; v has type dynamic(number() or nil), if hits was written as a number
```

### `if`, `else`, `not` (inside `if`)

```
(if test
  body…
else if test2
  body2…
else
  body3…)
```

Also:

```
(if not test
  body…)
```

`else` and `else if` are part of this form. They are not functions.

`test` can be any type. The checker does not require `bool()`. A value is false when it is `nil` or `false`. Everything else is true.

Result type is the union of the branch results.

**Narrowing** applies only to a **bound name**, and only inside that `if`.

| Test | True branch | False branch |
| --- | --- | --- |
| `v` (a name) | `v` without `nil` and without `false` | `v` as `nil` or `false` |
| `(str? v)` | `v` meets `string() or unknown_string()` | `v` unchanged |
| `(num? v)` | `v` meets `number()` | `v` unchanged |
| `(bool? v)` | `v` meets `bool()` | `v` unchanged |
| `(nil? v)` | `v` meets `nil` | `v` unchanged |
| `(list? v)` | `v` meets a list type | `v` unchanged |
| `(map? v)` | `v` meets a map type | `v` unchanged |

`if not` swaps the two columns.

A later `(get-prop "hits")` is a new lookup. It is not narrowed.

The checker does not warn that a branch never runs.

### `and`

```
(and a b …)
```

Each argument is typed. Result is `dynamic(type of last or false or nil)`.

### `or`

```
(or a b …)
```

Each argument is typed. Result is `dynamic(type of last or false or nil)`.

### `not`

```
(not x)
```

`x` can be any type. Result is `bool()`.

### `quote`

```
(quote form)
```

Result is the type of `form` as data, without calling it. A quoted symbol is `unknown_string()`. A quoted number is `number()`. And so on. Used by `pipe` internally.

### `after`

```
(after seconds body…)
```

| Slot | Type |
| --- | --- |
| `seconds` | `number()` |
| `body` | typed in the same names as the caller |

Result is `nil`. The body still counts for `set-prop` writes and for errors.

### `pipe`

```
(pipe value step…)
```

Needs a value and at least one step. Result is the type after the last step.

Each step is a name `f` or a call `(f extra…)`. The current value is passed as the **first** argument of `f`. Steps cannot use `k:` arguments.

```
(pipe xs
  (map (fn (v) (* v 2)))
  (reduce 0 (fn (acc cur) (+ acc cur))))
```

`xs` is the first argument of `map`. The list from `map` is the first argument of `reduce`.

---

## Events

Payload keys and their types. A missing key at run time is `nil`. The checker types a bind of that key as the payload type.

| Event | Keys | Types |
| --- | --- | --- |
| `start` | (none) | — |
| `enter` | `zone` | `name` |
| `leave` | `zone` | `name` |
| `use` | `target`, `x`, `y` | `name or ""`, `number()`, `number()` |
| `shoot` | `target`, `x`, `y` | `name or ""`, `number()`, `number()` |
| `die` | `enemy`, `x`, `y` | `name`, `number()`, `number()` |
| `pickup` | `target` | `name or ""` |
| `hurt` | `target`, `amount` | `name or ""`, `number()` |
| `teleport` | `pad` | `name` |

`shoot` uses `""` when the wall has no name. `hurt` uses `"player"` when the player takes damage.

```
(on shoot (target: "panel") …)   ; target is "panel"
(on shoot (target:) …)           ; target is name or ""
(on enter (zone: "ambush") …)    ; zone is "ambush"
(on start () …)
```

---

## Fields of things

Used by `spawn`, `spawn-fill`, `set-attr`, and `get-attr`.

| Field | Allowed on | Value type |
| --- | --- | --- |
| `id` | every type (spawn only) | `stringy` |
| `type` | every type (`get-attr` only) | `thing` |
| `variant` | `enemy` | `variant` |
| `dest` | `teleport` | `name` |
| `label` | `pickup` | `stringy` |
| `color` | `pickup` | `color` |
| `shape` | `pickup` | `shape` |
| `locked` | `door` | any (runtime uses truthiness; typically `bool()`) |
| `open` | `door` (`set-attr` only) | any (truthiness) |
| `disabled` | `button` | any (truthiness) |

If the id is exact and the map (or a `spawn` with that `id:`) knows the kind, a field that kind does not have is an error.

If the id is `unknown_string()`, any field in the table is allowed. A field that no kind has is still an error.

---

## Built-in functions

None of these take `k:` arguments. Using `k:` is an error.

Arguments are positional. `…` means zero or more. Optional slots say so.

### Numbers

| Call | Arguments | Result |
| --- | --- | --- |
| `(+ …)` | each `number()` | `number()` (no args: `0`) |
| `(* …)` | each `number()` | `number()` (no args: `1`) |
| `(- x)` | `number()` | `number()` |
| `(- x y …)` | `number()` each | `number()` |
| `(/ x y …)` | `number()` each | `number()` |
| `(mod a b)` | `number()`, `number()` | `number()` |
| `(abs x)` | `number()` | `number()` |
| `(min …)` | each `number()` | `number()` |
| `(max …)` | each `number()` | `number()` |
| `(floor x)` | `number()` | `number()` |
| `(ceil x)` | `number()` | `number()` |

A bind passed to these is tightened to `number()`.

### Compare

| Call | Arguments | Result |
| --- | --- | --- |
| `(= a b)` | any, any | `bool()` |
| `(/= a b)` | any, any | `bool()` |
| `(< a b)` | `number()`, `number()` | `bool()` |
| `(> a b)` | `number()`, `number()` | `bool()` |
| `(<= a b)` | `number()`, `number()` | `bool()` |
| `(>= a b)` | `number()`, `number()` | `bool()` |

`=` and `/=` do not restrict `a` and `b`. Missing `b` makes `=` false and `/=` true at run time. The checker still types the call as `bool()`.

### Text

| Call | Arguments | Result |
| --- | --- | --- |
| `(str …)` | any | If every arg is exact text, the concatenated exact text. Else `unknown_string()`. |

`str` prints each value, then joins. Numbers, bools, lists, and maps are allowed.

### Length

| Call | Arguments | Result |
| --- | --- | --- |
| `(len x)` | `stringy` or `listy` or `mapy` | `number()` |

### Lists

| Call | Arguments | Result |
| --- | --- | --- |
| `(cons x xs)` | any, list or missing | See below |
| `(first xs)` | list | See below |
| `(rest xs)` | list | See below |
| `(nth xs i)` | list, `number()` | See below |
| `(append …)` | lists or items | `list(any())` |
| `(map xs f)` | list or map, `fn` | `list(dynamic(any()))` |
| `(filter xs f)` | list or map, `fn` | `list(dynamic(any()))` |
| `(reduce xs init f)` | list or map, any, `fn` | `dynamic(type of init)` |

`cons`:

| `xs` | Result |
| --- | --- |
| `empty_list()` | `[type of x]` |
| `[T1 T2 …]` | `[type of x, T1, T2, …]` |
| `list(T)` | `list(type of x or T)` |
| anything else | `list(type of x)` |

`first`:

| `xs` | Result |
| --- | --- |
| `[T1 T2 …]` | `T1` |
| `list(T)` | `T or nil` |
| `empty_list()` | `nil` |
| anything else | `dynamic(any())` |

`rest`:

| `xs` | Result |
| --- | --- |
| `[T1 T2 …]` | `[T2 …]` |
| `list(T)` | `list(T)` |
| `empty_list()` | `empty_list()` |
| anything else | `dynamic(list(any()))` |

`nth`:

| `xs` | Result |
| --- | --- |
| `list(T)` | `T or nil` |
| `[T1 T2 …]` | `dynamic(T1 or T2 or … or nil)` |
| anything else | `dynamic(any())` |

`map` and `filter` walk a list as its items, or a map as `["key" value]` pairs. The checker does not yet type `f`’s argument or result. That is looser than the contract; a later pass should type `f`.

`reduce` walks from the start. `f` takes `(acc item)`. The checker does not yet type `f`.

### Maps

| Call | Arguments | Result |
| --- | --- | --- |
| `(get m k)` | `mapy`, key | See below |
| `(set m k v)` | `mapy`, key, any | See below |
| `(merge …)` | each `mapy` | See below |
| `(pairs m)` | `mapy` | `list(["string()" any()])` |
| `(from-pairs xs)` | list | `dynamic` map |
| `(keys m)` | `mapy` | `list(string() or unknown_string())` |
| `(vals m)` | `mapy` | `list(any())` |

`get`:

| `m` and `k` | Result |
| --- | --- |
| `empty_map()` | `nil` |
| `[a: Ta …]` and `k` is `"a"` | `Ta` |
| `[a: Ta …]` and `k` is exact text not in the map | `nil` (or rest type or `nil`, if `*: rest` is present) |
| `[a: Ta b: Tb]` and `k` is `unknown_string()` | `dynamic(Ta or Tb or nil)` |

`set`:

| `m` and `k` | Result |
| --- | --- |
| `empty_map()` and `k` is `"a"` | `[a: type of v]` |
| `[…]` and `k` is `"a"` | same map with `a` replaced by type of `v` |
| `k` is not exact text | `dynamic` map |

`merge` of known maps is a known map. Later keys win. `merge` of `empty_map()` with `m` is `m`. If a map is not known, the result is a `dynamic` map.

### Predicates

Each takes one argument of any type. Result is `bool()`.

| Call | True when |
| --- | --- |
| `(empty? x)` | `nil`, `[]`, `[:]`, or `""` |
| `(list? x)` | a list |
| `(map? x)` | a map |
| `(num? x)` | a number |
| `(str? x)` | a string |
| `(bool? x)` | `true` or `false` |
| `(nil? x)` | `nil` |

See `if` for how these tighten a bound name.

### Script store (`get-prop` / `set-prop`)

This store is global for the script. It is not a map value.

| Call | Arguments | Result |
| --- | --- | --- |
| `(set-prop k v)` | `stringy`, any | type of `v` |
| `(get-prop k)` | `stringy` | See below |

`set-prop` records the type of `v` under exact text `k` for the whole script (every handler, including `after`).

`get-prop`:

| `k` | Result |
| --- | --- |
| exact text that was never written | `nil` |
| exact text written as `T1`, `T2`, … | `dynamic(T1 or T2 or … or nil)` |
| not exact text | `dynamic(any())` |

### Player

| Call | Arguments | Result |
| --- | --- | --- |
| `(say …)` | any | `nil` (joins like `str`, then shows the line) |
| `(has k)` | `stringy` | `bool()` |
| `(give k)` | `stringy` | `bool()` |
| `(give k n)` | `stringy`, `number()` | `bool()` |
| `(take k)` | `stringy` | `bool()` |
| `(take k n)` | `stringy`, `number()` | `bool()` |
| `(win)` | none | `nil` |
| `(lose)` | none | `nil` |

`"ammo"` and `"health"` are special for `give` / `take` / `has`. Any other string is inventory. The checker types all of them as `stringy`.

### Things

| Call | Arguments | Result |
| --- | --- | --- |
| `(set-attr id fields)` | `name` or `list(name)`, map of fields | `bool()` |
| `(get-attr id)` | `name` | `dynamic` map of fields (checker is loose here) |
| `(get-attr id attr)` | `name`, field name | `dynamic(any())` (checker is loose here) |
| `(remove id)` | `name` or `list(name)` | `bool()` |
| `(spawn place type)` | `place`, `thing` | `unknown_string()` |
| `(spawn place type fields)` | `place`, `thing`, map | `id:` if that field is exact text, else `unknown_string()` |
| `(spawn-fill place type)` | `place` (a zone), `thing` | `list(unknown_string())` |
| `(spawn-fill place type fields)` | same, plus map | `list` of the same id type as `spawn` |
| `(teleport who dest)` | `who`, `place` | `bool()` |

`fields` for `spawn` / `spawn-fill` may have: `id`, `variant`, `dest`, `label`, `color`, `locked`, `disabled`, `shape`. Other keys are an error. Keys that do not belong to `type` are an error when `type` is exact text.

`fields` for `set-attr` may have: `locked`, `open`, `disabled`, `dest`, `label`, `color`, `variant`, `shape`. Other keys are an error.

`get-attr` with one argument returns every field of that thing at run time. The checker currently returns `dynamic` map instead of a row per kind. `get-attr` with two arguments returns one field. The checker currently returns `dynamic(any())` instead of the field table. Both are looser than the contract.

### Walls

| Call | Arguments | Result |
| --- | --- | --- |
| `(set-wall place fields)` | `place`, map | `bool()` |
| `(get-wall place)` | `place` | `[type: wall, color: color, floor: color, ceiling: color]` |
| `(get-wall place attr)` | `place`, `"type"` or `"color"` or `"floor"` or `"ceiling"` | `wall` for `"type"`, `color` otherwise |

`fields` for `set-wall` may have: `type`, `color`, `floor`, `ceiling`. `type` must meet `wall`. Other keys are an error. At least one field is required at run time.

If `attr` is exact text that is not one of those four names, that is an error. If `attr` is `unknown_string()`, the result is `dynamic(any())`.

---

## How a script is typed

1. **Parse.** A parse error stops here. One mark on the bad text.
2. **Names.** Collect `id()` from the map. Add `spawn` / `spawn-fill` `id:` values that are exact text, with that thing type.
3. **Collect** top-level `def` and `on` clauses. Reject unknown events, bad parameter lists, `def` / `on` that are not at the top.
4. **First walk.** Record every `set-prop` write. Type function bodies so bind parameters tighten. Build `fn` arrows. Do not report unknown names yet if a later `def` will bind them.
5. **Second walk.** Type the script again with those writes and function types. Report errors.

Top-level forms that are not `def` or `on` are typed as a boot body. They run when the fight starts, before `on start`.

A use is an error only when the argument type and the needed type share no values.

---

## Editor

The checker waits about 1.5 seconds after the last edit. Overlapping marks join into one mark. The message is a tooltip on the mark. The line under the editor lists messages.

Parse errors come first. Type errors use the same marks.
