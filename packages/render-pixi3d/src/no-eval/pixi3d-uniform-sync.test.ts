// The pin on the no-eval shim (Owner, 2026-10-30, S7-Q1 "AF-owned shim"). It fails loudly when a pixi.js or
// @pixi/3d update moves what the shim depends on: pixi's own uniform parsers, the four @pixi/3d appends after them,
// the polyfill methods pixi.js/unsafe-eval installs, and what each of the four parsers' source strings computes.
// Node has no CSP, so the source strings are evaluated here with `new Function` as the reference.
import { describe, expect, it } from 'vitest'
import '../no-eval.js'
import { GlUboSystem, GlUniformGroupSystem, GpuUboSystem, uniformParsers } from 'pixi.js'
import {
  PIXI_UNIFORM_PARSER_TYPES,
  PIXI3D_UNIFORM_PARSER_TYPES,
  pixi3dUboFunctions,
  pixi3dUniformFunctions,
} from './pixi3d-uniform-sync.js'

/** A method pixi declares private, which pixi.js/unsafe-eval replaces and the shim wraps. */
const privateMethod = (prototype: object, name: string): ((...args: unknown[]) => unknown) =>
  (prototype as Record<string, (...args: unknown[]) => unknown>)[name] as (...args: unknown[]) => unknown

type Call = readonly [string, ...unknown[]]

/** A WebGL context that records the calls an upload makes. */
function recordingGl(): { gl: WebGL2RenderingContext; calls: Call[] } {
  const calls: Call[] = []
  const gl = new Proxy({} as WebGL2RenderingContext, {
    get:
      (_target, method: string) =>
      (...args: unknown[]) =>
        void calls.push([method, ...args.map(copy)]),
  })
  return { gl, calls }
}
const copy = (value: unknown): unknown => (value instanceof Float32Array ? [...value] : value)

const mat4 = { elements: new Float32Array(Array.from({ length: 16 }, (_, i) => i + 0.5)) }
const mat3 = { elements: new Float32Array(Array.from({ length: 9 }, (_, i) => 10 - i)) }
const xyz = { x: 1.5, y: -2, z: 3.25 }
const rgb = { r: 0.25, g: 0.5, b: 0.75 }
/** One sample uniform per @pixi/3d parser, in their order. */
const SAMPLES = [
  { type: 'mat4x4<f32>', value: mat4 },
  { type: 'mat3x3<f32>', value: mat3 },
  { type: 'vec3<f32>', value: xyz },
  { type: 'vec3<f32>', value: rgb },
] as const

describe('the uniform parsers the shim depends on', () => {
  it("are pixi's five, then @pixi/3d's four, in this order", () => {
    expect(uniformParsers.map((parser) => parser.type)).toEqual([
      ...PIXI_UNIFORM_PARSER_TYPES,
      ...PIXI3D_UNIFORM_PARSER_TYPES,
    ])
    expect(PIXI_UNIFORM_PARSER_TYPES).toHaveLength(5)
    expect(PIXI3D_UNIFORM_PARSER_TYPES).toEqual(['mat4x4<f32>', 'mat3x3<f32>', 'vec3<f32>', 'vec3<f32>'])
  })

  it('route each sample uniform to its @pixi/3d parser', () => {
    SAMPLES.forEach((sample, index) => {
      const uniform = { name: 'u', type: sample.type, size: 1, value: sample.value }
      const first = uniformParsers.findIndex((p) => p.type === uniform.type && p.test(uniform as never))
      expect(first).toBe(PIXI_UNIFORM_PARSER_TYPES.length + index)
    })
  })

  it('are uploaded by the polyfill methods pixi.js/unsafe-eval replaces', () => {
    expect(typeof privateMethod(GlUniformGroupSystem.prototype, '_generateUniformsSync')).toBe('function')
    for (const System of [GlUboSystem, GpuUboSystem])
      expect(typeof privateMethod(System.prototype, '_generateUboSync')).toBe('function')
  })
})

