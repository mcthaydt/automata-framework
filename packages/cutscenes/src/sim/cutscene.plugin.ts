// The cutscene plugin (M6 spec §4.8). `createCutscenes` gives the plugin and the functions a game wires: `start` (puzzle's
// `cutscene` hook, NR-D3's pattern), `load` for a scene change, and `locked` for the input that cutscenes hold.
import { definePlugin, type PluginDef, type SimContext } from '@mcthaydt/automata-sim'
import { CutsceneSkip } from './cutscene.command'
import { CutsceneEnded, CutsceneStarted } from './cutscene.event'
import { CutsceneScene, CutsceneState } from './cutscene.resource'
import type { CutsceneScript } from './cutscene.schema'
import { type CutscenesOptions, cutsceneSystem, locked, startCutscene } from './cutscene.system'
import { loadCutscenes } from './load-cutscenes'

export type { CutscenesOptions }
export interface Cutscenes {
  readonly plugin: PluginDef
  start(ctx: SimContext, id: string): void
  load(ctx: SimContext, scripts: readonly CutsceneScript[]): void
  locked(ctx: SimContext): boolean
}

export function createCutscenes(options: CutscenesOptions = {}): Cutscenes {
  return {
    plugin: definePlugin({
      name: 'cutscenes',
      config: { anchors: options.anchor !== undefined },
      resources: [CutsceneScene, CutsceneState],
      commands: [CutsceneSkip],
      events: [CutsceneStarted, CutsceneEnded],
      systems: [cutsceneSystem],
    }),
    start: (ctx, id) => startCutscene(ctx, id, options),
    load: loadCutscenes,
    locked,
  }
}
