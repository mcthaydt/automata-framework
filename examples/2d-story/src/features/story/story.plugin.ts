import { definePlugin, type PluginDef } from '@automata/sim'
import { Story } from './story.resource.ts'
import { type StoryOptions, storySystems } from './story-systems.ts'

/** The story's part of the sim: what it remembers, and the systems that load it, start the conversation and the cutscene. */
export function createStoryPlugin(options: StoryOptions): PluginDef {
  return definePlugin({
    name: 'story-lines',
    dependsOn: ['level-2d', 'nav', 'puzzle', 'narrative', 'cutscenes', 'systems'],
    resources: [Story],
    systems: storySystems(options),
  })
}
