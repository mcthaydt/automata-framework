/** The distribution targets a game can build for: `web`, `itch`, `ruken` and `tauri`, peers, each removable. */
export const DIST_TARGETS = ['web', 'itch', 'ruken', 'tauri'] as const

export type DistTarget = (typeof DIST_TARGETS)[number]

/**
 * What a new game builds for when `--targets` is left out: the two any author can publish to with nothing signed up
 * for. `--targets` adds `tauri` (a desktop app) and `ruken`.
 */
export const DEFAULT_TARGETS: readonly DistTarget[] = ['web', 'itch']

export type ParsedTargets =
  | { readonly ok: true; readonly targets: readonly DistTarget[] }
  | { readonly ok: false; readonly message: string }

const isTarget = (value: string): value is DistTarget => (DIST_TARGETS as readonly string[]).includes(value)

/** Reads `--targets web,itch,…`: each known, none twice, at least one. Left out, `DEFAULT_TARGETS`. */
export function parseTargets(value: string | undefined): ParsedTargets {
  if (value === undefined) return { ok: true, targets: DEFAULT_TARGETS }
  const allowed = `allowed: ${DIST_TARGETS.join(', ')}`
  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
  if (names.length === 0) return { ok: false, message: `--targets: no target (${allowed})` }
  const targets: DistTarget[] = []
  for (const name of names) {
    if (!isTarget(name)) return { ok: false, message: `--targets: unknown target "${name}" (${allowed})` }
    if (targets.includes(name))
      return { ok: false, message: `--targets: target "${name}" given twice (${allowed})` }
    targets.push(name)
  }
  return { ok: true, targets }
}

/** The `package.json` scripts per target: a Vite build that picks the target's host adapter, then ship's packaging. */
export function targetScripts(targets: readonly DistTarget[]): Record<string, string> {
  const scripts: Record<string, string> = {}
  for (const target of targets) scripts[`build:${target}`] = `vite build --mode ${target}`
  // The web build is the artifact itself (`dist/`); the other three are packaged by ship.
  for (const target of targets)
    if (target !== 'web') scripts[`prepare:${target}`] = `automata ship prepare --target ${target}`
  return scripts
}

/**
 * Tauri's packages for a `tauri` build (the host's optional peers). A `ruken` build needs none: its adapter, with
 * Ruken's SDK, is bundled in `@mcthaydt/automata`'s `ruken` entry.
 */
export function targetDependencies(targets: readonly DistTarget[]): {
  readonly dependencies: Record<string, string>
  readonly devDependencies: Record<string, string>
} {
  const dependencies: Record<string, string> = {}
  const devDependencies: Record<string, string> = {}
  if (targets.includes('tauri')) {
    dependencies['@tauri-apps/api'] = '2.12.4'
    dependencies['@tauri-apps/plugin-process'] = '2.4.0'
    dependencies['@tauri-apps/plugin-store'] = '2.5.0'
    // `prepare --target tauri` runs the game's own Tauri CLI; ship does not carry it.
    devDependencies['@tauri-apps/cli'] = '2.12.3'
  }
  return { dependencies, devDependencies }
}

/** What each target's packaging writes beside the source: ship's itch zip, its Tauri project and the bundles. */
export function targetGitignore(targets: readonly DistTarget[]): string {
  const lines = ['node_modules/', 'dist/']
  if (targets.includes('itch')) lines.push('*-itch.zip')
  if (targets.includes('tauri')) lines.push('.automata/', 'dist-tauri/')
  return `${lines.join('\n')}\n`
}

const ADAPTER_CONDITION: Record<DistTarget, string> = {
  web: 'automata-web',
  itch: 'automata-web',
  ruken: 'automata-ruken',
  tauri: 'automata-tauri',
}

/** The chosen targets' modes and conditions, plus `web`, the fallback, for the generated `vite.config.ts`. */
export function adapterConditions(targets: readonly DistTarget[]): string {
  const modes = DIST_TARGETS.filter((target) => target === 'web' || targets.includes(target))
  return modes.map((mode) => `  ${mode}: '${ADAPTER_CONDITION[mode]}',`).join('\n')
}

const TARGET_GUIDE: Record<DistTarget, { readonly name: string; readonly commands: string }> = {
  web: { name: 'The web', commands: 'pnpm build:web' },
  itch: { name: 'itch.io', commands: 'pnpm build:itch && pnpm prepare:itch' },
  ruken: { name: 'Ruken', commands: 'pnpm build:ruken && pnpm prepare:ruken' },
  tauri: { name: 'Desktop (Tauri)', commands: 'pnpm build:tauri && pnpm prepare:tauri' },
}

/** The README of a new game: how to run it, where its code is, how to build for each chosen target. */
export function targetReadme(title: string, targets: readonly DistTarget[]): string {
  const rows = targets.map((target) => `- ${TARGET_GUIDE[target].name}: \`${TARGET_GUIDE[target].commands}\``)
  return `# ${title}

\`pnpm dev\` runs the game in your browser.

## Where things are

- \`src/features/square/\`: the square and how it moves. One folder for each thing in your game.
- \`src/shared/constants.ts\`: numbers the game uses in more than one place.
- \`src/app/game.ts\`: where the game is put together (the controls, the screen size).
- \`tests/\`: tests. \`pnpm test\` runs them, and \`pnpm check\` runs every check a game has to pass before it is published.

## Building

Each target builds on its own:

${rows.join('\n')}

Step-by-step guides for publishing to each target are in the Docs on the Automata Framework site.
`
}
