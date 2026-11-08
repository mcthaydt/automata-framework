import { type ContentEdit, openDocument } from '../../../shared/kit/documents/content-document.ts'
import { createHistory, type History } from '../../../shared/kit/history/history.ts'
import type { SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import {
  addKeyEdit,
  CONTROLS_PATH,
  type ControlRow,
  type ControlsRead,
  keyProblem,
  labelEdit,
  readControls,
  removeKeyEdit,
  touchEdit,
} from './controls-section'
import { readTuning, TUNING_PATH, type TuningMeta, type TuningRead } from './tuner-content'
import { checkValue, valueEdit } from './tuner-edits'

// The Tuner's session: `content/tuning.toml` of one game, kept for the
// app's life. One kit `History` holds the file's text, so a value, a drag, an accepted Ask proposal and their Undo are
// all steps of one list. An edit is a span-preserving change of one literal (the kit's content documents), held to the
// tunable's kind and bounds before it is made, and written through the workspace port before it counts (the port's
// rules, the mtime guard and the change set's journal stay the port's); a write the port refuses is a message and the
// history is left as it was. Locks live here, never in a file.

/** The compiler's bounds for a code-owned game: its output, read through the workspace. */
export const TUNING_META_PATH = 'content/generated/tuning-meta.json'

export interface TunerState {
  /** The tuning file's text, or `undefined` when the game has none yet. */
  readonly text: string | undefined
  /** `content/controls.toml`'s text, or `undefined` when the game has none (the Tuner never makes one). */
  readonly controls?: string | undefined
}

export type TunerOutcome = { readonly ok: true } | { readonly ok: false; readonly message: string }

export interface TunerDrag {
  /** Opens one transaction on a tunable; the live values it shows are not written until `commit`. */
  start(name: string): TunerOutcome
  /** A live value; refused (and not shown) when it is outside the bounds. */
  update(value: number | boolean | string): TunerOutcome
  /** Writes the live value as one undo step. */
  commit(): Promise<TunerOutcome>
  /** Takes the drag back: no step, nothing written. */
  cancel(): void
}

export interface TunerSession {
  readonly history: History<TunerState>
  /** The tunables as they are now (parsed once per state), or why the file cannot be read. */
  read(): TuningRead
  /** Whether the game has a `content/tuning.toml`. */
  hasFile(): boolean
  /** True when the compiler's `tuning-meta.json` is absent: a code-owned game's bare numbers then have no bounds. */
  boundsUnavailable(): boolean
  /** The tunables the person locked in this session, as the key paths Ask refuses to change (EDS-D18). */
  locked(): readonly string[]
  lock(name: string): void
  unlock(name: string): void
  /** One new value of one tunable, as one undo step. */
  set(name: string, value: number | boolean | string): Promise<TunerOutcome>
  readonly drag: TunerDrag
  /** An accepted Ask proposal (the whole new text), as one undo step labelled `summary`. */
  accept(text: string, summary: string): Promise<TunerOutcome>
  /** Whether the game has a `content/controls.toml`. */
  hasControls(): boolean
  /** The default controls as they are now, or why the file cannot be shown; undefined when the game has none. */
  controls(): ControlsRead | undefined
  /** Each of these is one undo step on the controls file; a refusal is a sentence and changes nothing. */
  setControlLabel(id: string, label: string): Promise<TunerOutcome>
  addControlKey(id: string, code: string): Promise<TunerOutcome>
  removeControlKey(id: string, code: string): Promise<TunerOutcome>
  setControlTouch(id: string, on: boolean): Promise<TunerOutcome>
  /** The file, when the game has none: a header and no tunables, as one undo step. */
  create(): Promise<TunerOutcome>
  undo(): Promise<TunerOutcome>
  redo(): Promise<TunerOutcome>
}

const OK: TunerOutcome = { ok: true }
const refused = (message: string): TunerOutcome => ({ ok: false, message })

const NEW_FILE =
  '# The numbers the game runs on. Each row is NAME = value, or NAME = { value, min, max, step }.\n'

export async function openTuner(ports: SuitePorts): Promise<TunerSession> {
  const { workspace } = ports
  const listed = await workspace.files('tuner')
  const row = listed.find((file) => file.path === TUNING_PATH)
  const read = await workspace.read(TUNING_PATH)
  let mtime: number | undefined = read?.mtime
  const controlsRow = listed.find((file) => file.path === CONTROLS_PATH)
  const controlsRead = await workspace.read(CONTROLS_PATH)
  let controlsMtime: number | undefined = controlsRead?.mtime
  const generated = await workspace.generated(TUNING_META_PATH)
  const meta: TuningMeta | undefined = parseMeta(generated)
  const history = createHistory<TunerState>({ text: read?.text, controls: controlsRead?.text })
  const locks = new Set<string>()

  let cached: { readonly text: string | undefined; readonly result: TuningRead } | undefined
  const current = (): TuningRead => {
    const text = history.state.text
    if (cached === undefined || cached.text !== text)
      cached = {
        text,
        result:
          text === undefined
            ? { problem: 'There is no content/tuning.toml yet.' }
            : readTuning(text, meta ?? {}),
      }
    return cached.result
  }

  /** Why a file cannot be written, or `undefined`. A file the game has not made yet is the port's to judge. */
  const unwritable = (): string | undefined =>
    row === undefined || row.writable ? undefined : `${TUNING_PATH}: ${row.why ?? 'it is read only'}`
  const controlsUnwritable = (): string | undefined =>
    controlsRow === undefined || controlsRow.writable
      ? undefined
      : `${CONTROLS_PATH}: ${controlsRow.why ?? 'it is read only'}`

  /** Writes what changed between two states through the port: the tuning file, then the controls. */
  async function sync(from: TunerState, to: TunerState): Promise<TunerOutcome> {
    if (from.text !== to.text && to.text !== undefined) {
      const result = await workspace.write(
        TUNING_PATH,
        to.text,
        from.text === undefined || mtime === undefined ? 'absent' : { mtime },
      )
      if (!result.ok) return refused(`${TUNING_PATH}: ${result.message}`)
      mtime = result.mtime
    }
    if (from.controls !== to.controls && to.controls !== undefined) {
      const result = await workspace.write(
        CONTROLS_PATH,
        to.controls,
        from.controls === undefined || controlsMtime === undefined ? 'absent' : { mtime: controlsMtime },
      )
      if (!result.ok) return refused(`${CONTROLS_PATH}: ${result.message}`)
      controlsMtime = result.mtime
    }
    return OK
  }

  /**
   * The shell's protocol (the fixture editor's): the step is applied first, so the write the shell records carries this
   * editor's label, and a refused write takes the step back, as a kit widget's refusal keeps the old value.
   */
  async function commit(label: string, next: TunerState): Promise<TunerOutcome> {
    const from = history.state
    history.apply(label, () => next)
    const written = await sync(from, next)
    if (!written.ok) history.undo()
    return written
  }

  /** The new text for one tunable's value, or why it cannot be made (the check, the lock, the patcher). */
  function textFor(name: string, value: number | boolean | string): { text: string } | { message: string } {
    if (locks.has(name)) return { message: `${name} is locked: unlock it to change it` }
    const parsed = current()
    if ('problem' in parsed) return { message: parsed.problem }
    const tunable = parsed.tunables.find((entry) => entry.name === name)
    if (tunable === undefined) return { message: `${name}: there is no such tunable` }
    const check = checkValue(tunable, value)
    if (!('ok' in check)) return check
    const text = history.state.text
    if (text === undefined) return { message: 'There is no content/tuning.toml yet.' }
    let result: ReturnType<ReturnType<typeof openDocument>['edit']>
    try {
      result = openDocument(TUNING_PATH, text).edit([valueEdit(tunable, value)])
    } catch (error) {
      return {
        message: `${name}: the document could not make this edit (${error instanceof Error ? error.message : String(error)})`,
      }
    }
    return result.ok ? { text: result.document.text } : { message: `${name}: ${result.message}` }
  }

  async function travel(back: boolean): Promise<TunerOutcome> {
    const before = history.state
    if (back) history.undo()
    else history.redo()
    const written = await sync(before, history.state)
    if (written.ok) return OK
    if (back) history.redo()
    else history.undo()
    return written
  }

  let open:
    | { readonly name: string; readonly tx: ReturnType<typeof history.begin>; readonly from: TunerState }
    | undefined
  const drag: TunerDrag = {
    start(name) {
      const problem = unwritable()
      if (problem !== undefined) return refused(problem)
      if (locks.has(name)) return refused(`${name} is locked: unlock it to change it`)
      const parsed = current()
      if ('problem' in parsed) return refused(parsed.problem)
      if (!parsed.tunables.some((entry) => entry.name === name && entry.editable))
        return refused(`${name}: there is no such tunable to change`)
      open = { name, tx: history.begin(`Set ${name}`), from: history.state }
      return OK
    },
    update(value) {
      if (open === undefined) return refused('No drag is open.')
      const made = textFor(open.name, value)
      if (!('text' in made)) return refused(made.message)
      open.tx.update((state) => ({ ...state, text: made.text }))
      return OK
    },
    async commit() {
      if (open === undefined) return refused('No drag is open.')
      const { tx, from } = open
      open = undefined
      const live = history.state
      if (live.text === from.text) {
        tx.cancel()
        return OK
      }
      tx.commit()
      const written = await sync(from, live)
      if (!written.ok) history.undo()
      return written
    },
    cancel() {
      if (open === undefined) return
      open.tx.cancel()
      open = undefined
    },
  }

  let controlsCached:
    | { readonly text: string | undefined; readonly result: ControlsRead | undefined }
    | undefined
  const controlsNow = (): ControlsRead | undefined => {
    const text = history.state.controls
    if (controlsCached === undefined || controlsCached.text !== text)
      controlsCached = { text, result: text === undefined ? undefined : readControls(text) }
    return controlsCached.result
  }

  /** One edit of one action of the controls file, as one undo step; `edit` gets the file's text and the action's index. */
  async function editControls(
    id: string,
    label: (name: string) => string,
    edit: (text: string, index: number, row: ControlRow) => ContentEdit | string,
  ): Promise<TunerOutcome> {
    const problem = controlsUnwritable()
    if (problem !== undefined) return refused(problem)
    const text = history.state.controls
    const read = controlsNow()
    if (text === undefined || read === undefined) return refused('There is no content/controls.toml.')
    if ('problem' in read) return refused(read.problem)
    const index = read.rows.findIndex((row) => row.id === id)
    const row = read.rows[index]
    if (row === undefined) return refused(`There is no action "${id}" in ${CONTROLS_PATH}.`)
    const made = edit(text, index, row)
    if (typeof made === 'string') return refused(made)
    const result = openDocument(CONTROLS_PATH, text).edit([made])
    if (!result.ok) return refused(`${row.label}: ${result.message}`)
    return commit(label(row.label), { ...history.state, controls: result.document.text })
  }

  return {
    history,
    read: current,
    hasFile: () => history.state.text !== undefined,
    boundsUnavailable: () => meta === undefined,
    locked: () => [...locks].sort(),
    lock: (name) => void locks.add(name),
    unlock: (name) => void locks.delete(name),
    async set(name, value) {
      const problem = unwritable()
      if (problem !== undefined) return refused(problem)
      const made = textFor(name, value)
      if (!('text' in made)) return refused(made.message)
      return commit(`Set ${name} to ${String(value)}`, { ...history.state, text: made.text })
    },
    drag,
    hasControls: () => history.state.controls !== undefined,
    controls: controlsNow,
    setControlLabel: (id, label) =>
      editControls(
        id,
        (name) => `Rename ${name}`,
        (text, index) =>
          label.trim() === '' ? 'An action needs a name.' : labelEdit(text, index, label.trim()),
      ),
    addControlKey: (id, code) =>
      editControls(
        id,
        (name) => `Add a key to ${name}`,
        (text, index, row) => keyProblem(row, code) ?? addKeyEdit(text, index, code),
      ),
    removeControlKey: (id, code) =>
      editControls(
        id,
        (name) => `Take a key off ${name}`,
        (text, index, row) =>
          row.keys.some((key) => key.code === code)
            ? removeKeyEdit(text, index, code)
            : `${row.label} has no such key.`,
      ),
    setControlTouch: (id, on) =>
      editControls(
        id,
        (name) => `${on ? 'Show' : 'Hide'} the touch button for ${name}`,
        (text, index) => touchEdit(text, index, on),
      ),
    async accept(text, summary) {
      const problem = unwritable()
      if (problem !== undefined) return refused(problem)
      const parsed = readTuning(text, meta ?? {})
      if ('problem' in parsed) return refused(parsed.problem)
      return commit(summary, { ...history.state, text })
    },
    async create() {
      const problem = unwritable()
      if (problem !== undefined) return refused(problem)
      if (history.state.text !== undefined) return refused(`${TUNING_PATH} already exists`)
      return commit(`Create ${TUNING_PATH}`, { ...history.state, text: NEW_FILE })
    },
    undo: () => travel(true),
    redo: () => travel(false),
  }
}

function parseMeta(text: string | undefined): TuningMeta | undefined {
  if (text === undefined) return undefined
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as TuningMeta)
      : undefined
  } catch {
    return undefined
  }
}
