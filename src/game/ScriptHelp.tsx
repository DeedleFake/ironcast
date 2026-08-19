import { useState } from "react";
import { formatLisp } from "./lisp";

const SAMPLE_SRC = `; Use the same names as the editor. announce is a small helper.
(def announce (msg)
  (say (str ">> " msg)))

; Lock the armory. Tell the player to find the key.
(on start ()
  (set-attr id: "door-armory" locked: true)
  (announce "Find the red key."))

; The key opens the lock.
(on pickup (target: "key-red")
  (set-attr id: "door-armory" locked: false)
  (announce "Armory unlocked."))

(on use (target: "door-armory")
  (if (get-attr "door-armory" "locked")
    (say "Locked. Need the red key.")
  else
    (set-attr id: "door-armory" open: true)))

; sprung remembers that the ambush already ran.
(on enter (zone: "ambush")
  (if not (get "sprung")
    (set "sprung" true)
    (spawn type: "enemy" at: [14.5 8.5] id: "grunt-a")
    (say "Ambush!")))

(on die (enemy: "grunt-a")
  (after 1
    (set-attr id: "door-exit" open: true)))

(on shoot (target: "panel")
  (set-wall at: "panel" type: "empty")
  (give "ammo" 20))
`;

const SAMPLE = (() => {
  const r = formatLisp(SAMPLE_SRC);
  return r.ok ? r.text : SAMPLE_SRC;
})();

const TABS = [
  "Intro",
  "Types",
  "Syntax",
  "Keywords",
  "Built-ins",
  "Events",
  "Commands",
  "Example",
] as const;

type Tab = (typeof TABS)[number];

