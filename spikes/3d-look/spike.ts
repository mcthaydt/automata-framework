// The look candidates, injected after base-3d builds its room. (a) passes: a stepped-light material on every mesh and a
// post effect that snaps to DUEL and draws depth edges; (b) bake: unlit flat meshes (light already in the colours) and
// the figure as one billboard. WebGL2 only: the WGSL twins are 8.2's.
import {
  createLightingBit,
  FlatMaterial,
  Mesh3D,
  PhongMaterial,
  PostEffect,
  Sprite3D,
  type View3D,
} from '@pixi/3d'
import { Texture, UniformGroup } from 'pixi.js'

const DUEL = [
  '#000000,#222323,#434549,#626871,#828b98,#a6aeba,#cdd2da,#f5f7fa',
  '#625d54,#857565,#9e8c79,#aea189,#bbafa4,#ccc3b1,#eadbc9,#fff3d6',
  '#583126,#733d3b,#885041,#9a624c,#ad6e51,#d58d6b,#fbaa84,#ffce7f',
  '#002735,#003850,#004d5e,#0b667f,#006f89,#328ca7,#24aed6,#88d6ff',
  '#662b29,#94363a,#b64d46,#cd5e46,#e37840,#f99b4e,#ffbc4e,#ffe949',
  '#282b4a,#3a4568,#615f84,#7a7799,#8690b2,#96b2d9,#c7d6ff,#c6ecff',
  '#002219,#003221,#174a1b,#225918,#2f690c,#518822,#7da42d,#a6cc34',
  '#181f2f,#23324d,#25466b,#366b8a,#318eb8,#41b2e3,#52d2ff,#74f5fd',
].flatMap((r) => r.split(','))

/** Stepped light: the direct light is cut into `STEPS` whole steps before it multiplies the albedo. */
const rampLightingBit = createLightingBit({
  name: 'spikeRampLighting',
  preLighting: { gpu: 'var direct = 0.0;', gl: 'float direct = 0.0;' },
  perLight: {
    gpu: 'direct += dot(light.color, vec3<f32>(0.333)) * nDotL * attenuation * shadow;',
    gl: 'direct += dot(light.color, vec3(0.333)) * nDotL * attenuation * shadow;',
  },
  postLighting: {
    gpu: 'let amb = dot(global.uGlobalLightParams.xyz / 3.14159 + sampleEnvironment(normal, 1.0), vec3<f32>(0.333)); let stepped = floor(clamp(direct + amb, 0.0, 1.0) * 5.0 + 0.5) / 5.0; finalColor = albedo * stepped + emissive;',
    gl: 'float amb = dot(uGlobalLightParams.xyz / 3.14159 + sampleEnvironment(normal, 1.0), vec3(0.333)); float stepped = floor(clamp(direct + amb, 0.0, 1.0) * 5.0 + 0.5) / 5.0; finalColor = albedo * stepped + emissive;',
  },
})

class RampMaterial extends PhongMaterial {
  // biome-ignore lint/suspicious/noExplicitAny: the beta's descriptor type is internal
  override getPrimaryDescriptor(view: any): any {
    const d = super.getPrimaryDescriptor(view)
    const swap = (bits: unknown[]) =>
      bits.map((b: any) => (b?.name === 'phongLighting' ? rampLightingBit : b))
    d.update({ bitsGpu: swap(d.bitsGpu), bitsGl: swap(d.bitsGl) })
    return d
  }
}

/** Snaps every pixel to the nearest DUEL colour and darkens where depth jumps (the outline). */
class LookEffect extends PostEffect {
  protected override readonly uniforms = new UniformGroup({})
  protected override readonly fragment = {
    gpu: 'fn effect(uv: vec2<f32>) -> vec4<f32> { return sampleColor(uv); }',
    gl: `
const vec3 DUEL[${DUEL.length}] = vec3[](${DUEL.map((c) => `vec3(${[1, 3, 5].map((i) => (Number.parseInt(c.slice(i, i + 2), 16) / 255).toFixed(3)).join(',')})`).join(',')});
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  float best = 1e9; vec3 pick = c.rgb;
  for (int i = 0; i < ${DUEL.length}; i++) { vec3 d = DUEL[i] - c.rgb; float e = dot(d, d); if (e < best) { best = e; pick = DUEL[i]; } }
  vec2 t = texel();
  float z = linearDepth(sampleDepth(uv));
  float edge = abs(z - linearDepth(sampleDepth(uv + vec2(t.x, 0.0)))) + abs(z - linearDepth(sampleDepth(uv + vec2(0.0, t.y))));
  if (edge > 0.35 * z) pick = vec3(0.0, 0.13, 0.1);
  return vec4(pick, c.a);
}`,
  }
}

/** Every Mesh3D under `root`, so figures that stream in later are caught on the next sweep. */
function meshes(node: any, out: Mesh3D[] = []): Mesh3D[] {
  if (node instanceof Mesh3D) out.push(node)
  for (const child of node.children ?? []) meshes(child, out)
  return out
}

export function spikeLook(view: View3D, mode: string): void {
  const result = { mode, material: 'n/a' as string, post: 'n/a' as string, swapped: 0 }
  ;(window as any).__spike = result
  if (mode === 'full' || mode === 'lowres') return
  const swap = () => {
    for (const mesh of meshes(view.root)) {
      const old: any = mesh.material
      if (old?.__spike) continue
      const colour = old?.baseColor ?? 0x808080
      const next: any =
        mode === 'passes' ? new RampMaterial({ baseColor: colour }) : new FlatMaterial({ baseColor: colour })
      next.__spike = true
      mesh.material = next
      result.swapped++
    }
  }
  try {
    swap()
    result.material = 'ok'
  } catch (e) {
    result.material = `fail: ${(e as Error).message}`
  }
  const loop = () => {
    try {
      swap()
    } catch {}
    setTimeout(loop, 500)
  }
  loop()
  if (mode === 'passes') {
    try {
      view.passes = [new LookEffect()]
      result.post = 'ok'
    } catch (e) {
      result.post = `fail: ${(e as Error).message}`
    }
  }
  if (mode === 'bake') {
    // Wick as one billboard cell (64 x 96), the cost of the baked figure: a quad per figure, no rig.
    const cell = document.createElement('canvas')
    cell.width = 64
    cell.height = 96
    const g = cell.getContext('2d') as CanvasRenderingContext2D
    g.fillStyle = '#d58d6b'
    g.fillRect(16, 8, 32, 80)
    const sprite = new Sprite3D(Texture.from(cell))
    sprite.position.set(0, 1, 0)
    view.root.addChild(sprite)
  }
}
