import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_PALETTE, type Diagnostic } from '@automata/content'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RIG_LIMITS } from '#src/features/figures/content/rig-limits.schema.ts'
import { swatchColourProblems } from '#src/features/figures/content/swatch-colours.ts'
import { compileFixture, FIXTURE_ROOT } from '#src/testing/compile-fixture.ts'
import { FIXTURE_ACTION_IDS, FIXTURE_CLIP_IDS } from '#src/testing/fixture-clips.ts'
import { FIXTURE_POSE_IDS } from '#src/testing/fixture-poses.ts'
import { KEEPER_SLIDERS, WICK_SLIDERS } from '#src/testing/fixture-sliders.ts'

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
    expect(Object.keys(data['figure-pose'] ?? {}).sort()).toEqual([...FIXTURE_POSE_IDS])
    expect(Object.keys(data['figure-clip'] ?? {}).sort()).toEqual([...FIXTURE_CLIP_IDS])
    expect(Object.keys(data['figure-action'] ?? {}).sort()).toEqual([...FIXTURE_ACTION_IDS])
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
  it('names only colours of the default palette, DUEL (ported: every swatch colour is on the palette)', async () => {
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
      // The compiler places a reference at its key, so the column is where that key starts on the line.
      const column = (text.split('\n')[at.line - 1]?.search(/\S/) ?? -1) + 1
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'unknownReference',
          file: c.file,
          line: at.line,
          column,
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
      expect.objectContaining({
        file,
        line: where(text, 'arms = 3').line,
        keyPath: 'sliders.arms',
        message: expect.stringContaining('<=2'),
      }),
    )
  })
  it("the drawn face's colours are not garment fields (M3.5b decision 7)", async () => {
    const file = 'content/figures/keeper.toml'
    const diagnostics = await diagnosticsAfter(file, 'lids = "pale-lid"', 'lids = "pale-lid"\nlips = "mouth"')
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'unknownField', file, keyPath: 'outfits.lamplighter.7.lips' }),
    )
  })
  it("FigureBuilder's painter fields are not swatch fields", async () => {
    const file = 'content/figure-swatches/fair.toml'
    const diagnostics = await diagnosticsAfter(file, 'step = 5', 'step = 5\nbase = 27')
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknownField',
        file,
        keyPath: 'base',
        message: 'unknown field: base',
      }),
    )
  })
})

describe('inline values and unions report the inner field, not the whole union', () => {
  const wick = 'content/figures/wick.toml'
  const keeper = 'content/figures/keeper.toml'
  it("an inline hood lock missing its size is reported at the lock's own key", async () => {
    const diagnostics = await diagnosticsAfter(wick, 'r = [1.3, 0.62, 1.2]\n', '')
    expect(diagnostics.map((d) => d.keyPath)).toEqual(['outfits.wanderer.4.style.locks.0.r'])
  })
  it('an inline hood lock on a misspelt place is reported at `on`', async () => {
    const diagnostics = await diagnosticsAfter(wick, 'on = "head"', 'on = "hed"')
    expect(diagnostics.map((d) => d.keyPath)).toEqual(['outfits.wanderer.4.style.locks.0.on'])
  })
  it('an inline gait missing numbers is reported at each missing field', async () => {
    const diagnostics = await diagnosticsAfter(wick, 'gait = "bounce"', 'gait = { cycle = 0.5 }')
    expect(diagnostics.length).toBeGreaterThan(1)
    expect(diagnostics.map((d) => d.keyPath)).toContain('gait.speed')
    expect(diagnostics.every((d) => d.code === 'missingField')).toBe(true)
  })
  it("an inline hair style written as locks reports the lock's field", async () => {
    const diagnostics = await diagnosticsAfter(
      keeper,
      'style = "cropped"',
      'style = [{ on = "head", at = [0, 0.7, 0] }]',
    )
    expect(diagnostics.map((d) => d.keyPath)).toEqual(['outfits.lamplighter.5.style.0.r'])
  })
  it("a stand's hand placed at an unknown opening is reported at `at`", async () => {
    const diagnostics = await diagnosticsAfter(
      'content/figure-stands/hand-on-hip.toml',
      'R = { at = "hip"',
      'R = { at = "hipp"',
    )
    expect(diagnostics.map((d) => d.keyPath)).toEqual(['hands.R.at'])
  })
})

describe('gait overrides and hair pieces', () => {
  it("applies a figure's gait overrides and checks their names", async () => {
    const file = 'content/figures/wick.toml'
    const ok = await compileFixture({
      [file]: fixtureText(file).replace(
        'gait = "bounce"',
        'gait = "bounce"\ngaitOverrides = { armSwing = 0.1 }',
      ),
    })
    if (!ok.ok) throw new Error(ok.message)
    const figures = ok.content.data.figure as Record<string, { gaitOverrides?: unknown }>
    expect(figures.wick?.gaitOverrides).toEqual({ armSwing: 0.1 })
    const diagnostics = await diagnosticsAfter(
      file,
      'gait = "bounce"',
      'gait = "bounce"\ngaitOverrides = { armswing = 0.1 }',
    )
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'unknownField', keyPath: 'gaitOverrides.armswing' }),
    )
  })
  it('checks every hair piece id against the hair library', async () => {
    const file = 'content/figures/keeper.toml'
    const diagnostics = await diagnosticsAfter(
      file,
      'stand = "hand-in-jacket-pocket"',
      'stand = "hand-in-jacket-pocket"\nhairPieces = ["cropped", "afro"]',
    )
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknownReference',
        keyPath: 'hairPieces.1',
        message: 'no figure-hair has the id afro',
      }),
    )
  })
})

