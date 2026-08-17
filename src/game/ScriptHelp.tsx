import { useState } from "react";

const SAMPLE = `(def (announce msg)
  (say (str ">> " msg)))

(on start ()
  (announce "Find the red key.")
  (lock "door-armory"))

(on pickup (who)
  (when (= who "key-red")
    (unlock "door-armory")
    (announce "Armory unlocked.")))

(on use (who)
  (when (= who "door-armory")
    (if (locked? "door-armory")
      (say "Locked. Need the red key.")
      (open "door-armory"))))

(on enter (zone)
  (when (= zone "ambush")
    (unless (get "sprung")
      (spawn "enemy" 14.5 8.5 "grunt-a")
      (say "Ambush!")
      (set "sprung" true))))

(on die (who)
  (when (= who "grunt-a")
    (after 1
      (open "door-exit"))))

(on shoot (who)
  (when (= who "panel")
    (set-wall who 0)
    (give "ammo" 20)))
`;

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
          Each map has one script. The game reads the whole script when the
          fight starts.
        </p>
        <p>
          A form that is not <Code>(on ...)</Code> runs at that time. Those
          forms usually define functions and set values.
        </p>
        <p>
          An <Code>(on ...)</Code> form does not run at load. The game stores
          the body. The game runs that body when the event occurs.
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
            Give a name to each door, pickup, zone, and mark that the script
            uses.
          </li>
          <li>
            Write <Code>(on event (args) ...)</Code> forms for the events that
            you want.
          </li>
          <li>Click Format to rewrite the script with a standard layout.</li>
        </ol>
      </Block>
      <Block>
        <H>Limits</H>
        <p>
          A script that runs too long stops. The limit is 8000 steps. The
          message is <Code>script ran too long</Code>.
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
          A number is a count, a position, or a delay.
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
          <Code>(list 1 2 3)</Code> is a list. A list holds more than one
          value. <Code>()</Code> is an empty list.
        </p>
      </Block>
      <Block>
        <H>Name</H>
        <p>
          A thing name is a string. <Code>"door-armory"</Code> is the
          door with that name. You can build a name with{" "}
          <Code>(str "enemy-" n)</Code>.
        </p>
        <p>
          A word such as <Code>zone</Code> is a variable. The word must have a
          value. An unknown word is an error.
        </p>
      </Block>
      <Block>
        <H>Function</H>
        <p>
          A function is a piece of code with a parameter list.{" "}
          <Code>def</Code> and <Code>fn</Code> make functions. There is no
          function literal in the file besides those forms.
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
        <H>Lists</H>
        <p>
          <Code>(</Code> and <Code>)</Code> make a list. The first item is the
          function or the keyword. The other items are arguments.
        </p>
        <p>
          A comma is not a separator. If you write a comma, the comma is part
          of a name.
        </p>
      </Block>
      <Block>
        <H>Number literals</H>
        <p>
          A number is digits, with an optional sign and an optional fraction.{" "}
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
        <H>Words</H>
        <p>
          <Code>true</Code>, <Code>false</Code>, and <Code>nil</Code> are
          words. They are not strings.
        </p>
        <p>
          Any other word is a variable name. A name can hold letters, digits,{" "}
          <Code>-</Code>, <Code>?</Code>, and other marks. The word must be
          bound by <Code>def</Code>, <Code>let</Code>, a function parameter, or
          an event parameter.
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
          A list <Code>(f a b)</Code> evaluates <Code>f</Code>, then each
          argument, then calls <Code>f</Code>. A keyword does not follow this
          rule. The Keywords tab lists those forms.
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
        <H>if, when, unless</H>
        <p>
          <Code>(if test then else)</Code> runs <Code>then</Code> when{" "}
          <Code>test</Code> is true. The form runs <Code>else</Code> when{" "}
          <Code>test</Code> is false. A missing <Code>else</Code> is{" "}
          <Code>nil</Code>.
        </p>
        <p>
          <Code>(when test ...)</Code> runs each body form when{" "}
          <Code>test</Code> is true. The result is the last body form.
        </p>
        <p>
          <Code>(unless test ...)</Code> runs each body form when{" "}
          <Code>test</Code> is false.
        </p>
      </Block>
      <Block>
        <H>and, or, not</H>
        <p>
          <Code>(and a b)</Code> evaluates from left to right. The form stops
          at the first false value and returns that value. If every value is
          true, the form returns the last value.
        </p>
        <p>
          <Code>(or a b)</Code> stops at the first true value and returns that
          value. If every value is false, the form returns the last value.
        </p>
        <p>
          <Code>(not x)</Code> is true when <Code>x</Code> is false.
        </p>
      </Block>
      <Block>
        <H>do</H>
        <p>
          <Code>(do ...)</Code> runs each form in order. The result is the
          last form.
        </p>
      </Block>
      <Block>
        <H>let</H>
        <p>
          <Code>(let ((n 1) (m 2)) ...)</Code> makes local names for the
          body. Each binding is a list of a name and a value.
        </p>
        <p>Those names exist only in the body.</p>
      </Block>
      <Block>
        <H>def</H>
        <p>
          <Code>(def name value)</Code> stores a value under a name.
        </p>
        <p>
          <Code>(def (announce msg) ...)</Code> makes a function. The first
          name in the list is the function name. The other names are
          parameters. The rest of the form is the body.
        </p>
        <p>
          <Code>(announce "Find the red key.")</Code> then runs that
          function. <Code>announce</Code> is not a built-in function.
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
          body runs. <Code>(after 1 (open door-exit))</Code> opens that door
          after one second. The form can hold more than one body form.
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
            <Code>(+ a b ...)</Code> adds. One argument is fine. Zero
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
            becomes a tiny number so the script does not stop.
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
            <Code>(= a b)</Code> is true when the two values are the same. A
            name and a string with the same text are equal.
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
            <Code>(len x)</Code> counts characters in a string or items in a
            list.
          </li>
          <li>
            <Code>(list a b ...)</Code> makes a list of the arguments.
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
        <H>Type tests</H>
        <p>
          <Code>empty?</Code> is true for <Code>nil</Code>, an empty list, or
          an empty string.
        </p>
        <p>
          <Code>list?</Code>, <Code>num?</Code>, <Code>str?</Code>,{" "}
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
          script. The form is <Code>(on event (args...) body...)</Code>.
        </p>
        <p>
          <Code>event</Code> is a word such as <Code>enter</Code>. The
          parameter list binds values that the event passes. You pick the
          parameter names.
        </p>
        <p>
          You can bind fewer parameters than the event provides. Extra values
          are dropped.
        </p>
        <p>
          The body runs for every match of that event. Use <Code>if</Code> or{" "}
          <Code>when</Code> to compare a parameter to a string.
        </p>
      </Block>
      <Block>
        <H>Event list</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(on start () ...)</Code> runs when the fight begins.
          </li>
          <li>
            <Code>(on enter (zone) ...)</Code> runs when the player walks
            into a zone. <Code>zone</Code> is a string.
          </li>
          <li>
            <Code>(on leave (zone) ...)</Code> runs when the player leaves a
            zone.
          </li>
          <li>
            <Code>(on use (who x y) ...)</Code> runs when the player presses
            E on a thing or a mark.
          </li>
          <li>
            <Code>(on shoot (who x y) ...)</Code> runs when a shot hits a
            mark or a door. A wall with no name passes an empty string.
          </li>
          <li>
            <Code>(on die (who x y) ...)</Code> runs when an enemy dies.
          </li>
          <li>
            <Code>(on pickup (who) ...)</Code> runs when the player takes an
            item. Ammo, health, and pickups all fire this event.
          </li>
          <li>
            <Code>(on hurt (who amount) ...)</Code> runs when the player or
            an enemy takes damage. For the player, <Code>who</Code> is{" "}
            <Code>"player"</Code>.
          </li>
          <li>
            <Code>(on teleport (who) ...)</Code> runs when the player uses a
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
      </Block>
      <Block>
        <H>Doors</H>
        <p>
          <Code>open</Code>, <Code>close</Code>, <Code>lock</Code>, and{" "}
          <Code>unlock</Code> take a string. Each form returns true when the
          door exists.
        </p>
        <p>
          <Code>(locked? "door-armory")</Code> and{" "}
          <Code>(open? "door-armory")</Code> read the state of the
          door.
        </p>
      </Block>
      <Block>
        <H>set-wall</H>
        <p>
          <Code>(set-wall "panel" 0)</Code> sets the wall at that
          mark. The second value is <Code>0</Code> for empty, or{" "}
          <Code>1</Code> through <Code>6</Code> for a pattern.
        </p>
        <p>
          <Code>(set-wall x y tex)</Code> uses cell coordinates. The name can
          also be a door. The cell of that door changes.
        </p>
      </Block>
      <Block>
        <H>remove, teleport, win, lose</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(remove "grunt-a")</Code> deletes that thing.
          </li>
          <li>
            <Code>(teleport "player" "stash")</Code> moves
            the player to that mark.{" "}
            <Code>(teleport "player" x y)</Code> uses numbers. The
            first argument can be a thing name.
          </li>
          <li>
            <Code>(win)</Code> and <Code>(lose)</Code> end the fight.
          </li>
        </ul>
      </Block>
      <Block>
        <H>spawn</H>
        <p>
          <Code>spawn</Code> adds a thing to the map. The command returns the
          name of the new thing.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>(spawn type x y)</Code>
          </li>
          <li>
            <Code>(spawn type x y name)</Code>
          </li>
          <li>
            <Code>(spawn type x y name variant)</Code>
          </li>
        </ul>
        <p>
          <Code>type</Code> is a string: <Code>"enemy"</Code>,{" "}
          <Code>"ammo"</Code>, <Code>"health"</Code>,{" "}
          <Code>"exit"</Code>, <Code>"door"</Code>,{" "}
          <Code>"teleport"</Code>, or{" "}
          <Code>"pickup"</Code>.
        </p>
        <p>
          <Code>x</Code> and <Code>y</Code> are map positions. The center of
          a cell is a number that ends in <Code>.5</Code>.
        </p>
        <p>
          <Code>name</Code> is a string. You can build it with{" "}
          <Code>str</Code>. If the name is missing, the game makes an id.
        </p>
        <p>
          <Code>variant</Code> is only for an enemy. The value is{" "}
          <Code>"grunt"</Code> or <Code>"bruiser"</Code>.
          If the variant is missing, the enemy is a grunt.
        </p>
        <p>
          A spawned door is unlocked and closed. A spawned pickup has no
          custom text or color. A spawned pad has no destination.
        </p>
        <p>Examples:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Code>
              (spawn "enemy" 11.5 6.5 "warden"
              "bruiser")
            </Code>
          </li>
          <li>
            <Code>
              (spawn "enemy" 11.5 6.5 (str "enemy-" n))
            </Code>
          </li>
          <li>
            <Code>(spawn "ammo" 8.5 10.5 "pack-a")</Code>
          </li>
          <li>
            <Code>(spawn "door" 9.5 3.5 "door-cell")</Code>
          </li>
        </ul>
      </Block>
    </div>
  );
}

function Example() {
  return (
    <div className="space-y-4">
      <Block>
        <H>What this script does</H>
        <p>
          The sample locks a door. The script unlocks the door when the
          player takes the key.
        </p>
        <p>
          <Code>announce</Code> is a function that the sample makes with{" "}
          <Code>def</Code>. <Code>"sprung"</Code> is a script value
          key. <Code>get</Code> and <Code>set</Code> read and write that
          value.
        </p>
        <p>
          Map names are strings.{" "}
          <Code>"door-armory"</Code>,{" "}
          <Code>"key-red"</Code>, <Code>"ambush"</Code>,{" "}
          <Code>"grunt-a"</Code>, <Code>"panel"</Code>, and{" "}
          <Code>"door-exit"</Code> must match the things in the
          editor.
        </p>
      </Block>
      <pre className="overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-[11px] leading-5 text-fg">
        {SAMPLE}
      </pre>
    </div>
  );
}
