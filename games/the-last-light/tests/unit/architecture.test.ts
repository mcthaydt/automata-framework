import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// The game's layers, as a test. These are the framework's own five rules for `src/` (`pnpm boundaries --features`
// enforces the same ones; this test states them where the game's author will read them, and fails beside the code):
//   1. a feature imports only itself, shared/ and other packages
//   2. shared/ imports only shared/ and other packages
//   3. only entries/ and testing/ import app/; app/ imports features and shared
//   4. entries/ only re-exports
//   5. product code never imports testing/

const ROOT = join(import.meta.dirname, '../..')
const SRC = join(ROOT, 'src')

/** Every file below `dir` whose name matches `pattern`, as absolute paths. */
function filesBelow(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : filesBelow(path, pattern)
    return pattern.test(entry.name) ? [path] : []
  })
}

/** The module specifiers a file imports or re-exports (`import … from 'x'`, `import 'x'`, `export … from 'x'`). */
function specifiersOf(file: string): string[] {
  const code = readFileSync(file, 'utf8')
  return [...code.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"`;]*?(?:from\s*)?['"]([^'"]+)['"]/g)].map(
    (match) => match[1] as string,
  )
}

interface Place {
  readonly layer: string
  /** The feature's own name for a feature, the layer's otherwise. */
  readonly name: string
}

/** The layer a path under `src/` is in, from where it sits. */
function placeOf(absolute: string): Place | undefined {
  const path = relative(SRC, absolute).split(sep)
  const [layer, second] = path
  if (layer === undefined || layer.startsWith('..')) return undefined
  return { layer, name: layer === 'features' && second !== undefined ? second : layer }
}

/** Where an import of `from` lands: a relative one is resolved, `#src/…` is under src/, a package is nowhere. */
function landing(from: string, specifier: string): Place | undefined {
  if (specifier.startsWith('#src/')) return placeOf(join(SRC, specifier.slice('#src/'.length)))
  if (specifier.startsWith('.')) return placeOf(resolve(from, '..', specifier))
  return undefined
}

const SOURCES = filesBelow(SRC, /\.(?:ts|svelte)$/)

/** The imports in `src/` that break `broken`, written as "file: specifier" for the failure message. */
function breaking(broken: (from: Place, to: Place) => boolean): string[] {
  const found: string[] = []
  for (const file of SOURCES) {
    const from = placeOf(file)
    if (from === undefined) continue
    for (const specifier of specifiersOf(file)) {
      const to = landing(file, specifier)
      if (to !== undefined && broken(from, to)) found.push(`${relative(ROOT, file)}: ${specifier}`)
    }
  }
  return found
}

describe('the layers', () => {
  it('only entries/ and testing/ import app/; app imports features and shared; shared imports only shared', () => {
    expect(
      breaking(
        (from, to) =>
          (to.layer === 'app' && !['app', 'entries', 'testing'].includes(from.layer)) ||
          (from.layer === 'shared' && to.layer !== 'shared'),
      ),
    ).toEqual([])
  })

  it('a feature imports only itself and shared', () => {
    expect(
      breaking(
        (from, to) =>
          from.layer === 'features' &&
          to.layer !== 'shared' &&
          !(to.layer === 'features' && to.name === from.name),
      ),
    ).toEqual([])
  })

  it('entries/ only re-exports, and product code never imports testing/', () => {
    expect(
      breaking((from, to) => to.layer === 'testing' && !['testing', 'entries'].includes(from.layer)),
    ).toEqual([])
    const logic: string[] = []
    for (const file of filesBelow(join(SRC, 'entries'), /\.ts$/))
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const code = line.trim()
        if (code === '' || code.startsWith('//')) continue
        if (
          !/^(?:import|export)\b/.test(code) &&
          !/^\}?\s*(?:from\b.*)?$/.test(code) &&
          !/^[\w$,\s{}*]+(?:from\b.*)?$/.test(code)
        )
          logic.push(`${relative(ROOT, file)}: ${code}`)
      }
    expect(logic).toEqual([])
  })

  it('no test sits beside the source', () => {
    expect(filesBelow(SRC, /\.test\.ts$/)).toEqual([])
  })

  it('every folder under tests/unit names a folder under src, or is content, convert or play', () => {
    const known = new Set([
      ...readdirSync(SRC),
      ...readdirSync(join(SRC, 'features')).map((name) => `features`.concat('/', name)),
    ])
    const loose = readdirSync(join(ROOT, 'tests/unit'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !known.has(name) && !['content', 'convert', 'play'].includes(name))
    expect(loose).toEqual([])
  })

  it('a test reaches the source as #src/…, never by a relative path', () => {
    const relativeInto: string[] = []
    for (const file of filesBelow(join(ROOT, 'tests'), /\.test\.ts$/))
      for (const specifier of specifiersOf(file))
        if (/^(?:\.\.?\/)+(?:.*\/)?src\//.test(specifier))
          relativeInto.push(`${relative(ROOT, file)}: ${specifier}`)
    expect(relativeInto).toEqual([])
  })

  it('nothing under src/ imports from tools/ or from outside the package by a relative path', () => {
    const out: string[] = []
    for (const file of SOURCES)
      for (const specifier of specifiersOf(file)) {
        if (!specifier.startsWith('.')) continue
        const target = resolve(file, '..', specifier)
        if (relative(ROOT, target).startsWith('..') || relative(ROOT, target).startsWith('tools'))
          out.push(`${relative(ROOT, file)}: ${specifier}`)
      }
    expect(out).toEqual([])
  })
})

describe('the layer test itself', () => {
  it('sees an import that breaks a rule (so a pass means something)', () => {
    const broken = breaking(() => true)
    expect(broken.length).toBeGreaterThan(0)
  })
})
