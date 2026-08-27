# Script types

This document is the type system for Ironcast map scripts. It is a reference. It does not assume prior work on this project. It does assume the script language in the in-editor tutorial.

A script contains no type annotations. The checker infers types from literals, from built-in commands, and from the current map. The editor runs the checker about 1.5 seconds after the last edit and marks text that cannot be right.

---

## Checking

Two relations are used.

**Subtype** (`A` is a subtype of `B`): every value of `A` is a value of `B`. Written `A ⊆ B`. This is the “will work” relation.

**Intersection** (`A ∩ B`): the values that belong to both `A` and `B`. If the intersection is `none()`, the two types have no value in common.

A value of type `A` is accepted where type `B` is required as follows:

| `A` | Accepted where `B` is required when |
| --- | --- |
| Not wrapped in `dynamic` | `A ⊆ B` (it **will** work) |
| `dynamic(T)` | `T ∩ B` is not `none()` (it **might** work) |

After a successful use of `dynamic(T)` where `B` is required, the type of that use is `dynamic(T ∩ B)`. The wrapper is kept. The inner type may shrink.

```
(+ 1 2)                 ; number() ⊆ number(). Will work.
(+ 1 "x")               ; "x" ⊆ number()? No. Error.
(+ 1 (get-prop "n"))    ; get-prop is dynamic(number() or nil).
                        ; (number() or nil) ∩ number() = number().
                        ; Might work. Allowed.
```

`any()` is not accepted where `number()` is required: `any()` is not a subtype of `number()`. `dynamic(any())` is accepted there: `any() ∩ number() = number()`.

---

## Types

A type is a set of values.

### `none()` and `any()`

| Type | Values | Notes |
| --- | --- | --- |
| `none()` | No values | The empty set. A check that requires a non-empty intersection and gets `none()` is an error. |
| `any()` | Every value | Top type. Everything is a subtype of `any()`. `any()` is a subtype only of `any()`. |

`any()` is **not** accepted everywhere. A command that requires `number()` rejects `any()`, because that value might not be a number. Use `dynamic(any())` for a value that has not been constrained yet (for example an unannotated parameter). That form is accepted wherever some value would work.

### `nil`

| Type | Values |
| --- | --- |
| `nil` | Only `nil` |

`nil` is false in `if`, `and`, `or`, and `not`.

### Booleans

| Type | Values |
| --- | --- |
| `true` | Only `true` |
| `false` | Only `false` |
| `bool()` | `true` and `false` |

`true ⊆ bool()` and `false ⊆ bool()`. `false` is false in `if`. `true` is true in `if`.

### Numbers

| Type | Values |
| --- | --- |
| `number()` | Every number |

Exact numbers are not types. `0` and `3.5` both have type `number()`. A pattern `(0)` therefore has argument type `number()`, not “the number zero”. Runtime still matches only `0`.

### Strings

| Type | Values |
| --- | --- |
| `"door-cell"` | Only that exact text |
| `unknown_string()` | A string whose text is not known |
| `string()` | Every string: every exact text, and `unknown_string()` |

Exact text is a subtype of `string()`. `unknown_string()` is a subtype of `string()`. Exact text is **not** a subtype of `unknown_string()`. `unknown_string()` is **not** a subtype of any exact text.

```
"a" ∩ "a"                 = "a"
"a" ∩ "b"                 = none()
"a" ∩ unknown_string()    = none()
"a" ∩ string()            = "a"
unknown_string() ∩ string() = unknown_string()
```

`(str "a" "b")` has type `"ab"`. If any argument is not exact text, the result is `unknown_string()`. `(str '+)` is `"+"`. `(str true)` is `"true"`.

### Symbols

A symbol is a name as data. `'hits` is a symbol. `` `foo bar` `` is a symbol whose name has a space.

| Type | Values |
| --- | --- |
| `'+` | Only that exact symbol |
| `unknown_symbol()` | A symbol whose name is not known |
| `symbol()` | Every symbol: every exact symbol, `unknown_symbol()`, `true`, `false`, and `nil` |

Exact symbols print as `'hits`. A name that is not a bare token prints as `` '`foo bar` ``.

