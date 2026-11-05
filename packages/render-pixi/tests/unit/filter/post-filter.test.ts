import { describe, expect, it } from 'vitest'
import { postFilter } from '#src/filter/post-filter.ts'

const glsl = `precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() { finalColor = texture(uTexture, vTextureCoord); }`
const wgsl = `
@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  return textureSample(uTexture, uSampler, input.uv);
}`

describe('postFilter', () => {
  it('declares a filter by name from its GLSL and WGSL, run first and at every quality tier', () => {
    const def = postFilter('vignette', { glsl, wgsl })
    expect(def).toEqual({ name: 'vignette', glsl, wgsl, order: 0, minTier: undefined })
    expect(Object.isFrozen(def)).toBe(true)
  })

  it('passes the slot its order and the lowest quality tier it runs at', () => {
    const def = postFilter('bloom', { glsl, wgsl, order: 5, minTier: 'medium' })
    expect(def.order).toBe(5)
    expect(def.minTier).toBe('medium')
  })

  it.each([
    ['name', () => postFilter('', { glsl, wgsl })],
    ['glsl', () => postFilter('vignette', { glsl: '  ', wgsl })],
    ['wgsl', () => postFilter('vignette', { glsl, wgsl: '' })],
  ])('throws naming the empty %s', (field, declare) => {
    expect(declare).toThrow(new RegExp(`postFilter.*${field}`))
  })
})
