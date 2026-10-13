import { GlProgram, GpuProgram } from 'pixi.js'

export const FILTER_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vPixelCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
    vPixelCoord = aPosition * uOutputFrame.zw + uOutputFrame.xy;
}
`

export const WGSL_FILTER_HEADER = `
struct GlobalFilterUniforms {
    uInputSize: vec4<f32>,
    uInputPixel: vec4<f32>,
    uInputClamp: vec4<f32>,
    uOutputFrame: vec4<f32>,
    uGlobalFrame: vec4<f32>,
    uOutputTexture: vec4<f32>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;

struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) pixelCoord: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>, gfu: GlobalFilterUniforms) -> vec4<f32> {
    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>, gfu: GlobalFilterUniforms) -> vec2<f32> {
    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>, @builtin(instance_index) instanceIndex: u32) -> VSOutput {
    var output: VSOutput;
    output.position = filterVertexPosition(aPosition, gfu);
    output.uv = filterTextureCoord(aPosition, gfu);
    output.pixelCoord = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
    return output;
}
`

export interface FilterProgramsResult {
  readonly glProgram: GlProgram
  readonly gpuProgram: GpuProgram
}

export function filterPrograms(
  name: string,
  fragmentGlsl: string,
  fragmentWgsl: string,
): FilterProgramsResult {
  const glProgram = GlProgram.from({
    vertex: FILTER_VERTEX,
    fragment: fragmentGlsl,
    name: `${name}-gl`,
  })
  const gpuProgram = GpuProgram.from({
    vertex: {
      source: WGSL_FILTER_HEADER,
      entryPoint: 'mainVertex',
    },
    fragment: {
      source: `${WGSL_FILTER_HEADER}\n${fragmentWgsl}`,
      entryPoint: 'mainFragment',
    },
    name: `${name}-gpu`,
  })
  return { glProgram, gpuProgram }
}
