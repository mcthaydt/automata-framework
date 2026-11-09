// @automata/systems: world rules and agents as data. The sim side is the `./sim` entry; this
// entry adds the `systems` content kind and `systemsExtension`.

export { type SystemsExtension, systemsExtension } from '../app/systems.extension'
export { systemsContent, systemsSchema } from '../shared/systems.content'
export * from './sim'
