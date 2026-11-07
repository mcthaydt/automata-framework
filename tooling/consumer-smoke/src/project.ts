// The game-like project consumer-smoke installs AF into: its package.json and.npmrc. It lives
// in a temp folder outside the workspace, so nothing resolves through workspace links: only what a game
// repository would get from a tarball or from GitHub Packages.

export interface ToolVersions {
  readonly typescript: string
  /** The TypeScript 6 that TS 6 consumers (and svelte-check) use; installed as `typescript6`. */
  readonly typescript6: string
  readonly vite: string
  readonly svelte: string
  readonly vitePluginSvelte: string
  /** Node's types, which Vite's declarations (and so content's Vite plugin) need. */
  readonly typesNode: string
  /** A game that defines content schemas imports zod itself. */
  readonly zod: string
  /** PixiJS, a peer of render-pixi, game and the umbrella: the game installs it. */
  readonly pixi: string
}

export interface ConsumerPackage {
  readonly name: string
  /** Packs mode: the tarball, relative to the project folder. */
  readonly tarball?: string
}

export interface ConsumerOptions {
  readonly from: 'packs' | 'registry'
  /** Registry mode: the published version every package shares. */
  readonly version?: string | undefined
  readonly packages: readonly ConsumerPackage[]
  readonly tools: ToolVersions
  /** The workspace's own `packageManager`, so corepack runs the pnpm the smoke was written against. */
  readonly packageManager: string
}

export interface ConsumerManifest {
  readonly name: string
  readonly private: true
  readonly type: 'module'
  readonly dependencies: Record<string, string>
  readonly devDependencies: Record<string, string>
  readonly packageManager: string
}

const sorted = (entries: [string, string][]): Record<string, string> =>
  Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)))

type PackageSource = Pick<ConsumerOptions, 'from' | 'version' | 'packages'>

function dependenciesOf(options: PackageSource): Record<string, string> {
  const specOf = (pkg: ConsumerPackage): string => {
    if (options.from === 'registry') {
      if (options.version === undefined) throw new Error('a registry run needs --version')
      return options.version
    }
    if (pkg.tarball === undefined) throw new Error(`no packed tarball for ${pkg.name}`)
    return `file:${pkg.tarball}`
  }
  return sorted(options.packages.map((pkg) => [pkg.name, specOf(pkg)]))
}

export function consumerManifest(options: ConsumerOptions): ConsumerManifest {
  const dependencies = dependenciesOf(options)
  return {
    name: 'af-consumer-smoke',
    private: true,
    type: 'module',
    dependencies,
    devDependencies: sorted([
      ['@sveltejs/vite-plugin-svelte', options.tools.vitePluginSvelte],
      ['@types/node', options.tools.typesNode],
      ['pixi.js', options.tools.pixi],
      ['svelte', options.tools.svelte],
      ['typescript', options.tools.typescript],
      ['typescript6', `npm:typescript@${options.tools.typescript6}`],
      ['vite', options.tools.vite],
      ['zod', options.tools.zod],
    ]),
    packageManager: options.packageManager,
  }
}

/**
 * The project's `pnpm-workspace.yaml`, which holds its overrides: a tarball's own `@mcthaydt/*` dependencies name
 * the shared version, which is not on any registry yet in packs mode, so the overrides send them to the same
 * tarballs. Settings live here rather than under `pnpm` in package.json, which newer pnpm no longer reads.
 */
export function consumerWorkspace(options: PackageSource): string {
  if (options.from === 'registry') return 'overrides: {}\n'
  const lines = Object.entries(dependenciesOf(options)).map(([name, spec]) => `  '${name}': '${spec}'`)
  return ['overrides:', ...lines, ''].join('\n')
}

/** `${NODE_AUTH_TOKEN}` is expanded by pnpm at install time, so no token is ever written to disk. */
export function consumerNpmrc(): string {
  return [
    '@mcthaydt:registry=https://npm.pkg.github.com',
    `//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}`,
    '',
  ].join('\n')
}
