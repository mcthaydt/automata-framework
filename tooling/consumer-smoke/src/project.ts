// The game-like project consumer-smoke installs AF into (M2.4 spec §3.6): its package.json and .npmrc. It lives
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
}

export interface ConsumerManifest {
  readonly name: string
  readonly private: true
  readonly type: 'module'
  readonly dependencies: Record<string, string>
  readonly devDependencies: Record<string, string>
  readonly pnpm: { readonly overrides: Record<string, string> }
}

const sorted = (entries: [string, string][]): Record<string, string> =>
  Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)))

export function consumerManifest(options: ConsumerOptions): ConsumerManifest {
  const specOf = (pkg: ConsumerPackage): string => {
    if (options.from === 'registry') {
      if (options.version === undefined) throw new Error('a registry run needs --version')
      return options.version
    }
    if (pkg.tarball === undefined) throw new Error(`no packed tarball for ${pkg.name}`)
    return `file:${pkg.tarball}`
  }
  const dependencies = sorted(options.packages.map((pkg) => [pkg.name, specOf(pkg)]))
  return {
    name: 'af-consumer-smoke',
    private: true,
    type: 'module',
    dependencies,
    devDependencies: sorted([
      ['@sveltejs/vite-plugin-svelte', options.tools.vitePluginSvelte],
      ['@types/node', options.tools.typesNode],
      ['svelte', options.tools.svelte],
      ['typescript', options.tools.typescript],
      ['typescript6', `npm:typescript@${options.tools.typescript6}`],
      ['vite', options.tools.vite],
      ['zod', options.tools.zod],
    ]),
    // A tarball's own `@mcthaydt/*` dependencies name the shared version, which is not on any registry yet in
    // packs mode; the overrides send them to the same tarballs.
    pnpm: { overrides: options.from === 'packs' ? { ...dependencies } : {} },
  }
}

/** `${NODE_AUTH_TOKEN}` is expanded by pnpm at install time, so no token is ever written to disk. */
export function consumerNpmrc(): string {
  return [
    '@mcthaydt:registry=https://npm.pkg.github.com',
    `//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}`,
    '',
  ].join('\n')
}
