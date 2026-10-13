import { GlProgram, GpuProgram } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { FILTER_VERTEX, filterPrograms, WGSL_FILTER_HEADER } from './filter-programs.js'

describe('filterPrograms and shader headers', () => {
  it('computes pixel coordinates in GLSL vertex shader', () => {
    expect(FILTER_VERTEX).toContain('out vec2 vPixelCoord;')
    expect(FILTER_VERTEX).toContain('aPosition * uOutputFrame.zw + uOutputFrame.xy')
    expect(FILTER_VERTEX).toContain('vPixelCoord =')
  })

  it('computes pixel coordinates in WGSL vertex stage', () => {
    expect(WGSL_FILTER_HEADER).toContain('@location(1) pixelCoord: vec2<f32>')
    expect(WGSL_FILTER_HEADER).toContain('aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy')
    expect(WGSL_FILTER_HEADER).toContain('@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;')
    expect(WGSL_FILTER_HEADER).toContain('@group(0) @binding(1) var uTexture: texture_2d<f32>;')
    expect(WGSL_FILTER_HEADER).toContain('@group(0) @binding(2) var uSampler: sampler;')
  })

  it('creates GlProgram and GpuProgram pair from fragments', () => {
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

    const programs = filterPrograms('test-filter', glFragment, wgslFragment)
    expect(programs.glProgram).toBeInstanceOf(GlProgram)
    expect(programs.gpuProgram).toBeInstanceOf(GpuProgram)
    expect(programs.glProgram.vertex).toContain('out vec2 vPixelCoord;')
    expect(programs.glProgram.fragment).toContain('texture(uTexture, vTextureCoord)')
  })
})
