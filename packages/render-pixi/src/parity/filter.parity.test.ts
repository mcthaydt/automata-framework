import { describe, expect, it } from 'vitest'
import { FILTER_VERTEX, filterPrograms, WGSL_FILTER_HEADER } from '../filter/filter-programs.js'

describe('filterPrograms browser parity', () => {
  it('compiles filter program pair in real browser engine', () => {
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
  })
})
