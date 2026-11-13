// What a WebGPU device says about the shader modules made while a test draws. A WGSL compile error neither throws nor reaches
// `uncapturederror`: the pass's pipeline is invalid and its output is black, so the modules' own messages are the only report.
import type { Renderer } from 'pixi.js'

export interface ShaderCompile {
  /** Waits for every module made so far to report, and returns each compile error as `line N: message (the line)`. */
  settle(): Promise<string[]>
}

/** Watches the shader modules `renderer`'s WebGPU device makes from now on; a renderer on WebGL has none, so it finds nothing. */
export function watchShaderCompile(renderer: Renderer): ShaderCompile {
  const found: string[] = []
  const pending: Promise<void>[] = []
  const device = (renderer as unknown as { gpu?: { device?: GPUDevice } }).gpu?.device
  if (device !== undefined) {
    const create = device.createShaderModule.bind(device)
    device.createShaderModule = (descriptor) => {
      const module = create(descriptor)
      pending.push(
        module.getCompilationInfo().then((info) => {
          for (const m of info.messages)
            if (m.type === 'error')
              found.push(
                `line ${m.lineNum}: ${m.message} (${descriptor.code.split('\n')[m.lineNum - 1]?.trim().slice(0, 90)})`,
              )
        }),
      )
      return module
    }
  }
  return {
    settle: async () => {
      await Promise.all(pending)
      return found
    },
  }
}
