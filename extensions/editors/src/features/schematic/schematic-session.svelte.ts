// Schematic's session: the scene being edited, its files (the behaviour file, the places and the puzzle), and what the
// person has chosen. A scene is the name its files share (`content/systems/<scene>.toml`, `content/nav/<scene>.toml`,
// `content/puzzles/<scene>.toml`). The session outlives the view, so leaving Schematic and coming back finds the same
// thing chosen. `revision` only tells Svelte that a history moved.
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { CheckResult, SuitePorts } from '@automata/editor/kit/ports'
import { type NavGraph, navGraphSchema } from '@automata/nav/sim'
import { type PuzzleDef, puzzleDefShape } from '@automata/puzzle/sim'
import { type AgentDef, type SystemsDef, systemsDefShape, type Transition } from '@automata/systems/sim'
import { contentOf } from '../../shared/content-session.svelte.ts'
import {
  type Outcome,
  openTomlSession,
  type Problem,
  type TomlRead,
  type TomlSession,
} from '../../shared/toml-session.ts'
import { FAIR_CHECK } from './fair-words.ts'
import * as places from './places-actions.ts'
import { addFactEdits, addItemEdits, removeFactEdits, removeItemEdits } from './puzzle/puzzle-edits.ts'
import {
  addModeEdits,
  diffEdits,
  newSwitch,
  renameAgentEdits,
  renameModeEdits,
  reorderEdits,
  sameShape,
} from './schematic-edits.ts'
import { schematicProblems } from './schematic-problems.ts'
import { newAgent, newSystemsFile, systemsFileText } from './starter.ts'
import { type CharacterList, changeListText, type ListChange, type SwitchChange } from './switch-text.ts'
import {
  changeRuleText,
  changeTableListText,
  type ItemChange,
  type RuleChange,
  type TableList,
} from './table-list-text.ts'

/** What is selected on a character: a mode, or a switch by its place in the file. */
export type Selection =
  | { readonly kind: 'mode'; readonly mode: string }
  | { readonly kind: 'switch'; readonly index: number }

export const SYSTEMS_DIR = 'content/systems/'
export const NAV_DIR = 'content/nav/'
export const PUZZLE_DIR = 'content/puzzles/'

/** What the panel has chosen; the canvas shows it. */
export type SchematicChoice =
  | { readonly kind: 'character'; readonly index: number }
  | { readonly kind: 'places' }
  | { readonly kind: 'rules' }
  | { readonly kind: 'numbers' }
  | { readonly kind: 'fair' }
  | { readonly kind: 'puzzle' }

/** A scene's three files, open. The puzzle is only open when the scene has one. */
export interface SceneFiles {
  readonly scene: string
  readonly systems: TomlSession<SystemsDef>
  readonly nav: TomlSession<NavGraph>
  readonly puzzle: TomlSession<PuzzleDef> | undefined
}

/** What the game does or does not have, found when the editor opens. */
export interface SchematicFacts {
  /** The game's code uses the systems extension. */
  readonly usesSystems: boolean
  /** The editor list names the behaviour files, and the places. */
  readonly listsSystems: boolean
  readonly listsNav: boolean
  /** The address of the game's dev page, when the editors were opened in the game's folder. */
  readonly gameUrl: string | undefined
  /** The editor list names a 2D level editor and no 3D one, so light and warmth need the game's own facts. */
  readonly twoD: boolean
}

const EMPTY_SYSTEMS = "# How this scene's characters behave.\n"
const EMPTY_NAV = '# The places in this scene that characters walk between.\n'

const sceneOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.toml$/, '')

/** The scenes the files name, sorted. */
export function scenesOf(paths: readonly string[]): string[] {
  const scenes = new Set<string>()
  for (const path of paths)
    if ([SYSTEMS_DIR, NAV_DIR, PUZZLE_DIR].some((dir) => path.startsWith(dir)) && path.endsWith('.toml'))
      scenes.add(sceneOf(path))
  return [...scenes].sort()
}

