# Script types

This document describes the type checker for map scripts. It is the design, not a walk through the code.

The checker runs in the editor a short time after you stop typing. It marks the text that is wrong. Hover a mark, or put the caret on it, to read the message.

The checker only reports a problem when the types **cannot** work. If the code might still be right, the checker stays quiet.

Types come from built-in commands and from the current map. You do not write type names in a script.

## Exact values and unknown values

A type is a set of values.

| Kind | Exact | Unknown | All values of that kind |
| --- | --- | --- | --- |
| String | `"door-cell"` | `unknown_string()` | `string()` |
| Number | (not tracked) | — | `number()` |
| Boolean | `true`, `false` | — | `bool()` |
| Nil | `nil` | — | `nil` |

`"door-cell"` is not a subtype of `unknown_string()`. They only meet under `string()`.

`(str "a" "b")` is `"ab"`. If either side is not known text, the result is `unknown_string()`.

Every number is `number()`. The checker does not keep exact numbers such as `0` or `3`.

`true` and `false` are subsets of `bool()`.

`any()` is every value. `none()` is no value. You should not see `none()` in a good script.

## Names on the map

`id()` is the set of names on **this** map: things, marks, and zones. The checker also adds names created by `spawn` / `spawn-fill` when the `id:` field is known text.

A command that wants a name accepts `id() or unknown_string()`.

- `"door-cell"` is fine if that name is on the map.
- `"door-cel"` is an error. It is exact text that is not a name.
- A name from `str` or from `spawn` without a known `id:` is `unknown_string()`. That is allowed.

`"player"` is also a valid name for `teleport` and for the `hurt` event.

## Maps

A map keeps a type for each known key.

`[a: "example" b: 2]` has type `[a: "example" b: number()]`.

`[:]` is `empty_map()`.

`(get m "a")` uses the type of key `a`. If the key might be missing, the result also includes `nil`.

`(get m k)` when `k` is `unknown_string()` uses the union of the value types, or `nil`.

`(set m "a" v)` returns a new map. Key `a` now has the type of `v`.

`(merge a b)` keeps keys from both maps. A later map wins on the same key.

## Lists

`[]` is `empty_list()`.

A list of known slots is written `[T1 T2 …]`. Example: `[11.5 6.5]` is `[number() number()]`.

A list of unknown length is `list(T)`.

The checker keeps the tightest shape it can prove.

## `dynamic`

`dynamic(T)` means “this is `T`, but we are not sure.” A use of `dynamic(T)` is allowed when `T` **overlaps** the type that the command needs.

The main case is `get-prop`.

## Props

`(set-prop "hits" 0)` stores `number()` under `"hits"`.

`(get-prop "hits")` is `dynamic( (union of every set-prop to "hits") or nil )`.

If nothing in the script writes `"hits"`, `(get-prop "hits")` is `nil`.

If the key is not known text, `(get-prop k)` is `dynamic(any())`.

## Functions

Each `def` or `fn` clause has an arrow: argument types to a result type.

The type of the function is **all** of those arrows at once. `int → int` and `string → string` is not `(int or string) → (int or string)`.

Clause order matters at run time. The checker carves earlier exact patterns out of later ones when it can. For numbers, every number is `number()`, so a clause `(0)` and a clause `(n)` have the same argument type.

A call is fine when the arguments overlap at least one clause. If several clauses could match, the result is the union of those results, often wrapped in `dynamic`.

A parameter with no literal pattern starts as `any()`. If the body uses it as a number, the checker tightens it to `number()`.

A function may call itself. The checker types the body twice so the recursive call can see the function type.

## `if`

After a test, a **bound name** can get a tighter type.

```
(let [v: (get-prop "hits")]
  (if v
    (+ v 1)
  else
    (set-prop "hits" 0)))
```

In the true branch, `v` is not `nil` and not `false`. In the false branch, `v` is `nil` or `false`.

