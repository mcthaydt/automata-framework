import { readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { parseSync } from 'oxc-parser'
import type { AstNode } from './ast.ts'
import type { Finding, Rule } from './check.ts'
import { collectSources } from './files.ts'
import { readImports } from './imports.ts'

// The `--features` check (core and 2D refactor spec §3.3 and §3.5). A package's src/ is app/, features/<x>/, shared/,
// entries/ and testing/, and the imports between them go one way:
//   1. features/<x>/ imports only itself, shared/, and other packages. Never another feature, app/ or entries/.
//   2. shared/ imports only shared/ and other packages.
//   3. Only entries/ and testing/ import app/ (app/ imports features and shared).
//   4. entries/ re-exports and holds no logic.
//   5. Product code never imports testing/; entries/ re-exports it.
// Relative imports are judged by the folder they land in; type-only imports count too, because a type still ties
// one feature to another. An import is judged where it points, so the target file need not exist yet.

/** A place in a package's src/: a layer, and for `features/` the feature's own name. */
interface Place {
  readonly layer: string
  /** What the message calls it: the feature's name for a feature, the layer otherwise. */
  readonly name: string
  /** Its path under src/, with forward slashes. */
  readonly path: string
}

function placeOf(src: string, file: string): Place | undefined {
  const path = relative(src, file).split(sep).join('/')
  if (path.startsWith('..')) return undefined
  const [layer, second] = path.split('/') as [string, string | undefined]
  return { layer, name: layer === 'features' && second !== undefined ? second : layer, path }
}

const SHARED_ADVICE =
  'shared/ may only use shared/ and other packages. Move what it needs into shared/, or move this file into the feature that owns it.'

/** The finding for an import that breaks a rule, or undefined when it is allowed. */
function judge(from: Place, to: Place): { rule: Rule; advice: string } | undefined {
  if (to.layer === 'testing' && from.layer !== 'testing' && from.layer !== 'entries')
    return {
      rule: 'testing-import',
      advice:
        'testing/ holds the published test helpers; product code never imports it. Only entries/ re-exports it.',
    }
  if (from.layer === 'features') {
    if (to.layer === 'features' && to.name !== from.name)
      return {
        rule: 'feature-import',
        advice:
          'A feature may only use its own files and shared/. Pass what it needs in from app/, or move the shared part to shared/.',
      }
    if (to.layer === 'app')
      return {
        rule: 'app-import',
        advice: 'Only entries/ and testing/ may import app/. Pass the value in from app/ instead.',
      }
  }
  if (from.layer === 'shared' && ['features', 'app', 'entries'].includes(to.layer))
    return { rule: 'shared-import', advice: SHARED_ADVICE }
  if (to.layer === 'entries' && ['features', 'app'].includes(from.layer))
    return {
      rule: 'entries-import',
      advice: 'entries/ is the published surface; nothing inside the package imports it.',
    }
  if (to.layer === 'app' && from.layer === 'shared') return { rule: 'shared-import', advice: SHARED_ADVICE }
  return undefined
}

/** Statements an entry file may hold: imports, and exports that name things without declaring them. */
function entryLogic(file: string, code: string): Finding[] {
  const parsed = parseSync(file, code)
  if (parsed.errors.length > 0) return []
  const lineStarts = [0]
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1)
  const findings: Finding[] = []
  for (const statement of (parsed.program as unknown as { body: AstNode[] }).body) {
    const allowed =
      statement.type === 'ImportDeclaration' ||
      statement.type === 'ExportAllDeclaration' ||
      (statement.type === 'ExportNamedDeclaration' && statement.declaration == null)
    if (allowed) continue
    let line = 0
    while (line + 1 < lineStarts.length && (lineStarts[line + 1] as number) <= statement.start) line++
    findings.push({
      file,
      line: line + 1,
      col: statement.start - (lineStarts[line] as number) + 1,
      rule: 'entries-logic',
      message: `entries/ re-exports and holds no logic (found ${statement.type.endsWith('Declaration') ? 'a declaration' : 'a statement'}).\nMove the code into app/, features/ or shared/, and re-export it from here.`,
    })
  }
  return findings
}

/** The files checked and the findings, for one package folder (`packages/automata`): its `src/` is read. */
export function featureFindings(packageRoot: string): { files: string[]; findings: Finding[] } {
  const files = collectSources(join(packageRoot, 'src'))
  const src = resolve(packageRoot, 'src')
  const findings: Finding[] = []
  for (const file of files) {
    const absolute = resolve(file)
    const code = readFileSync(absolute, 'utf8')
    const here = placeOf(src, absolute)
    const { imports, errors } = readImports(file, code)
    findings.push(...errors)
    if (here?.layer === 'entries') findings.push(...entryLogic(file, code))
    for (const { specifier, line, col } of imports) {
      if (specifier.startsWith('#src/')) {
        findings.push({
          file,
          line,
          col,
          rule: 'alias-in-src',
          message: `"${specifier}" is the alias tests use.\nImport by relative path in src/; the #src alias is for tests/ only.`,
        })
        continue
      }
      if (here === undefined || !specifier.startsWith('.')) continue
      const to = placeOf(src, resolve(absolute, '..', specifier))
      if (to === undefined) continue
      const verdict = judge(here, to)
      if (verdict === undefined) continue
      findings.push({
        file,
        line,
        col,
        rule: verdict.rule,
        message: `"${here.name}" imports "${to.name}" (${to.path}).\n${verdict.advice}`,
      })
    }
  }
  return { files, findings }
}
