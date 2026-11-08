// @automata/3d/world-content: the world's content kinds, for a game's content compiler (its `vite.config.ts` lists them
// beside the figures'). A game writes its own swatches and prop presets as TOML under `content/world-swatches/` and
// `content/world-props/`; the room's builder reads them back from the compiled content. The schemas import no Pixi.

export { worldPropContent, worldSwatchContent } from '../features/world/content/world.content.ts'

// The rules that say whether a level's names exist in a library, for an editor's check: the same ones the world builder
// uses, so the editor and the game never disagree. Pixi-free.
export { isFault, type PropFault, type ResolvedProp, resolveProp } from '../features/world/props/resolve.ts'
export { hasSwatch, type WorldLibrary } from '../features/world/swatches.ts'
