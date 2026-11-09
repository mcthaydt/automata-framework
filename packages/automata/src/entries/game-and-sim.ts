// The game call and the sim's define verbs, unchanged: each is a thin layer over a part a game can always drop down
// to (`@automata/sim` for the verbs). `createCamera2d` comes through `game.ts`; verbs core does not have
// yet (`sound`, `music`, `t`, `tween`) join this list when they ship.

export {
  type Command,
  type CommandDef,
  type ComponentDef,
  defineCommand,
  defineComponent,
  defineEvent,
  definePlugin,
  defineResource,
  defineSystem,
  type EntityRef,
  type EventDef,
  type PluginDef,
  type ResourceDef,
  type Sim,
  type SimContext,
  type StepResult,
  type SystemDef,
} from '@automata/sim'
export * from './game.ts'
