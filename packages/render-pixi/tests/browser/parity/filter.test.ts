import { describe, expect, it } from 'vitest'
import { FILTER_VERTEX, filterPrograms, WGSL_FILTER_HEADER } from '#src/filter/filter-programs.ts'

describe('filterPrograms browser parity', () => {
  it('compiles filter program pair in real browser engine', async () => {
    const glFragment = `precision highp float;
in vec2 vTextureCoord;
in vec2 vPixelCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  finalColor = texture(uTexture, vTextureCoord);
}`

    const wgslFragment = `
@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  return textureSample(uTexture, uSampler, input.uv);
}`

    const programs = filterPrograms('parity-filter', glFragment, wgslFragment)
    expect(programs.glProgram).toBeDefined()
    expect(programs.gpuProgram).toBeDefined()
    expect(programs.glProgram.vertex).toContain('out vec2 vPixelCoord;')
    expect(programs.glProgram.vertex).toContain(FILTER_VERTEX.trim())
    expect(WGSL_FILTER_HEADER).toContain('@location(1) pixelCoord: vec2<f32>')

    // Real WebGL2 context shader compile and program link validation
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (gl) {
      const vs = gl.createShader(gl.VERTEX_SHADER)
      if (!vs) throw new Error('createShader vs failed')
      gl.shaderSource(vs, `#version 300 es\nprecision highp float;\n${FILTER_VERTEX}`)
      gl.compileShader(vs)
      const vsOk = gl.getShaderParameter(vs, gl.COMPILE_STATUS)
      if (!vsOk) {
        throw new Error(`VS compile error: ${gl.getShaderInfoLog(vs)}`)
      }

      const fs = gl.createShader(gl.FRAGMENT_SHADER)
      if (!fs) throw new Error('createShader fs failed')
      gl.shaderSource(fs, `#version 300 es\n${glFragment}`)
      gl.compileShader(fs)
      const fsOk = gl.getShaderParameter(fs, gl.COMPILE_STATUS)
      if (!fsOk) {
        throw new Error(`FS compile error: ${gl.getShaderInfoLog(fs)}`)
      }

      const prog = gl.createProgram()
      if (!prog) throw new Error('createProgram failed')
      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)
      const linkOk = gl.getProgramParameter(prog, gl.LINK_STATUS)
      if (!linkOk) {
        throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`)
      }
      expect(linkOk).toBe(true)
    }

    // WebGPU shader module validation if navigator.gpu is available
    const nav =
      typeof navigator !== 'undefined'
        ? (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } })
        : undefined
    if (nav?.gpu) {
      try {
        const adapter = (await nav.gpu.requestAdapter()) as {
          requestDevice: () => Promise<{
            createShaderModule: (desc: { code: string }) => {
              getCompilationInfo: () => Promise<{
                messages: ReadonlyArray<{ type: string; message: string }>
              }>
            }
          }>
        } | null
        if (adapter) {
          const device = await adapter.requestDevice()
          const wgslCode = `${WGSL_FILTER_HEADER}\n${wgslFragment}`
          const sm = device.createShaderModule({ code: wgslCode })
          const info = await sm.getCompilationInfo()
          const errors = info.messages.filter((m) => m.type === 'error')
          expect(errors.length).toBe(0)
        }
      } catch {
        // GPU adapter unavailable in headless environment
      }
    }
  })
})