`'+ ⊆ symbol()`. `'+ ∩ 'once` is `none()`. A symbol is **not** a string. `"hits" ∩ 'hits` is `none()`. `id()` is strings, not symbols.

`(symbol "hits")` is `'hits`. `(symbol (str "a" n))` is `unknown_symbol()`. `(symbol true)` is `true`.

`true`, `false`, and `nil` are interned symbols.

| | |
| --- | --- |
| `true ⊆ bool()` | `true ⊆ symbol()` |
| `false ⊆ bool()` | `false ⊆ symbol()` |
| `nil` is not `bool()` | `nil ⊆ symbol()` |

`bool() ∩ symbol()` is `true or false`. `'true` and `true` are the same value.

At run time each distinct name is one object. `quote` of a symbol, `(symbol …)`, and `eval` of a symbol all return that interned value. Source trees keep their own spans.

### `id()`

`id()` is the union of exact strings that name things, marks, and zones on the current map, plus exact `id:` strings passed to `spawn` or `spawn-fill` anywhere in the script, plus `"player"`.

Collection is **not** order-dependent. The whole script is scanned first. Every occurrence of `id()` in the script, including uses that appear before the `spawn` in source, includes those names.

`"player"` is always a member of `id()`. It is the player. Nothing else may use that name: the editor, map load, `spawn`, and `spawn-fill` all reject it.

If the map has `door-cell` and the script contains `(spawn … [id: "warden"])`:

```
id() = "player" or "door-cell" or "warden" or …
```

When a union of those names is long, the checker writes `id()` instead of listing them. It does **not** use `id()` for other long unions of exact text.

### `wall_type()`, `thing_type()`, `shape_type()`

These are fixed unions of exact text. They do not depend on the map.

```
wall_type()   = "empty" or "tech-panel" or "blood-brick" or "rust-metal"
                or "circuit" or "stone" or "hazard"
thing_type()  = "enemy" or "ammo" or "health" or "exit"
                or "door" or "teleport" or "pickup" or "button"
shape_type()  = "diamond" or "square" or "star" or "explosion"
                or "circle" or "triangle" or "cross"
```

A command that wants a wall type requires `wall_type() or unknown_string()`. `"stone"` is in `wall_type()`. `"lair"` is not, and is not `unknown_string()`, so it is an error. `(str "tech-" x)` is `unknown_string()` and is accepted.

### Names and places

These names are aliases used in the rest of this document. They are not extra kinds of value.

```
name   = id() or unknown_string()
point  = [number() number()]
place  = name or point or list(name or point)
```

A command that requires `name` accepts:

| Value | Why |
| --- | --- |
| `"door-cell"` when that string is in `id()` | `"door-cell" ⊆ id() ⊆ name` |
| `"player"` | Always in `id()`. |
| `"door-cel"` when that string is not in `id()` | Not a subtype of `id()` or of `unknown_string()`. Error. |
| `(str "door-" x)` | Type `unknown_string()`, which is a subtype of `name`. |
| `(spawn … [id: "warden"])` | Result `"warden"`, and `"warden"` is a member of `id()`. |

`hurt`, `shoot`, `use`, and `pickup` may also pass `""` as `target` when there is no name. `remove` does not accept `"player"` (will not work). `dynamic` of a name may still try `remove` and fail at run time.

### Lists

| Type | Values |
| --- | --- |
| `empty_list()` | Only `[]` |
| `[T1 T2 … Tn]` | Lists of length `n` whose slots have those types |
| `list(T)` | Lists of any length whose items have type `T`, including `[]` |

```
[]              ; empty_list()
[11.5 6.5]      ; [number() number()]
(cons 1 [])     ; [number()]
(rest [1 2 3])  ; [number() number()]
```

`empty_list() ⊆ list(T)` for every `T`. `empty_list()` is not a subtype of a fixed-length `[T1 T2]`.

`[T1 T2 … Tn] ⊆ list(U)` when each `Ti ⊆ U`. Two fixed-length lists are related only when they have the same length and each slot is a subtype of the corresponding slot.