`(str? v)`, `(num? v)`, `(bool? v)`, `(nil? v)`, `(list? v)`, and `(map? v)` also tighten `v` in the true branch.

A later `(get-prop "hits")` is a new lookup. It is not narrowed.

The checker does not warn that a branch never runs.

## `let` and `pipe`

`(let map body…)` types `map`, then binds each key as a name in `body`.

`(pipe value step…)` types `value`, then each step. The current value is the first argument of the next step.

## Places

A place is:

- a name (`id()` or `unknown_string()`), or
- a point `[number() number()]`, or
- a list of those.

`spawn`, `spawn-fill`, `set-wall`, `get-wall`, and `teleport` use this.

## Things and fields

Thing types: `"enemy"`, `"ammo"`, `"health"`, `"exit"`, `"door"`, `"teleport"`, `"pickup"`, `"button"`.

| Field | Thing |
| --- | --- |
| `id` | every type |
| `type` | every type (read only through `get-attr`) |
| `variant` | enemy (`"grunt"` or `"bruiser"`) |
| `dest` | teleport |
| `label`, `color`, `shape` | pickup |
| `locked`, `open` | door |
| `disabled` | button |

When the id is a known name, only fields of that kind are allowed.

When the id is `unknown_string()`, any field that **some** kind of thing has is allowed.

Wall `type` values: `"empty"`, `"tech-panel"`, `"blood-brick"`, `"rust-metal"`, `"circuit"`, `"stone"`, `"hazard"`.

Pickup `shape` values: `"diamond"`, `"square"`, `"star"`, `"explosion"`, `"circle"`, `"triangle"`, `"cross"`.

## Built-in results

| Command | Result (typical) |
| --- | --- |
| `+` `-` `*` `/` `mod` `abs` `min` `max` `floor` `ceil` `len` | `number()` |
| `=` `/=` `<` `>` `<=` `>=` | `bool()` |
| `str` | `"ab"` if both sides are known text, else `unknown_string()` |
| `cons` `first` `rest` `nth` `append` | list types as above |
| `map` `filter` | `list(dynamic(any()))` |
| `reduce` | `dynamic` of the init type |
| `pairs` `keys` `vals` `from-pairs` | list or map as named |
| `empty?` `list?` `map?` `num?` `str?` `bool?` `nil?` | `bool()` |
| `get` | the field type, or `nil` |
| `set` | a new map |
| `merge` | a map |
| `get-prop` | `dynamic(writes or nil)` |
| `set-prop` | the stored value |
| `has` `give` `take` | `bool()` |
| `say` `win` `lose` `after` | `nil` |
| `set-attr` `set-wall` `remove` `teleport` | `bool()` |
| `get-attr` | a map of fields, or one field |
| `get-wall` | `[type: … color: … floor: … ceiling: …]` or one field |
| `spawn` | the `id:` text if known, else `unknown_string()` |
| `spawn-fill` | `list` of those names |

## Events

| Event | Keys |
| --- | --- |
| `start` | none |
| `enter` `leave` | `zone`, and the checker treats `zone` as a name |
| `use` `shoot` | `target`, `x`, `y` |
| `die` | `enemy`, `x`, `y` |
| `pickup` | `target` |
| `hurt` | `target`, `amount` |
| `teleport` | `pad` |

`x`, `y`, and `amount` are `number()`. Name keys use `id() or unknown_string()`. `shoot` may pass `""` as `target`.

## How inference runs

1. Parse the script. A parse error stops here.
2. Collect names from the map and from `spawn` / `spawn-fill` with a known `id:`.
3. Collect `def` and `on` clauses.
4. Walk the script once to record `set-prop` writes and to tighten parameters.
5. Walk the script again to report errors, using those writes and function types.

A use is an error only when the argument type and the needed type share **no** values.

## Marks in the editor

The checker waits about 1.5 seconds after the last edit. Overlapping marks join into one mark. The message is a tooltip on the mark. The line under the editor also lists messages.
