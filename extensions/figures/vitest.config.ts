import { defineTests } from '@automataframework/vitest-preset'
import { playwright } from '@vitest/browser-playwright'

// The goldens and the pins that guard them run on every commit that touches the painter (the hook runs `goldens` only);
// `unit`, each layer's own tests, runs with them in `pnpm check` and CI (AF_UNIT_FULL=1, the root unit-test scripts).
const GOLDENS = [
  'tests/unit/golden/**/*.test.ts',
  'tests/unit/actors/actors.test.ts',
  'tests/unit/paint/identity.test.ts',
  'tests/unit/hair/ulp.test.ts',
  'tests/unit/api.test.ts',
  'tests/unit/layers.test.ts',
]

// A test that paints a figure in every view and its walk takes a second or two alone, and several times that with the
// suite's files run side by side, so the default 5 s limit is raised to keep a slow machine from failing a sound render.
// WebGPU in Chromium needs its flag, and a machine with no GPU (a cloud session, CI without one) needs a software adapter that can
// also present a canvas: SwiftShader through Vulkan (`AF_WEBGPU=software`, as `packages/3d`'s and the character kit's `webgpu` project have it).
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

// The preset makes one Node project, `unit`, and has no option for a second, so the package splits it here.
// `browser`: the view against the painter under WebGL. `webgpu`: the same cases through Pixi's WebGPU renderer, in a Chromium
// launched with WebGPU on (the `browser` project's has none, so it would only ever fall back). Chromium only: the view check has
// only ever been run there, and WebKit and Firefox are not on every machine that runs this package.
const config = defineTests({
  testTimeout: 30_000,
  optimizeDeps: ['pixi.js', '@pixi/3d', 'zod'],
  browserProjects: [
    { name: 'browser', folder: 'view', engines: ['chromium'] },
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
type Project = { test: { name: string; exclude?: string[] } }
const projects = (config.test?.projects ?? []) as Project[]
config.test = {
  ...config.test,
  projects: projects.flatMap((project) =>
    project.test.name === 'unit'
      ? [
          { ...project, test: { ...project.test, name: 'goldens', include: GOLDENS } },
          { ...project, test: { ...project.test, exclude: [...(project.test.exclude ?? []), ...GOLDENS] } },
        ]
      : [project],
  ),
}
export default config
