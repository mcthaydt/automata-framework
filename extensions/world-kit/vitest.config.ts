import { defineTests } from '@automata/vitest-preset'
import { playwright } from '@vitest/browser-playwright'

// `tests/unit`: the kit's registrations, dresser, lettering, library, maps, textures and checks, on Node. `tests/browser`:
// the look passes on a real WebGL2 context. Svelte compiles the runtime's screens, which `@automata/3d`'s renderer reaches
// through `@automata/framework`.

// WebGPU in Chromium needs its flag, and a machine with no GPU needs a software adapter that can also present a canvas: SwiftShader
// through Vulkan (`AF_WEBGPU=software`, as `packages/3d`'s `webgpu` project has it).
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

// `browser`: the look passes and the props on WebGL2, in every engine. `webgpu`: the sky effects on both backends, in a Chromium
// launched with WebGPU on (the `browser` project's has none, so it would only ever fall back).
export default defineTests({
  svelte: true,
  optimizeDeps: ['zod'],
  browserProjects: [
    { name: 'browser', folder: '{sky,props}', engines: ['chromium', 'webkit', 'firefox'] },
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
