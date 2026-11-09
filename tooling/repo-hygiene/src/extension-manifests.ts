// The manifest rules for `extensions/*`: an extension is a workspace package named after its folder, MIT licensed,
// importing its own source through `#src/*`, and reaching core only as a peer (core is never bundled into it).

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The packages an extension may use as core: it lists them under `peerDependencies`, never `dependencies`. */
const CORE_PACKAGES: ReadonlySet<string> = new Set([
  '@automata/framework',
  '@automata/tools',
  '@automata/sim',
  '@automata/content',
  '@automata/3d',
  '@automata/evidence',
])

interface Manifest {
  readonly name?: string
  readonly license?: string
  readonly imports?: Record<string, unknown>
  readonly dependencies?: Record<string, string>
}

/** One sentence per problem, each naming the manifest it is about. Empty when every extension is well-formed. */
export function extensionManifestProblems(root: string): string[] {
  const extensionsDir = join(root, 'extensions')
  if (!existsSync(extensionsDir)) return []
  const problems: string[] = []
  for (const folder of readdirSync(extensionsDir).sort()) {
    const manifestPath = join(extensionsDir, folder, 'package.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
    const where = `extensions/${folder}/package.json`
    const expectedName = `@automata/${folder}`
    if (manifest.name !== expectedName) problems.push(`${where}: name must be ${expectedName}`)
    if (manifest.license !== 'MIT') problems.push(`${where}: license must be "MIT"`)
    if (manifest.imports?.['#src/*'] !== './src/*') {
      problems.push(`${where}: imports must map "#src/*" to "./src/*"`)
    }
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (CORE_PACKAGES.has(dependency)) {
        problems.push(`${where}: ${dependency} is core, so it belongs in peerDependencies`)
      }
    }
  }
  return problems
}
