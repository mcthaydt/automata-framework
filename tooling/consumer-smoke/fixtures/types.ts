// consumer-smoke's types step: the published declarations, read by TypeScript 7.0.2 and by
// 6.0.3 (a TS 6 consumer can read AF's .d.ts). One use of each entry's main types.

import type { Hosting } from '@automataframework/automata'
import { createHosting } from '@automataframework/automata/target'
import { fakeHosting, REFERENCE_SIZES, type ReferenceSize } from '@automataframework/automata/testing'
import type { CompiledContent, ContentConfig, Diagnostic } from '@automataframework/automata-content'
import { type ContentText, createContentText } from '@automataframework/automata-content/locale'
import { automataContent } from '@automataframework/automata-content/vite'
import {
  createSim,
  defineComponent,
  definePlugin,
  defineSystem,
  type Sim,
  type StepResult,
} from '@automataframework/automata-sim'
import { xxhash64 } from '@automataframework/automata-sim/hash'
import { sin } from '@automataframework/automata-sim/math'
import { defineShipConfig, type ShipConfig } from '@automataframework/automata-tools'
import '@automataframework/automata/no-eval'
import {
  type DefinedGame,
  defineGame,
  type GameSpec,
  keys,
  startGame,
  defineComponent as umbrellaComponent,
} from '@automataframework/automata'
import '@automataframework/automata/no-eval'
import { createPixiRenderer, type PixiRendererOptions, rect } from '@automataframework/automata'
import '@automataframework/automata/no-eval'
import {
  classifyFormFactor,
  Dialog,
  type FormFactor,
  type GameDefinition,
  type Geometry,
  type RuntimeHandle,
  runGame,
} from '@automataframework/automata'
import { defineExtension, type ExtensionDef } from '@automataframework/automata/extension'
import { checkLayout, manualFrames, withRuntimeTest } from '@automataframework/automata/testing'

export const sizes: readonly ReferenceSize[] = REFERENCE_SIZES
export const factor: FormFactor = classifyFormFactor(390, 844)
export type Uses = [CompiledContent, ContentConfig, Diagnostic, Hosting, ShipConfig, Geometry]
// The umbrella package, published: the runtime, renderer, game call and host contract.
export type GameUses = [GameDefinition, RuntimeHandle, ExtensionDef, PixiRendererOptions, GameSpec]
export const gameValues = [runGame, startGame, keys, createPixiRenderer, rect, manualFrames, withRuntimeTest]
export const extension: ExtensionDef<'smoke'> = defineExtension({ name: 'smoke' })
export const game: DefinedGame = defineGame({
  id: 'consumer-smoke',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
})
export const hp = umbrellaComponent('hp', { value: 'f32' })
export const values = [automataContent, createHosting, fakeHosting, defineShipConfig]
export const component: typeof Dialog = Dialog
export const layout: typeof checkLayout = checkLayout
export const position = defineComponent('position', { x: 'f32', y: 'f32' })
export const drift = defineSystem('drift', () => {})
export const plugins = [definePlugin({ name: 'drift', components: [position], systems: [drift] })]
export const digest: bigint = xxhash64(new Uint8Array([1, 2, 3]))
export const wave: number = sin(1)
export const contentText: ContentText = createContentText({})

export async function run(): Promise<StepResult> {
  const sim: Sim = await createSim({ seed: 1, plugins })
  return sim.step([])
}
