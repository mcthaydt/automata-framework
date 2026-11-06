import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyPlan, type MoveConfig, planMoves } from '#src/move-tests.ts'

const FIXTURE = resolve(import.meta.dirname, '../fixtures/move-tests')

let root = ''
beforeEach(() => {
  // A copy, so a run never edits the checked-in fixture.
  root = mkdtempSync(join(tmpdir(), 'af-move-tests-'))
  cpSync(FIXTURE, root, { recursive: true })
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}
const config = (extra: Partial<MoveConfig> = {}): MoveConfig => ({
  root,
  environment: 'node',
  keepQualifier: ['src/a/i.analog.test.ts'],
  extraRoots: ['deploy'],
  ...extra,
})
const plan = (extra: Partial<MoveConfig> = {}) => planMoves(config(extra), listFiles(root))
const where = (path: string): string => join(root, path)
const textOf = (path: string, result = plan()): string => {
  const text = result.rewrites.get(where(path))
  if (text === undefined) throw new Error(`${path} is not in the plan`)
  return text
}

describe('where each test goes', () => {
  it('sorts by qualifier into unit, browser, bench and fixtures, keeping role suffixes', () => {
    const moved = Object.fromEntries(
      plan().moves.map((move) => [relative(root, move.from), relative(root, move.to)]),
    )
    expect(moved).toMatchObject({
      'src/a/b.test.ts': 'tests/unit/a/b.test.ts',
      'src/a/b.parity.test.ts': 'tests/browser/a/b.test.ts',
      'src/a/c.dom.test.ts': 'tests/unit/a/c.test.ts',
      'src/a/d.layout.test.ts': 'tests/browser/a/d.test.ts',
      'src/a/e.bench.test.ts': 'tests/bench/a/e.test.ts',
      'src/a/f.svelte.test.ts': 'tests/unit/a/f.svelte.test.ts',
      'src/a/g.schema.test.ts': 'tests/unit/a/g.schema.test.ts',
      'src/a/h.contract.test.ts': 'tests/unit/a/h.test.ts',
      'src/a/Host.test.svelte': 'tests/fixtures/a/Host.test.svelte',
      'e2e/play.e2e.ts': 'tests/e2e/play.test.ts',
      'e2e/origins.ts': 'tests/e2e/origins.ts',
    })
  })

  it('moves the tests of another root, keeping its folder name, and imports its code relatively', () => {
    expect(plan().moves.find((move) => move.from === where('deploy/bin/render.test.ts'))?.to).toBe(
      where('tests/unit/deploy/bin/render.test.ts'),
    )
    const text = textOf('tests/unit/deploy/bin/render.test.ts')
    expect(text).toContain("from '../../../../deploy/bin/render.ts'")
    expect(text).toContain("from '#src/a/b.ts'")
  })

  it('leaves a published helper and the test host it imports where they are', () => {
    const result = plan()
    expect(result.moves.map((move) => relative(root, move.from))).not.toContain('src/testing/helper.ts')
    expect(result.moves.map((move) => relative(root, move.from))).not.toContain('src/a/Published.test.svelte')
    expect(result.stayed).toEqual(['src/a/Published.test.svelte'])
  })

  it('keeps the qualifier of a file named in keepQualifier', () => {
    const target = plan().moves.find((move) => move.from === where('src/a/i.analog.test.ts'))?.to
    expect(target && relative(root, target)).toBe('tests/unit/a/i.analog.test.ts')
  })

  it('stops with both paths when two files would land on one name', () => {
    expect(() => plan({ keepQualifier: [] })).toThrow(
      /src\/a\/i\.(?:analog\.)?test\.ts and src\/a\/i\.(?:analog\.)?test\.ts both become tests\/unit\/a\/i\.test\.ts/,
    )
  })

  it('stops on a qualifier that has no row in the table', () => {
    const files = [...listFiles(root), where('src/a/z.surprise.test.ts')]
    expect(() => planMoves(config(), files, () => '')).toThrow(/qualifier "surprise"/)
  })
})

describe('a package with named browser folders', () => {
  // The files are only named, never read: `planMoves` decides the places from the names.
  const named = (names: string[], extra: Partial<MoveConfig> = {}): Record<string, string> =>
    Object.fromEntries(
      planMoves(config({ browserFolders: true, ...extra }), names.map(where), () => '').moves.map((move) => [
        relative(root, move.from),
        relative(root, move.to),
      ]),
    )

  it('sends layout, canvas, parity and journey tests to the folder of their kind, under the feature path', () => {
    expect(
      named([
        'src/a/b.layout.test.ts',
        'src/a/c.canvas.test.ts',
        'src/a/d.parity.test.ts',
        'src/a/e.journey.test.ts',
      ]),
    ).toEqual({
      'src/a/b.layout.test.ts': 'tests/browser/layout/a/b.test.ts',
      'src/a/c.canvas.test.ts': 'tests/browser/canvas/a/c.test.ts',
      'src/a/d.parity.test.ts': 'tests/browser/parity/a/d.test.ts',
      'src/a/e.journey.test.ts': 'tests/browser/journeys/a/e.test.ts',
    })
  })

  it('leaves the folders out unless the package asks, so a package already moved reruns the same', () => {
    expect(planMoves(config(), [where('src/a/b.canvas.test.ts')], () => '').moves[0]?.to).toBe(
      where('tests/browser/a/b.test.ts'),
    )
  })

  it("drops `features/` from the path of a feature's tests, as the other packages' tests/unit has it", () => {
    expect(
      named(
        ['src/features/level/a.test.ts', 'src/shared/kit/b.layout.test.ts', 'src/app/editor-2d/c.test.ts'],
        { featureFolders: true },
      ),
    ).toEqual({
      'src/features/level/a.test.ts': 'tests/unit/level/a.test.ts',
      'src/shared/kit/b.layout.test.ts': 'tests/browser/layout/shared/kit/b.test.ts',
      'src/app/editor-2d/c.test.ts': 'tests/unit/app/editor-2d/c.test.ts',
    })
  })

  it('folds a one-off qualifier into the name with a hyphen, and a DOM one still runs in jsdom', () => {
    const result = planMoves(
      config({ browserFolders: true }),
      ['src/a/patch.refusal.test.ts', 'src/a/Suite.ship.dom.test.ts', 'src/a/codec.codec-bug.test.ts'].map(
        where,
      ),
      () => '',
    )
    const to = Object.fromEntries(
      result.moves.map((move) => [relative(root, move.from), relative(root, move.to)]),
    )
    expect(to).toEqual({
      'src/a/patch.refusal.test.ts': 'tests/unit/a/patch-refusal.test.ts',
      'src/a/Suite.ship.dom.test.ts': 'tests/unit/a/Suite-ship.test.ts',
      'src/a/codec.codec-bug.test.ts': 'tests/unit/a/codec-codec-bug.test.ts',
    })
    expect(result.moves.find((move) => move.from === where('src/a/Suite.ship.dom.test.ts'))?.directive).toBe(
      '// @vitest-environment jsdom',
    )
  })

  it('stops when the folded names of two files are the same', () => {
    expect(() => named(['src/a/p.refusal.test.ts', 'src/a/p-refusal.test.ts'])).toThrow(/both become/)
  })
})

describe('the environment line', () => {
  it('adds `// @vitest-environment jsdom` to a .dom test in a Node package, and nothing to the others', () => {
    expect(textOf('tests/unit/a/c.test.ts').split('\n')[0]).toBe('// @vitest-environment jsdom')
    expect(textOf('tests/unit/a/b.test.ts')).not.toContain('@vitest-environment')
  })

  it('adds nothing to a .dom test when the package default is already jsdom', () => {
    expect(textOf('tests/unit/a/c.test.ts', plan({ environment: 'jsdom' }))).not.toContain(
      '@vitest-environment',
    )
  })

  it('puts `node` on the tests under otherEnvironment in a jsdom package', () => {
    const result = plan({ environment: 'jsdom', otherEnvironment: ['src/a'] })
    expect(textOf('tests/unit/a/b.test.ts', result).split('\n')[0]).toBe('// @vitest-environment node')
  })
})

describe('imports', () => {
  it('rewrites a relative import of code under src to the #src alias', () => {
    const text = textOf('tests/unit/a/b.test.ts')
    expect(text).toContain("from '#src/a/b.ts'")
    expect(text).toContain("from '#src/testing/helper.ts'")
  })

  it('names the file in full when the specifier left off the extension or named a folder', () => {
    const text = textOf('tests/unit/a/j.test.ts')
    expect(text).toContain("from '#src/a/b.ts'")
    expect(text).toContain("from '#src/a/sub/index.ts'")
  })

  it('leaves a new URL(...) call written inside a string alone', () => {
    expect(textOf('tests/unit/a/k.test.ts')).toContain('const page = "new URL(\'./b.ts\', import.meta.url)"')
  })

  it('points an import of a file outside the package at its place relative to the moved test', () => {
    const outside = join(dirname(root), `outside-${basename(root)}.ts`)
    writeFileSync(outside, 'export const outside = 1\n')
    try {
      const read = (path: string): string =>
        path.endsWith('a/i.test.ts')
          ? `import { outside } from '../../../${basename(outside)}'`
          : readFileSync(path, 'utf8')
      const text = planMoves(config(), listFiles(root), read).rewrites.get(where('tests/unit/a/i.test.ts'))
      expect(text).toContain(`from '../../../../${basename(outside)}'`)
    } finally {
      rmSync(outside, { force: true })
    }
  })

  it('maps .js to .ts, aliases json, and moves a new URL path to wherever it points now', () => {
    const text = textOf('tests/unit/a/k.test.ts')
    expect(text).toContain("from '#src/a/b.ts'")
    expect(text).toContain("from '#src/a/data.json'")
    // src/a/ reached the package root with ../.. ; tests/unit/a/ needs one more level.
    expect(text).toContain("new URL('../../..', import.meta.url)")
    expect(text).toContain("join(import.meta.dirname, '../../../src/a/data.json')")
    expect(text).toContain("join(import.meta.dirname, '../../../src/a')")
    expect(text).toContain("typeof import('#src/a/b.ts')")
  })

  it('rewrites vi.mock and dynamic import specifiers', () => {
    const text = textOf('tests/unit/a/c.test.ts')
    expect(text).toContain("vi.mock('#src/a/b.ts'")
    expect(text).toContain("import('#src/a/b.ts')")
  })

  it('points an import of a moved fixture at its new place, relatively', () => {
    expect(textOf('tests/unit/a/f.svelte.test.ts')).toContain("from '../../fixtures/a/Host.test.svelte'")
  })

  it('rewrites the imports inside a Svelte test host', () => {
    expect(textOf('tests/fixtures/a/Host.test.svelte')).toContain("from '#src/a/b.ts'")
  })

  it('rewrites a journey that reaches into src', () => {
    expect(textOf('tests/e2e/play.test.ts')).toContain("from '#src/a/b.ts'")
  })

  it('leaves import text inside a string alone', () => {
    expect(textOf('tests/unit/a/g.schema.test.ts')).toContain("const sample = `import { b } from './b.ts'`")
  })

  it('lists a moved file that finds files at run time, so a person checks it', () => {
    const files = listFiles(root)
    const read = (path: string): string =>
      path.endsWith('b.test.ts')
        ? "const file = new URL('./b.ts', import.meta.url)"
        : readFileSync(path, 'utf8')
    expect(planMoves(config(), files, read).needsEyes).toContain('tests/unit/a/b.test.ts')
  })
})

describe('applyPlan', () => {
  it('moves the files, writes the new text and adds the #src alias to package.json', () => {
    applyPlan(config(), plan(), { move: renameSync })
    const after = listFiles(root).map((path) => relative(root, path))
    expect(after).toContain('tests/unit/a/b.test.ts')
    expect(after).toContain('tests/browser/a/b.test.ts')
    expect(after).not.toContain('src/a/b.test.ts')
    expect(after).toContain('src/a/Published.test.svelte')
    expect(readFileSync(where('tests/unit/a/b.test.ts'), 'utf8')).toContain("from '#src/a/b.ts'")
    expect(JSON.parse(readFileSync(where('package.json'), 'utf8')).imports).toEqual({ '#src/*': './src/*' })
  })

  it('is a no-op the second time', () => {
    applyPlan(config(), plan(), { move: renameSync })
    const second = plan()
    expect(second.moves).toEqual([])
  })
})
