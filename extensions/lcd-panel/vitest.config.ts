import { defineTests } from '@automata/vitest-preset'
import { playwright } from '@vitest/browser-playwright'

// `tests/unit`: the profile, the pitch maths and the shader's uniforms, on Node. `tests/browser`: the pass on a real WebGL2 context,
// and the screen filter under WebGL2 and WebGPU. The passes draw in Chromium; WebKit and a real GPU's parity are the GPU runner's.
//
// Chromium is launched with WebGPU on, so the screen filter's WebGPU case has an adapter to ask for (the field pass's tests ask for
// WebGL2 and are not touched by it). A machine with no GPU needs a software adapter that can present a canvas: SwiftShader through
// Vulkan (`AF_WEBGPU=software`, as `packages/3d` and the character kit have it); without one the WebGPU case skips, in words.
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
    {
      name: 'browser',
      folder: '.',
      engines: ['chromium'],
      instance: () => ({
        browser: 'chromium',
        provider: playwright({ launchOptions: { args: webgpuArgs } }),
      }),
    },
  ],
})