### Maps

Keys are strings. The checker tracks a type per known key. A map may also have a rest type `*: T` for unknown keys.

| Type | Values |
| --- | --- |
| `empty_map()` | Only `[:]` |
| `[a: Ta b: Tb]` | Maps that have (at least) those keys with those types |
| `[a: Ta *: T]` | Those known keys, plus other keys of type `T` |

```
[:]                     ; empty_map()
[a: "example" b: 2]     ; [a: "example" b: number()]
(set [:] "hits" 0)      ; [hits: number()]
(merge [a: 1] [b: "x"]) ; [a: number() b: "x"]
```

`(merge a b)` keeps keys from both maps. On the same key, `b` wins.

`(get m k)` and `(set m k v)` take `k` as a string or as a list of strings (a path). `(get m ["a" "b"])` walks nested maps. A missing key is `nil`. A non-map in the middle of a path is an error.

`(set m k nil)` deletes that key. `(set m ["a" "b"] 1)` creates missing maps in the middle.

`(update m k f)` reads the key (or `nil` if missing), calls `f` with that value, and writes the result. If `f` returns `nil`, the key is deleted.

`empty_map()` is a subtype of a map with no known keys. It is not a subtype of `[a: T]`.

### Functions

A function type is a list of **arrows**, one per clause. The printed form is `fn`.

```
(number()) -> number()
(target: "panel") -> nil
```

The type of a function is all of its arrows at once. It is not one combined arrow. `int → int` together with `string → string` is not `(int or string) → (int or string)`.

A call matches an arrow when the arguments fit that arrow (will-work or might-work, same rule as above). Missing keyword arguments are treated as `nil`. If several arrows match, the result is `dynamic(union of those results)`. If none match, the call is an error.

### Unions

```
A or B or C
```

A value of a union is a value of at least one member. `A or B ⊆ C` when `A ⊆ C` and `B ⊆ C`. `(A or B) ∩ C` is `(A ∩ C) or (B ∩ C)`.

A union that contains `any()` is `any()`. Members that are `none()` are dropped. A union of one member is that member.

### `dynamic(T)`

`dynamic(T)` is not a larger set of values than `T`. The values are exactly the values of `T`. The wrapper records that the checker **has not proved** which member of `T` the value is.

Static types use the subtype rule (will work). `dynamic` uses the intersection rule (might work).

| Value type | Required | Intersection | Decision | Type of the use |
| --- | --- | --- | --- | --- |
| `number()` | `number()` | `number()` | Will work | `number()` |
| `any()` | `number()` | `number()` | Will not work (`any() ⊈ number()`) | error |
| `dynamic(any())` | `number()` | `number()` | Might work | `dynamic(number())` |
| `number() or nil` | `number()` | `number()` | Will not work (`number() or nil ⊈ number()`) | error |
| `dynamic(number() or nil)` | `number()` | `number()` | Might work | `dynamic(number())` |
| `dynamic(number() or nil)` | `string()` | `none()` | Cannot work | error |
| `nil` | `number()` | `none()` | Cannot work | error |
| `"door-cel"` | `name` | `none()` | Cannot work | error |

`dynamic` never makes an impossible use legal. It only allows uses that are possible for some member of `T`.

#### Example

```
(on start ()
  (set-prop "hits" 0))

(on hurt (target: "player")
  (set-prop "hits" (+ (get-prop "hits") 1)))
```

1. The whole script is scanned. `"hits"` is written with type `number()`.
2. `(get-prop "hits")` has type `dynamic(number() or nil)`. The `nil` is included because a read may occur on a path that has not written yet.
3. `+` requires `number()`. `(number() or nil) ∩ number() = number()`, so the use is allowed. The use has type `dynamic(number())`.
4. `+` itself returns `number()`. That is written back with `set-prop`.

If no `set-prop` writes `"hits"`, `(get-prop "hits")` has type `nil`, not `dynamic`. Then `(+ (get-prop "hits") 1)` is an error: `nil ⊈ number()`.

#### Where `dynamic` is produced

