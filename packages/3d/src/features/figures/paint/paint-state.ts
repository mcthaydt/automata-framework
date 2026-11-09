import type { PainterMaterial } from '../figure/materials.ts'
import type { Fabric } from './fabric.ts'
import type { FaceStamp } from './face-stamp.ts'
import type { HandStamp } from './hand-stamp.ts'
import type { PaintStyle } from './paint-style.ts'
import type { GBuffer } from './raster.ts'
export interface PaintInput {
  g: GBuffer
  materials: PainterMaterial[]
  albedo: Uint8ClampedArray
  normals: Uint8ClampedArray
  face: FaceStamp | null
  style: PaintStyle
  skin: number
  hands: HandStamp[]
  bends: Partial<Record<number, readonly number[]>>
  cloth: Cloth | undefined
}

/** What the stage "surfaces" leaves for the ones after it. */
export interface SurfacesOut {
  w: number
  h: number
  n: number
  ink: number
  tones: number[][]
  D: number
  ppm: number
  fabrics: readonly (Fabric | null)[]
  skinny: boolean[]
  hairy: (p: number) => boolean
  darkRamp: boolean[]
  extra: { line: number; fold: number; shine: number; rim: number }[]
  stains: (number[] | null)[]
  material: Int16Array
  part: Int16Array
  group: Int16Array
  depth: Float32Array
  place: Float32Array
  handTone: Int8Array
  filled: (x: number, y: number) => boolean
  sm: Float32Array
}
export type State1 = PaintInput & SurfacesOut

/** What the stage "faceLight" leaves for the ones after it. */
export interface FaceLightOut {
  isFace: (k: number) => boolean
  lightOf: (k: number) => number
  faceLit: Float32Array
  faceTh: [number, number, number] | null
  faceLight: Uint8Array
}
export type State2 = State1 & FaceLightOut

/** What the stage "keyLight" leaves for the ones after it. */
export interface KeyLightOut {
  lit: Float32Array
  grains: Float32Array
  P: Float32Array
  modelled: (k: number) => boolean
  thOf: (k: number) => readonly number[]
}
export type State3 = State2 & KeyLightOut

/** What the stage "quilting" leaves for the ones after it. */
export interface QuiltingOut {
  band: Int8Array
}
export type State4 = State3 & QuiltingOut

/** What the stage "toneTexels" leaves for the ones after it. */
export interface ToneTexelsOut {
  tone: Int8Array
  owner: Int32Array
  under: Int8Array
}
export type State5 = State4 & ToneTexelsOut

/** What the stage "cleanTones" leaves for the ones after it. */
export interface CleanTonesOut {
  stack: number[]
  run: number[]
}
export type State6 = State5 & CleanTonesOut

/** What the stage "outlines" leaves for the ones after it. */
export type OutlinesOut = {}
export type State7 = State6 & OutlinesOut

/** What the stage "washAndHolo" leaves for the ones after it. */
export interface WashAndHoloOut {
  wash: (k: number, up: number, stain: NonNullable<PainterMaterial['stain']>) => 0 | 1 | 3 | 2
  hue: Int8Array
  through: Map<number, number[]>
}
export type State8 = State7 & WashAndHoloOut

/** What the stage "output" leaves for the ones after it. */
export type OutputOut = {}
type State9 = State8 & OutputOut

export interface Cloth {
  place: Float32Array
  u(group: number, c: number, s: number): number | null
}

export const NO_FABRICS: readonly (Fabric | null)[] = []
