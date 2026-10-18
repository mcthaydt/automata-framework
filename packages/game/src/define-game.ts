// defineGame: a `GameSpec` with every default filled in (DX spec §3.1, §5 step 1). Pure: it reads no document
// until the runtime asks for the root, so a game module also loads in Node (the examples' golden parity).
import type { HostingOptions } from '@mcthaydt/automata-host'
import {
  createPixiRenderer,
  type EntityViewFactory,
  type PixiRendererOptions,
} from '@mcthaydt/automata-render-pixi'
import {
  BootDefect,
  type CompiledContentData,
  type EventScores,
  type EventSounds,
  type GameDefinition,
  type GameOrientation,
  type RuntimeSeams,
  type ScreenDef,
  type SettingsDef,
} from '@mcthaydt/automata-runtime'
import type { ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import type { PluginDef, Sim } from '@mcthaydt/automata-sim'
import { SLUG_RE } from '@ruken/manifest'
import { defaultContent } from './default-content.ts'
import { createDrawLayer, type DrawContext, type DrawLayer, mergeStageHooks } from './draw/draw-layer.ts'
import type { InputMap } from './input/keys.ts'
import { defaultScreens } from './screens/default-screens.ts'

export interface GameSpec<S = never> {
  /** Ruken's game id (`[game].id`), checked with Ruken's own rule; it is `hosting.gameId`. */
  readonly id: string
  /** Shown on the title screen. Default: the id. */
  readonly title?: string
  /** The playfield in logical pixels. */
  readonly size: { readonly width: number; readonly height: number }
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    /** Default 1. */
    readonly seed?: number
    /** Spawns the starting entities before tick 0. */
    readonly setup?: (sim: Sim) => void
  }
  /**
   * The orientation the game plays in, the same as the ship config's `runtime.orientation` (M4.7). On a phone held
   * the other way a `portrait` or `landscape` game pauses behind the rotate hint. Default `any`.
   */
  readonly orientation?: GameOrientation
  /** Default: no commands. */
  readonly input?: InputMap
  /** Component id → view (`rect`, `sprite`). */
  readonly views?: Readonly<Record<string, EntityViewFactory>>
  /**
   * The sound each sim event plays, by the event's id: `{ [Chime.id]: 'chime.wav' }`, or `{ alias, bus, gain }`.
   * Silent until the player's first gesture (browsers allow no sound before it).
   */
  readonly sounds?: EventSounds
  /**
   * The board and score each sim event submits, by the event's id (M5.7):
   * `{ [RunEnded.id]: { board: 'best', score: (payload) => RunEnded.schema.parse(payload).score } }`. The board is a key
   * of the ship config's `leaderboards`; the game then asks the host for `leaderboards`.
   */
  readonly scores?: EventScores
  /** A game with `content/` passes the compiler's output; `sim` is the sim's partition of it. */
  readonly content?: { readonly data: CompiledContentData; readonly hash: string; readonly sim?: unknown }
  /** Default: title, play and paused (DX spec §7). */
  readonly screens?: readonly ScreenDef[]
  /** Default: `#game`. */
  readonly root?: HTMLElement
  readonly hosting?: Partial<Omit<HostingOptions, 'gameId' | 'disclosedEvents'>>
  readonly settings?: SettingsDef<S>
  readonly extensions?: readonly ExtensionDef[]
  /**
   * Immediate-mode HUD, debug and prototype drawing over the entity views, once per display frame while the
   * default screens hold a sim (PRODUCT spec §7). It reads the sim and never writes it. Needs the default screens.
   */
  readonly draw?: (ctx: DrawContext) => void
  /** Merged over the defaults (`pixelArt`, the logical size and the views). */
  readonly renderer?: PixiRendererOptions
  readonly copy?: GameDefinition['copy']
  /** Tests only. */
  readonly seams?: RuntimeSeams
}

/** The runtime's `GameDefinition`, plus what the screens and the golden replay read from the spec. */
export interface DefinedGame<S = never> extends GameDefinition<S> {
  readonly id: string
  readonly title: string
  readonly size: { readonly width: number; readonly height: number }
  readonly input?: InputMap | undefined
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    readonly seed: number
    readonly setup?: ((sim: Sim) => void) | undefined
    readonly content?: unknown
  }
}

/** Every invalid field of a spec, by path: `size.width: …`. */
export class GameSpecError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(`invalid GameSpec:\n  ${problems.join('\n  ')}`)
    this.name = 'GameSpecError'
    this.problems = problems
  }
}

const HASH = /^[0-9a-f]{16}$/
const isSize = (value: number): boolean => Number.isInteger(value) && value > 0