| Source | Result |
| --- | --- |
| Unannotated `def` / `fn` / `on` bind parameter | `dynamic(any())` until the body constrains it |
| `(get-prop "hits")` after writes of `T1`, `T2`, … | `dynamic(T1 or T2 or … or nil)` |
| `(get-prop k)` when `k` is not exact text | `dynamic(any())` |
| A call that matches more than one clause | `dynamic(union of those results)` |
| `(and …)` and `(or …)` | `dynamic(type of last argument or false or nil)` |
| `(map …)` and `(filter …)` | `list(dynamic(any()))` |
| `(reduce xs init f)` | `dynamic(type of init)` |
| `(nth xs i)` on a fixed-length list | `dynamic(slot types or nil)` |
| `(get m k)` when `k` is not exact text | `dynamic(value types or nil)` |
| `(set m k v)` when `k` is not exact text | `dynamic` map |
| `(from-pairs …)` | `dynamic` map |
| `(first xs)` / `(rest xs)` when `xs` is not a known list | `dynamic(…)` |
| `(get-attr …)` | `dynamic(any())` (see Things; this is looser than the field table) |
| Unknown name, or a failed check that continues | `dynamic(any())` or `dynamic(required type)` |

`any()` and `none()` are never needed as inner types of `dynamic` except `dynamic(any())`, which is the unconstrained parameter type. `dynamic(none())` is not used. `dynamic(dynamic(T))` is `dynamic(T)`.

---

## Literals and other syntax

| Syntax | Type |
| --- | --- |
| `0`, `1`, `-2`, `3.5` | `number()` |
| `true` | `true` |
| `false` | `false` |
| `nil` | `nil` |
| `"text"` | `"text"` |
| `'hits` | `'hits` |
| `` '`foo bar` `` | `` '`foo bar` `` |
| `[]` | `empty_list()` |
| `[a b c]` | `[type of a, type of b, type of c]` |
| `[:]` | `empty_map()` |
| `[k: v …]` | `[k: type of v …]` |
| `; comment` | Ignored. A comment form has type `nil`. |
| `name` (symbol) | Lookup: `true` / `false` / `nil`, else a parameter or `def`. Unknown names are an error. |
| `(f …)` | Result type of the call |
| `k:` in a call or parameter list | A keyword name, not a value |

A map cannot mix plain items and `k:` pairs. That is a parse error.

In a parameter list, `target:` binds the keyword `target` to the name `target`. `target: "panel"` matches only when that keyword is the exact string `"panel"`.

---

## Other aliases

```
thing_type()  = "enemy" or "ammo" or "health" or "exit"
                or "door" or "teleport" or "pickup" or "button"
wall_type()   = "empty" or "tech-panel" or "blood-brick" or "rust-metal"
                or "circuit" or "stone" or "hazard"
shape_type()  = "diamond" or "square" or "star" or "explosion"
                or "circle" or "triangle" or "cross"

thing    = thing_type() or unknown_string()
wall     = wall_type() or unknown_string()
variant  = "grunt" or "bruiser" or unknown_string()
shape    = shape_type() or unknown_string()
color    = number() or string() or unknown_string()
stringy  = string() or unknown_string()
mapy     = empty_map() or a map
listy    = empty_list() or list(T) or [T1 T2 …]
```

At run time a color also accepts `"#rrggbb"` and `"#rgb"`. The checker treats any `string()` as a color. A malformed hex string is a run-time error, not a type error.

---

## Keywords

Keywords are special forms. They are not functions. They do not take `k:` arguments unless stated below.

### `def`

```
(def (name args…) body…)
```

Allowed only at the top of the script. Defines a function `name`. The first list is the call with holes: the name, then the parameters. Several `def` forms with the same `name` must sit next to each other. They are clauses of one function. The first matching clause at run time wins.

The parameters after the name are either all positional (`n`, `0`, `"x"`) or all keyword (`target:`, `target: "server"`). Mixing is an error. `[]` is not a parameter list.