interface Step {
  readonly label: string
  readonly sessions: readonly TomlSession<unknown>[]
}

export class SchematicSession {
  #revision = $state(0)
  readonly ports: SuitePorts
  readonly facts: SchematicFacts
  /** The scenes the game has files for; a game with none has one called `main` to start. */
  scenes: string[] = $state([])
  /** The scene being edited. */
  scene: string = $state('')
  chosen: SchematicChoice = $state({ kind: 'character', index: 0 })
  /** What is selected on the open character, if anything. */
  selected: Selection | undefined = $state()
  /** Why the last change was not made, until the next one is. */
  message: string | undefined = $state()
  /** The last fair-play run: what it found, the behaviour file's text it ran on, and how many steps had been written. */
  fair: { readonly result: CheckResult; readonly text: string; readonly steps: number } | undefined = $state()
  /** Whether a fair-play run is going. */
  fairRunning: boolean = $state(false)
  #files: SceneFiles | undefined = $state.raw()
  /**
   * Every write the editor made, as the files it changed, newest last: the same steps the suite's write path keeps, so Undo
   * and Redo move the files that step changed (a rename of a place changes two). Redo has what Undo took back.
   */
  #steps: Step[] = []
  #redone: Step[] = []
  readonly #listeners = new Set<() => void>()
  readonly #unsubscribe: (() => void)[] = []

  constructor(ports: SuitePorts, facts: SchematicFacts, scenes: string[]) {
    this.ports = ports
    this.facts = facts
    this.scenes = scenes.length === 0 ? ['main'] : scenes
  }

