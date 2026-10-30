// The AF-owned no-eval shim for @pixi/3d (Owner, 2026-10-30, S7-Q1 "AF-owned shim"; the spike's
// spikes/s7-pixi3d/src/mount/pixi3d-no-eval.ts at 86a5298, rewired as below).
//
// Importing @pixi/3d runs its `addUniformParsers()`, which appends four uniform parsers to pixi's `uniformParsers`
// as source strings for pixi's code generator: `mat4x4<f32>` and `mat3x3<f32>` from an `elements` array, and two
// `vec3<f32>` from `{x,y,z}` and `{r,g,b}`. Under Ruken's CSP a game imports `pixi.js/unsafe-eval`, whose
// polyfills take a parser's upload function from arrays parallel to `uniformParsers`; those arrays hold pixi's own
// five and nothing for @pixi/3d's four, so the first 3D draw calls `undefined` ("functionMap[i] is not a function").
//
// The arrays are not in pixi.js's package exports, so a package cannot reach them without a bundler alias in every
// game. This shim wraps the polyfill generators instead, which pixi.js exports on its systems and which
// `pixi.js/unsafe-eval` itself installs: a uniform whose first matching parser is one of @pixi/3d's four is uploaded
// by the function below that does what that parser's source string says; every other uniform goes to pixi's
// polyfill as before. pixi3d-uniform-sync.test.ts pins the parsers' count, order and types, the method names, and
// each function against its source string, so an update that moves any of them fails there.
//
// Removed when a Pixi 3D release ships its own no-eval counterparts (re-checked at M9.10).
import { GlUboSystem, GlUniformGroupSystem, GpuUboSystem, type UniformData, uniformParsers } from 'pixi.js'

/** The types of pixi.js 8.22's own uniform parsers, in order: the shim's parsers follow them. */
export const PIXI_UNIFORM_PARSER_TYPES: readonly string[] = [
  'mat3x3<f32>',
  'vec4<f32>',
  'vec2<f32>',
  'vec4<f32>',
  'vec3<f32>',
]

/** The types of the four parsers @pixi/3d 0.1.0-beta.2 appends, in order. */
export const PIXI3D_UNIFORM_PARSER_TYPES: readonly string[] = [
  'mat4x4<f32>',
  'mat3x3<f32>',
  'vec3<f32>',
  'vec3<f32>',
]

type Elements = { readonly elements: Float32Array }
type Vec3 = readonly [number, number, number]
interface UniformSlot {
  readonly location: WebGLUniformLocation
  readonly value: Float32Array
}

/** pixi's polyfill signature for one uniform: name, its slot, the slot's cached value, the value, all slots, all values, gl. */
type UniformUpload = (
  name: string,
  slot: unknown,
  cached: unknown,
  value: unknown,
  slots: Record<string, UniformSlot>,
  values: Record<string, unknown>,
  gl: WebGL2RenderingContext,
) => void

/** pixi's polyfill signature for one uniform-buffer member: name, the buffer, the float offset, all values, the value. */
type UboWrite = (
  name: string,
  data: Float32Array,
  offset: number,
  values: Record<string, unknown>,
  value: unknown,
) => void

const xyz = (v: unknown): Vec3 => {
  const { x, y, z } = v as { x: number; y: number; z: number }
  return [x, y, z]
}
const rgb = (v: unknown): Vec3 => {
  const { r, g, b } = v as { r: number; g: number; b: number }
  return [r, g, b]
}

/** `vec3<f32>`: uploads only when the cached value differs, as the parser's source does. */
const vec3Upload =
  (read: (v: unknown) => Vec3): UniformUpload =>
  (name, _slot, _cached, _value, slots, values, gl) => {
    const slot = slots[name] as UniformSlot
    const [x, y, z] = read(values[name])
    const cached = slot.value
    if (cached[0] !== x || cached[1] !== y || cached[2] !== z) {
      cached[0] = x
      cached[1] = y
      cached[2] = z
      gl.uniform3f(slot.location, x, y, z)
    }
  }

const vec3Write =
  (read: (v: unknown) => Vec3): UboWrite =>
  (name, data, offset, values) => {
    const [x, y, z] = read(values[name])
    data[offset] = x
    data[offset + 1] = y
    data[offset + 2] = z
  }

/** The uniform uploads of @pixi/3d's four parsers, in their order. */
export const pixi3dUniformFunctions: readonly UniformUpload[] = [
  (name, _slot, _cached, _value, slots, values, gl) =>
    gl.uniformMatrix4fv((slots[name] as UniformSlot).location, false, (values[name] as Elements).elements),
  (name, _slot, _cached, _value, slots, values, gl) =>
    gl.uniformMatrix3fv((slots[name] as UniformSlot).location, false, (values[name] as Elements).elements),
  vec3Upload(xyz),
  vec3Upload(rgb),
]

