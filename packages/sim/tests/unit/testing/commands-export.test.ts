// @vitest-environment node
// A vitest.config is loaded by plain Node, without a bundler, so the browser command must load from its own subpath.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

test('@mcthaydt/automata-sim/testing/commands loads in plain Node', () => {
  const out = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "const m = await import('@mcthaydt/automata-sim/testing/commands'); console.log(Object.keys(m.goldenCommands()).join())",
    ],
    { cwd: fileURLToPath(new URL('../../..', import.meta.url)), encoding: 'utf8' },
  )
  expect(out.trim()).toBe('readGolden')
})
