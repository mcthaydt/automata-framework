import { Filter, GlProgram, GpuProgram } from 'pixi.js'

const glVertex = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vPixel;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); vPixel = aPosition * uOutputFrame.zw + uOutputFrame.xy; }`

const glFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vPixel;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uSteps;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 p = floor(vPixel); // from the vertex stage: top-left origin on both backends (gl_FragCoord is bottom-left)
  float x = mod(p.x, 4.0);
  float y = mod(p.y, 4.0);
  float b = mod(floor(x + 1.0) * floor(y + 1.0) * 17.0, 16.0) / 16.0 - 0.5;
  finalColor = vec4(floor(c.rgb * uSteps + b) / uSteps, c.a);
}`

const wgsl = /* wgsl */ `
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>, uInputPixel: vec4<f32>, uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>, uGlobalFrame: vec4<f32>, uOutputTexture: vec4<f32>,
};
struct DitherUniforms { uSteps: f32 };
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> ditherUniforms: DitherUniforms;
struct VSOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) pixel: vec2<f32> };
fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  return VSOutput(filterVertexPosition(aPosition), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw), aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy);
}
@fragment fn mainFragment(@location(0) uv: vec2<f32>, @location(1) pixel: vec2<f32>) -> @location(0) vec4<f32> {
  let c = textureSample(uTexture, uSampler, uv);
  let p = floor(pixel);
  let x = p.x % 4.0;
  let y = p.y % 4.0;
  let b = ((floor(x + 1.0) * floor(y + 1.0) * 17.0) % 16.0) / 16.0 - 0.5;
  let s = ditherUniforms.uSteps;
  return vec4(floor(c.rgb * s + b) / s, c.a);
}`

export function ditherFilter(steps = 8) {
  return new Filter({
    glProgram: GlProgram.from({ vertex: glVertex, fragment: glFragment, name: 'dither' }),
    gpuProgram: GpuProgram.from({
      vertex: { source: wgsl, entryPoint: 'mainVertex' },
      fragment: { source: wgsl, entryPoint: 'mainFragment' },
    }),
    resources: { ditherUniforms: { uSteps: { value: steps, type: 'f32' } } },
  })
}