/** The uniform-buffer writes of @pixi/3d's four parsers, in their order. A `mat3x3` pads each column to four floats. */
export const pixi3dUboFunctions: readonly UboWrite[] = [
  (name, data, offset, values) => {
    const v = (values[name] as Elements).elements
    for (let i = 0; i < 16; i++) data[offset + i] = v[i] as number
  },
  (name, data, offset, values) => {
    const v = (values[name] as Elements).elements
    for (let column = 0; column < 3; column++)
      for (let row = 0; row < 3; row++) data[offset + column * 4 + row] = v[column * 3 + row] as number
  },
  vec3Write(xyz),
  vec3Write(rgb),
]

/** Which of @pixi/3d's four parsers pixi would pick for `uniform` (pixi's rule: the first whose type and test match). */
function pixi3dParserIndex(uniform: UniformData): number | undefined {
  const first = uniformParsers.findIndex((parser) => uniform.type === parser.type && parser.test(uniform))
  const index = first - PIXI_UNIFORM_PARSER_TYPES.length
  return first === -1 || index < 0 ? undefined : index
}

function assertParsers(): void {
  const types = uniformParsers.map((parser) => parser.type)
  const expected = [...PIXI_UNIFORM_PARSER_TYPES, ...PIXI3D_UNIFORM_PARSER_TYPES]
  if (types.join() !== expected.join())
    throw new Error(
      `render-pixi3d/no-eval: pixi's uniform parsers are [${types.join(', ')}], not [${expected.join(', ')}]: ` +
        'a pixi.js or @pixi/3d update moved them, so the shim would upload the wrong functions',
    )
}

type UniformsSync = (
  slots: Record<string, UniformSlot>,
  values: Record<string, unknown>,
  renderer: { gl: WebGL2RenderingContext },
) => void
type GenerateUniformsSync = (
  group: { uniformStructures: Record<string, UniformData> },
  uniformData: Record<string, unknown>,
) => UniformsSync
interface UboElement {
  readonly data: UniformData
  readonly offset: number
}
type UboSync = (
  values: Record<string, unknown>,
  data: Float32Array,
  dataInt32: Int32Array,
  offset: number,
) => void
type GenerateUboSync = (uboElements: readonly UboElement[]) => UboSync

const INSTALLED = Symbol.for('automata-render-pixi3d/no-eval')

function wrapUniformsSync(prototype: { _generateUniformsSync: GenerateUniformsSync }): void {
  const pixiPolyfill = prototype._generateUniformsSync
  prototype._generateUniformsSync = function (this: unknown, group, uniformData) {
    const ours: [string, UniformUpload][] = []
    const theirs: Record<string, unknown> = { ...uniformData }
    for (const name in group.uniformStructures) {
      if (!uniformData[name]) continue
      const index = pixi3dParserIndex(group.uniformStructures[name] as UniformData)
      if (index === undefined) continue
      ours.push([name, pixi3dUniformFunctions[index] as UniformUpload])
      delete theirs[name]
    }
    const pixiSync = pixiPolyfill.call(this, group, theirs)
    if (ours.length === 0) return pixiSync
    return (slots, values, renderer) => {
      pixiSync(slots, values, renderer)
      for (const [name, upload] of ours) {
        const slot = slots[name] as UniformSlot
        upload(name, slot, slot.value, values[name], slots, values, renderer.gl)
      }
    }
  }
}

function wrapUboSync(prototype: { _generateUboSync: GenerateUboSync }): void {
  const pixiPolyfill = prototype._generateUboSync
  prototype._generateUboSync = function (this: unknown, uboElements) {
    const ours: [string, number, UboWrite][] = []
    const theirs: UboElement[] = []
    for (const element of uboElements) {
      const index = pixi3dParserIndex(element.data)
      if (index === undefined) theirs.push(element)
      else ours.push([element.data.name ?? '', element.offset / 4, pixi3dUboFunctions[index] as UboWrite])
    }
    const pixiSync = pixiPolyfill.call(this, theirs)
    if (ours.length === 0) return pixiSync
    return (values, data, dataInt32, offset) => {
      pixiSync(values, data, dataInt32, offset)
      for (const [name, at, write] of ours) write(name, data, offset + at, values, values[name])
    }
  }
}

/** Whether `installPixi3dUniformSync` has run in this page (`render-pixi3d/no-eval` was imported). */
export function pixi3dUniformSyncInstalled(): boolean {
  return (globalThis as { [INSTALLED]?: true })[INSTALLED] === true
}

/**
 * Lets pixi.js/unsafe-eval upload @pixi/3d's uniforms. Run once, after `pixi.js/unsafe-eval` and `@pixi/3d` are
 * imported and before the first draw (`render-pixi3d/no-eval` does). A second call does nothing.
 */
export function installPixi3dUniformSync(): void {
  const registry = globalThis as { [INSTALLED]?: true }
  if (registry[INSTALLED]) return
  assertParsers()
  wrapUniformsSync(
    GlUniformGroupSystem.prototype as unknown as { _generateUniformsSync: GenerateUniformsSync },
  )
  for (const System of [GlUboSystem, GpuUboSystem])
    wrapUboSync(System.prototype as unknown as { _generateUboSync: GenerateUboSync })
  registry[INSTALLED] = true
}