describe("the shim's four functions", () => {
  it("upload a uniform exactly as the parser's source string does", () => {
    SAMPLES.forEach((sample, index) => {
      const parser = uniformParsers[PIXI_UNIFORM_PARSER_TYPES.length + index]!
      // biome-ignore lint/security/noGlobalEval: the reference implementation, in Node only (no CSP here).
      const reference = new Function('name', 'cu', 'cv', 'v', 'ud', 'uv', 'gl', parser.uniform as string)
      const run = (upload: (...args: never[]) => void) => {
        const { gl, calls } = recordingGl()
        const ud = { u: { location: 'loc', value: new Float32Array(3) } }
        const uv = { u: sample.value }
        upload(...(['u', ud.u, ud.u.value, uv.u, ud, uv, gl] as never[]))
        // A second upload of the same value is skipped by the vec3 parsers' cache check.
        upload(...(['u', ud.u, ud.u.value, uv.u, ud, uv, gl] as never[]))
        return { calls, cached: [...ud.u.value] }
      }
      expect(run(pixi3dUniformFunctions[index]!)).toEqual(run(reference as never))
    })
  })

  it("write a uniform buffer exactly as the parser's source string does", () => {
    SAMPLES.forEach((sample, index) => {
      const parser = uniformParsers[PIXI_UNIFORM_PARSER_TYPES.length + index]!
      // biome-ignore lint/security/noGlobalEval: the reference implementation, in Node only (no CSP here).
      const reference = new Function('name', 'data', 'offset', 'uv', 'v', parser.ubo as string)
      const run = (write: (...args: never[]) => void) => {
        const data = new Float32Array(24).fill(-1)
        write(...(['u', data, 3, { u: sample.value }, sample.value] as never[]))
        return [...data]
      }
      expect(run(pixi3dUboFunctions[index]!)).toEqual(run(reference as never))
    })
  })
})

describe('the installed shim', () => {
  it("uploads @pixi/3d's uniforms and leaves pixi's own to its polyfill", () => {
    const uniformStructures = {
      model: { name: 'model', type: 'mat4x4<f32>', size: 1, value: mat4 },
      tint: { name: 'tint', type: 'vec3<f32>', size: 1, value: rgb },
      alpha: { name: 'alpha', type: 'f32', size: 1, value: 0.5 },
    }
    const uniformData = { model: {}, tint: {}, alpha: {} }
    const generate = privateMethod(GlUniformGroupSystem.prototype, '_generateUniformsSync')
    const sync = generate.call({}, { uniformStructures }, uniformData) as (
      ud: unknown,
      uv: unknown,
      renderer: unknown,
    ) => void
    const ud = {
      model: { location: 'm', value: new Float32Array(16) },
      tint: { location: 't', value: new Float32Array(3) },
      alpha: { location: 'a', value: 0 },
    }
    const uv = { model: mat4, tint: rgb, alpha: 0.5 }
    const { gl, calls } = recordingGl()
    sync(ud, uv, { gl })
    expect(calls).toEqual(
      expect.arrayContaining([
        ['uniformMatrix4fv', 'm', false, [...mat4.elements]],
        ['uniform3f', 't', 0.25, 0.5, 0.75],
        ['uniform1f', 'a', 0.5],
      ]),
    )
    expect(calls).toHaveLength(3)
  })

  it.each([
    ['GlUboSystem', GlUboSystem],
    ['GpuUboSystem', GpuUboSystem],
  ])("writes @pixi/3d's uniforms into %s buffers beside pixi's own", (_name, System) => {
    const uboElements = [
      { data: { name: 'alpha', type: 'f32', size: 1, value: 0.5 }, offset: 0 },
      { data: { name: 'normal', type: 'mat3x3<f32>', size: 1, value: mat3 }, offset: 16 },
    ]
    const generate = privateMethod(System.prototype, '_generateUboSync')
    const sync = generate.call({}, uboElements) as (
      uniforms: unknown,
      data: Float32Array,
      dataInt32: Int32Array,
      offset: number,
    ) => void
    const data = new Float32Array(20)
    sync({ alpha: 0.5, normal: mat3 }, data, new Int32Array(data.buffer), 0)
    expect(data[0]).toBe(0.5)
    expect([...data.slice(4, 15)]).toEqual([10, 9, 8, 0, 7, 6, 5, 0, 4, 3, 2])
  })
})
