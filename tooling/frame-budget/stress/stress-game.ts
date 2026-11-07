import type { CompiledContentData, GameDefinition, RendererFactory, RuntimeSeams } from '@mcthaydt/automata'
import { createPixiRenderer } from '@mcthaydt/automata'
import type { StressParams } from './params.ts'
import { WORLD } from './sim/stress.component.ts'
import { stressScreen } from './stress-screen.ts'
import { bodyView } from './views.ts'

/** One screen, no assets: the scene is built in code so its size comes from the query, not from content. */
export const STRESS_CONTENT: CompiledContentData = {
  flow: { entry: 'stress', screens: ['stress'], terminal: [], transitions: [] },
  game: {
    source_language: 'en',
    rating: 'everyone',
    descriptors: [],
    custom_events: [],
    preload_screens: [],
  },
}

/** hex64(xxhash64(canonicalJson(STRESS_CONTENT))), the runtime's formula; stress-game.test.ts pins it. */
export const STRESS_CONTENT_HASH = '5fe00a8b56426bc9'

export interface StressGameOptions {
  readonly root: HTMLElement
  /** The Pixi renderer with an entity view per body unless a test swaps it. */
  readonly renderer?: RendererFactory
  readonly seams?: RuntimeSeams
}

/** The core stress example as a GameDefinition for `runGame`. */
export function stressGame(params: StressParams, options: StressGameOptions): GameDefinition {
  return {
    root: options.root,
    hosting: { gameId: 'af-stress-core', wants: [], pauseBehavior: 'pause' },
    content: { data: STRESS_CONTENT, hash: STRESS_CONTENT_HASH },
    screens: [stressScreen(params)],
    renderer:
      options.renderer ??
      createPixiRenderer({
        logicalWidth: WORLD.width,
        logicalHeight: WORLD.height,
        backgroundColor: 0x111122,
        entityViews: { 'stress-body': bodyView },
      }),
    ...(options.seams === undefined ? {} : { seams: options.seams }),
  }
}
