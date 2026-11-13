// @vitest-environment node
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

// `pnpm check:launch` is `node scripts/check-launch.ts`: Node, not Vite, loads its imports, and Node needs each
// relative import to name its file with the extension. The other unit tests import the script through Vite, which
// fills the extension in, so a bare `./name` passes them and then crashes the deploy gate (site.yml).
const SCRIPT = fileURLToPath(new URL('../../../scripts/check-launch.ts', import.meta.url))

it("the launch check's whole module graph loads under Node itself", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    '--input-type=module',
    '-e',
    `const check = await import(${JSON.stringify(SCRIPT)}); console.log(typeof check.launchProblems)`,
  ])
  expect(stdout.trim()).toBe('function')
})
