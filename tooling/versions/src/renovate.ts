// Renovate and Ruken-matched pins (QB.1). A row of docs/versions.md whose reason says "Same as Ruken" moves
// only when Ruken's docs/versions.md moves, so renovate.json must turn Renovate off for it.

/** The parts of renovate.json this check reads. */
export interface RenovateConfig {
  readonly packageRules?: readonly {
    readonly matchPackageNames?: readonly string[]
    readonly enabled?: boolean
    readonly [option: string]: unknown
  }[]
}

const SECTIONS = ['Runtimes', 'npm packages']

/**
 * The names of the Runtimes and npm rows whose last cell says "Same as Ruken", as Renovate names them: the
 * backticked package name, or the runtime's name in lower case (`node`, `pnpm`).
 */
export function rukenMatchedNames(versionsDoc: string): string[] {
  const names = new Set<string>()
  for (const part of versionsDoc.split(/^## /m)) {
    if (!SECTIONS.some((section) => part.startsWith(section))) continue
    for (const line of part.split('\n')) {
      const cells = line.split('|').map((cell) => cell.trim())
      // | name | version | date | why |  splits into ['', name, version, date, why, '']
      const [, name, , , why] = cells
      if (name === undefined || why === undefined || !why.includes('Same as Ruken')) continue
      names.add(name.startsWith('`') ? name.replaceAll('`', '') : name.toLowerCase())
    }
  }
  return [...names].sort()
}

/** Ruken-matched names that no `enabled: false` package rule in the Renovate config covers. */
export function unfrozenRukenPins(versionsDoc: string, config: RenovateConfig): string[] {
  const frozen = new Set(
    (config.packageRules ?? [])
      .filter((rule) => rule.enabled === false)
      .flatMap((rule) => rule.matchPackageNames ?? []),
  )
  return rukenMatchedNames(versionsDoc).filter((name) => !frozen.has(name))
}