function problemsOf<S>(spec: GameSpec<S>): string[] {
  const problems: string[] = []
  if (!SLUG_RE.test(spec.id))
    problems.push(`id: "${spec.id}" is not a Ruken game id (lowercase letters, digits and hyphens)`)
  for (const side of ['width', 'height'] as const)
    if (!isSize(spec.size[side])) problems.push(`size.${side}: ${spec.size[side]} is not a positive integer`)
  const drawn = new Set(
    spec.sim.plugins.flatMap((plugin) => plugin.components.filter((c) => c.render).map((c) => c.id)),
  )
  for (const key of Object.keys(spec.views ?? {}))
    if (!drawn.has(key)) problems.push(`views.${key}: no plugin has a drawn component "${key}"`)
  const events = new Set(spec.sim.plugins.flatMap((plugin) => plugin.events.map((event) => event.id)))
  for (const key of Object.keys(spec.sounds ?? {}))
    if (!events.has(key)) problems.push(`sounds.${key}: no plugin defines an event "${key}"`)
  for (const key of Object.keys(spec.scores ?? {}))
    if (!events.has(key)) problems.push(`scores.${key}: no plugin defines an event "${key}"`)
  if (spec.draw !== undefined && typeof spec.draw !== 'function') problems.push('draw: is not a function')
  else if (spec.draw !== undefined && spec.screens !== undefined)
    problems.push('draw: needs the default screens (custom screens do not hand their sim to the draw layer)')
  if (spec.content !== undefined && !HASH.test(spec.content.hash))
    problems.push(`content.hash: "${spec.content.hash}" is not 16 hex digits`)
  return problems
}

/** The capabilities the game asks for: the spec's, plus `leaderboards` when it has scores (once). */
function wantsOf<S>(spec: GameSpec<S>): NonNullable<HostingOptions['wants']> {
  const wants = spec.hosting?.wants ?? []
  return spec.scores === undefined || wants.includes('leaderboards') ? wants : [...wants, 'leaderboards']
}

/** `spec.root`, else `#game`; a BootDefect when there is neither (DX spec §6). */
function rootOf<S>(spec: GameSpec<S>): HTMLElement {
  const root = spec.root ?? (typeof document === 'undefined' ? null : document.getElementById('game'))
  if (root === null)
    throw new BootDefect({ cause: new Error('no root: pass `root` or add an element #game') })
  return root
}

/** Every game `defineGame` returned, so `startGame` can tell one from a spec without guessing from its shape. */
const definedGames = new WeakSet<object>()

/** Whether `value` came from `defineGame`. */
export function isDefinedGame<S>(value: GameSpec<S> | DefinedGame<S>): value is DefinedGame<S> {
  return definedGames.has(value)
}

/**
 * The Pixi renderer's options: the logical size, pixel art and the views, under the game's own `renderer`
 * options. With a draw layer, the game's own `setup` runs first and the layer mounts over it; their frame
 * hooks run in that order.
 */
export function pixiOptions<S>(spec: GameSpec<S>, layer: DrawLayer | undefined): PixiRendererOptions {
  const options: PixiRendererOptions = {
    logicalWidth: spec.size.width,
    logicalHeight: spec.size.height,
    pixelArt: true,
    ...(spec.views === undefined ? {} : { entityViews: spec.views }),
    ...spec.renderer,
  }
  if (layer === undefined) return options
  const ownSetup = spec.renderer?.setup
  return {
    ...options,
    setup: (stage) => mergeStageHooks(ownSetup?.(stage) ?? undefined, layer.setup(stage)),
  }
}

export function defineGame<S = never>(spec: GameSpec<S>): DefinedGame<S> {
  const problems = problemsOf(spec)
  if (problems.length > 0) throw new BootDefect({ cause: new GameSpecError(problems) })

  const title = spec.title ?? spec.id
  const sim = {
    plugins: spec.sim.plugins,
    seed: spec.sim.seed ?? 1,
    ...(spec.sim.setup === undefined ? {} : { setup: spec.sim.setup }),
    ...(spec.content?.sim === undefined ? {} : { content: spec.content.sim }),
  }
  const content =
    spec.content === undefined ? defaultContent() : { data: spec.content.data, hash: spec.content.hash }
  const layer = spec.draw === undefined ? undefined : createDrawLayer(spec.draw, spec.size)
  const renderer = createPixiRenderer(pixiOptions(spec, layer))

  const game: DefinedGame<S> = {
    id: spec.id,
    title,
    size: spec.size,
    orientation: spec.orientation ?? 'any',
    sim,
    ...(spec.input === undefined ? {} : { input: spec.input }),
    get root() {
      return rootOf(spec)
    },
    hosting: { pauseBehavior: 'pause', ...spec.hosting, wants: wantsOf(spec), gameId: spec.id },
    content,
    screens:
      spec.screens ??
      defaultScreens({
        title,
        sim,
        input: spec.input,
        ...(layer === undefined ? {} : { watchSim: layer.watch }),
        ...(spec.scores === undefined ? {} : { board: Object.values(spec.scores)[0]?.board }),
        ...(spec.extensions === undefined ? {} : { extensions: spec.extensions }),
      }),
    renderer,
    ...(spec.settings === undefined ? {} : { settings: spec.settings }),
    ...(spec.extensions === undefined ? {} : { extensions: spec.extensions }),
    ...(spec.sounds === undefined ? {} : { sounds: spec.sounds }),
    ...(spec.scores === undefined ? {} : { scores: spec.scores }),
    ...(spec.copy === undefined ? {} : { copy: spec.copy }),
    ...(spec.seams === undefined ? {} : { seams: spec.seams }),
  }
  definedGames.add(game)
  return game
}
