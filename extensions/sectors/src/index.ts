// @automata/sectors: a scene's sector map (M6 spec §4.3). The sim side is the `./sim` entry; this entry adds the
// `sector-map` content kind and the extension a game registers. The render side arrives with M6.4b.

export { sectorMapContent } from './sector-map.content'
export { sectorsExtension } from './sectors.extension'
export * from './sim/index'
