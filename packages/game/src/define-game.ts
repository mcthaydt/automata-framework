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
  type GameDefinition,
  type RuntimeSeams,
  type ScreenDef,
  type SettingsDef,
} from '@mcthaydt/automata-runtime'
import type { ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import type { PluginDef, Sim } from '@mcthaydt/automata-sim'
import { SLUG_RE } from '@ruken/manifest'
import { defaultContent } from './default-content.ts'
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
  /** Default: no commands. */
  readonly input?: InputMap
  /** Component id → view (`rect`, `sprite`). */
  readonly views?: Readonly<Record<string, EntityViewFactory>>
  /** A game with `content/` passes the compiler's output; `sim` is the sim's partition of it. */
  readonly content?: { readonly data: CompiledContentData; readonly hash: string; readonly sim?: unknown }
  /** Default: title, play and paused (DX spec §7). */
  readonly screens?: readonly ScreenDef[]
  /** Default: `#game`. */
  readonly root?: HTMLElement
  readonly hosting?: Partial<Omit<HostingOptions, 'gameId' | 'disclosedEvents'>>
  readonly settings?: SettingsDef<S>
  readonly extensions?: readonly ExtensionDef[]
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
  if (spec.content !== undefined && !HASH.test(spec.content.hash))
    problems.push(`content.hash: "${spec.content.hash}" is not 16 hex digits`)
  return problems
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
  const renderer = createPixiRenderer({
    logicalWidth: spec.size.width,
    logicalHeight: spec.size.height,
    pixelArt: true,
    ...(spec.views === undefined ? {} : { entityViews: spec.views }),
    ...spec.renderer,
  })

  const game: DefinedGame<S> = {
    id: spec.id,
    title,
    size: spec.size,
    sim,
    ...(spec.input === undefined ? {} : { input: spec.input }),
    get root() {
      return rootOf(spec)
    },
    hosting: { wants: [], pauseBehavior: 'pause', ...spec.hosting, gameId: spec.id },
    content,
    screens: spec.screens ?? defaultScreens({ title, sim, input: spec.input }),
    renderer,
    ...(spec.settings === undefined ? {} : { settings: spec.settings }),
    ...(spec.extensions === undefined ? {} : { extensions: spec.extensions }),
    ...(spec.copy === undefined ? {} : { copy: spec.copy }),
    ...(spec.seams === undefined ? {} : { seams: spec.seams }),
  }
  definedGames.add(game)
  return game
}
