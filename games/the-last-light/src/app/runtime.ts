import { cutscenesExtension } from '@automata/cutscenes'
import type { ExtensionDef } from '@automata/framework/extension'
import { interactExtension } from '@automata/interact'
import type { SimView } from '@automata/interact/sim'
import { narrativeExtension } from '@automata/narrative'
import { puzzleExtension } from '@automata/puzzle'
import { type PuzzleOptions, PuzzleState, type Reader } from '@automata/puzzle/sim'
import { InSector } from '@automata/sectors/sim'
import type { PluginDef, SimContext } from '@automata/sim'
import { createCarriedLight, createPeek, systemsExtension } from '@automata/systems'
import { adaPlugin } from '../features/ada/ada.plugin.ts'
import { catchPlugin } from '../features/catch/catch.plugin.ts'
import { caught } from '../features/catch/catch-hook.ts'
import { saveCheckpoint } from '../features/catch/checkpoint.ts'
import { fillLamp } from '../features/lamp/fill.ts'
import { lampPlugin } from '../features/lamp/lamp.plugin.ts'
import { lampFacts } from '../features/lamp/lamp-facts.ts'
import { nightPlugin } from '../features/night/night.plugin.ts'
import { Night } from '../features/night/night.resource.ts'
import { nightHooks } from '../features/night/night-hooks.ts'
import { Ada } from '../shared/ada.component.ts'
import type { PlayContent } from '../shared/play-content.ts'
import { anchorsOf } from './anchors.ts'

/** Everything the game builds from its content once: the extensions, the plugins and the objects the scene loads through. */
export interface Runtime {
  readonly extensions: readonly ExtensionDef[]
  /** The game's own plugins, after the extensions'. */
  readonly plugins: readonly PluginDef[]
  readonly interact: ReturnType<typeof interactExtension>
  readonly cutscenes: ReturnType<typeof cutscenesExtension>
  readonly narrative: ReturnType<typeof narrativeExtension>
  readonly systems: ReturnType<typeof systemsExtension>
}

/**
 * The puzzle facts the game keeps in its own state: the lamp's `lit` and `fuel`, and the night's `vigilOver`. Every other
 * fact is the puzzle's own.
 */
const facts: NonNullable<PuzzleOptions['facts']> = {
  get: (ctx, name) => (name === 'vigilOver' ? ctx.resource(Night).over : lampFacts.get(ctx, name)),
  set: () => false,
}

/** The facts and items the puzzle reads, for a use and for the prompt: the mapped facts first, then the puzzle's own. */
const reader = (view: SimView): Reader => {
  const state = view.resource(PuzzleState)
  // The mapped facts only query and read resources, which a view has.
  return {
    fact: (name) => facts.get(view as SimContext, name) ?? state.facts[name],
    has: (item) => state.items.includes(item),
  }
}

/** The extensions and plugins of the game, with every join between them made. Needs the numbers of the content. */
export function createRuntime(play: PlayContent): Runtime {
  const cutscenes = cutscenesExtension({ anchor: anchorsOf(play) })
  const hooks = nightHooks({
    checkpoint: saveCheckpoint,
    start: cutscenes.start,
    playing: cutscenes.locked,
    caught: caught({ start: cutscenes.start, playing: cutscenes.locked }),
  })
  const systems = systemsExtension({ hooks, facts })
  const narrative = narrativeExtension({ facts: facts.get })
  const puzzle: PuzzleOptions = {
    calls: { read: () => undefined, fill: fillLamp(play.lamp) },
    facts,
    noise: (ctx, noise) => systems.hear(ctx, { at: noise.at, loudness: noise.loudness, kind: noise.kind }),
    dialogue: narrative.startDialogue,
    cutscene: cutscenes.start,
    locked: cutscenes.locked,
    verb: narrative.heardVerb,
  }
  const interact = interactExtension({
    player: (view) => {
      const [ada] = view.query(Ada, InSector)
      if (ada === undefined) return undefined
      const { x, z } = ada.get(InSector)
      return { entity: ada.sid, x, z }
    },
    reader,
    hide: systems.hide,
    puzzle,
  })
  return {
    extensions: [
      puzzleExtension({ ...puzzle, extensions: ['systems', 'narrative', 'cutscenes'] }),
      systems.extension,
      narrative.extension,
      cutscenes.extension,
      interact.extension,
    ],
    plugins: [
      createCarriedLight({ def: play.lamp }),
      createPeek({
        def: play.peek,
        facing: (ctx) => ctx.query(Ada)[0]?.get(Ada).yaw ?? 0,
      }),
      adaPlugin,
      lampPlugin(play.lamp, cutscenes.locked),
      nightPlugin(systems.hear, cutscenes.locked),
      catchPlugin(cutscenes.locked),
    ],
    interact,
    cutscenes,
    narrative,
    systems,
  }
}
