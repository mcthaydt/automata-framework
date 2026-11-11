import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { publishablePackages } from '#src/publishable-packages.ts'

// `@pixi/3d` is a closed beta and the figure builder is a private repository: nothing published may bundle either. The root
// hoists both for the workspace, so a published package that imported one by mistake would resolve and build. `pnpm boundaries`
// forbids both in every published package; this pins that the list covers them all, so a package that joins the publish set
// (release-list.test.ts) cannot join without the guard.
const root = fileURLToPath(new URL('../../../..', import.meta.url))
const boundaries = (
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: { boundaries: string } }
).scripts.boundaries

/** What `--forbid` names for each package folder, from the root's `boundaries` script. */
function forbidden(): Map<string, string[]> {
  const named = new Map<string, string[]>()
  for (const command of boundaries.split('&&')) {
    const [tool, flag, ...pairs] = command.trim().split(/\s+/)
    if (tool !== 'automata-check-boundaries' || flag !== '--forbid') continue
    for (const pair of pairs) {
      const [dir, modules] = pair.split(':')
      named.set(dir as string, [...(named.get(dir as string) ?? []), ...(modules ?? '').split(',')])
    }
  }
  return named
}

describe('the closed beta stays out of every published package', () => {
  const named = forbidden()
  for (const { dir, manifest } of publishablePackages(root)) {
    it(`${manifest.name} (${dir}) may import neither @pixi/3d nor figure-builder`, () => {
      expect(named.get(dir), `${dir} in the --forbid list of "boundaries"`).toEqual(
        expect.arrayContaining(['@pixi/3d', 'figure-builder']),
      )
    })
  }
})
