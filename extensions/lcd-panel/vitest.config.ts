import { defineTests } from '@automata/vitest-preset'
import { playwright } from '@vitest/browser-playwright'

// `tests/unit`: the profile, the maths and the uniforms, on Node. `tests/browser/pass`: the pass on a real WebGL2 context in Chromium
// (WebKit parity is the GPU runner's). `tests/browser/webgpu`: its WGSL source compiled and drawn through Pixi's WebGPU renderer, in a
// Chromium launched with WebGPU on; a machine with no GPU needs the software adapter that can also present a canvas: SwiftShader through
// Vulkan (`AF_WEBGPU=software`, as `packages/3d`'s `webgpu` project has it).
const webgpuArgs = [
  '--enable-unsafe-webgpu',
  ...(process.env.AF_WEBGPU === 'software'
    ? [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--enable-features=Vulkan',
        '--use-vulkan=swiftshader',
      ]
    : []),
]

export default defineTests({
  svelte: true,
  optimizeDeps: ['zod'],
  browserProjects: [
    { name: 'browser', folder: 'pass', engines: ['chromium'] },
    {
      name: 'webgpu',
      folder: 'webgpu',
      engines: ['chromium'],
      instance: () => ({
        browser: 'chromium',
        provider: playwright({ launchOptions: { args: webgpuArgs } }),
      }),
    },
  ],
})
