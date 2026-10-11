import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  findRanges,
  type Manifest,
  type Pin,
  pinsFromManifests,
  pinsFromVersionsDoc,
  publishedPeerFloors,
} from './pins.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))

/** The root package.json plus one per workspace folder (pnpm-workspace.yaml: packages/*, tooling/*, examples/*). */
function workspaceManifests(): Manifest[] {
  const manifests: Manifest[] = [JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Manifest]
  for (const group of ['packages', 'tooling', 'examples']) {
    let names: string[] = []
    try {
      names = readdirSync(join(root, group))
    } catch {
      continue // the group folder does not exist yet
    }
    for (const name of names.sort()) {
      try {
        manifests.push(JSON.parse(readFileSync(join(root, group, name, 'package.json'), 'utf8')) as Manifest)
      } catch {
        // a folder without a package.json is not a workspace package
      }
    }
  }
  return manifests
}

const key = (pin: Pin): string => `${pin.name}@${pin.version}`

describe('docs/versions.md', () => {
  const used = pinsFromManifests(workspaceManifests().map(publishedPeerFloors))
  const recorded = pinsFromVersionsDoc(readFileSync(join(root, 'docs/versions.md'), 'utf8'))

  it('has no version ranges in any package.json', () => {
    expect(findRanges(used).map(key)).toEqual([])
  })

  it('records every exact pin in a package.json', () => {
    const recordedKeys = new Set(recorded.map(key))
    expect(used.map(key).filter((pin) => !recordedKeys.has(pin))).toEqual([])
  })

  it("floors a published package's peer ranges at that package's own workspace pin", () => {
    for (const manifest of workspaceManifests()) {
      const floors = publishedPeerFloors(manifest).peerDependencies ?? {}
      for (const [name, version] of Object.entries(manifest.peerDependencies ?? {})) {
        if (version === floors[name]) continue // exact, workspace: or file:
        expect(manifest.devDependencies?.[name], `${name} ${version}`).toBe(floors[name])
      }
    }
  })

  it('has no row for a version nothing uses', () => {
    const usedKeys = new Set(used.map(key))
    expect(recorded.map(key).filter((pin) => !usedKeys.has(pin))).toEqual([])
  })

  it('pins Node in .nvmrc and pnpm-workspace.yaml to the same version as the Runtimes table', () => {
    const doc = readFileSync(join(root, 'docs/versions.md'), 'utf8')
    const node = /^\| Node \| (\d+\.\d+\.\d+)/m.exec(doc)?.[1]
    expect(node).toBeDefined()
    expect(readFileSync(join(root, '.nvmrc'), 'utf8').trim()).toBe(node)
    expect(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')).toContain(`useNodeVersion: ${node}`)
  })

  it('pins pnpm in package.json to the version in the Runtimes table', () => {
    const doc = readFileSync(join(root, 'docs/versions.md'), 'utf8')
    const pnpm = /^\| pnpm \| (\d+\.\d+\.\d+)/m.exec(doc)?.[1]
    const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      packageManager: string
    }
    expect(rootManifest.packageManager.split('+')[0]).toBe(`pnpm@${pnpm}`)
  })
})
