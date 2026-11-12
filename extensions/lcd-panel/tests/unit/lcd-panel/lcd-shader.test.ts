import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LCD_UNIFORMS } from '#src/features/lcd-panel/lcd-geometry.ts'
import { LCD_GLSL, LCD_WGSL } from '#src/features/lcd-panel/lcd-shader.ts'

describe('the two shaders', () => {
  it('both read every uniform, so WebGL2 and WebGPU draw the same panel', () => {
    for (const name of LCD_UNIFORMS) {
      expect(LCD_GLSL, `GLSL ${name}`).toContain(name)
      expect(LCD_WGSL, `WGSL ${name}`).toContain(`fx.${name}`)
    }
  })

  it('both define the effect entry the pass calls', () => {
    expect(LCD_GLSL).toContain('vec4 effect(vec2 uv)')
    expect(LCD_WGSL).toContain('fn effect(uv: vec2<f32>) -> vec4<f32>')
  })

  it('carries the licence of the mesh it is ported from', () => {
    const source = readFileSync(
      new URL('../../../src/features/lcd-panel/lcd-shader.ts', import.meta.url),
      'utf8',
    )
    expect(source).toContain('MIT licence')
    expect(source).toContain('sinedied')
  })
})
