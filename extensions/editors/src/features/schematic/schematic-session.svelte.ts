// Schematic's session: the scene being edited, its files (the behaviour file, the places and the puzzle), and what the
// person has chosen. A scene is the name its files share (`content/systems/<scene>.toml`, `content/nav/<scene>.toml`,
// `content/puzzles/<scene>.toml`). The session outlives the view, so leaving Schematic and coming back finds the same
// thing chosen. `revision` only tells Svelte that a history moved.
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { SuitePorts } from '@automata/editor/kit/ports'
import { type NavGraph, navGraphSchema } from '@automata/nav/sim'
import { type PuzzleDef, puzzleDefShape } from '@automata/puzzle/sim'
import { type AgentDef, type SystemsDef, systemsDefShape, type Transition } from '@automata/systems/sim'
import { stringify } from 'smol-toml'
import { contentOf } from '../../shared/content-session.svelte.ts'
import {
  type Outcome,
  openTomlSession,
  type Problem,
  type TomlRead,
  type TomlSession,
} from '../../shared/toml-session.ts'
import {
  addPlaceEdits,
  connectEdits,
  disconnectEdits,
  removePlaceEdits,
  renamePlaceEdits,
} from './places-edits.ts'
import { changeRuleText, type RuleChange } from './rule-text.ts'
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
  #files: SceneFiles | undefined = $state.raw()
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
    ): Promise<TomlSession<T>> =>
      openTomlSession<T>({ path: `${dir}${scene}.toml`, ports: this.ports, schema, empty })
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
    if (item === undefined) return this.#refuse('That is not in this character any more.')
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
    if (before === undefined) return this.#refuse('That switch is not in this character any more.')
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
    if (character === undefined) return this.#refuse('That character is not in this scene any more.')
    return this.change('Change the order', reorderEdits(character, agent, index, to))
  }

  async renameMode(agent: number, from: string, to: string): Promise<Outcome> {
    const def = this.def
    if (def === undefined)
      return this.#refuse('This file has a mistake, so it is read only until the mistake is fixed.')
    const edits = renameModeEdits(def, agent, from, to)
    if ('refused' in edits) return this.#refuse(edits.refused)
    const outcome = await this.change(`Rename ${from} to ${to}`, edits)
    if (outcome.ok && this.selected?.kind === 'mode' && this.selected.mode === from)
      this.selected = { kind: 'mode', mode: to }
    return outcome
  }

  async renameCharacter(from: string, to: string): Promise<Outcome> {
    const def = this.def
    if (def === undefined)
      return this.#refuse('This file has a mistake, so it is read only until the mistake is fixed.')
    const edits = renameAgentEdits(def, from, to)
    if ('refused' in edits) return this.#refuse(edits.refused)
    return this.change(`Rename ${from} to ${to}`, edits)
  }

  /** A new mode, named "mode 2" and so on, that stands still until it is given a speed. */
  async addMode(agent: number): Promise<Outcome> {
    const character = this.def?.agents[agent]
    if (character === undefined) return this.#refuse('That character is not in this scene any more.')
    let n = character.modes.length + 1
    while (character.modes.includes(`mode-${n}`)) n += 1
    const name = `mode-${n}`
    const outcome = await this.change('Add a mode', addModeEdits(agent, name))
    if (outcome.ok) this.selected = { kind: 'mode', mode: name }
    return outcome
  }

  /** Runs a places edit: `edits` for the places file, or why not. */
  async #places(
    label: string,
    edits: readonly ContentEdit[] | { readonly refused: string },
  ): Promise<Outcome> {
    if ('refused' in edits) return this.#refuse(edits.refused)
    const outcome = await this.files.nav.edit(label, edits)
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  /** The first place makes the scene's places file (when the editor list lets Schematic write it). */
  async addPlace(name: string, x: number, z: number): Promise<Outcome> {
    if (!this.facts.listsNav)
      return this.#refuse(
        'The editor list does not name the places files yet. Add the rows shown on the start page.',
      )
    const nav = this.places
    if (nav !== undefined) return this.#places('Add a place', addPlaceEdits(nav, name, x, z))
    if (this.files.nav.exists())
      return this.#refuse('The places file has a mistake, so it is read only until it is fixed.')
    const id = name.trim()
    if (id === '') return this.#refuse('A place needs a name.')
    const text = `# The places in this scene that characters walk between.\n${stringify({ nodes: { [id]: { x, z } }, edges: [] })}`
    const outcome = await this.files.nav.accept(text, 'Add the first place')
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  async movePlace(place: string, axis: 'x' | 'z', value: number): Promise<Outcome> {
    const at = this.places?.nodes[place]
    if (at === undefined) return this.#refuse('That place is not in this scene any more.')
    return this.#places('Move a place', [{ keyPath: ['nodes', place, axis], expected: at[axis], set: value }])
  }

  async connectPlaces(a: string, b: string): Promise<Outcome> {
    const nav = this.places
    return nav === undefined
      ? this.#refuse('There are no places yet.')
      : this.#places('Join two places', connectEdits(nav, a, b))
  }

  async disconnectPlaces(a: string, b: string): Promise<Outcome> {
    const nav = this.places
    return nav === undefined
      ? this.#refuse('There are no places yet.')
      : this.#places('Part two places', disconnectEdits(nav, a, b))
  }

  async removePlace(place: string): Promise<Outcome> {
    const nav = this.places
    if (nav === undefined) return this.#refuse('There are no places yet.')
    return this.#places('Remove a place', removePlaceEdits(nav, this.def, place))
  }

  /** The places file first, then the references in the behaviour file; the two files keep their own histories. */
  async renamePlace(from: string, to: string): Promise<Outcome> {
    const nav = this.places
    if (nav === undefined) return this.#refuse('There are no places yet.')
    const edits = renamePlaceEdits(nav, this.def, from, to)
    if ('refused' in edits) return this.#refuse(edits.refused)
    const first = await this.#places(`Rename ${from} to ${to}`, edits.nav)
    if (!first.ok || edits.systems.length === 0) return first
    return this.change(`Rename ${from} to ${to}`, edits.systems)
  }

  /**
   * World rule `rule` made `next`. When only values differ each is written in its own literal; when a condition or an
   * action came or went, the rule's tables are written again (`rule-text.ts`).
   */
  async setRule(label: string, rule: number, next: SystemsDef['rules'][number]): Promise<Outcome> {
    const before = this.def?.rules[rule]
    if (before === undefined) return this.#refuse('That rule is not in this scene any more.')
    if (sameShape(before, next)) return this.change(label, diffEdits(['rules', rule], before, next))
    return this.#rules(label, { kind: 'replace', index: rule, next })
  }

  /** A new rule with nothing in it yet, named "rule-3" and so on. */
  async addRule(): Promise<Outcome> {
    const def = this.def
    if (def === undefined)
      return this.#refuse('This file has a mistake, so it is read only until the mistake is fixed.')
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
    if (found === undefined) return this.#refuse('That rule is not in this scene any more.')
    const cell = this.def?.matrix.find((c) => c.rule === found.id)
    if (cell !== undefined)
      return this.#refuse(
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

  /** A number in the Numbers page. */
  async setNumber(name: string, value: number): Promise<Outcome> {
    const before = this.def?.tunables[name]
    if (before === undefined) return this.#refuse('That number is not in this scene any more.')
    return this.change(`Change ${name}`, [
      { keyPath: ['tunables', name, 'value'], expected: before.value, set: value },
    ])
  }

  #refuse(message: string): Outcome {
    this.message = message
    return { ok: false, message }
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
