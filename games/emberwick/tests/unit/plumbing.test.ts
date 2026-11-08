import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The DX spec's measuring script (§10, §12; DX.3 decision E-4). It replaces §1's hand count (1,939 lines of
// plumbing) with one taken from the game itself: walk the relative imports from `main.ts`, count the lines of
// every TypeScript file the game reaches, and class each by where it sits. The sim is every file with a sim role
// suffix plus `tiles.ts`, `tuning.ts` and `place-wick.ts`; `shared/art/` is the art; `features/room/` and `room.ts` are the content; `features/scene/`, `pixels.ts` and `light-levels.ts` are the drawing Emberwick does
// (room, light map, particles, backdrop), except `scene-renderer.ts`, which only wires that drawing into the
// renderer and so counts as plumbing.
// Everything else the game reaches is plumbing. Files under `src/` the game never reaches are kept for the
// demos (decision E-3) and reported on their own line.

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// 400 until the room learned to pause when the page is hidden (about ten lines of listener); 420 leaves room for the next small
// piece of behaviour without hiding a real growth in plumbing.
const PLUMBING_LIMIT = 420

const SIM_ROLE = /\.(?:component|system|command|event|resource|plugin)\.ts$/
const SIM_BY_IMPORT = ['src/shared/tiles.ts', 'src/shared/tuning.ts', 'src/features/player/place-wick.ts']
const CONTENT = ['src/shared/room.ts']
const DRAWING = ['src/shared/pixels.ts', 'src/shared/light-levels.ts']

type LineClass = 'sim' | 'art' | 'content' | 'drawing' | 'plumbing'

const RELATIVE_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s+['"](\.{1,2}\/[^'"]+)['"]/g

function lineCount(file: string): number {
  const text = readFileSync(file, 'utf8')
  // Counted like `wc -l`: newlines, so a file that ends in one counts its last line once.
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
}

function resolveImport(from: string, specifier: string): string | null {
  const target = resolve(dirname(from), specifier)
  for (const candidate of [target, `${target}.ts`, join(target, 'index.ts')]) {
    if (candidate.endsWith('.ts') && existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null // CSS, Svelte, assets: not TypeScript, not counted
}

/** Every TypeScript file reachable from `entry` through relative imports, sorted. */
function reachableFiles(entry: string): string[] {
  const seen = new Set<string>()
  const pending = [entry]
  while (pending.length > 0) {
    const file = pending.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    for (const match of readFileSync(file, 'utf8').matchAll(RELATIVE_IMPORT)) {
      const next = resolveImport(file, (match[1] ?? match[2]) as string)
      if (next !== null) pending.push(next)
    }
  }
  return [...seen].sort()
}

function classOf(root: string, file: string): LineClass {
  const path = relative(root, file)
  if (SIM_ROLE.test(path) || SIM_BY_IMPORT.includes(path)) return 'sim'
  if (path.startsWith('src/shared/art/')) return 'art'
  if (path.startsWith('src/features/room/') || CONTENT.includes(path)) return 'content'
  if (path === 'src/features/scene/scene-renderer.ts') return 'plumbing'
  if (path.startsWith('src/features/scene/') || DRAWING.includes(path)) return 'drawing'
  return 'plumbing'
}

interface Measure {
  readonly lines: Record<LineClass, number>
  readonly files: readonly { readonly path: string; readonly lines: number; readonly kind: LineClass }[]
  readonly demoSupport: readonly { readonly path: string; readonly lines: number }[]
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    const isSource = entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')
    return isSource && !/\.test\.ts$/.test(entry.name) ? [path] : []
  })
}

function measure(root: string): Measure {
  const reached = reachableFiles(join(root, 'main.ts'))
  const lines: Record<LineClass, number> = { sim: 0, art: 0, content: 0, drawing: 0, plumbing: 0 }
  const files = reached.map((file) => {
    const kind = classOf(root, file)
    const count = lineCount(file)
    lines[kind] += count
    return { path: relative(root, file), lines: count, kind }
  })
  const demoSupport = sourceFiles(join(root, 'src'))
    .filter((file) => !reached.includes(file))
    .sort()
    .map((file) => ({ path: relative(root, file), lines: lineCount(file) }))
  return { lines, files, demoSupport }
}

describe("Emberwick's plumbing, measured from main.ts", () => {
  const result = measure(GAME_ROOT)

  it(`is at most ${PLUMBING_LIMIT} lines`, () => {
    const table = result.files.map(
      (file) => `  ${file.kind.padEnd(8)} ${String(file.lines).padStart(4)}  ${file.path}`,
    )
    const demo = result.demoSupport.reduce((sum, file) => sum + file.lines, 0)
    console.info(
      [
        "Emberwick's game, by class (lines, non-test .ts reached from main.ts):",
        ...table,
        `  totals: ${JSON.stringify(result.lines)}`,
        `  not reached by the game (demo support E-3, the golden replay, package entries): ${demo} lines in ${result.demoSupport.length} files`,
        ...result.demoSupport.map((file) => `           ${String(file.lines).padStart(4)}  ${file.path}`),
      ].join('\n'),
    )
    expect(result.lines.plumbing).toBeLessThanOrEqual(PLUMBING_LIMIT)
  })

  it('walks the whole game: the definition, its screens, its flow, its sim and its scene', () => {
    const paths = result.files.map((file) => file.path)
    for (const path of [
      'main.ts',
      'src/app/game.ts',
      'src/features/screens/flow.ts',
      'src/features/screens/emberwick-screens.ts',
      'src/app/emberwick.plugin.ts',
      'src/features/scene/scene.ts',
      'src/features/scene/scene-renderer.ts',
      'src/shared/room.ts',
      'src/shared/art/sprites.ts',
    ]) {
      expect(paths).toContain(path)
    }
  })
})
