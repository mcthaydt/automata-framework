// Sequence's session: the game's cutscenes (each a TOML session), which one is open and which step is chosen, the
// playhead, and what is drawn from them (the scene at the playhead, the walls of a level the person picked). It
// outlives the view, so switching to another editor and back finds the same cutscene at the same moment.
import { createDirector, type SceneState } from '@automata/cutscenes/director'
import { type CutsceneScript, cutsceneSchema, type PlacedScript, placeScript } from '@automata/cutscenes/sim'
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { SuitePorts, WorkspaceFile } from '@automata/editor/kit/ports'
import { ContentSession } from '../../shared/content-session.svelte.ts'
import { humanize } from '../../shared/humanize.ts'
import { type Outcome, openTomlSession } from '../../shared/toml-session.ts'
import { UndoTrail } from '../../shared/undo-many.ts'
import {
  addKeyEdits,
  durationEdits,
  moveEdits,
  type NewKeyOptions,
  removeKeyEdit,
  retimeEdit,
  snap,
} from './key-edits.ts'
import type { KeyField, SequenceNames } from './key-fields.ts'
import { levelWalls, type Segment } from './plan-view.ts'
import { type LineWords, type SceneProblem, sceneProblems } from './scene-problems.ts'
import { type GameNames, namesFor, readGameNames } from './sequence-names.ts'
import { keysOf, TRACK_WORDS, type TrackId } from './tracks.ts'

export type Selection = { readonly track: TrackId; readonly index: number } | undefined

/** What drives Play: the time, and the next frame. The page gives the browser's; a test gives its own. */
export interface Clock {
  now(): number
  frame(callback: () => void): () => void
}

export const browserClock: Clock = {
  now: () => performance.now(),
  frame: (callback) => {
    const handle = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(handle)
  },
}

export interface CutsceneEntry {
  readonly id: string
  readonly name: string
  readonly path: string
}

const CUTSCENE_FILE = /^content\/cutscenes\/([^/]+)\.toml$/

/** The text of a new cutscene: one camera key at 0, looking down the first metre, and nothing else. */
export function addCutsceneEdit(id: string, duration: number): string {
  return [
    '# A cutscene: the game takes the camera for a moment.',
    `id = ${JSON.stringify(id)}`,
    `duration = ${String(duration)}`,
    '',
    '[[camera]]',
    't = 0',
    'pos = [0, 1.6, 0]',
    'look = [0, 1.6, 1]',
    '',
  ].join('\n')
}