export function ScriptHelp({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("Intro");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-labelledby="script-help-title"
        className="flex max-h-[min(42rem,92dvh)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
      >
        <div className="shrink-0 border-b border-border px-5 pt-4 pb-0">
          <h3
            id="script-help-title"
            className="font-display text-lg font-semibold tracking-wide text-fg uppercase"
          >
            Level scripts
          </h3>
          <p className="mt-1 text-sm text-muted">
            Each map has one script. The script is a Lisp program.
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-t-md px-2.5 py-1.5 text-[11px] tracking-wide uppercase ${
                  tab === t
                    ? "bg-surface-2 text-fg"
                    : "text-dim hover:text-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-muted">
          {tab === "Intro" ? <Intro /> : null}
          {tab === "Types" ? <Types /> : null}
          {tab === "Syntax" ? <Syntax /> : null}
          {tab === "Keywords" ? <Keywords /> : null}
          {tab === "Built-ins" ? <Builtins /> : null}
          {tab === "Events" ? <Events /> : null}
          {tab === "Commands" ? <Commands /> : null}
          {tab === "Example" ? <Example /> : null}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-fg hover:bg-primary-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="text-fg">{children}</code>;
}

function H({ children }: { children: React.ReactNode }) {
  return <p className="font-medium text-fg">{children}</p>;
}

function Block({ children }: { children: React.ReactNode }) {
  return <section className="space-y-1.5">{children}</section>;
}

function Intro() {
  return (
    <div className="space-y-4">
      <Block>
        <H>What a script is</H>
        <p>
          Each map has one script. The game reads the full script at the start
          of the fight.
        </p>
        <p>
          A form that is not <Code>(on ...)</Code> starts at that time. Those
          forms define functions.
        </p>
        <p>
          An <Code>(on ...)</Code> form does not start at load. The game stores
          the body. The game starts that body when the event occurs.
        </p>
        <p>
          A name on the map is a string in the script. The string must match
          the name in the editor.
        </p>
      </Block>
      <Block>
        <H>How to write a script</H>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open the Script panel.</li>
          <li>
            Give a name to each door, button, pickup, zone, and mark that
            the script uses.
          </li>
          <li>
            Write <Code>(on event (args) ...)</Code> forms for the events.
          </li>
          <li>Click Format to rewrite the script with a standard layout.</li>
        </ol>
      </Block>
      <Block>
        <H>Limits</H>
        <p>
          A step is one evaluation of a form. A name lookup is a step. A
          number is a step. A function call is a step. Each argument is also a
          step.
        </p>
        <p>
          The limit is 8000 steps. A count that hits the limit stops. The
          message is <Code>script ran too long</Code>.
        </p>
        <p>
          The count starts at 8000 at the start of the fight. That count is
          for every top-level form that is not an <Code>on</Code> handler.
        </p>
        <p>
          The count starts at 8000 again for each <Code>on</Code> handler. Two
          handlers for the same event each get 8000 steps.
        </p>
        <p>
          Each <Code>after</Code> body starts a new count of 8000.
        </p>
        <p>
          <Code>(on ...)</Code> is valid only at the top of the file. A nested{" "}
          <Code>on</Code> form is an error.
        </p>
      </Block>
    </div>
  );
}

function Types() {
  return (
    <div className="space-y-4">
      <Block>
        <H>Values</H>
        <p>A value has one type. The types are listed here.</p>
      </Block>
      <Block>
        <H>Number</H>
        <p>
          <Code>12</Code>, <Code>14.5</Code>, and <Code>-3</Code> are numbers.
          A number is a count. A number is also a position or a delay.
        </p>
        <p>
          The script does not read hex values such as <Code>0xaa46c8</Code> as
          numbers.
        </p>
      </Block>
      <Block>
        <H>String</H>
        <p>
          <Code>"hello"</Code> is a string. A string is text. A
          string holds a message or a label.
        </p>
      </Block>
      <Block>
        <H>Boolean</H>
        <p>
          <Code>true</Code> and <Code>false</Code> are boolean values. A
          boolean is a yes-or-no value.
        </p>
      </Block>
      <Block>
        <H>nil</H>
        <p>
          <Code>nil</Code> is the empty value. The script reads{" "}
          <Code>nil</Code> as false.
        </p>
      </Block>
      <Block>
        <H>List</H>
        <p>
          <Code>[1 2 3]</Code> is a list. A list holds more than one
          value. <Code>[]</Code> is an empty list.
        </p>
      </Block>
      <Block>
        <H>Map</H>
        <p>
          <Code>[hp: 3 name: "guard"]</Code> is a map. A map holds named
          fields. Each key is a string. <Code>[:]</Code> is an empty map.
        </p>
      </Block>
      <Block>
        <H>Name</H>
        <p>
          A thing name is a string. <Code>"door-armory"</Code> is the
          door with that name. <Code>(str "enemy-" n)</Code> makes a
          name.
        </p>
        <p>
          A word such as <Code>zone</Code> is a variable. The word needs a
          value. An unknown word is an error.
        </p>
      </Block>
      <Block>
        <H>Function</H>
        <p>
          A function is a piece of code with a parameter list.{" "}
          <Code>def</Code> and <Code>fn</Code> make functions.
        </p>
      </Block>
      <Block>
        <H>True and false in tests</H>
        <p>
          <Code>false</Code> and <Code>nil</Code> are false. Every other value
          is true. <Code>0</Code> is true. An empty string is true.
        </p>
      </Block>
    </div>
  );
}

function Syntax() {
  return (
    <div className="space-y-4">
      <Block>
        <H>Forms</H>
        <p>
          A form is one value in the file. Whitespace separates forms. A new
          line does not change the meaning.
        </p>
        <p>
          A comment starts with <Code>;</Code> and goes to the end of the
          line.
        </p>
      </Block>
      <Block>
        <H>Calls</H>
        <p>
          <Code>(</Code> and <Code>)</Code> make a call. The first item is the
          function or the keyword. The other items are arguments.
        </p>
        <p>
          A comma is not a separator. A comma is part of a name.
        </p>
      </Block>
      <Block>
        <H>Number literals</H>
        <p>
          A number is digits. A sign is optional. A fraction is optional.{" "}
          <Code>12</Code>, <Code>+4</Code>, <Code>-3</Code>, and{" "}
          <Code>14.5</Code> are valid. <Code>14.</Code> is not valid.
        </p>
      </Block>
      <Block>
        <H>String literals</H>
        <p>
          A string sits between double quotes.{" "}
          <Code>\n</Code> is a new line. <Code>\t</Code> is a tab. A backslash
          plus one other character inserts that character.
        </p>
      </Block>
      <Block>
        <H>List literals</H>
        <p>
          <Code>[</Code> and <Code>]</Code> write a list.{" "}
          <Code>[1 2 3]</Code> is a list of three numbers.{" "}
          <Code>[]</Code> is an empty list.
        </p>
        <p>
          This is not a call. The script keeps the items. It does not run the
          first item as a function.
        </p>
      </Block>
      <Block>
        <H>Map literals</H>
        <p>
          The same brackets write a map when every item is a{" "}
          <Code>name: value</Code> pair.{" "}
          <Code>[hp: 3 name: "guard"]</Code> is a map.{" "}
          <Code>[:]</Code> is an empty map. <Code>[]</Code> is an
          empty list, not an empty map.
        </p>
        <p>
          A key is a string. <Code>hp:</Code> is the key{" "}
          <Code>"hp"</Code>. A map cannot mix keys and other items.
        </p>
      </Block>
      <Block>
        <H>Words</H>
        <p>
          <Code>true</Code>, <Code>false</Code>, and <Code>nil</Code> are
          words. They are not strings.
        </p>
        <p>
          Any other word is a variable name. A name holds letters and digits. A
          name also holds <Code>-</Code>, <Code>?</Code>, and other marks.{" "}
          <Code>def</Code>, <Code>let</Code>, a function parameter, or an event
          parameter binds the word.
        </p>
      </Block>
      <Block>
        <H>Quote</H>
        <p>
          <Code>(quote x)</Code> returns <Code>x</Code> and does not evaluate
          it.
        </p>
      </Block>
      <Block>
        <H>Evaluation</H>
        <p>
          A number, a string, a boolean, and <Code>nil</Code> evaluate to
          themselves.
        </p>
        <p>
          A name looks up a value. If the name has no value, the script stops
          with <Code>unknown name</Code>.
        </p>
        <p>
          A call <Code>(f a b)</Code> evaluates <Code>f</Code>. Then it
          evaluates each argument. Then it calls <Code>f</Code>. A
          keyword does not follow this rule. The Keywords tab lists those
          forms.
        </p>
        <p>
          A list <Code>[a b]</Code> evaluates each item. It does not call
          the first item. The result is a list of those values.
        </p>
        <p>
          A map evaluates each value. The keys stay as they are. The result
          is a map.
        </p>
      </Block>
    </div>
  );
}

function Keywords() {
  return (
    <div className="space-y-4">
      <Block>
        <H>What a keyword is</H>
        <p>
          A keyword is special syntax. The script does not treat a keyword as
          a normal function. Arguments do not all evaluate first.
        </p>
      </Block>
      <Block>
        <H>if and else</H>
        <p>
          <Code>if</Code> starts a branch. Every form after the test and
          before <Code>else</Code> is the true branch. Every form after{" "}
          <Code>else</Code> is the false branch. The result is the last form
          of the branch that started.
        </p>
        <p>
          A missing <Code>else</Code> means the false branch is{" "}
          <Code>nil</Code>. <Code>else if</Code> adds another test.{" "}
          <Code>if not</Code> and <Code>else if not</Code> flip the test.
        </p>
        <p>Example:</p>
        <pre className="overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-[11px] leading-5 text-fg">
          {`(if (get-attr "door-armory" "locked")
  (say "Locked.")
  (say "Find the key.")
else if (has "key-red")
  (set-attr id: "door-armory" open: true)
else
  (say "Still locked."))`}
        </pre>
      </Block>
      <Block>
        <H>and, or, not</H>
        <p>
          <Code>(and a b)</Code> evaluates from left to right. The form stops
          at the first false value. The form returns that value. If every
          value is true, the form returns the last value.
        </p>
        <p>
          <Code>(or a b)</Code> stops at the first true value. The form
          returns that value. If every value is false, the form returns the
          last value.
        </p>
        <p>
          <Code>(not x)</Code> is true when <Code>x</Code> is false.
        </p>
      </Block>
      <Block>
        <H>let</H>
        <p>
          <Code>(let map body...)</Code> makes local names from a map.
          Each key becomes a name. Each value is the value of that name.
        </p>
        <p>
          <Code>(let [n: 1 m: 2] ...)</Code> uses a map literal.{" "}
          <Code>(let (get-wall target) ...)</Code> uses a map from a
          call. Those names exist only in the body.
        </p>
        <p>
          Values in the map run before the names exist. A binding cannot use
          another binding in the same <Code>let</Code>. To join maps first,
          use <Code>merge</Code>.
        </p>
      </Block>
      <Block>
        <H>pipe</H>
        <p>
          <Code>pipe</Code> sends a value through a list of calls. The
          value becomes the first argument of the next call. Then that
          result becomes the first argument of the call after that.
        </p>
        <p>
          <Code>(pipe xs first)</Code> is the same as{" "}
          <Code>(first xs)</Code>. A name with no extra arguments is a
          call of one argument.
        </p>
        <p>
          <Code>(pipe xs (nth 0) rest)</Code> is the same as{" "}
          <Code>(rest (nth xs 0))</Code>.
        </p>
        <p>
          <Code>map</Code>, <Code>filter</Code>, and <Code>reduce</Code>{" "}
          take the list first, so they work in <Code>pipe</Code>:
        </p>
        <pre className="overflow-x-auto rounded-md bg-[#0e0e12] p-3 font-mono text-xs leading-5 text-fg">
          {`(pipe xs
  (map (fn (v) (* v 2)))
  (reduce 0 (fn (acc cur) (+ acc cur))))`}
        </pre>
        <p>
          A step must be a call or a name. A step cannot use{" "}
          <Code>name:</Code> arguments. <Code>pipe</Code> needs a value
          and at least one step.
        </p>
      </Block>
      <Block>
        <H>def</H>
        <p>
          <Code>(def announce (msg) ...)</Code> makes a function. The form
          matches <Code>on</Code>. The parts are the name, a parameter list,
          and the body. The body can be empty. To store a value, use{" "}
          <Code>set</Code>.
        </p>
        <p>
          A later <Code>def</Code> with the same name adds another clause. The
          clauses must sit next to each other. A form between them is an
          error.
        </p>
        <p>
          A call tries clauses from top to bottom. The first match runs. A
          name in the list matches any value. A literal matches only that
          value. A clause that an earlier clause already covers is an error.
        </p>
        <p>Example:</p>
        <pre className="overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-[11px] leading-5 text-fg">
          {`(def example ("test")
  (say "A test."))

(def example (value)
  (say (str "This is a " value ".")))`}
        </pre>
        <p>
          <Code>(announce "Find the red key.")</Code> runs that
          function.
        </p>
      </Block>
      <Block>
        <H>Keyword arguments</H>
        <p>
          A word that ends in <Code>:</Code> is a key. A key and the next
          value are a pair. The order of pairs does not matter.
        </p>
        <p>
          <Code>(def example (an-arg: other:) ...)</Code> makes a function
          that takes keys. The body uses <Code>an-arg</Code> and{" "}
          <Code>other</Code> with no colon.
        </p>
        <p>
          <Code>(example other: 2 an-arg: 1)</Code> calls that function. A
          missing key binds <Code>nil</Code>. An unknown key is an error. The
          allowed keys are the keys from every clause.
        </p>
        <p>
          <Code>(def example (value: "test") ...)</Code> matches only when{" "}
          <Code>value:</Code> is <Code>"test"</Code>. A key that a clause
          does not list is not checked. To match <Code>nil</Code>, write{" "}
          <Code>value: nil</Code>.
        </p>
        <p>
          Do not mix positional parameters and keyword parameters in one
          list.
        </p>
      </Block>
      <Block>
        <H>fn</H>
        <p>
          <Code>(fn (a b) ...)</Code> makes a function with no name.
        </p>
      </Block>
      <Block>
        <H>quote</H>
        <p>
          <Code>(quote x)</Code> returns <Code>x</Code> with no evaluation.
        </p>
      </Block>
      <Block>
        <H>after</H>
        <p>
          <Code>(after seconds ...)</Code> waits that many seconds. Then the
          body starts. <Code>(after 1 (set-attr id: "door-exit" open: true))</Code>{" "}
          opens that door after one second. The form holds more than one body
          form.
        </p>
      </Block>
      <Block>
        <H>on</H>
        <p>
          <Code>on</Code> is valid only at the top of the script. The Events
          tab describes the form.
        </p>
      </Block>
    </div>
  );
}

function Builtins() {
  return (
    <div className="space-y-4">
      <Block>
        <H>Arithmetic</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(+ a b ...)</Code> adds. One argument is valid. Zero
            arguments return <Code>0</Code>.
          </li>
          <li>
            <Code>(- a)</Code> is the negation of <Code>a</Code>.{" "}
            <Code>(- a b c)</Code> is <Code>a</Code> minus <Code>b</Code>{" "}
            minus <Code>c</Code>.
          </li>
          <li>
            <Code>(* a b ...)</Code> multiplies. Zero arguments return{" "}
            <Code>1</Code>.
          </li>
          <li>
            <Code>(/ a b ...)</Code> divides from the left. A zero divisor
            becomes a tiny number. The script does not stop.
          </li>
          <li>
            <Code>(mod a b)</Code> is the remainder of <Code>a</Code> divided
            by <Code>b</Code>.
          </li>
          <li>
            <Code>(abs a)</Code> is the absolute value.
          </li>
          <li>
            <Code>(min a b ...)</Code> and <Code>(max a b ...)</Code> return
            the smallest or largest number.
          </li>
          <li>
            <Code>(floor a)</Code> drops the fraction. <Code>(ceil a)</Code>{" "}
            goes to the next integer up.
          </li>
        </ul>
      </Block>
      <Block>
        <H>Compare</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(= a b)</Code> is true when the two values are the same.
          </li>
          <li>
            <Code>(/= a b)</Code> is true when the two values are not the
            same.
          </li>
          <li>
            <Code>{"<"}</Code>, <Code>{">"}</Code>, <Code>{"<="}</Code>, and{" "}
            <Code>{">="}</Code> compare two numbers.
          </li>
        </ul>
      </Block>
      <Block>
        <H>Text and lists</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(str a b ...)</Code> joins values into one string.
          </li>
          <li>
            <Code>(len x)</Code> counts characters in a string, items in a
            list, or keys in a map.
          </li>
          <li>
            <Code>[a b ...]</Code> makes a list of the values.
          </li>
          <li>
            <Code>[a: 1 b: 2]</Code> makes a map. <Code>[:]</Code> is
            an empty map.
          </li>
          <li>
            <Code>(merge a b ...)</Code> joins maps into one map. A later
            map wins on the same key. A non-map value is an error.
          </li>
          <li>
            <Code>(cons a xs)</Code> puts <Code>a</Code> at the front of list{" "}
            <Code>xs</Code>.
          </li>
          <li>
            <Code>(first xs)</Code> is the first item. <Code>(rest xs)</Code>{" "}
            is the list without the first item.
          </li>
          <li>
            <Code>(nth xs i)</Code> is the item at index <Code>i</Code>. The
            first index is <Code>0</Code>.
          </li>
          <li>
            <Code>(append a b ...)</Code> joins lists into one list.
          </li>
        </ul>
      </Block>
      <Block>
        <H>map, filter, reduce</H>
        <p>
          These walk a list from the first item to the last. A map is
          walked as <Code>["key" value]</Code> pairs.{" "}
          <Code>map</Code> and <Code>filter</Code> always return a list.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(map xs f)</Code> calls <Code>f</Code> on each item. The
            result is a list of those return values.
          </li>
          <li>
            <Code>(filter xs f)</Code> keeps the items for which{" "}
            <Code>f</Code> is true.
          </li>
          <li>
            <Code>(reduce xs init f)</Code> starts with{" "}
            <Code>init</Code>. For each item, it calls <Code>f</Code> with
            the last result and the current item. That return value is the
            last result for the next item. An empty list returns{" "}
            <Code>init</Code>.
          </li>
        </ul>
        <p>Example:</p>
        <pre className="overflow-x-auto rounded-md bg-[#0e0e12] p-3 font-mono text-xs leading-5 text-fg">
          {`(reduce [1 2 3] 0 (fn (acc cur) (- acc cur)))
; is ((0 - 1) - 2) - 3, so -6`}
        </pre>
        <p>
          With <Code>pipe</Code>:
        </p>
        <pre className="overflow-x-auto rounded-md bg-[#0e0e12] p-3 font-mono text-xs leading-5 text-fg">
          {`(pipe [1 2 3 4]
  (map (fn (v) (* v 2)))
  (filter (fn (v) (> v 4)))
  (reduce 0 (fn (acc cur) (+ acc cur))))
; 6 + 8, so 14`}
        </pre>
      </Block>
      <Block>
        <H>pairs, from-pairs, keys, vals</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(pairs m)</Code> is a list of{" "}
            <Code>["key" value]</Code> pairs, in insert order.
          </li>
          <li>
            <Code>(from-pairs xs)</Code> builds a map from that list. A
            later pair wins on the same key. Each item must be a pair. Each
            key must be a string.
          </li>
          <li>
            <Code>(keys m)</Code> is the list of keys.{" "}
            <Code>(vals m)</Code> is the list of values.
          </li>
        </ul>
      </Block>
      <Block>
        <H>Type tests</H>
        <p>
          <Code>empty?</Code> is true for <Code>nil</Code>, an empty list, an
          empty map, or an empty string.
        </p>
        <p>
          <Code>list?</Code>, <Code>map?</Code>, <Code>num?</Code>,{" "}
          <Code>str?</Code>,{" "}
          <Code>bool?</Code>, and <Code>nil?</Code> test the type of one
          value.
        </p>
      </Block>
    </div>
  );
}

function Events() {
  return (
    <div className="space-y-4">
      <Block>
        <H>The on form</H>
        <p>
          An <Code>(on ...)</Code> form is valid only at the top of the
          script. The form has the same shape as a function:{" "}
          <Code>(on event (args...) body...)</Code>.
        </p>
        <p>
          Keys in the parameter list make the order free.{" "}
          <Code>(on shoot (target: x: y:) ...)</Code> binds those values.{" "}
          <Code>(on shoot (target:) ...)</Code> binds only <Code>target</Code>.
        </p>
        <p>
          A missing key binds <Code>nil</Code>. The first matching clause
          starts. A later <Code>on</Code> for the same event must sit next to
          the last one. A clause that an earlier clause already covers is an
          error.
        </p>
      </Block>
      <Block>
        <H>Event list</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(on start () ...)</Code> starts when the fight begins.
          </li>
          <li>
            <Code>(on enter (zone: "ambush") ...)</Code> starts when the
            player walks into that zone. <Code>(on enter (zone:) ...)</Code>{" "}
            matches any zone.
          </li>
          <li>
            <Code>(on leave (zone:) ...)</Code> starts when the player leaves a
            zone.
          </li>
          <li>
            <Code>(on use (target: x: y:) ...)</Code> starts when the player
            presses E on a door, a pickup, or a button.
          </li>
          <li>
            <Code>(on shoot (target: x: y:) ...)</Code> starts when a shot hits
            a mark or a door. A wall with no name passes an empty string.
          </li>
          <li>
            <Code>(on die (enemy: x: y:) ...)</Code> starts when an enemy dies.
          </li>
          <li>
            <Code>(on pickup (target:) ...)</Code> starts when the player takes
            an item. Ammo, health, and pickups all fire this event.
          </li>
          <li>
            <Code>(on hurt (target: amount:) ...)</Code> starts when the player
            or an enemy takes damage. For the player, <Code>target</Code> is{" "}
            <Code>"player"</Code>.
          </li>
          <li>
            <Code>(on teleport (pad:) ...)</Code> starts when the player uses a
            pad.
          </li>
        </ul>
      </Block>
    </div>
  );
}

function Commands() {
  return (
    <div className="space-y-4">
      <Block>
        <H>Messages and inventory</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(say a b ...)</Code> shows a message. The arguments join
            into one line.
          </li>
          <li>
            <Code>(give "ammo" n)</Code> adds ammo.{" "}
            <Code>(give "health" n)</Code> adds health. Any other
            string goes into the inventory.
          </li>
          <li>
            <Code>(take "ammo" n)</Code> removes ammo.{" "}
            <Code>(take "health" n)</Code> removes health. Any other
            string leaves the inventory.
          </li>
          <li>
            <Code>(has "ammo")</Code> is true when ammo is more than
            zero. <Code>(has "key-red")</Code> is true when that
            string is in the inventory.
          </li>
        </ul>
      </Block>
      <Block>
        <H>Script values</H>
        <p>
          <Code>(set "sprung" true)</Code> stores a value for the
          rest of the fight. <Code>(get "sprung")</Code> reads that
          value. A missing value is <Code>nil</Code>.
        </p>
        <p>
          <Code>(get attrs "locked")</Code> reads a key from a map. A
          missing key is <Code>nil</Code>.
        </p>
      </Block>
      <Block>
        <H>set-attr, get-attr</H>
        <p>
          <Code>set-attr</Code> changes a named thing.{" "}
          <Code>get-attr</Code> reads a named thing.
        </p>
        <p>
          <Code>set-attr</Code> uses keys. <Code>id:</Code> is one
          name or a list of names. Each other key is a field to change.
          The form returns true when every named thing exists.
        </p>
        <p>
          The fields you can change are <Code>locked:</Code>,{" "}
          <Code>open:</Code>, <Code>disabled:</Code>,{" "}
          <Code>dest:</Code>, <Code>label:</Code>,{" "}
          <Code>color:</Code>, <Code>shape:</Code>, and{" "}
          <Code>variant:</Code>.
        </p>
        <p>
          <Code>locked</Code> and <Code>open</Code> belong to doors.{" "}
          <Code>disabled</Code> belongs to buttons. A disabled button does
          not show a use prompt. The player cannot use it.
        </p>
        <p>
          <Code>(set-attr id: "door-armory" locked: true)</Code>{" "}
          locks that door. One call can change more than one field.{" "}
          <Code>(set-attr id: ["door-a" "door-b"] open: true)</Code>{" "}
          changes every name in the list.
        </p>
        <p>
          <Code>(get-attr "door-armory")</Code> returns a map of the
          fields that thing has.{" "}
          <Code>(get-attr "door-armory" "locked")</Code> reads one
          field. If the thing is missing, the result is <Code>nil</Code>.
          You can also read <Code>"type"</Code> and <Code>"id"</Code>.
        </p>
        <p>
          A button is a use point. The player cannot see it. You can put a
          button on a wall. A mark is only a name for a cell. The player
          cannot use a mark.
        </p>
        <p>
          To change a wall, the floor, or the ceiling, use{" "}
          <Code>set-wall</Code>.
        </p>
      </Block>
      <Block>
        <H>set-wall</H>
        <p>
          <Code>set-wall</Code> changes map cells. The call uses keys
          only.
        </p>
        <p>
          The cells are <Code>at:</Code>. <Code>at:</Code> is the name of
          a mark, a door, or a zone, or a point{" "}
          <Code>[x y]</Code>. A zone sets every square in that zone. A
          point is one cell.
        </p>
        <p>
          <Code>type:</Code> is a pattern name. The names are{" "}
          <Code>"empty"</Code>, <Code>"tech-panel"</Code>,{" "}
          <Code>"blood-brick"</Code>,{" "}
          <Code>"rust-metal"</Code>, <Code>"circuit"</Code>,{" "}
          <Code>"stone"</Code>, and <Code>"hazard"</Code>.
        </p>
        <p>
          <Code>color:</Code>, <Code>floor:</Code>, and{" "}
          <Code>ceiling:</Code> are color strings such as{" "}
          <Code>"#6b4a3a"</Code>.
        </p>
        <p>A missing key does not change that attribute.</p>
        <p>Examples:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>
              (set-wall at: "panel" type: "empty")
            </Code>
          </li>
          <li>
            <Code>
              (set-wall at: [5 8] type: "rust-metal" color:
              "#8b3a3a")
            </Code>
          </li>
          <li>
            <Code>
              (set-wall at: "ambush" floor: "#1a3028"
              ceiling: "#0c1014")
            </Code>
          </li>
        </ul>
      </Block>
      <Block>
        <H>get-wall</H>
        <p>
          <Code>get-wall</Code> reads a cell. The call has no keys.
        </p>
        <p>
          <Code>(get-wall "panel")</Code> returns a map with{" "}
          <Code>type</Code>, <Code>color</Code>, <Code>floor</Code>,
          and <Code>ceiling</Code>.{" "}
          <Code>(get-wall "panel" "type")</Code> reads one field.{" "}
          <Code>(get-wall [5 8] "color")</Code> uses a point.
        </p>
        <p>
          The field is <Code>"type"</Code>, <Code>"color"</Code>,{" "}
          <Code>"floor"</Code>, or <Code>"ceiling"</Code>.{" "}
          <Code>type</Code> is a pattern name such as{" "}
          <Code>"empty"</Code> or <Code>"rust-metal"</Code>. The
          color fields are strings such as <Code>"#6b4a3a"</Code>. An
          empty cell has no wall color, so that field is{" "}
          <Code>nil</Code>. A missing mark or thing is{" "}
          <Code>nil</Code>.
        </p>
      </Block>
      <Block>
        <H>remove, teleport, win, lose</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(remove "grunt-a")</Code> deletes that thing.{" "}
            <Code>(remove ["a" "b"])</Code> deletes each
            name in the list.
          </li>
          <li>
            <Code>(teleport "player" "stash")</Code> moves
            the player to that mark, thing, or zone. A zone picks a random
            open cell. If the mover is near that zone, farther cells
            are more likely. <Code>(teleport "player" [5 8])</Code> uses
            a point. The first argument can also be a thing name.
          </li>
          <li>
            <Code>(win)</Code> and <Code>(lose)</Code> end the fight.
          </li>
        </ul>
      </Block>
      <Block>
        <H>spawn</H>
        <p>
          <Code>spawn</Code> adds a thing. The call uses keys only. The
          result is the name of the new thing.
        </p>
      </Block>
      <Block>
        <H>Place</H>
        <p>
          Every call needs <Code>type:</Code> and <Code>at:</Code>.
        </p>
        <p>
          <Code>at:</Code> is the name of a mark, a thing, or a zone, or a
          point <Code>[x y]</Code>. A mark or a thing is one place. A
          zone picks a random open cell. The picker skips walls. It prefers
          a cell with no other thing. The center of a cell is a number that
          ends in <Code>.5</Code>.
        </p>
        <p>
          <Code>fill: true</Code> with <Code>at:</Code> set to a
          zone puts one thing on every open cell in that zone. It skips
          walls, closed doors, and cells that already have a thing. The
          result is a list of the new names. A mark or a thing with{" "}
          <Code>fill: true</Code> still makes one thing, in a list of
          one. <Code>fill:</Code> needs a name, not a point.
        </p>
      </Block>
      <Block>
        <H>Shared keys</H>
        <p>
          <Code>type:</Code> is one of <Code>"enemy"</Code>,{" "}
          <Code>"ammo"</Code>, <Code>"health"</Code>,{" "}
          <Code>"exit"</Code>, <Code>"door"</Code>,{" "}
          <Code>"teleport"</Code>,{" "}
          <Code>"pickup"</Code>, or{" "}
          <Code>"button"</Code>.
        </p>
        <p>
          <Code>id:</Code> is a string. <Code>str</Code> can build
          one. If you omit <Code>id:</Code>, <Code>spawn</Code> makes
          a name like <Code>enemy-1</Code> and returns it. Store that
          string if you want to use the new thing later. With{" "}
          <Code>fill: true</Code>, each thing gets its own name.{" "}
          <Code>id:</Code> is then a prefix, such as{" "}
          <Code>wave-1</Code>, <Code>wave-2</Code>.
        </p>
      </Block>
      <Block>
        <H>enemy</H>
        <p>
          <Code>variant:</Code> is <Code>"grunt"</Code> or{" "}
          <Code>"bruiser"</Code>. If the key is missing, the enemy
          is a grunt.
        </p>
      </Block>
      <Block>
        <H>ammo, health, exit</H>
        <p>
          These types have no extra keys. Use <Code>type:</Code>, a
          place, and <Code>id:</Code> if you need a name.
        </p>
      </Block>
      <Block>
        <H>door</H>
        <p>
          <Code>locked:</Code> is <Code>true</Code> or <Code>false</Code>. If
          the key is missing, the door is unlocked. A spawned door is closed.
        </p>
      </Block>
      <Block>
        <H>teleport</H>
        <p>
          <Code>dest:</Code> is the name of a mark, a thing, or a zone. A
          zone picks a random open cell. If the key is missing, the pad
          has no destination.
        </p>
      </Block>
      <Block>
        <H>pickup</H>
        <p>
          <Code>label:</Code> is short text on the sprite. If the key is
          missing or empty, the sprite has no text.
        </p>
        <p>
          <Code>color:</Code> is a color string such as{" "}
          <Code>"#aa46c8"</Code>. If the key is missing, the pickup
          uses the default purple.
        </p>
        <p>
          <Code>shape:</Code> is the silhouette. The names are{" "}
          <Code>"diamond"</Code>, <Code>"square"</Code>,{" "}
          <Code>"star"</Code>, <Code>"explosion"</Code>,{" "}
          <Code>"circle"</Code>, <Code>"triangle"</Code>, and{" "}
          <Code>"cross"</Code>. If the key is missing, the pickup is a
          diamond.
        </p>
      </Block>
      <Block>
        <H>button</H>
        <p>
          <Code>disabled:</Code> is <Code>true</Code> or{" "}
          <Code>false</Code>. If you omit the key, the button works. A
          disabled button does not show a use prompt.
        </p>
      </Block>
      <Block>
        <H>Examples</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>
              (spawn type: "enemy" at: "stash" id:
              "warden" variant: "bruiser")
            </Code>
          </li>
          <li>
            <Code>
              (spawn type: "enemy" at: [11.5 6.5] id: (str
              "enemy-" n))
            </Code>
          </li>
          <li>
            <Code>
              (spawn type: "door" at: "gate" id:
              "door-cell" locked: true)
            </Code>
          </li>
          <li>
            <Code>
              (spawn type: "teleport" at: [8.5 10.5] dest:
              "stash")
            </Code>
          </li>
          <li>
            <Code>
              (spawn type: "enemy" at: "ambush" fill: true)
            </Code>
          </li>
          <li>
            <Code>
              (spawn type: "pickup" at: "loot" id:
              "key-red" label: "K" color:
              "#c43c3c")
            </Code>
          </li>
        </ul>
      </Block>
    </div>
  );
}

function Example() {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-[11px] leading-5 text-fg">
      {SAMPLE}
    </pre>
  );
}
