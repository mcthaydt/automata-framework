import { describe, expect, it } from 'vitest'
import { consumerManifest, consumerNpmrc, consumerWorkspace } from './project.ts'

const PNPM = 'pnpm@10.34.6+sha512.abc'
const tools = {
  typescript: '7.0.2',
  typescript6: '6.0.3',
  vite: '8.3.2',
  svelte: '5.57.1',
  vitePluginSvelte: '7.3.1',
  zod: '4.6.5',
  typesNode: '24.19.1',
}

describe('consumerManifest (the project outside the workspace, M2.4 spec §3.6)', () => {
  it('depends on every packed tarball and overrides the transitive @mcthaydt ones to the same files', () => {
    const manifest = consumerManifest({
      from: 'packs',
      packages: [
        { name: '@mcthaydt/automata-sim', tarball: 'packs/mcthaydt-automata-sim-0.0.1.tgz' },
        { name: '@mcthaydt/automata-physics', tarball: 'packs/mcthaydt-automata-physics-0.0.1.tgz' },
      ],
      tools,
      packageManager: PNPM,
    })
    expect(manifest.dependencies).toEqual({
      '@mcthaydt/automata-physics': 'file:packs/mcthaydt-automata-physics-0.0.1.tgz',
      '@mcthaydt/automata-sim': 'file:packs/mcthaydt-automata-sim-0.0.1.tgz',
    })
    expect(
      consumerWorkspace({
        from: 'packs',
        packages: [{ name: '@mcthaydt/automata-sim', tarball: 'packs/mcthaydt-automata-sim-0.0.1.tgz' }],
      }),
    ).toBe(
      ['overrides:', "  '@mcthaydt/automata-sim': 'file:packs/mcthaydt-automata-sim-0.0.1.tgz'", ''].join(
        '\n',
      ),
    )
  })

  it('depends on the registry version and needs no overrides', () => {
    const manifest = consumerManifest({
      from: 'registry',
      version: '0.0.3',
      packages: [{ name: '@mcthaydt/automata-sim' }],
      tools,
      packageManager: PNPM,
    })
    expect(manifest.dependencies).toEqual({ '@mcthaydt/automata-sim': '0.0.3' })
    expect(
      consumerWorkspace({
        from: 'registry',
        version: '0.0.3',
        packages: [{ name: '@mcthaydt/automata-sim' }],
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

  it('brings the peers and tools a game has: both TypeScripts, Vite, Svelte and its Vite plugin, zod', () => {
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
      svelte: '5.57.1',
      typescript: '7.0.2',
      typescript6: 'npm:typescript@6.0.3',
      vite: '8.3.2',
      zod: '4.6.5',
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

describe('consumerNpmrc', () => {
  it('sends @mcthaydt to GitHub Packages with the token from the environment, never a literal token', () => {
    const npmrc = consumerNpmrc()
    expect(npmrc).toContain('@mcthaydt:registry=https://npm.pkg.github.com')
    expect(npmrc).toContain(`//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}`)
  })
})
