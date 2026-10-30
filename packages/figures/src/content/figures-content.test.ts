import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_PALETTE, type Diagnostic } from '@mcthaydt/automata-content'
import { describe, expect, it } from 'vitest'
import { swatchColourProblems } from '../library/swatch-colours'
import { compileFixture, FIXTURE_ROOT } from '../testing/compile-fixture'
import { KEEPER_SLIDERS, WICK_SLIDERS } from '../testing/fixture-sliders'

const fixtureText = (file: string): string => readFileSync(join(FIXTURE_ROOT, file), 'utf8')

/** The 1-based line and column of the first `needle` in `text`. */
function where(text: string, needle: string): { line: number; column: number } {
  const index = text.indexOf(needle)
  if (index < 0) throw new Error(`${needle} is not in the fixture`)
  const before = text.slice(0, index).split('\n')
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 }
}

/** Compiles the fixture with `old` replaced by `new` in one file and returns the diagnostics. */
async function diagnosticsAfter(
  file: string,
  old: string,
  replacement: string,
): Promise<readonly Diagnostic[]> {
  const text = fixtureText(file)
  expect(text).toContain(old)
  const result = await compileFixture({ [file]: text.replace(old, replacement) })
  expect(result.ok).toBe(false)
  return result.ok ? [] : result.diagnostics
}

describe('the fixture figures and libraries compile as content', () => {
  it('compiles with no diagnostics and keeps every library item', async () => {
    const result = await compileFixture()
    if (!result.ok) throw new Error(result.message)
    const data = result.content.data as Record<string, Record<string, unknown>>
    expect(Object.keys(data.figure ?? {}).sort()).toEqual(['keeper', 'wick'])
    expect(Object.keys(data['figure-gait'] ?? {})).toHaveLength(7)
    expect(Object.keys(data['figure-hair'] ?? {})).toHaveLength(11)
    expect(Object.keys(data['figure-headwear'] ?? {})).toHaveLength(3)
    expect(Object.keys(data['figure-item'] ?? {})).toHaveLength(3)
    expect(Object.keys(data['figure-stand'] ?? {})).toHaveLength(7)
    expect(Object.keys(data['figure-rig'] ?? {})).toEqual(['default'])
    // FigureBuilder's 56 swatches and Wick's six.
    expect(Object.keys(data['figure-swatch'] ?? {})).toHaveLength(62)
  })
  it("keeps the sliders the tests' skeletons are built from", async () => {
    const result = await compileFixture()
    if (!result.ok) throw new Error(result.message)
    const figures = result.content.data.figure as Record<string, { sliders: Record<string, unknown> }>
    expect(figures.wick?.sliders).toEqual(WICK_SLIDERS)
    const { face: _face, ...keeper } = figures.keeper?.sliders ?? {}
    expect(keeper).toEqual(KEEPER_SLIDERS)
  })
  it('names only colours of the default palette, Endesga 64 (ported: every swatch colour is on the palette)', async () => {
    const result = await compileFixture()
    if (!result.ok) throw new Error(result.message)
    const swatches = result.content.data['figure-swatch'] as Parameters<typeof swatchColourProblems>[0]
    expect(result.content.data.palette).toEqual(DEFAULT_PALETTE)
    expect(swatchColourProblems(swatches, DEFAULT_PALETTE)).toEqual([])
  })
})

describe('F-e: a figure naming a missing library id fails content compile with its location', () => {
  const wick = 'content/figures/wick.toml'
  const keeper = 'content/figures/keeper.toml'
  const cases: { what: string; file: string; old: string; next: string; kind: string; id: string }[] = [
    {
      what: 'skin swatch',
      file: wick,
      old: 'skin = "wick-shadow"',
      next: 'skin = "ghost"',
      kind: 'figure-swatch',
      id: 'ghost',
    },
    {
      what: 'gait',
      file: wick,
      old: 'gait = "bounce"',
      next: 'gait = "moonwalk"',
      kind: 'figure-gait',
      id: 'moonwalk',
    },
    {
      what: 'rig limits',
      file: wick,
      old: 'rig = "default"',
      next: 'rig = "floppy"',
      kind: 'figure-rig',
      id: 'floppy',
    },
    {
      what: 'stand',
      file: keeper,
      old: '"hand-in-jacket-pocket"',
      next: '"lean-on-lamp"',
      kind: 'figure-stand',
      id: 'lean-on-lamp',
    },
    {
      what: 'hair style',
      file: keeper,
      old: 'style = "cropped"',
      next: 'style = "mohawk"',
      kind: 'figure-hair',
      id: 'mohawk',
    },
    {
      what: 'headwear',
      file: keeper,
      old: 'style = "flat"',
      next: 'style = "top-hat"',
      kind: 'figure-headwear',
      id: 'top-hat',
    },
    {
      what: 'garment swatch',
      file: keeper,
      old: 'buttons = "brass"',
      next: 'buttons = "gold"',
      kind: 'figure-swatch',
      id: 'gold',
    },
    {
      what: "an item's material",
      file: 'content/figure-items/torch.toml',
      old: 'material = "rag"',
      next: 'material = "oilcloth"',
      kind: 'figure-swatch',
      id: 'oilcloth',
    },
    {
      what: "a stand's fallback",
      file: 'content/figure-stands/hand-on-hip.toml',
      old: '["hip-and-pocket"]',
      next: '["slouch"]',
      kind: 'figure-stand',
      id: 'slouch',
    },
  ]
  for (const c of cases) {
    it(`reports a missing ${c.what} at file:line:col`, async () => {
      const diagnostics = await diagnosticsAfter(c.file, c.old, c.next)
      const text = fixtureText(c.file).replace(c.old, c.next)
      const at = where(text, `"${c.id}"`)
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'unknownReference',
          file: c.file,
          line: at.line,
          message: `no ${c.kind} has the id ${c.id}`,
        }),
      )
    })
  }
})

describe('impossible skeletons fail content compile, naming the slider', () => {
  it('a pelvis above the chest (a negative spine) is reported at the slider that set it', async () => {
    const file = 'content/figures/wick.toml'
    const text = fixtureText(file)
      .replace('legs = 0.2\n', 'legs = 2\n')
      .replace('head = 1\nchunk', 'head = 2\nchunk')
      .replace('neckLength = 0.1', 'neckLength = 2')
    const result = await compileFixture({ [file]: text })
    const diagnostics = result.ok ? [] : result.diagnostics
    const spine = diagnostics.find((d) => d.message.includes('spine'))
    expect(spine).toMatchObject({ file, line: where(text, 'legs = 2').line, keyPath: 'sliders.legs' })
    expect(spine?.message).toMatch(/^legs 2 gives the spine a length of -\d/)
  })
  it('a slider far past its ends is refused with its range', async () => {
    const file = 'content/figures/wick.toml'
    const diagnostics = await diagnosticsAfter(file, 'arms = 0.3', 'arms = 3')
    const text = fixtureText(file).replace('arms = 0.3', 'arms = 3')
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ file, line: where(text, 'arms = 3').line, keyPath: 'sliders.arms' }),
    )
  })
  it("FigureBuilder's painter fields are not swatch fields", async () => {
    const file = 'content/figure-swatches/fair.toml'
    const diagnostics = await diagnosticsAfter(file, 'colour = 22', 'colour = 22\nramp = 27')
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknownField',
        file,
        keyPath: 'ramp',
        message: 'unknown field: ramp',
      }),
    )
  })
})