| Kind of parameter | Argument type of that clause |
| --- | --- |
| Bind, such as `n` or `target:` | Starts as `dynamic(any())`. The body is typed once to collect uses, then those names are updated. If the body never constrains a name, it stays `dynamic(any())`. If the body uses it as a number (for example `(- n 1)`), it becomes `number()`. If the body uses it as a place (for example `(set-wall place …)` or `(spawn-fill target …)`), it becomes that place type. A name bound by `let` is updated the same way after the `let` body is typed. Every use of that name, including earlier ones, then has that type. |
| Literal, such as `0` or `"server"` | The type of that literal. `0` is `number()`. `"server"` is `"server"`. The body does not change this. |

So `(name 0)` and `(name n)` do **not** always have the same argument type. They have the same type when `n` is inferred to `number()` and the literal `0` is typed as `number()`. If `n` is unused, the bind clause accepts `dynamic(any())` and the `(name 0)` clause still requires `number()`. A use only inside one branch of `if` does not constrain the parameter for the whole clause.

When two clauses print the same arrow, the type of the function shows that arrow once.

The result of a clause is the type of the last form in `body`. An empty body is `nil`.

A `def` that is not at the top of the script is an error.

### `defm`

```
(defm (name args…) body…)
```

Allowed only at the top of the script. Same clause rules as `def`. `name` cannot also be a `def`, a keyword, or a built-in.

The body runs while the script loads. Each parameter is bound to the argument *form*, not the evaluated value. A positional list may end with `@rest` (often written `@body`). That binds leftover forms as `list(any())`. It must be last. A clause with `@rest` matches at least as many arguments as the names before it. `(n @rest)` covers a later `(n)` or `(n m)`. Regular functions (`def`, `fn`, `on`) cannot use `@rest`.

The result of the body is a form. That form replaces the call, then it is typed and run.

A `let` in the result is private: its names are renamed so they do not clash with the call site. `let!` is the same as `let` after expansion, but those names are not renamed, so spliced caller code can see them.

Free names in the expansion resolve at the call site. The `defm` body itself runs in the script’s function environment, not in a caller `let`.

The type of a macro call is the type of the expanded form. Expansion errors are reported on the call.

A `defm` that is not at the top of the script is an error.

### `fn`

```
(fn (params…) body…)
(fn (nil) 1
 fn (n) (+ n 1))
(fn + #1 1)
(fn (+ #1 1))
```

Same parameter rules as `def` for a long `fn`. A bare `fn` at that level starts another clause. Nested `(fn …)` is a new function, not a separator. The result type is `fn` with one arrow per clause. When two clauses print the same arrow, that arrow is shown once. The function may use names from the enclosing scope.

`[]` is not a parameter list. `(fn [x] …)` is an error.

If `#1`, `#2`, … appear in this `fn` (not inside a nested `fn`), the form is short. `#1` is the first argument. The highest index is the arity. Missing lower indexes are unused binds. `#0` and a bare `#` are errors. `#1` inside a string is not a slot.

A short `fn` cannot contain another `fn`. A short `fn` is one expression. One item after `fn` is that expression. Two or more items are wrapped as one call:

| Form | Meaning |
| --- | --- |
| `(fn (+ #1 1))` | add one, return the number |
| `(fn + #1 1)` | the same call |
| `(fn (n) (+ #1 1))` | call `n` with no arguments, add one, call that result with the sum |
| `(fn #1)` | return the argument |

`#1` starts as `dynamic(any())` and is inferred from the body the same way as a named bind.

### `on`

```
(on event (params…) body…)
```

Allowed only at the top of the script. Same clause rules as `def`. `event` must be a name in the event table. An unknown event is an error.

The result of an `on` body is discarded.

Event payload keys, when bound without a literal pattern, have the types in the event table (not `dynamic(any())`).

### `let`

```
(let map body…)
```

`map` must be a map (`empty_map()` or `[k: T …]`), or `dynamic` of a type whose intersection with a map is not `none()`. Each key becomes a name in `body` with that key’s type. The result is the last form of `body`.

### `let!`

```
(let! map body…)
```

Typed the same as `let`. In a macro expansion, `let!` keeps the map keys as written so spliced caller code can use those names. After expansion it is a `let`.

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

`else` and `else if` belong to this form. They are not functions.

