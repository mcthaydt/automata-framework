import { defineTests, type TestOptions } from '@automata/vitest-preset'
import { playwright } from '@vitest/browser-playwright'
import type { BrowserCommand } from 'vitest/node'
import type { FigureLibrary } from './src/features/figures/figure/build.ts'
import type { fixtureFigures } from './src/testing/fixture-library.ts'

// `tests/unit`: the parsers, the views' maths, the figures' rig, genes and content checks, the no-eval shim's pin and
// the bundle guard, on Node. `tests/browser`: the renderer on a real WebGL2 context and the figures' goldens again in
// Chromium, WebKit and Firefox, so they hold in four engines (`tests/unit` runs the same golden checks in Node).
// Headless Firefox in this container has no WebGL, so those cases skip there and the GPU runner runs them. The solve
// bench in `tests/bench` measures and never asserts (`pnpm bench`).
//
// Svelte compiles the runtime's screens, which the renderer's tests reach through `@automata/framework`.
//
// `figureFixture` compiles the fixture content in Node (the content compiler reads files) and hands a browser page its
// library; build() itself then runs in the page. The fixture loads through the project's Vite module runner, which
// resolves the workspace's TypeScript sources (this config is loaded by Node, which does not).
const figureFixture: BrowserCommand<[], FigureLibrary> = async (ctx) => {
  const fixture = await ctx.project.import<{ fixtureFigures: typeof fixtureFigures }>(
    './src/testing/fixture-library.ts',
  )
  return (await fixture.fixtureFigures()).library
}

// WebGPU in Chromium needs its flag, and a machine with no GPU (a cloud session, CI without one) needs a software
// adapter that can also present a canvas: SwiftShader through Vulkan. Without that, the GPU process cannot make the
// swap chain's shared image and the device is lost on the first frame, with or without a mesh (`AF_WEBGPU=software`).
const webgpuArgs = [
  '--enable-unsafe-webgpu',
  ...(process.env['AF_WEBGPU'] === 'software'
    ? [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--enable-features=Vulkan',
        '--use-vulkan=swiftshader',
      ]
    : []),
]

// Pre-bundled browser-side deps: on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
export default defineTests({
  svelte: true,
  optimizeDeps: ['zod', 'smol-toml'],
  browserCommands: { figureFixture } as TestOptions['browserCommands'],
  // `parity`: every engine, WebGL2 and the figures' goldens. `webgpu`: Chromium launched with WebGPU on, a mesh drawn
  // through Pixi's WebGPU renderer (the `browser` name stays the one `pnpm test:browser` runs).
  browserProjects: [
    { name: 'browser', folder: 'parity', engines: ['chromium', 'webkit', 'firefox'] },
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
