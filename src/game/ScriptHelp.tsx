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

export function ScriptHelp({ onClose, onInsert }: { onClose: () => void; onInsert: (src: string) => void }) {
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
            One Lisp file per map. Name things in the editor, then write handlers
            that fire when something happens.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm text-muted">
          <p className="font-medium text-fg">Types</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="text-fg">12</code> / <code className="text-fg">14.5</code> — numbers, for counts, coordinates, delays
            </li>
            <li>
              <code className="text-fg">"hello"</code> — strings, for messages and labels
            </li>
            <li>
              <code className="text-fg">true</code> / <code className="text-fg">false</code> — booleans, for flags and conditions
            </li>
            <li>
              <code className="text-fg">nil</code> — empty value; treated as false
            </li>
            <li>
              <code className="text-fg">(list 1 2 3)</code> — lists, for grouping values
            </li>
            <li>
              <code className="text-fg">door-armory</code> — names, for things and zones you placed
            </li>
          </ul>
          <p>
            Define functions with{" "}
            <code className="text-fg">(def (name a b) ...)</code>. Math is{" "}
            <code className="text-fg">+ - * /</code>; glue text with{" "}
            <code className="text-fg">(str "hi " x)</code>.
          </p>
          <p className="font-medium text-fg">Events</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="text-fg">(on start ...)</code> — fight begins
            </li>
            <li>
              <code className="text-fg">(on enter zone ...)</code> /{" "}
              <code className="text-fg">leave</code> — walk into a painted zone
            </li>
            <li>
              <code className="text-fg">(on use name ...)</code> — press E
            </li>
            <li>
              <code className="text-fg">(on shoot name ...)</code> — hit a mark
              or door
            </li>
            <li>
              <code className="text-fg">(on die name ...)</code> /{" "}
              <code className="text-fg">(on pickup name ...)</code>
            </li>
            <li>
              <code className="text-fg">(on hurt player ...)</code>
            </li>
          </ul>
          <p className="font-medium text-fg">Verbs</p>
          <p>
            <code className="text-fg">
              say give take has get set open close lock unlock locked? open?
              set-wall spawn remove teleport win lose after
            </code>
          </p>
          <p>
            Name doors, pickups, and marks in the sidebar. Paint a zone, name it,
            then <code className="text-fg">(on enter that-name ...)</code>.
          </p>
          <pre className="overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-[11px] leading-5 text-fg">
            {SAMPLE}
          </pre>
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
