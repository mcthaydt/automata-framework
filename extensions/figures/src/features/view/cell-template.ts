import type { ShaderBitTemplate } from '@pixi/3d'

/**
 * The WGSL template of a depth-writing `CellSprite` under WebGPU.
 *
 * `@pixi/3d`'s default material template (`gpuTemplate` in `MaterialSystemGpu`, module-internal) returns a bare
 * `@location(0) vec4<f32>` from its fragment entry, so no shader bit can write `@builtin(frag_depth)`: the return type has
 * to change. This is a copy of that template with four edits, and no others: the fragment entry returns `CellFragment`
 * (a colour and a window depth), declares `var cellDepth` (1, the far plane, until `cellDepthBit` sets it), returns it with the
 * colour, and snaps the texture coordinate to its texel's centre (`@pixi/3d`'s batch sampler is linear, so a texture's own
 * `nearest` is ignored under WebGPU). `tests/unit/view/template.test.ts` reads the installed `@pixi/3d` and fails, in words, when its template
 * moves on, before a frame is wrong.
 *
 * Used only beside `cellDepthBit`, and only under WebGPU: it has no GLSL stage. A shader's cache key includes the template's id,
 * so it never shares an entry with a plain flat material's.
 */
export const CELL_TEMPLATE: ShaderBitTemplate = {
  bindGroups: ['global', 'camera', 'batch'],
  gpu: `


{{header}}
{{textureGetters}}
{{vertexHeader}}

@vertex
fn mainVertex(input: VertexInput,
  @builtin(instance_index) ii: u32,
  @builtin(vertex_index) vid: u32
) -> VertexOutput {
  var output: VertexOutput;

  var position: vec4<f32>;
  var normal = vec3<f32>(0.0, 0.0, 1.0);
  var tangent = vec3<f32>(0.0);
  var uv = vec2<f32>(0.0);
  
  let inst = uRenderableInstanceStorage[ii];
  let renderable = uRenderableStorage[inst.id];
  let textureSlots = inst.texSlots;
  let vMaterialIndex = renderable.materialIndex;
  {{vertexMaterialAccess}}

  _textureSlots = textureSlots;

  let batchWorldMatrix = uRenderableStorage[0].transform;
  var modelMatrix = batchWorldMatrix * renderable.transform;

  {{vertexInput}}

  {{vertexBeforeTransform}}

  var worldPosition = modelMatrix * position;
  let modelMatrix3 = mat3x3<f32>(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);

  let normalScale = 1.0 / vec3<f32>(
    dot(modelMatrix3[0], modelMatrix3[0]),
    dot(modelMatrix3[1], modelMatrix3[1]),
    dot(modelMatrix3[2], modelMatrix3[2])
  );
  var worldNormal = modelMatrix3 * (normal * normalScale);
  var clipPosition = camera.uViewProjectionMatrix * worldPosition;

  {{vertexAfterTransform}}

  {{vertexEnd}}

  output.position       = clipPosition;
  output.vPosition      = worldPosition.xyz;
  output.vNormal        = worldNormal;
  output.vUV            = uv;
  output.vMaterialIndex = renderable.materialIndex;
  output.vTextureSlots  = textureSlots;

  return output;
}

struct CellFragment { @location(0) color: vec4<f32>, @builtin(frag_depth) depth: f32 }

@fragment
fn mainFragment(inputIn: FragmentInput) -> CellFragment {
  var input = inputIn;
  _textureSlots = input.vTextureSlots;
  var cellDepth: f32 = 1.0;
  var normal = normalize(input.vNormal);
  var albedo: vec3<f32> = vec3<f32>(1.0);
  var finalColor: vec3<f32>;
  var alpha: f32 = 1.0;

  let vMaterialIndex = input.vMaterialIndex;
  {{fragmentMaterialAccess}}

  // Nearest sampling, by hand: the batch's one sampler (uSampler) is linear whatever a texture's own filter says, so a magnified
  // texel would blend with its neighbours (and a packed depth would turn to garbage). Sample each texel at its centre.
  input.vUV = (clamp(floor(input.vUV * material.texSize.xy), vec2<f32>(0.0), material.texSize.xy - 1.0) + 0.5) / material.texSize.xy;

  {{fragmentMaterial}}

  finalColor = albedo;

  {{fragmentLighting}}

  finalColor *= global.uExposure;

  {{fragmentEnd}}

  return CellFragment(vec4<f32>(finalColor * alpha, alpha), cellDepth);
}
`,
}
