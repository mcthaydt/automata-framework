// When a WebGPU browser test cannot judge Pixi on this machine. A machine's WebGPU adapter can be missing or come and go
// (the GPU runner has had both): Pixi then falls back to WebGL, or loses its device and finds no adapter to restore it
// from. What the test would report then is the machine, not Pixi or AF, so it skips with the reason instead.
import type { Renderer } from 'pixi.js'

/** Why `renderer` is not drawing through a WebGPU device, or `undefined` when it is. */
export function notOnWebGpu(renderer: Renderer): string | undefined {
  if (renderer.name !== 'webgpu')
    return `Pixi fell back to ${renderer.name}: no WebGPU adapter on this machine`
  const device = (renderer as unknown as { gpu?: { device?: GPUDevice } }).gpu?.device
  return device === undefined ? 'Pixi got no WebGPU device on this machine' : undefined
}

/**
 * After a lost device: why the loss is the machine's (it no longer returns an adapter, so Pixi cannot restore the
 * device either), or `undefined` when an adapter is still there and the loss is the code's to answer for.
 */
export async function adapterGone(): Promise<string | undefined> {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu
  const adapter = await gpu?.requestAdapter().catch(() => null)
  return adapter ? undefined : 'the WebGPU device was lost and this machine no longer returns an adapter'
}
