import type { ShaderBitTemplate } from '@pixi/3d'

/**
 * The WGSL template of a depth-writing `CellSprite` under WebGPU.
 *
 * `@pixi/3d`'s default material template (`gpuTemplate` in `MaterialSystemGpu`, module-internal) ends its fragment entry with
 * `{{fragmentWriteOutputs}}`, which returns a `FragmentOutput` of colour locations only, so no shader bit can write
 * `@builtin(frag_depth)`: the return type has to change. This is a copy of that template with three edits, and no others: the
 * fragment entry returns `CellFragment` (a colour and a window depth), declares `var cellDepth` (1, the far plane, until `cellDepthBit`
 * sets it) where the original declares its outputs, and returns both where the original writes them. The slots a bit may use,
 * the bind groups (the global one as a uniform buffer, as beta.3 asks) and the exposure line are the original's.
 * `tests/unit/view/template.test.ts` reads the installed `@pixi/3d` and fails, in words, when its template moves on, before a frame is wrong.
 *
 * Used only beside `cellDepthBit`, and only under WebGPU: it has no GLSL stage. A shader's cache key includes the template's id,
 * so it never shares an entry with a plain flat material's.
 */
export const CELL_TEMPLATE: ShaderBitTemplate = {
  bindGroups: [{ name: 'global', ubo: true }, 'camera', 'batch'],
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
  let vMaterialIndex = renderable.materialIndex;
  {{vertexStoreAccess}}

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

  return output;
}

struct CellFragment { @location(0) color: vec4<f32>, @builtin(frag_depth) depth: f32 }

@fragment
fn mainFragment(input: FragmentInput) -> CellFragment {
  var cellDepth: f32 = 1.0;
  var normal = normalize(input.vNormal);
  var albedo: vec3<f32> = vec3<f32>(1.0);
  var finalColor: vec3<f32>;
  var alpha: f32 = 1.0;

  let vMaterialIndex = input.vMaterialIndex;
  {{fragmentStoreAccess}}

  {{fragmentMaterial}}

  finalColor = albedo;

  {{fragmentLighting}}

  finalColor *= inputExposure(global.uExposure, global.uDisplayExposure);

  {{fragmentEnd}}

  return CellFragment(vec4<f32>(finalColor * alpha, alpha), cellDepth);
}
`,
}
