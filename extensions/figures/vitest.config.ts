import { defineTests } from '@automata/vitest-preset'

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
// The preset makes one Node project, `unit`, and has no option for a second, so the package splits it here.
const config = defineTests({ testTimeout: 30_000, browsers: [] })
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
