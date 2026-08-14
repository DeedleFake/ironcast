const SAMPLE = `(def (announce msg)
  (say (str ">> " msg)))

(on start
  (announce "Find the red key.")
  (lock door-armory))

(on pickup key-red
  (unlock door-armory)
  (announce "Armory unlocked."))

(on use door-armory
  (if (locked? door-armory)
    (say "Locked. Need the red key.")
    (open door-armory)))

(on enter ambush
  (unless (get sprung)
    (spawn enemy 14.5 8.5 grunt-a)
    (say "Ambush!")
    (set sprung true)))

(on die grunt-a
  (after 1
    (open door-exit)))

(on shoot panel
  (set-wall panel 0)
  (give ammo 20))
`;

export function ScriptHelp({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (src: string) => void;
}) {
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
        className="flex max-h-[min(36rem,90dvh)] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-lg border border-border bg-surface p-5 shadow-2xl"
      >
        <div>
          <h3
            id="script-help-title"
            className="font-display text-lg font-semibold tracking-wide text-fg uppercase"
          >
            Level scripts
          </h3>
          <p className="mt-1 text-sm text-muted">
            Each map has one script. The script is a Lisp program. The game runs
            a part of the script when an event occurs.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 text-sm text-muted">
          <section className="space-y-1.5">
            <p className="font-medium text-fg">How to start</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open the Script panel.</li>
              <li>Give a name to each door, pickup, zone, and mark.</li>
              <li>Write an <code className="text-fg">(on ...)</code> form that uses that name.</li>
              <li>Click Format to rewrite the script with a standard layout.</li>
            </ol>
          </section>

          <section className="space-y-1.5">
            <p className="font-medium text-fg">Types</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code className="text-fg">12</code> and{" "}
                <code className="text-fg">14.5</code> are numbers. A number is a
                count, a position, or a delay.
              </li>
              <li>
                <code className="text-fg">"hello"</code> is a string. A string is
                text. A string holds a message or a label.
              </li>
              <li>
                <code className="text-fg">true</code> and{" "}
                <code className="text-fg">false</code> are boolean values. A
                boolean is a yes-or-no value.
              </li>
              <li>
                <code className="text-fg">nil</code> is the empty value. The
                script reads <code className="text-fg">nil</code> as false.
              </li>
              <li>
                <code className="text-fg">(list 1 2 3)</code> is a list. A list
                holds more than one value.
              </li>
              <li>
                <code className="text-fg">door-armory</code> is a name. A name
                refers to a thing or a zone on the map.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <p className="font-medium text-fg">Functions</p>
            <p>
              A function is a named piece of code that you make.{" "}
              <code className="text-fg">(def (announce msg) ...)</code> makes a
              function with the name <code className="text-fg">announce</code>.
              Then <code className="text-fg">(announce "Find the red key.")</code>{" "}
              runs that function. <code className="text-fg">announce</code> is
              not a built-in function.
            </p>
            <p>
              The operators <code className="text-fg">+</code>,{" "}
              <code className="text-fg">-</code>, <code className="text-fg">*</code>
              , and <code className="text-fg">/</code> do arithmetic.{" "}
              <code className="text-fg">(str "hi " x)</code> joins text into one
              string.
            </p>
          </section>

          <section className="space-y-1.5">
            <p className="font-medium text-fg">Keywords</p>
            <p>
              A keyword is special syntax. The script does not treat a keyword
              as a normal function.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code className="text-fg">(if test then else)</code> runs{" "}
                <code className="text-fg">then</code> when{" "}
                <code className="text-fg">test</code> is true. The form runs{" "}
                <code className="text-fg">else</code> when{" "}
                <code className="text-fg">test</code> is false.
              </li>
              <li>
                <code className="text-fg">(when test ...)</code> runs the body
                when <code className="text-fg">test</code> is true.
              </li>
              <li>
                <code className="text-fg">(unless test ...)</code> runs the body
                when <code className="text-fg">test</code> is false.
              </li>
              <li>
                <code className="text-fg">(and a b)</code> is true when{" "}
                <code className="text-fg">a</code> and{" "}
                <code className="text-fg">b</code> are both true.
              </li>
              <li>
                <code className="text-fg">(or a b)</code> is true when{" "}
                <code className="text-fg">a</code> is true, or{" "}
                <code className="text-fg">b</code> is true, or both are true.
              </li>
              <li>
                <code className="text-fg">(not x)</code> is true when{" "}
                <code className="text-fg">x</code> is false.
              </li>
              <li>
                <code className="text-fg">(let ((n 1)) ...)</code> makes local
                names for the body.
              </li>
              <li>
                <code className="text-fg">(do ...)</code> runs each form in
                order.
              </li>
              <li>
                <code className="text-fg">(fn (a b) ...)</code> and{" "}
                <code className="text-fg">(lambda (a b) ...)</code> make a
                function with no name.
              </li>
              <li>
                <code className="text-fg">(quote x)</code> and{" "}
                <code className="text-fg">'x</code> return{" "}
                <code className="text-fg">x</code> with no evaluation.
              </li>
              <li>
                <code className="text-fg">def</code>,{" "}
                <code className="text-fg">on</code>, and{" "}
                <code className="text-fg">after</code> are also keywords. The
                other sections describe those forms.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <p className="font-medium text-fg">Built-in functions</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code className="text-fg">+</code>,{" "}
                <code className="text-fg">-</code>,{" "}
                <code className="text-fg">*</code>,{" "}
                <code className="text-fg">/</code>,{" "}
                <code className="text-fg">mod</code>,{" "}
                <code className="text-fg">abs</code>,{" "}
                <code className="text-fg">min</code>,{" "}
                <code className="text-fg">max</code>,{" "}
                <code className="text-fg">floor</code>, and{" "}
                <code className="text-fg">ceil</code> do arithmetic.
              </li>
              <li>
                <code className="text-fg">=</code>,{" "}
                <code className="text-fg">/=</code>,{" "}
                <code className="text-fg">{"<"}</code>,{" "}
                <code className="text-fg">{">"}</code>,{" "}
                <code className="text-fg">{"<="}</code>, and{" "}
                <code className="text-fg">{">="}</code> compare values.
              </li>
              <li>
                <code className="text-fg">str</code> joins text.{" "}
                <code className="text-fg">len</code> counts items in a string
                or a list.
              </li>
              <li>
                <code className="text-fg">list</code>,{" "}
                <code className="text-fg">cons</code>,{" "}
                <code className="text-fg">first</code>,{" "}
                <code className="text-fg">rest</code>,{" "}
                <code className="text-fg">nth</code>, and{" "}
                <code className="text-fg">append</code> build and read lists.
              </li>
              <li>
                <code className="text-fg">empty?</code>,{" "}
                <code className="text-fg">list?</code>,{" "}
                <code className="text-fg">num?</code>,{" "}
                <code className="text-fg">str?</code>,{" "}
                <code className="text-fg">bool?</code>, and{" "}
                <code className="text-fg">nil?</code> test the type of a value.
              </li>
              <li>
                <code className="text-fg">name</code> turns a name into a
                string.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <p className="font-medium text-fg">Events</p>
            <p>
              An <code className="text-fg">(on ...)</code> form is valid only at
              the top of the script. The first name after{" "}
              <code className="text-fg">on</code> is the event.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code className="text-fg">(on start ...)</code> runs when the
                fight begins.
              </li>
              <li>
                <code className="text-fg">(on enter zone ...)</code> runs when
                the player walks into that zone.
              </li>
              <li>
                <code className="text-fg">(on leave zone ...)</code> runs when
                the player leaves that zone.
              </li>
              <li>
                <code className="text-fg">(on use name ...)</code> runs when the
                player presses E on that thing.
              </li>
              <li>
                <code className="text-fg">(on shoot name ...)</code> runs when a
                shot hits that mark or door.
              </li>
              <li>
                <code className="text-fg">(on die name ...)</code> runs when
                that enemy dies.
              </li>
              <li>
                <code className="text-fg">(on pickup name ...)</code> runs when
                the player takes that item.
              </li>
              <li>
                <code className="text-fg">(on hurt player ...)</code> runs when
                the player takes damage.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <p className="font-medium text-fg">Commands</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code className="text-fg">say</code> shows a message.
              </li>
              <li>
                <code className="text-fg">give</code>,{" "}
                <code className="text-fg">take</code>, and{" "}
                <code className="text-fg">has</code> change or read the
                inventory.
              </li>
              <li>
                <code className="text-fg">get</code> and{" "}
                <code className="text-fg">set</code> read or write a script
                value.
              </li>
              <li>
                <code className="text-fg">open</code>,{" "}
                <code className="text-fg">close</code>,{" "}
                <code className="text-fg">lock</code>,{" "}
                <code className="text-fg">unlock</code>,{" "}
                <code className="text-fg">locked?</code>, and{" "}
                <code className="text-fg">open?</code> control a door.
              </li>
              <li>
                <code className="text-fg">set-wall</code> changes a wall cell.
              </li>
              <li>
                <code className="text-fg">spawn</code> adds a thing.{" "}
                <code className="text-fg">remove</code> deletes a thing.
              </li>
              <li>
                <code className="text-fg">teleport</code> moves the player or a
                thing.
              </li>
              <li>
                <code className="text-fg">win</code> and{" "}
                <code className="text-fg">lose</code> end the fight.
              </li>
              <li>
                <code className="text-fg">(after seconds ...)</code> waits that
                many seconds. Then the body runs.{" "}
                <code className="text-fg">(after 1 (open door-exit))</code>{" "}
                opens that door after one second. The form can hold more than
                one body form.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <p className="font-medium text-fg">Sample</p>
            <p>
              This sample locks a door. The script opens the door when the
              player takes the key.
            </p>
            <p>
              <code className="text-fg">announce</code> is a function that the
              sample makes with <code className="text-fg">def</code>.{" "}
              <code className="text-fg">sprung</code> is a script value.{" "}
              <code className="text-fg">get</code> and{" "}
              <code className="text-fg">set</code> read and write that value.
            </p>
            <p>
              <code className="text-fg">door-armory</code>,{" "}
              <code className="text-fg">key-red</code>,{" "}
              <code className="text-fg">ambush</code>,{" "}
              <code className="text-fg">grunt-a</code>,{" "}
              <code className="text-fg">panel</code>, and{" "}
              <code className="text-fg">door-exit</code> are names on the map.
              Those names must match the things in the editor.
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-[11px] leading-5 text-fg">
              {SAMPLE}
            </pre>
          </section>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onInsert(SAMPLE)}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
          >
            Insert sample
          </button>
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
