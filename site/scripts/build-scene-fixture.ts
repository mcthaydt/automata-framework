import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// `node scripts/build-scene-fixture.ts`: the one site build that has 3D example pages, made from the fixture folder
// (tests/fixtures/scene-examples) because no real 3D example is public yet. It is the build tests/e2e/scene-examples.e2e.ts
// serves, from `build-scenes/` so the real `build/` is untouched. It adds to what `pnpm build` made (the demos, the
// playground and the editor in static/ are linked from the pages it prerenders), so that comes first.
const siteRoot = fileURLToPath(new URL('..', import.meta.url))
export const FIXTURE_SCENES = join(siteRoot, 'tests/fixtures/scene-examples')

if (!existsSync(join(siteRoot, 'static/demos/emberwick/index.html')))
  throw new Error(
    'build-scene-fixture: run `pnpm build` first; the pages link to the demos it writes into static/.',
  )

// The two names the fixture build reads and nothing else does: the folder of scene examples, and the folder the pages go to.
const env = { ...process.env, AF_SITE_SCENES_DIR: FIXTURE_SCENES, AF_SITE_OUT: 'build-scenes' }
const run = (command: string, args: string[]) =>
  execFileSync(command, args, { cwd: siteRoot, env, stdio: 'inherit' })

run(process.execPath, ['scripts/build-demos.ts', '--scenes-only'])
run('pnpm', ['exec', 'vite', 'build'])
console.log(`build-scene-fixture: pages in ${resolve(siteRoot, 'build-scenes')}.`)