  /** Opens a scene's files and shows it. */
  async select(scene: string): Promise<void> {
    for (const stop of this.#unsubscribe.splice(0)) stop()
    const open = async <T>(
      dir: string,
      schema: Parameters<typeof openTomlSession<T>>[0]['schema'],
      empty: string,
    ): Promise<TomlSession<T>> => {
      const mine: { session?: TomlSession<T> } = {}
      mine.session = await openTomlSession<T>({
        path: `${dir}${scene}.toml`,
        ports: this.ports,
        schema,
        empty,
        // A write of one file is one step of the log.
        onStep: (label) => this.jointStep(label, mine.session === undefined ? [] : [mine.session]),
      })
      return mine.session
    }
    const systems = await open<SystemsDef>(SYSTEMS_DIR, systemsDefShape, EMPTY_SYSTEMS)
    const nav = await open<NavGraph>(NAV_DIR, navGraphSchema, EMPTY_NAV)
    const puzzle = (await this.ports.workspace.read(`${PUZZLE_DIR}${scene}.toml`))
      ? await open<PuzzleDef>(PUZZLE_DIR, puzzleDefShape, '')
      : undefined
    for (const session of [systems, nav, puzzle])
      if (session) this.#unsubscribe.push(session.history.subscribe(() => this.#changed()))
    this.#files = { scene, systems, nav, puzzle }
    this.scene = scene
    this.chosen = { kind: 'character', index: 0 }
    this.selected = undefined
    this.message = undefined
    this.#changed()
  }

  /** Records a write of these files as one step, before it is made; gives back what takes it away if it is refused. */
  jointStep(label: string, sessions: readonly TomlSession<unknown>[]): () => void {
    const step = { label, sessions }
    this.#steps.push(step)
    this.#redone = []
    this.#changed()
    return () => {
      const at = this.#steps.lastIndexOf(step)
      if (at >= 0) this.#steps.splice(at, 1)
      this.#changed()
    }
  }

  /** What Undo would take back and what Redo would put back, by the step's own words. */
  get undoLabel(): string | undefined {
    void this.#revision
    return this.#steps.at(-1)?.label
  }

  get redoLabel(): string | undefined {
    void this.#revision
    return this.#redone.at(-1)?.label
  }

  /** The files of the last step moved back (the suite has already written them), or forward again. */
  async followStep(back: boolean): Promise<void> {
    const from = back ? this.#steps : this.#redone
    const step = from.pop()
    if (step === undefined) return
    ;(back ? this.#redone : this.#steps).push(step)
    await Promise.all(step.sessions.map((session) => session.follow(back)))
    this.#changed()
  }

  #changed(): void {
    this.#revision += 1
    for (const listener of this.#listeners) listener()
  }

  /** Called after every change to any open file, or a change of scene; gives back the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  get files(): SceneFiles {
    void this.#revision
    if (this.#files === undefined) throw new Error('Schematic has no scene open')
    return this.#files
  }

  get read(): TomlRead<SystemsDef> {
    void this.#revision
    return this.files.systems.read()
  }

  /** The behaviour file as far as it can be read: what passes the shape, or the parsed value when only a check fails. */
  get def(): SystemsDef | undefined {
    return contentOf(this.read)
  }

  /** The scene's places, when its file reads. */
  get places(): NavGraph | undefined {
    void this.#revision
    return contentOf(this.files.nav.read())
  }

  /** Every problem of the behaviour file: its shape, then what the game's compiler would check. */
  get problems(): readonly Problem[] {
    const read = this.read
    if (read.kind === 'invalid') return read.problems
    if (read.kind !== 'ok') return []
    const nodes = this.places === undefined ? undefined : Object.keys(this.places.nodes)
    return schematicProblems(read.value, nodes)
  }

  async change(label: string, edits: readonly ContentEdit[], coalesce?: string): Promise<Outcome> {
    const outcome = await this.files.systems.edit(
      label,
      edits,
      coalesce === undefined ? undefined : { coalesce },
    )
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  /**
   * Items of a character's lists (a switch, a patrol stop, a sense) replaced, removed or added, in order, as one undo step:
   * each is the text of its own tables (`switch-text.ts`), and the file is written once.
   */
  async changeLists(label: string, changes: readonly ListChange[]): Promise<Outcome> {
    const { systems } = this.files
    let text = systems.history.state.text
    let refusal: string | undefined = text === undefined ? 'There is no file to change yet.' : undefined
    for (const change of changes) {
      if (text === undefined) break
      const result = changeListText(systems.path, text, change)
      if ('refused' in result) {
        refusal = result.refused
        break
      }
      text = result.text
    }
    const outcome: Outcome =
      refusal !== undefined || text === undefined
        ? { ok: false, message: refusal ?? 'There is no file to change yet.' }
        : await systems.accept(text, label)
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  changeList(label: string, change: ListChange): Promise<Outcome> {
    return this.changeLists(label, [change])
  }

  async changeSwitch(label: string, change: SwitchChange): Promise<Outcome> {
    return this.changeList(label, { ...change, list: 'transitions' })
  }

  /**
   * Item `index` of `list` made `next`: each changed value is written in its own literal when the shape is the same, else
   * the item's tables are rewritten.
   */
  async setItem(
    label: string,
    list: CharacterList,
    agent: number,
    index: number,
    next: unknown,
  ): Promise<Outcome> {
    const before = (this.def?.agents[agent] as Record<string, unknown> | undefined)?.[list]
    const item = Array.isArray(before) ? before[index] : undefined
    if (item === undefined) return this.refuse('That is not in this character any more.')
    if (sameShape(item, next))
      return this.change(label, diffEdits(['agents', agent, list, index], item, next))
    return this.changeList(label, { kind: 'replace', list, agent, index, next })
  }

  /**
   * Character `agent`'s switch `index` made `next`. When only numbers and words differ, each is written into its own
   * literal; when a condition or an action came or went, the switch's tables are rewritten (`switch-text.ts`).
   */
  async setSwitch(label: string, agent: number, index: number, next: Transition): Promise<Outcome> {
    const before = this.def?.agents[agent]?.transitions[index]
    if (before === undefined) return this.refuse('That switch is not in this character any more.')
    if (sameShape(before, next))
      return this.change(label, diffEdits(['agents', agent, 'transitions', index], before, next))
    return this.changeSwitch(label, { kind: 'replace', agent, index, next })
  }

  async removeSwitch(agent: number, index: number): Promise<Outcome> {
    const outcome = await this.changeSwitch('Remove a switch', { kind: 'remove', agent, index })
    if (outcome.ok) this.selected = undefined
    return outcome
  }

  /** A new switch out of `from`, checked first and always, until it is given a condition; it is selected. */
  async addSwitch(agent: number, from: string, to: string): Promise<Outcome> {
    const outcome = await this.changeSwitch('Add a switch', { kind: 'add', agent, next: newSwitch(from, to) })
    if (outcome.ok) {
      const count = this.def?.agents[agent]?.transitions.length ?? 0
      this.selected = { kind: 'switch', index: count - 1 }
    }
    return outcome
  }

  /** Moves a switch to place `to` inside its own group. */
  async moveSwitch(agent: number, index: number, to: number): Promise<Outcome> {
    const character = this.def?.agents[agent]
    if (character === undefined) return this.refuse('That character is not in this scene any more.')
    return this.change('Change the order', reorderEdits(character, agent, index, to))
  }

  async renameMode(agent: number, from: string, to: string): Promise<Outcome> {
    const def = this.def
    if (def === undefined)
      return this.refuse('This file has a mistake, so it is read only until the mistake is fixed.')
    const edits = renameModeEdits(def, agent, from, to)
    if ('refused' in edits) return this.refuse(edits.refused)
    const outcome = await this.change(`Rename ${from} to ${to}`, edits)
    if (outcome.ok && this.selected?.kind === 'mode' && this.selected.mode === from)
      this.selected = { kind: 'mode', mode: to }
    return outcome
  }

  async renameCharacter(from: string, to: string): Promise<Outcome> {
    const def = this.def
    if (def === undefined)
      return this.refuse('This file has a mistake, so it is read only until the mistake is fixed.')
    const edits = renameAgentEdits(def, from, to)
    if ('refused' in edits) return this.refuse(edits.refused)
    return this.change(`Rename ${from} to ${to}`, edits)
  }

  /** A new mode, named "mode 2" and so on, that stands still until it is given a speed. */
  async addMode(agent: number): Promise<Outcome> {
    const character = this.def?.agents[agent]
    if (character === undefined) return this.refuse('That character is not in this scene any more.')
    let n = character.modes.length + 1
    while (character.modes.includes(`mode-${n}`)) n += 1
    const name = `mode-${n}`
    const outcome = await this.change('Add a mode', addModeEdits(agent, name))
    if (outcome.ok) this.selected = { kind: 'mode', mode: name }
    return outcome
  }

  /** The places actions (`places-actions.ts`): each is one undo step, a rename one step across both files. */
  addPlace = (name: string, x: number, z: number): Promise<Outcome> => places.addPlace(this, name, x, z)
  movePlace = (place: string, axis: 'x' | 'z', value: number): Promise<Outcome> =>
    places.movePlace(this, place, axis, value)
  connectPlaces = (a: string, b: string): Promise<Outcome> => places.connectPlaces(this, a, b)
  disconnectPlaces = (a: string, b: string): Promise<Outcome> => places.disconnectPlaces(this, a, b)
  removePlace = (place: string): Promise<Outcome> => places.removePlace(this, place)
  renamePlace = (from: string, to: string): Promise<Outcome> => places.renamePlace(this, from, to)

  /**
   * World rule `rule` made `next`. When only values differ each is written in its own literal; when a condition or an
   * action came or went, the rule's tables are written again (`rule-text.ts`).
   */
  async setRule(label: string, rule: number, next: SystemsDef['rules'][number]): Promise<Outcome> {
    const before = this.def?.rules[rule]
    if (before === undefined) return this.refuse('That rule is not in this scene any more.')
    if (sameShape(before, next)) return this.change(label, diffEdits(['rules', rule], before, next))
    return this.#rules(label, { kind: 'replace', index: rule, next })
  }

  /** A new rule with nothing in it yet, named "rule-3" and so on. */
  async addRule(): Promise<Outcome> {
    const def = this.def
    if (def === undefined)
      return this.refuse('This file has a mistake, so it is read only until the mistake is fixed.')
    const taken = new Set(def.rules.map((r) => r.id))
    let n = def.rules.length + 1
    while (taken.has(`rule-${n}`)) n += 1
    return this.#rules('Add a rule', {
      kind: 'add',
      next: { id: `rule-${n}`, text: 'A new rule.', when: [], then: [] },
    })
  }

  /** Takes a rule out, unless the design notes still point to it. */
  async removeRule(rule: number): Promise<Outcome> {
    const found = this.def?.rules[rule]
    if (found === undefined) return this.refuse('That rule is not in this scene any more.')
    const cell = this.def?.matrix.find((c) => c.rule === found.id)
    if (cell !== undefined)
      return this.refuse(
        `“${found.text}” is in the design notes (${cell.row} ${cell.verb} ${cell.col}), so it stays. Change what it says instead.`,
      )
    return this.#rules('Remove a rule', { kind: 'remove', index: rule })
  }

  async #rules(label: string, change: RuleChange): Promise<Outcome> {
    const { systems } = this.files
    const text = systems.history.state.text
    const result =
      text === undefined
        ? { refused: 'There is no file to change yet.' }
        : changeRuleText(systems.path, text, change)
    const outcome: Outcome =
      'refused' in result ? { ok: false, message: result.refused } : await systems.accept(result.text, label)
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  /** The scene's puzzle, when it has a file and the file reads. */
  get puzzleDef(): PuzzleDef | undefined {
    void this.#revision
    const puzzle = this.files.puzzle
    return puzzle === undefined ? undefined : contentOf(puzzle.read())
  }

  /** Runs a puzzle edit: `edits` for the puzzle file, or why not. */
  async puzzleEdit(
    label: string,
    edits: readonly ContentEdit[] | { readonly refused: string },
  ): Promise<Outcome> {
    const puzzle = this.files.puzzle
    if (puzzle === undefined) return this.refuse('This scene has no puzzle.')
    if ('refused' in edits) return this.refuse(edits.refused)
    const outcome = await puzzle.edit(label, edits)
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  /** One item of the puzzle's actions or goal replaced, removed or added, as its own tables (`table-list-text.ts`). */
  async puzzleList(label: string, key: TableList, change: ItemChange): Promise<Outcome> {
    const puzzle = this.files.puzzle
    if (puzzle === undefined) return this.refuse('This scene has no puzzle.')
    const text = puzzle.history.state.text
    const result =
      text === undefined
        ? { refused: 'There is no file to change yet.' }
        : changeTableListText(puzzle.path, text, key, change)
    if ('refused' in result) return this.refuse(result.refused)
    const outcome = await puzzle.accept(result.text, label)
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  /** Whether the scene has a puzzle file. */
  get hasPuzzle(): boolean {
    void this.#revision
    return this.#files?.puzzle !== undefined
  }

  /** The puzzle file's text, which an answer about the puzzle is tied to. */
  get puzzleText(): string | undefined {
    void this.#revision
    return this.files.puzzle?.history.state.text
  }

  /** An item or a fact of the puzzle added or taken out by name: `edits` works out what to write, or why not. */
  async #puzzleNamed(
    label: string,
    edits: (def: PuzzleDef, name: string) => ContentEdit[] | { readonly refused: string },
    name: string,
  ): Promise<Outcome> {
    const def = this.puzzleDef
    return def === undefined
      ? this.refuse('This scene has no puzzle.')
      : this.puzzleEdit(label, edits(def, name))
  }

  addPuzzleItem = (name: string): Promise<Outcome> => this.#puzzleNamed('Add an item', addItemEdits, name)
  removePuzzleItem = (name: string): Promise<Outcome> =>
    this.#puzzleNamed('Remove an item', removeItemEdits, name)
  addPuzzleFact = (name: string): Promise<Outcome> => this.#puzzleNamed('Add a fact', addFactEdits, name)
  removePuzzleFact = (name: string): Promise<Outcome> =>
    this.#puzzleNamed('Remove a fact', removeFactEdits, name)

  /** Whether the game declares the check Fair play runs. */
  get fairAvailable(): boolean {
    return this.ports.checks.declared().some((check) => check.id === FAIR_CHECK)
  }

  /** How many changes ago fair play was checked: 0 on the version it ran on, `undefined` when it never has. */
  get fairAge(): number | undefined {
    void this.#revision
    return this.fair === undefined ? undefined : Math.max(0, this.#steps.length - this.fair.steps)
  }

  /** Whether the file has changed since the last fair-play run. */
  get fairStale(): boolean {
    void this.#revision
    return this.fair !== undefined && this.fair.text !== this.files.systems.history.state.text
  }

  /**
   * Runs the game's fair-play check by its id, on the file as it is now. It runs only here, never after a write, because
   * it plays the whole scene many times.
   */
  async checkFair(): Promise<void> {
    const { systems } = this.files
    const text = systems.history.state.text
    if (text === undefined || this.fairRunning) return
    this.fairRunning = true
    try {
      const run = await this.ports.checks.run({
        checks: [FAIR_CHECK],
        candidates: [{ path: systems.path, text }],
      })
      const result = (await run.result())[0]
      if (result !== undefined) this.fair = { result, text, steps: this.#steps.length }
    } finally {
      this.fairRunning = false
    }
  }

  /** One of the fairness thresholds, or a scenario's `within`, `probability` or `seeds`: a value in its own literal. */
  async setFairNumber(label: string, keyPath: readonly (string | number)[], value: number): Promise<Outcome> {
    let at: unknown = this.def
    for (const key of keyPath) at = (at as Record<string | number, unknown> | undefined)?.[key]
    if (typeof at !== 'number') return this.refuse('That is not in this scene any more.')
    return this.change(label, [{ keyPath, expected: at, set: value }])
  }

  /** A number in the Numbers page. */
  async setNumber(name: string, value: number): Promise<Outcome> {
    const before = this.def?.tunables[name]
    if (before === undefined) return this.refuse('That number is not in this scene any more.')
    return this.change(`Change ${name}`, [
      { keyPath: ['tunables', name, 'value'], expected: before.value, set: value },
    ])
  }

  /** Says why a change was not made, and gives that back as the outcome. */
  refuse(message: string): Outcome {
    this.message = message
    return { ok: false, message }
  }

  /** Shows a change's outcome: a refusal is said, a success clears the last one. */
  settle(outcome: Outcome): Outcome {
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  /** Adds a character; the first one makes the scene's file. */
  async addCharacter(agent: AgentDef = newAgent('character')): Promise<Outcome> {
    const { systems, scene } = this.files
    const def = this.def
    const taken = new Set(def?.agents.map((a) => a.id))
    let id = agent.id
    for (let n = 2; taken.has(id); n++) id = `${agent.id}-${n}`
    const next = { ...agent, id }
    const outcome =
      def === undefined
        ? systems.exists()
          ? {
              ok: false as const,
              message: 'This file has a mistake, so it is read only until the mistake is fixed.',
            }
          : await systems.accept(systemsFileText(newSystemsFile(scene, next)), `Add ${id}`)
        : await systems.edit(`Add ${id}`, [{ keyPath: ['agents'], insert: next }])
    this.message = outcome.ok ? undefined : outcome.message
    if (outcome.ok)
      this.chosen = { kind: 'character', index: this.def?.agents.length ? this.def.agents.length - 1 : 0 }
    return outcome
  }

  /** Chooses a character; nothing is selected on it yet. */
  choose(index: number): void {
    this.chosen = { kind: 'character', index }
    this.selected = undefined
  }

  /** The character the panel chose, or `undefined`. */
  get character(): AgentDef | undefined {
    const choice = this.chosen
    return choice.kind === 'character' ? this.def?.agents[choice.index] : undefined
  }
}