`test` may have any type. The checker does not require `bool()`. A value is false when it is `nil` or `false`. Every other value is true.

The result type is the union of the branch results.

Narrowing applies only to a **bound name**, and only inside that `if`.

| Test | True branch | False branch |
| --- | --- | --- |
| `v` (a name) | `v` with `nil` and `false` removed | `v` as `nil` or `false` |
| `(str? v)` | `v ∩ (string() or unknown_string())` | `v` unchanged |
| `(num? v)` | `v ∩ number()` | `v` unchanged |
| `(bool? v)` | `v ∩ bool()` | `v` unchanged |
| `(nil? v)` | `v ∩ nil` | `v` unchanged |
| `(list? v)` | `v ∩` a list type | `v` unchanged |
| `(map? v)` | `v ∩` a map type | `v` unchanged |

`if not` swaps the two columns.

A later `(get-prop "hits")` is a new lookup. It is not narrowed.

The checker does not report that a branch never runs.

### `and`

```
(and a b …)
```

Each argument is typed. The result is `dynamic(type of the last argument or false or nil)`.

### `or`

```
(or a b …)
```

Each argument is typed. The result is `dynamic(type of the last argument or false or nil)`.

### `not`

```
(not x)
```

`x` may have any type. The result is `bool()`.

### Quote, comma, and `@`

```
'form
,form
@form
```

`'` quotes. The form is data. It is not called. A quoted word has type `'that-word` (a symbol). `'true` has type `true`. A quoted number has type `number()`. `'(+ 1 2)` has type `['+ number() number()]`.

`,` is only valid inside `'`. It evaluates that form and inserts the value.

`@` inserts a list into the list around it. The form after `@` must be a list. `(+ 1 @[2 3])` is `(+ 1 2 3)`. `(a b @'(c d))` is `(a b c d)`. `'(a @xs)` splices the value of `xs`. An empty list inserts nothing.

`pipe` uses `'` internally so a list value is not called as a function.

A comma outside `'` is an error. `@` outside a list is an error.

### `eval`

```
(eval form)
```

`form` may have any type. The argument is evaluated. Then that value is evaluated again as code, in the same names. The result is `dynamic(any())`. A quoted call such as `'(+ 1 2)` runs as a call. A list `[1 2]` stays a list.

### `after`

```
(after seconds body…)
```

| Slot | Type |
| --- | --- |
| `seconds` | `number()` |
| `body` | Typed in the same environment as the caller |

The result is `nil`. The body still contributes `set-prop` writes and type errors.

### `pipe`

```
(pipe value step…)
```

Requires a value and at least one step. The result is the type after the last step.

Each step is a name `f` or a call `(f extra…)`. The current value is the **first** argument of `f`. Steps cannot use `k:` arguments.

```
(pipe xs
  (map (fn * #1 2))
  (reduce 0 (fn + #1 #2)))
```

---

## Events

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

A missing key at run time is `nil`. A bind of that key is still given the payload type above. A literal pattern such as `(target: "panel")` has argument type `"panel"`.

`shoot` uses `""` when the wall has no name. `hurt` uses `"player"` when the player takes damage.

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
| `locked` | `door` | any (run time uses truthiness) |
| `open` | `door` (`set-attr` only) | any (truthiness) |
| `health` | `player` | `number()` |
| `ammo` | `player` | `number()` |
| `inventory` | `player` | `map` with rest `number()` |
| `x`, `y`, `angle` | `player` | `number()` |

If the id is exact text and the kind of that id is known (from the map or from `spawn` / `spawn-fill` with that `id:`), a field that kind does not have is an error.

If the id is `unknown_string()`, any field in this table is allowed. A field that no kind has is an error.

---

## Built-in functions

None of these take `k:` arguments. Using `k:` is an error. Arguments are positional. `…` means zero or more.

### Numbers

