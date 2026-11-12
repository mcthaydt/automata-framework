import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// `automata check` runs a game's `vite build` under plain Node, which loads the game's `vite.config.ts`, which imports
// `@automata/content/vite` from this workspace's source. Plain Node does not add a file extension, so one extensionless
// import anywhere in an entry's graph makes the entry unloadable there, though Vite (which the other tests load
// through) resolves it. So every entry is loaded here by a real `node`, as the tools' bin and the build step load it.

const packageDir = resolve(import.meta.dirname, '../../..')
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
  name: string
  exports: Record<string, string>
}

describe('every entry loads under plain Node', () => {
  it.each(Object.keys(manifest.exports))('%s', (key) => {
    const specifier = `${manifest.name}${key.slice(1)}`
    const run = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(specifier)})`],
      { cwd: packageDir, encoding: 'utf8' },
    )
    expect(run.stderr.split('\n').find((line) => /ERR_|Error/.test(line)) ?? '').toBe('')
    expect(run.status).toBe(0)
  })
})
