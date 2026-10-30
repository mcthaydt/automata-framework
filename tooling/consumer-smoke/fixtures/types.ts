// consumer-smoke's types step (M2.4 spec §3.6): the published declarations, read by TypeScript 7.0.2 and by
// 6.0.3 (ship spec §3.1: TS 6 consumers can read AF's .d.ts). One use of each entry's main types.
import type { CompiledContent, ContentConfig, Diagnostic } from '@mcthaydt/automata-content'
import { type ContentText, createContentText } from '@mcthaydt/automata-content/locale'
import { automataContent } from '@mcthaydt/automata-content/vite'
import { HostError, type Hosting, HostingLive } from '@mcthaydt/automata-host'
import { makeHosting } from '@mcthaydt/automata-host/target'
import { HostingTest } from '@mcthaydt/automata-host/testing'
import { type FilesService, ProcessRunner } from '@mcthaydt/automata-node'
import { BodyKind, body2d, physics2d } from '@mcthaydt/automata-physics/2d'
import { physics3d } from '@mcthaydt/automata-physics/3d'
import { prepareBuild, type ShipConfig } from '@mcthaydt/automata-ship'
import { createSim, defineComponent, type Sim, type StepResult } from '@mcthaydt/automata-sim'
import { xxhash64 } from '@mcthaydt/automata-sim/hash'
import { sin } from '@mcthaydt/automata-sim/math'
import { REFERENCE_SIZES, type ReferenceSize } from '@mcthaydt/automata-testing'
import '@mcthaydt/automata/no-eval'
import { type DefinedGame, defineGame, defineComponent as umbrellaComponent } from '@mcthaydt/automata'
import { type GameSpec, keys, startGame } from '@mcthaydt/automata-game'
import '@mcthaydt/automata-game/no-eval'
import { createPixiRenderer, type PixiRendererOptions, rect } from '@mcthaydt/automata-render-pixi'
import '@mcthaydt/automata-render-pixi/no-eval'
import { type GameDefinition, type RuntimeHandle, runGame } from '@mcthaydt/automata-runtime'
import { defineExtension, type ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import { manualFrames, RuntimeTest } from '@mcthaydt/automata-runtime/testing'
import { classifyFormFactor, Dialog, type FormFactor, type Geometry } from '@mcthaydt/automata-ui'
import { checkLayout } from '@mcthaydt/automata-ui/testing'

export const sizes: readonly ReferenceSize[] = REFERENCE_SIZES
export const factor: FormFactor = classifyFormFactor(390, 844)
export type Uses = [CompiledContent, ContentConfig, Diagnostic, Hosting, FilesService, ShipConfig, Geometry]
// DX.2a: runtime, render-pixi, game and the umbrella, published.
export type GameUses = [GameDefinition, RuntimeHandle, ExtensionDef, PixiRendererOptions, GameSpec]
export const gameValues = [runGame, startGame, keys, createPixiRenderer, rect, manualFrames, RuntimeTest]
export const extension: ExtensionDef<'smoke'> = defineExtension({ name: 'smoke' })
export const game: DefinedGame = defineGame({
  id: 'consumer-smoke',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
})
export const hp = umbrellaComponent('hp', { value: 'f32' })
export const values = [
  automataContent,
  HostError,
  HostingLive,
  HostingTest,
  makeHosting,
  ProcessRunner,
  prepareBuild,
]
export const component: typeof Dialog = Dialog
export const layout: typeof checkLayout = checkLayout
export const position = defineComponent('position', { x: 'f32', y: 'f32' })
export const body = body2d(BodyKind.dynamic)
export const plugins = [physics2d(), physics3d()]
export const digest: bigint = xxhash64(new Uint8Array([1, 2, 3]))
export const wave: number = sin(1)
export const contentText: ContentText = createContentText({})

export async function run(): Promise<StepResult> {
  const sim: Sim = await createSim({ seed: 1, plugins })
  return sim.step([])
}