| Call | Arguments | Result |
| --- | --- | --- |
| `(+ …)` | each `number()` | `number()` (no arguments: `0`) |
| `(* …)` | each `number()` | `number()` (no arguments: `1`) |
| `(- x)` | `number()` | `number()` |
| `(- x y …)` | `number()` each | `number()` |
| `(/ x y …)` | `number()` each | `number()` |
| `(mod a b)` | `number()`, `number()` | `number()` |
| `(abs x)` | `number()` | `number()` |
| `(min …)` | each `number()` | `number()` |
| `(max …)` | each `number()` | `number()` |
| `(floor x)` | `number()` | `number()` |
| `(ceil x)` | `number()` | `number()` |

A bind passed to these is constrained toward `number()`.

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
| `(str …)` | any | Concatenated exact text if every argument is exact text; otherwise `unknown_string()` |
| `(symbol x)` | string, symbol, `true`, `false`, or `nil` | `'hits` from `"hits"`; `true` from `"true"` or `true`; `unknown_symbol()` from `unknown_string()` |

`(str '+)` is `"+"`. `(str true)` is `"true"`.

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

`map` and `filter` walk a list as its items, or a map as `["key" value]` pairs. The checker does not yet type the argument or the result of `f`. `reduce` walks from the start; `f` takes `(acc item)`. The checker does not yet type `f`.

### Maps

| Call | Arguments | Result |
| --- | --- | --- |
| `(get m k)` | `mapy`, key or path | See below |
| `(set m k v)` | `mapy`, key or path, any | See below |
| `(update m k f)` | `mapy`, key or path, `fn` | a map |
| `(merge …)` | each `mapy` | See below |
| `(pairs m)` | `mapy` | `list(["string()" any()])` |
| `(from-pairs xs)` | list | `dynamic` map |
| `(keys m)` | `mapy` | `list(string() or unknown_string())` |
| `(vals m)` | `mapy` | `list(any())` |

`k` is a string or a list of strings. A list walks nested maps.

`get`:

| `m` and `k` | Result |
| --- | --- |
| `empty_map()` | `nil` |
| `[a: Ta …]` and `k` is `"a"` | `Ta` |
| `[a: Ta …]` and `k` is exact text not in the map | `nil`, or rest type or `nil` if `*: rest` is present |
| `[a: Ta b: Tb]` and `k` is `unknown_string()` | `dynamic(Ta or Tb or nil)` |
| `[a: [b: Tb]]` and `k` is `["a" "b"]` | `Tb` |

`set`:

| `m` and `k` | Result |
| --- | --- |
| `empty_map()` and `k` is `"a"` | `[a: type of v]` |
| `[…]` and `k` is `"a"` | the same map with `a` replaced by the type of `v` |
| `v` is `nil` | the key is removed |
| `k` is not exact text | `dynamic` map |

`update` types `f` against the current value at that path, then behaves as `set` of `f`’s result.

`merge` of known maps is a known map. Later keys win. `merge` of `empty_map()` with `m` is `m`. If a map is not known, the result is a `dynamic` map.

### Predicates

Each takes one argument of any type. The result is `bool()`.

| Call | True at run time when |
| --- | --- |
| `(empty? x)` | `nil`, `[]`, `[:]`, or `""` |
| `(list? x)` | a list |
| `(map? x)` | a map |
| `(num? x)` | a number |
| `(str? x)` | a string |
| `(symbol? x)` | a symbol, including `true`, `false`, and `nil` |
| `(bool? x)` | `true` or `false` |
| `(nil? x)` | `nil` |

See `if` for how these narrow a bound name.

### Script store

This store is global for the script. It is not a map value.

| Call | Arguments | Result |
| --- | --- | --- |
| `(set-prop k v)` | path, any | type of `v` |
| `(get-prop k)` | path | See below |
| `(update-prop k f)` | path, `fn` | result of `f` |

`k` is a string or a list of strings, the same as `get` / `set` / `update`. One string is a top-level name. A list walks inside a map stored under the first name. Missing maps in the middle are created on `set-prop` and `update-prop`. A value of `nil` removes that last key.

`set-prop` records a write to the top-level name for the whole script, including every handler and every `after` body. Order in the file does not matter. A nested write records the new type of that top-level map.

`update-prop` reads the current value at `k` (same type as `get-prop`), calls `f` with that value, and writes the result. The write is recorded like `set-prop`. The result of the call is the result of `f`. If the name was never set, `f` receives `nil`.

