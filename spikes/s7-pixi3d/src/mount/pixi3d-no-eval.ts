// The S7-Q1 remedy under test (spike, M3.1a): NOT part of the question as asked, which imports render-pixi/no-eval
// alone. @pixi/3d's `addUniformParsers` (dist/utils/addUniformParsers.mjs, run when the package is imported) pushes
// four uniform parsers into pixi's `uniformParsers` as source strings for pixi's code generator. `pixi.js/unsafe-eval`
// replaces the generator with polyfills that look a parser's function up by the same index in their own arrays
// (`uniformParserFunctions`, `uboParserFunctions`), which have no entries for the 3D parsers, so the first draw throws
// "functionMap[i] is not a function". This pushes the four functions those strings describe, at the same indices.
//
// The two arrays are not in pixi.js's package exports; vite.config.ts aliases their files. A real fix belongs
// upstream (a beta bug report) or in render-pixi3d's no-eval entry.
import '@pixi/3d'
import { uniformParsers } from 'pixi.js'
import { uboParserFunctions } from '#pixi-unsafe-eval/ubo'
import { uniformParserFunctions } from '#pixi-unsafe-eval/uniforms'

type Vec = { x: number; y: number; z: number }
type Rgb = { r: number; g: number; b: number }
type Uniforms = Record<string, { location: WebGLUniformLocation; value: Float32Array }>

const PIXI3D_PARSERS = 4
if (uniformParserFunctions.length !== uniformParsers.length - PIXI3D_PARSERS) {
  throw new Error(`pixi3d-no-eval: expected ${PIXI3D_PARSERS} @pixi/3d parsers after pixi's own`)
}

const vec3Uniform =
  (read: (v: never) => readonly [number, number, number]) =>
  (
    name: string,
    _cu: unknown,
    _cv: unknown,
    _v: unknown,
    ud: Uniforms,
    uv: Record<string, never>,
    gl: WebGL2RenderingContext,
  ) => {
    const cv = ud[name]!.value
    const [x, y, z] = read(uv[name]!)
    if (cv[0] !== x || cv[1] !== y || cv[2] !== z) {
      cv[0] = x
      cv[1] = y
      cv[2] = z
      gl.uniform3f(ud[name]!.location, x, y, z)
    }
  }
const readXyz = (v: Vec) => [v.x, v.y, v.z] as const
const readRgb = (v: Rgb) => [v.r, v.g, v.b] as const

uniformParserFunctions.push(
  (
    name: string,
    _cu: unknown,
    _cv: unknown,
    _v: unknown,
    ud: Uniforms,
    uv: Record<string, { elements: Float32Array }>,
    gl: WebGL2RenderingContext,
  ) => gl.uniformMatrix4fv(ud[name]!.location, false, uv[name]!.elements),
  (
    name: string,
    _cu: unknown,
    _cv: unknown,
    _v: unknown,
    ud: Uniforms,
    uv: Record<string, { elements: Float32Array }>,
    gl: WebGL2RenderingContext,
  ) => gl.uniformMatrix3fv(ud[name]!.location, false, uv[name]!.elements),
  vec3Uniform(readXyz as (v: never) => readonly [number, number, number]),
  vec3Uniform(readRgb as (v: never) => readonly [number, number, number]),
)

type Ubo = (name: string, data: Float32Array, offset: number, uv: Record<string, never>) => void
const vec3Ubo =
  (read: (v: never) => readonly [number, number, number]): Ubo =>
  (name, data, offset, uv) => {
    const [x, y, z] = read(uv[name]!)
    data[offset] = x
    data[offset + 1] = y
    data[offset + 2] = z
  }
uboParserFunctions.push(
  ((name, data, offset, uv: Record<string, { elements: Float32Array }>) => {
    const v = uv[name]!.elements
    for (let i = 0; i < 16; i++) data[offset + i] = v[i]!
  }) as Ubo,
  ((name, data, offset, uv: Record<string, { elements: Float32Array }>) => {
    const v = uv[name]!.elements
    for (let column = 0; column < 3; column++) {
      for (let row = 0; row < 3; row++) data[offset + column * 4 + row] = v[column * 3 + row]!
    }
  }) as Ubo,
  vec3Ubo(readXyz as (v: never) => readonly [number, number, number]),
  vec3Ubo(readRgb as (v: never) => readonly [number, number, number]),
)
