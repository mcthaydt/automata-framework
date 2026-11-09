import { describe, expect, it } from 'vitest'
import { consumerManifest, consumerWorkspace } from '#src/project.ts'

const PNPM = 'pnpm@10.34.6+sha512.abc'
const tools = {
  typescript: '7.0.2',
  typescript6: '6.0.3',
  vite: '8.3.3',
  svelte: '5.57.1',
  vitePluginSvelte: '7.3.1',
  zod: '4.6.6',
  typesNode: '24.19.1',
  pixi: '8.21.0',
}

describe('consumerManifest (the project outside the workspace, M2.4 spec §3.6)', () => {
  it('depends on every packed tarball and overrides the transitive @automata ones to the same files', () => {
    const manifest = consumerManifest({
      from: 'packs',
      packages: [
        { name: '@automata/sim', tarball: 'packs/automata-sim-0.0.1.tgz' },
        { name: '@automata/testing', tarball: 'packs/automata-testing-0.0.1.tgz' },
      ],
      tools,
      packageManager: PNPM,
    })
    expect(manifest.dependencies).toEqual({
      '@automata/testing': 'file:packs/automata-testing-0.0.1.tgz',
      '@automata/sim': 'file:packs/automata-sim-0.0.1.tgz',
    })
    expect(
      consumerWorkspace({
        from: 'packs',
        packages: [{ name: '@automata/sim', tarball: 'packs/automata-sim-0.0.1.tgz' }],
      }),
    ).toBe(['overrides:', "  '@automata/sim': 'file:packs/automata-sim-0.0.1.tgz'", ''].join('\n'))
  })

  it('depends on the registry version and needs no overrides', () => {
    const manifest = consumerManifest({
      from: 'registry',
      version: '0.0.3',
      packages: [{ name: '@automata/sim' }],
      tools,
      packageManager: PNPM,
    })
    expect(manifest.dependencies).toEqual({ '@automata/sim': '0.0.3' })
    expect(
      consumerWorkspace({
        from: 'registry',
        version: '0.0.3',
        packages: [{ name: '@automata/sim' }],
      }),
    ).toBe('overrides: {}\n')
  })

  it("pins the workspace's own pnpm, so corepack never picks a pnpm that reads its settings differently", () => {
    const manifest = consumerManifest({
      from: 'registry',
      version: '0.0.3',
      packages: [],
      tools,
      packageManager: PNPM,
    })
    expect(manifest.packageManager).toBe(PNPM)
    expect(manifest).not.toHaveProperty('pnpm')
  })

  it('brings the peers and tools a game has: both TypeScripts, Vite, Svelte and its Vite plugin, PixiJS, zod', () => {
    const manifest = consumerManifest({
      from: 'registry',
      version: '0.0.3',
      packages: [],
      tools,
      packageManager: PNPM,
    })
    expect(manifest.devDependencies).toEqual({
      '@sveltejs/vite-plugin-svelte': '7.3.1',
      '@types/node': '24.19.1',
      'pixi.js': '8.21.0',
      svelte: '5.57.1',
      typescript: '7.0.2',
      typescript6: 'npm:typescript@6.0.3',
      vite: '8.3.3',
      zod: '4.6.6',
    })
    expect(manifest.private).toBe(true)
    expect(manifest.type).toBe('module')
  })

  it('refuses a registry run without a version and a packs run without tarballs', () => {
    expect(() =>
      consumerManifest({ from: 'registry', packages: [{ name: 'a' }], tools, packageManager: PNPM }),
    ).toThrow(/version/)
    expect(() =>
      consumerManifest({ from: 'packs', packages: [{ name: 'a' }], tools, packageManager: PNPM }),
    ).toThrow(/tarball/)
  })
})
