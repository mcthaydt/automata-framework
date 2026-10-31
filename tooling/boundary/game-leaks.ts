// M6.3's rule (M6 spec L-a, as amended by M6.0a; decision 8): the adventure source is not edited, so the leaks its
// engine code has (M6 spec §2.3) are removed in the Plus rewrites, and this keeps them out. An extension package never
// imports a scene or a game: no `scenes` path segment, no relative path out of its package, no starter or game
// workspace package. An M6 package also never keeps device storage (M6-D8: core Settings and Save, host authority) and
// never carries one game's contract fields. Comments and test files do not count for those two token rules.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { findImports, sourceFiles } from './core-imports.ts'

/** The M6 gameplay extensions (M6 spec §3), by folder under `packages/`. */
export const M6_PACKAGES: readonly string[] = [
  'feel',
  'debug',
  'sectors',
  'nav',
  'puzzle',
  'systems',
  'narrative',
  'cutscenes',
  'audio-synth',
]
/** The adventure source's game-specific contract fields (M6 spec §2.3, `game/contracts/rules.ts`). */
export const GAME_FIELDS: readonly string[] = ['basinFull', 'torchTime']

const TEST_FILE = /\.test\.[mc]?[jt]sx?$/
const STORAGE = /\b(localStorage|sessionStorage)\b/g
const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
const GAME_DIRS = ['starters', 'games'] as const

/** The workspace package names under `starters/` and `games/`. */
function gameNames(root: string): string[] {
  const names: string[] = []
  for (const dir of GAME_DIRS) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    for (const item of readdirSync(base, { withFileTypes: true })) {
      const manifest = join(base, item.name, 'package.json')
      if (item.isDirectory() && existsSync(manifest))
        names.push((JSON.parse(readFileSync(manifest, 'utf8')) as { name: string }).name)
    }
  }
  return names
}

/** The source with each comment blanked, its line breaks kept, so a token's line is still its line. */
const withoutComments = (source: string): string =>
  source.replace(COMMENTS, (comment) => comment.replace(/[^\n]/g, ' '))
const lineOf = (source: string, index: number): number => source.slice(0, index).split('\n').length

/** Every game leak in the workspace's extension packages, as `file:line: message`, in file order. */
export function gameLeakFindings(root: string): string[] {
  const games = gameNames(root)
  const findings: string[] = []
  const packages = join(root, 'packages')
  if (!existsSync(packages)) return findings
  for (const item of readdirSync(packages, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const src = join(packages, item.name, 'src')
    if (!item.isDirectory() || !existsSync(src)) continue
    const packageDir = join(packages, item.name)
    const isM6 = M6_PACKAGES.includes(item.name)
    for (const file of sourceFiles(src)) {
      const where = relative(root, file).split(sep).join('/')
      const source = readFileSync(file, 'utf8')
      for (const { specifier, line } of findImports(source)) {
        if (specifier.split('/').includes('scenes'))
          findings.push(`${where}:${line}: "${specifier}" imports a scene`)
        else if (specifier.startsWith('.') && !resolve(file, '..', specifier).startsWith(packageDir + sep))
          findings.push(`${where}:${line}: "${specifier}" imports from outside its package`)
        else if (games.some((name) => specifier === name || specifier.startsWith(`${name}/`)))
          findings.push(`${where}:${line}: "${specifier}" imports a game`)
      }
      if (!isM6 || TEST_FILE.test(file)) continue
      const code = withoutComments(source)
      for (const match of code.matchAll(STORAGE))
        findings.push(
          `${where}:${lineOf(code, match.index ?? 0)}: "${match[1]}" is device storage; use core Settings or Save (M6-D8)`,
        )
      for (const field of GAME_FIELDS)
        for (const match of code.matchAll(new RegExp(`\\b${field}\\b`, 'g')))
          findings.push(
            `${where}:${lineOf(code, match.index ?? 0)}: "${field}" is one game's field (M6 spec §2.3)`,
          )
    }
  }
  return findings
}
