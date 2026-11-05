// @mcthaydt/automata: the one import (PRODUCT spec §7), raylib's `raylib.h` for AF core. It re-exports the game
// package and the sim's define verbs unchanged; each is a thin layer over a public package a game can always drop
// down to (`@mcthaydt/automata-sim`, `-runtime`, `-render-pixi`, `-host`, `-ui`). Plus extensions are separate
// imports and never come through here. `createCamera2d` (M4.8) comes through the game package; verbs core does not
// have yet (`sound`, `music`, `t`, `tween`) join this list when their owning packages ship them (PRODUCT.2 plan U-3).

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
} from '@mcthaydt/automata-sim'
export * from './from-game.ts'
