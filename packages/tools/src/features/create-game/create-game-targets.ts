/**
 * The distribution targets a generated game builds for (ADR 0006, DIST spec §5.3): `web`, `itch`, `ruken` and
 * `tauri`, peers, each removable. `create-game` writes all four unless told otherwise (DIST-D9).
 */
export const DIST_TARGETS = ['web', 'itch', 'ruken', 'tauri'] as const

export type DistTarget = (typeof DIST_TARGETS)[number]

export type ParsedTargets =
  | { readonly ok: true; readonly targets: readonly DistTarget[] }
  | { readonly ok: false; readonly message: string }

const isTarget = (value: string): value is DistTarget => (DIST_TARGETS as readonly string[]).includes(value)

/** Reads `--targets web,itch,…`: each known, none twice, at least one. Left out, all four. */
export function parseTargets(value: string | undefined): ParsedTargets {
  if (value === undefined) return { ok: true, targets: DIST_TARGETS }
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
  // The web build is the artifact itself (`dist/`); the other three are packaged by ship (DIST spec §8 flow 1).
  for (const target of targets)
    if (target !== 'web') scripts[`prepare:${target}`] = `automata ship prepare --target ${target}`
  return scripts
}

/** Ruken's SDK for a `ruken` build; Tauri's packages for a `tauri` one (the host's optional peers, DIST spec §6.1). */
export function targetDependencies(targets: readonly DistTarget[]): {
  readonly dependencies: Record<string, string>
  readonly devDependencies: Record<string, string>
} {
  const dependencies: Record<string, string> = {}
  const devDependencies: Record<string, string> = {}
  if (targets.includes('ruken')) dependencies['@ruken/sdk'] = '^0.0.0'
  if (targets.includes('tauri')) {
    dependencies['@tauri-apps/api'] = '2.12.4'
    dependencies['@tauri-apps/plugin-process'] = '2.4.0'
    dependencies['@tauri-apps/plugin-store'] = '2.5.0'
    // `prepare --target tauri` runs the game's own Tauri CLI; ship does not carry it (DIST.5b).
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

/** The README's list of the chosen targets and how to build each. */
export function targetReadme(title: string, targets: readonly DistTarget[]): string {
  const rows = targets.map((target) => `- ${TARGET_GUIDE[target].name}: \`${TARGET_GUIDE[target].commands}\``)
  return `# ${title}

\`pnpm dev\` runs the game in the browser.

## Building

Each target builds on its own, with its own host adapter:

${rows.join('\n')}

Publishing to each target is described in the Automata Framework guides (\`docs/guides/publish-to-*.md\`).
`
}
