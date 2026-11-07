// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { build, defaultClientConditions, type Rolldown } from 'vite'
import { describe, expect, it } from 'vitest'
import {
  findRukenSdkMarkers,
  findTauriMarkers,
  RUKEN_SDK_MARKERS,
  TAURI_MARKERS,
} from '#src/features/targets/sdk-markers.ts'
import { WEB_STORAGE_PROBE_KEY } from '#src/features/targets/web/hosting-web.ts'

// PUB spec §3 and §7 (build row): `./target` puts exactly one adapter in a bundle. The entry imports the host as
// the runtime's boot does; Vite builds it the way PUB.2's `--target` will, from the workspace sources.
const fixture = fileURLToPath(
  new URL('../../../src/testing/host/page/fixtures/target-bundle/', import.meta.url),
)

/**
 * All the JavaScript of a production build of the fixture: with the target's AF condition, or with none
 * (`'none'`, a tool that knows nothing of AF's conditions).
 */
async function bundle(target: 'ruken' | 'web' | 'itch' | 'tauri' | 'none'): Promise<string> {
  const condition = {
    ruken: 'automata-ruken',
    web: 'automata-web',
    itch: 'automata-web',
    tauri: 'automata-tauri',
    none: undefined,
  }[target]
  const output = await build({
    root: fixture,
    configFile: false,
    logLevel: 'silent',
    // `resolve.conditions` replaces Vite's defaults, so a target build adds its condition in front of them.
    resolve: condition === undefined ? {} : { conditions: [condition, ...defaultClientConditions] },
    // What PUB.2's build sets for an itch build; only `hostName` reads it.
    define: target === 'itch' ? { __AUTOMATA_TARGET__: JSON.stringify('itch') } : {},
    build: {
      write: false,
      minify: true,
      rolldownOptions: { input: `${fixture}entry.ts` },
    },
  })
  const results = (Array.isArray(output) ? output : [output]) as Rolldown.RolldownOutput[]
  return results
    .flatMap((result) => result.output)
    .flatMap((file) => (file.type === 'chunk' ? [file.code] : []))
    .join('\n')
}

describe('the ./target export in a real bundle (PUB spec §3, DIST spec §5.3)', () => {
  it('an automata-web build holds the web adapter and no Ruken SDK code', async () => {
    const code = await bundle('web')
    expect(findRukenSdkMarkers(code)).toEqual([])
    expect(code).not.toContain('RukenError')
    expect(code).toContain(WEB_STORAGE_PROBE_KEY)
  }, 90_000)

  it('an itch build is the web adapter with the build target filled in', async () => {
    const code = await bundle('itch')
    expect(findRukenSdkMarkers(code)).toEqual([])
    expect(code).not.toContain('__AUTOMATA_TARGET__')
    expect(code).toContain('itch.io')
  }, 90_000)

  it('a build with no AF condition holds the web adapter and no Ruken SDK code: no target is the default', async () => {
    const code = await bundle('none')
    expect(findRukenSdkMarkers(code)).toEqual([])
    expect(code).toContain(WEB_STORAGE_PROBE_KEY)
  }, 90_000)

  it('an automata-ruken build holds the Ruken SDK, and not the web adapter', async () => {
    const code = await bundle('ruken')
    expect(findRukenSdkMarkers(code)).toEqual(RUKEN_SDK_MARKERS)
    expect(code).not.toContain(WEB_STORAGE_PROBE_KEY)
  }, 90_000)

  it('an automata-tauri build holds the desktop adapter and Tauri IPC code, and no Ruken SDK code', async () => {
    const code = await bundle('tauri')
    expect(findTauriMarkers(code)).toEqual(TAURI_MARKERS)
    expect(findRukenSdkMarkers(code)).toEqual([])
  }, 90_000)

  it('web and Ruken builds hold no Tauri IPC code (DIST spec §5.3)', async () => {
    for (const target of ['web', 'ruken', 'none'] as const)
      expect(findTauriMarkers(await bundle(target)), target).toEqual([])
  }, 180_000)
})