describe("a garment's default swatches are checked at compile (M3.5b review)", () => {
  // A garment that names no sole, no lids or no mouth wears the library's; a library without it is refused at
  // the garment that would wear it, not left to throw in build().
  const cases: { swatch: string; file: string; garment: string; keyPath: string }[] = [
    {
      swatch: 'mouth',
      file: 'content/figures/wick.toml',
      garment: 'eyes = "wick-eye"',
      keyPath: 'outfits.wanderer.5.mouth',
    },
    {
      swatch: 'lid',
      file: 'content/figures/wick.toml',
      garment: 'eyes = "wick-eye"',
      keyPath: 'outfits.wanderer.5.lids',
    },
    {
      swatch: 'sole',
      file: 'content/figures/keeper.toml',
      garment: 'shoes = "boot-brown"\nboots = true\n\n[[outfits.shirtsleeves]]\nhair',
      keyPath: 'outfits.shirtsleeves.3.sole',
    },
  ]
  for (const c of cases)
    it(`reports a missing default ${c.swatch} at the garment`, async () => {
      const result = await compileFixture({ [`content/figure-swatches/${c.swatch}.toml`]: null })
      expect(result.ok).toBe(false)
      const diagnostics = result.ok ? [] : result.diagnostics
      const text = fixtureText(c.file)
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'unknownReference',
          file: c.file,
          // The garment's own place: its `[[outfits.…]]` header, the line above its first key.
          line: where(text, c.garment).line - 1,
          keyPath: c.keyPath,
          message: `no figure-swatch has the id ${c.swatch}`,
        }),
      )
    })
  it('writes the defaults into the compiled garment', async () => {
    const result = await compileFixture()
    if (!result.ok) throw new Error(result.message)
    const figures = result.content.data.figure as Record<string, { outfits: Record<string, unknown[]> }>
    expect(figures.wick?.outfits.wanderer?.[5]).toEqual({
      eyes: 'wick-eye',
      lids: 'lid',
      brows: 'brow',
      mouth: 'mouth',
    })
  })
})

describe("a garment's numbers and lists are bounded (M3.5b review)", () => {
  const file = 'content/figures/keeper.toml'
  const top = 'top = "starch"\nsleeves = "short"'
  // Each would build badly: zero-width cargos run out of memory, an empty zip throws, the rest degrade.
  const cases: { garment: string; field: string }[] = [
    { garment: 'cargos = "charcoal"\nwidth = 0', field: 'width' },
    { garment: 'cargos = "charcoal"\nwidth = -0.2', field: 'width' },
    { garment: 'jacket = "navy"\nzip = []', field: 'zip' },
    { garment: 'bomber = "navy"\nzip = []', field: 'zip' },
    { garment: 'skirt = "navy"\nlength = -1', field: 'length' },
    { garment: 'tee = "navy"\nfit = 0', field: 'fit' },
    { garment: 'hoops = "brass"\nsize = -1', field: 'size' },
    { garment: 'puffer = "navy"\nbaffles = 0', field: 'baffles' },
    { garment: 'puffer = "navy"\nbaffles = 2.5', field: 'baffles' },
    { garment: 'chain = "brass"\ndrop = 3', field: 'drop' },
  ]
  for (const c of cases)
    it(`refuses ${c.garment.replace('\n', ', ')} at the field`, async () => {
      const diagnostics = await diagnosticsAfter(file, top, c.garment)
      const text = fixtureText(file).replace(top, c.garment)
      const line = c.garment.split('\n')[1] ?? ''
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          file,
          line: where(text, line).line,
          keyPath: `outfits.shirtsleeves.0.${c.field}`,
        }),
      )
    })
})

describe('a hair garment with no style wears hairPieces (M3.5b decision 6)', () => {
  const file = 'content/figures/keeper.toml'
  it("compiles when the figure has hair pieces, and keeps the garment's colour", async () => {
    const text = fixtureText(file)
      .replace('style = "cropped"\n', '')
      .replace('stand = "hand-in-jacket-pocket"', 'stand = "hand-in-jacket-pocket"\nhairPieces = ["cropped"]')
    const result = await compileFixture({ [file]: text })
    if (!result.ok) throw new Error(result.message)
  })
  it('is refused at the garment when the figure has none', async () => {
    const diagnostics = await diagnosticsAfter(file, 'style = "cropped"\n', '')
    const text = fixtureText(file).replace('style = "cropped"\n', '')
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        file,
        line: where(text, 'hair = "steel-grey"').line,
        keyPath: 'outfits.lamplighter.5.hair',
        message: expect.stringContaining('hairPieces'),
      }),
    )
  })
})

describe("the fixture's default rig", () => {
  it('says what DEFAULT_RIG_LIMITS says', async () => {
    const result = await compileFixture()
    if (!result.ok) throw new Error(result.message)
    const rigs = result.content.data['figure-rig'] as Record<string, unknown>
    expect(rigs.default).toEqual({ ...DEFAULT_RIG_LIMITS, about: expect.any(String) })
  })
})
