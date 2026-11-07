// The narrative plugin (M6 spec §4.7, §4.13). `createNarrative` gives the plugin and the functions the game wires into
// puzzle's hooks (`dialogue: startDialogue`, `verb: heardVerb`, NR-D3), with `fireSystem` for its own system events and
// `load` for a scene change.

import type { VerbReport } from '@automata/puzzle/sim'
import { definePlugin, type PluginDef, type ResourceDef, type SimContext } from '@automata/sim'
import type { z } from 'zod'
import { loadNarrative, type NarrativeScene } from './load-narrative'
import { AdvanceCommand, ChooseCommand, StartCommand } from './narrative.command'
import { NarrativeChoices, NarrativeEnded, NarrativeLine, NarrativeStorylet } from './narrative.event'
import {
  NarrativeDialogue,
  NarrativeEnv,
  type NarrativeEnvValue,
  NarrativeSceneResource,
  NarrativeStorylets,
} from './narrative.resource'
import {
  dialogueSystem,
  fireSystem,
  heardVerb,
  type NarrativeOptions,
  startDialogue,
  storyletSystem,
} from './narrative.system'

export interface Narrative {
  readonly plugin: PluginDef
  /** Where the game names the player (`narrative.env`). */
  readonly env: ResourceDef<z.ZodType<NarrativeEnvValue>>
  startDialogue(ctx: SimContext, id: string): void
  heardVerb(ctx: SimContext, report: VerbReport): void
  fireSystem(ctx: SimContext, event: string): void
  load(ctx: SimContext, scene: NarrativeScene): void
}

export function createNarrative(options: NarrativeOptions = {}): Narrative {
  return {
    plugin: definePlugin({
      name: 'narrative',
      dependsOn: ['sectors', 'puzzle'],
      config: { mappedFacts: options.facts !== undefined },
      resources: [NarrativeSceneResource, NarrativeDialogue, NarrativeStorylets, NarrativeEnv],
      commands: [StartCommand, AdvanceCommand, ChooseCommand],
      events: [NarrativeLine, NarrativeChoices, NarrativeEnded, NarrativeStorylet],
      systems: [dialogueSystem(options), storyletSystem(options)],
    }),
    env: NarrativeEnv,
    startDialogue: (ctx, id) => startDialogue(ctx, id, options),
    heardVerb: (ctx, report) => heardVerb(ctx, report, options),
    fireSystem: (ctx, event) => fireSystem(ctx, event, options),
    load: loadNarrative,
  }
}
