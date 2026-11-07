// @automata/systems: world rules and agents as data. The sim side is the `./sim` entry; this
// entry adds the `systems` content kind and `systemsExtension`.

export { systemsContent, systemsSchema } from '../features/agents/systems.content'
export { type SystemsExtension, systemsExtension } from '../features/agents/systems.extension'
export * from './sim'