/** A name a person typed as a file's id: lower case words joined with dashes. */
export function cutsceneIdOf(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export class SequenceSession {
  readonly ports: SuitePorts
  readonly trail: UndoTrail = new UndoTrail()
  readonly is2d: boolean
  cutscenes: CutsceneEntry[] = $state([])
  /** The open cutscene's file, or `undefined` when the game has none. */
  current: ContentSession<CutsceneScript, Selection> | undefined = $state.raw()
  playhead: number = $state(0)
  playing: boolean = $state(false)
  /** Pixels for a second on the timeline. */
  zoom: number = $state(60)
  /** The 2D level the preview draws walls from ("Show over: Hall"), kept only for this visit. */
  level: string | undefined = $state()
  walls: readonly Segment[] = $state.raw([])
  /** A new length that would take steps away, waiting for the person to say yes. */
  shortening: { readonly length: number; readonly dropped: number } | undefined = $state()

  readonly #game: GameNames
  readonly #cache = new Map<string, ContentSession<CutsceneScript, Selection>>()
  #stop: (() => void) | undefined

  private constructor(ports: SuitePorts, is2d: boolean, game: GameNames) {
    this.ports = ports
    this.is2d = is2d
    this.#game = game
  }

  static async open(listed: readonly WorkspaceFile[], ports: SuitePorts): Promise<SequenceSession> {
    const everything = await ports.workspace.files()
    const is2d =
      (await ports.workspace.files('levels-2d')).length > 0 &&
      (await ports.workspace.files('levels-3d')).length === 0
    const game = await readGameNames(ports, everything)
    const session = new SequenceSession(ports, is2d, game)
    const found = new Map<string, CutsceneEntry>()
    for (const file of [...listed, ...everything]) {
      const id = CUTSCENE_FILE.exec(file.path)?.[1]
      if (id !== undefined) found.set(file.path, { id, name: humanize(id), path: file.path })
    }
    session.cutscenes = [...found.values()].sort((a, b) => a.id.localeCompare(b.id))
    const first = session.cutscenes[0]
    if (first !== undefined) await session.choose(first.path)
    return session
  }

  get levels(): GameNames['levels'] {
    return this.#game.levels
  }

  get script(): CutsceneScript | undefined {
    return this.current?.content
  }

  get names(): SequenceNames {
    return namesFor(this.#game, this.script)
  }

  /** Every line the game has with its words, for the page's problems. */
  get lineWords(): LineWords {
    return new Map(this.#game.lines.map((line) => [line.id, line.words]))
  }

  get problems(): readonly SceneProblem[] {
    const script = this.script
    return script === undefined ? [] : sceneProblems(script, this.lineWords)
  }

  /** The scene at the playhead, from the director, with every place settled to a point. */
  get state(): SceneState | undefined {
    const script = this.script
    if (script === undefined) return undefined
    const where = (anchor: string): { x: number; z: number } | undefined => {
      if (anchor.startsWith('actor:')) {
        const key = (script.actor ?? []).find((candidate) => candidate.who === anchor.slice(6))
        return { x: key?.x ?? 0, z: key?.z ?? 0 }
      }
      const person = this.#game.people.find((candidate) => candidate.name === anchor)
      return person === undefined ? { x: 0, z: 0 } : { x: person.x, z: person.z }
    }
    const placed = placeScript(script, where)
    const play: PlacedScript = placed.ok ? placed.script : { ...script, actor: [] }
    return createDirector(play, () => undefined).stateAt(this.playhead)
  }

  get selection(): Selection {
    return this.current?.chosen
  }

  select(selection: Selection): void {
    if (this.current !== undefined) this.current.chosen = selection
  }

  async choose(path: string): Promise<void> {
    let session = this.#cache.get(path)
    if (session === undefined) {
      const toml = await openTomlSession<CutsceneScript>({
        path,
        ports: this.ports,
        schema: cutsceneSchema,
        empty: addCutsceneEdit(CUTSCENE_FILE.exec(path)?.[1] ?? 'cutscene', 5),
      })
      this.trail.add(toml)
      session = new ContentSession(toml, undefined as Selection, 'Start this cutscene')
      this.#cache.set(path, session)
    }
    this.pause()
    this.current = session
    this.playhead = 0
    this.shortening = undefined
  }

  /** A new cutscene named `name`, `length` seconds long. */
  async addCutscene(name: string, length: number): Promise<Outcome> {
    const id = cutsceneIdOf(name)
    if (id === '') return { ok: false, message: 'Give the cutscene a name.' }
    const path = `content/cutscenes/${id}.toml`
    if (this.cutscenes.some((entry) => entry.path === path))
      return { ok: false, message: 'This game already has a cutscene with that name.' }
    const toml = await openTomlSession<CutsceneScript>({
      path,
      ports: this.ports,
      schema: cutsceneSchema,
      empty: addCutsceneEdit(id, Math.max(1, Math.round(length * 10) / 10)),
    })
    this.trail.add(toml)
    const session = new ContentSession(toml, undefined as Selection, 'Add a cutscene')
    const made = await session.start()
    if (!made.ok) return made
    this.#cache.set(path, session)
    this.cutscenes = [...this.cutscenes, { id, name: humanize(id), path }].sort((a, b) =>
      a.id.localeCompare(b.id),
    )
    await this.choose(path)
    return { ok: true }
  }

  // --- the playhead -------------------------------------------------------------------------------------------------

  seek(t: number): void {
    const length = this.script?.duration ?? 0
    this.playhead = Math.min(length, Math.max(0, Math.round(t * 100) / 100))
  }

  play(clock: Clock = browserClock): void {
    const script = this.script
    if (script === undefined || this.playing) return
    if (this.playhead >= script.duration) this.playhead = 0
    this.playing = true
    let last = clock.now()
    const step = (): void => {
      const now = clock.now()
      const next = this.playhead + (now - last) / 1000
      last = now
      const length = this.script?.duration ?? 0
      if (next >= length) {
        this.playhead = length
        this.pause()
        return
      }
      this.playhead = next
      this.#stop = clock.frame(step)
    }
    this.#stop = clock.frame(step)
  }

  pause(): void {
    this.#stop?.()
    this.#stop = undefined
    this.playing = false
  }

  // --- the preview's walls ------------------------------------------------------------------------------------------

  async showOver(path: string | undefined): Promise<void> {
    this.level = path
    this.walls = path === undefined ? [] : await levelWalls(this.ports, path)
  }

  // --- changing the cutscene ------------------------------------------------------------------------------------------

  async #change(label: string, edits: readonly ContentEdit[], coalesce?: string): Promise<Outcome> {
    if (this.current === undefined || edits.length === 0) return { ok: true }
    return this.current.change(label, edits, coalesce)
  }

  /** A step's field changed. */
  async setField(entry: KeyField, value: string | number, label: string): Promise<Outcome> {
    return this.#change(label, entry.edits(value), `${label}`)
  }

  /** A step dragged to a new time (or its end, for a bar). Nothing is written when it ends where it started. */
  async retime(track: TrackId, index: number, t: number, end = false): Promise<Outcome> {
    const script = this.script
    if (script === undefined) return { ok: true }
    const edit = retimeEdit(script, track, index, t, end)
    return this.#change(`Move a ${TRACK_WORDS[track].toLowerCase()} step`, edit === undefined ? [] : [edit])
  }

  /** A whole bar dragged to start at `t`, keeping its length. */
  async move(track: TrackId, index: number, t: number): Promise<Outcome> {
    const script = this.script
    if (script === undefined) return { ok: true }
    return this.#change(`Move a ${TRACK_WORDS[track].toLowerCase()} step`, moveEdits(script, track, index, t))
  }

  async moveToPlayhead(): Promise<Outcome> {
    const selection = this.selection
    if (selection === undefined) return { ok: true }
    return this.move(selection.track, selection.index, snap(this.playhead, this.script?.duration ?? 0))
  }

  /** A step at the playhead with the values the scene has there; `undefined` when it needs a name that was not given. */
  async addKey(track: TrackId, options: NewKeyOptions = {}): Promise<Outcome | undefined> {
    const script = this.script
    const state = this.state
    if (script === undefined || state === undefined) return undefined
    const edits = addKeyEdits(script, track, this.playhead, state, options)
    if (edits === undefined) return undefined
    const outcome = await this.#change(`Add a ${TRACK_WORDS[track].toLowerCase()} step`, edits)
    if (outcome.ok) {
      const keys = keysOf(this.script ?? script, track)
      const at = Math.round(this.playhead * 10) / 10
      const index = keys.findIndex((key) => {
        const time = Array.isArray(key)
          ? (key as number[])[0]
          : ((key as { t?: number; at?: number }).t ?? (key as { at?: number }).at)
        return time === at
      })
      this.select({ track, index: Math.max(0, index) })
    }
    return outcome
  }

  async removeSelected(): Promise<Outcome> {
    const script = this.script
    const selection = this.selection
    if (script === undefined || selection === undefined) return { ok: true }
    const edit = removeKeyEdit(script, selection.track, selection.index)
    if (edit === undefined) return { ok: false, message: 'A scene needs at least one camera step.' }
    const outcome = await this.#change(`Remove a ${TRACK_WORDS[selection.track].toLowerCase()} step`, [edit])
    if (outcome.ok) this.select(undefined)
    return outcome
  }

  /** A new length. When it would take steps away it asks first (`shortening`) and writes nothing until `confirmLength`. */
  async setLength(length: number): Promise<Outcome> {
    const script = this.script
    if (script === undefined) return { ok: true }
    const { edits, dropped } = durationEdits(script, length)
    if (dropped > 0) {
      this.shortening = { length, dropped }
      return { ok: true }
    }
    this.shortening = undefined
    return this.#change('Change the length', edits)
  }

  async confirmLength(): Promise<Outcome> {
    const script = this.script
    const asked = this.shortening
    if (script === undefined || asked === undefined) return { ok: true }
    this.shortening = undefined
    this.select(undefined)
    return this.#change('Shorten the scene', durationEdits(script, asked.length).edits)
  }
}
