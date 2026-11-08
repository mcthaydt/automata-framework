// Schematic's session: the scene being edited, its files (the behaviour file, the places and the puzzle), and what the
// person has chosen. A scene is the name its files share (`content/systems/<scene>.toml`, `content/nav/<scene>.toml`,
// `content/puzzles/<scene>.toml`). The session outlives the view, so leaving Schematic and coming back finds the same
// thing chosen. `revision` only tells Svelte that a history moved.
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { SuitePorts } from '@automata/editor/kit/ports'
import { type NavGraph, navGraphSchema } from '@automata/nav/sim'
import { type PuzzleDef, puzzleDefShape } from '@automata/puzzle/sim'
import { type AgentDef, type SystemsDef, systemsDefShape } from '@automata/systems/sim'
import { contentOf } from '../../shared/content-session.svelte.ts'
import {
  type Outcome,
  openTomlSession,
  type Problem,
  type TomlRead,
  type TomlSession,
} from '../../shared/toml-session.ts'
import { schematicProblems } from './schematic-problems.ts'
import { newAgent, newSystemsFile, systemsFileText } from './starter.ts'

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