`get-prop`:

| `k` | Result |
| --- | --- |
| exact text that was never written | `nil` |
| exact text written as `T1`, `T2`, … | `dynamic(T1 or T2 or … or nil)` |
| exact path `["a" "b"]` | `dynamic` of `get` of those writes of `"a"` along `"b"`, or `nil` |
| not exact text | `dynamic(any())` |

### Player and messages

| Call | Arguments | Result |
| --- | --- | --- |
| `(say …)` | any | `nil` |
| `(win)` | none | `nil` |
| `(lose)` | none | `nil` |

The player is a thing with id `"player"`. Health, ammo, inventory, and pose are player fields. See `set-attr` / `get-attr` / `update-attr`.

### Things

| Call | Arguments | Result |
| --- | --- | --- |
| `(set-attr id fields)` | `name` or `list(name)`, map of fields | `bool()` |
| `(set-attr id key value)` | `name` or `list(name)`, key or path, any | `bool()` |
| `(get-attr id)` | `name` | For `"player"`, the player row. For others, a `dynamic` map |
| `(get-attr id key)` | `name`, key or path | For `"player"`, the field type. For others, `dynamic(any())` |
| `(update-attr id key f)` | `name` or `list(name)`, key or path, `fn` | `bool()` |
| `(remove id)` | `name` or `list(name)`, not `"player"` | `bool()` |
| `(spawn place type)` | `place`, `thing` | `unknown_string()` |
| `(spawn place type fields)` | `place`, `thing`, map | `id:` if that field is exact text, else `unknown_string()` |
| `(spawn-fill place type)` | `place`, `thing` | `list(unknown_string())` |
| `(spawn-fill place type fields)` | same, plus map | `list` of the same id type as `spawn` |
| `(teleport who dest)` | `name`, `place` | `bool()` |

`fields` for `spawn` / `spawn-fill` may have: `id`, `variant`, `dest`, `label`, `color`, `locked`, `disabled`, `shape`. `id: "player"` is an error. Other keys are an error. Keys that do not belong to `type` are an error when `type` is exact text.

`set-attr` map keys may have the fields of that kind, including player fields when the id is `"player"`. `type` and `id` cannot be set.

### Walls

| Call | Arguments | Result |
| --- | --- | --- |
| `(set-wall place fields)` | `place`, map | `bool()` |
| `(get-wall place)` | `place` | `[type: wall_type() or unknown_string(), color: color, floor: color, ceiling: color]` |
| `(get-wall place attr)` | `place`, `"type"` or `"color"` or `"floor"` or `"ceiling"` | `wall_type() or unknown_string()` for `"type"`, `color` otherwise |
| `(update-wall place field f)` | `place`, those four names, `fn` | `bool()` |

`fields` for `set-wall` may have: `type`, `color`, `floor`, `ceiling`. `type` must fit `wall_type() or unknown_string()`. Other keys are an error. At least one field is required at run time.

If `place` is a zone, `get-wall` needs every square to have the same fields. If they do not, that is an error.

If `attr` is exact text that is not one of those four names, that is an error. If `attr` is `unknown_string()`, the result is `dynamic(any())`.

---

## How a script is typed

1. Parse. A parse error stops here. One mark on the bad text.
2. Collect `id()` from the map. Scan the whole script and add exact `id:` values from `spawn` and `spawn-fill`, with that thing type. This step does not depend on source order.
3. Collect top-level `def` and `on` clauses. Reject unknown events, bad parameter lists, and `def` / `on` that are not at the top.
4. First walk: record every `set-prop` write; type function bodies so bind parameters are constrained; build `fn` arrows.
5. Second walk: type the script again with those writes and function types. Report errors.

Top-level forms that are not `def` or `on` are a boot body. They run when the fight starts, before `on start`.

---

## Editor

The checker waits a short time after the last edit. Hover a name in the script to see its type at that point. Overlapping marks join into one mark. The message is a tooltip on the mark. Next to Script, a count shows how many errors there are.

Parse errors and type errors use the same marks.
