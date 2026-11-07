// @automata/systems: world rules and agents as data (M6 spec §4.6). The sim side is the `./sim` entry; this
// entry adds the `systems` content kind and `systemsExtension`.
export * from './sim/index'
export { systemsContent, systemsSchema } from './systems.content'
export { type SystemsExtension, systemsExtension } from './systems.extension'
