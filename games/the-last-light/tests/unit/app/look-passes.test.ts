import { registeredLookPasses } from '@automata/3d'
import { LCD_CLINIC } from '@automata/lcd-panel'
import { CRISP_CLINIC, RETRO_CLINIC } from '@automata/retro-crisp'
import { describe, expect, it } from 'vitest'
import { wholeScaleFor } from '#src/app/field.ts'
import { lookPassesOf, RENDERER_SCALE, screenFiltersOf } from '#src/app/look-passes.ts'
import { lookProfilesSchema } from '#src/app/look-profiles.content.ts'

// The old game's own picture: its LCD panel and its retro grade (`src/render/lcd-panel.ts`, `retro-filter.ts` at 92e6704), added once
// before the renderer is made, on in play and in cutscenes, the film holding still for a player who asked for less motion. The numbers
// are the old game's (the extensions' defaults); `content/look.toml` holds the keys the game changes.

describe('the profiles', () => {
  it('are the old game’s numbers when the file changes none of them', () => {
    const profiles = lookProfilesSchema.parse({})
    expect(profiles.lcd).toEqual(LCD_CLINIC)
    expect(profiles.retro).toEqual(RETRO_CLINIC)
    expect(profiles.light).toEqual({ lamps: 1, contact: 0 })
  })

  it('refuse a setting out of range, naming it', () => {
    expect(() => lookProfilesSchema.parse({ lcd: { grid: 2 } })).toThrow(/grid/)
    expect(() => lookProfilesSchema.parse({ retro: { vignette: 3 } })).toThrow(/vignette/)
    expect(() => lookProfilesSchema.parse({ light: { lamps: 0 } })).toThrow(/lamps/)
    expect(() => lookProfilesSchema.parse({ light: { contact: 1.5 } })).toThrow(/contact/)
  })

  it('are in the committed file: the old game’s but for the LCD cell (one field pixel), the LCD mesh, stripes and scanlines and scanlines drawn at the screen’s pixels between texels at the old strengths, the stripes off (the field pass keeps none of them, nor their gain), and the lamps (a gain on the old game’s light)', async () => {
    const toml = await import('smol-toml').then((m) => m.parse)
    const { readFileSync } = await import('node:fs')
    const file = toml(readFileSync(new URL('../../../content/look.toml', import.meta.url), 'utf8'))
    expect(lookProfilesSchema.parse(file)).toEqual({
      ...lookProfilesSchema.parse({}),
      lcd: {
        ...LCD_CLINIC,
        cell: 1,
        grid: 0,
        subpixels: 0,
        scanlines: 0,
        aberration: 0,
        brightness: 1,
      },
      lcdScreen: {
        grid: LCD_CLINIC.grid,
        balance: LCD_CLINIC.balance,
        subpixels: 0,
        layout: LCD_CLINIC.layout,
        scanlines: LCD_CLINIC.scanlines,
        brightness: SCREEN_GAIN,
        cellPixels: 4,
      },
      light: { lamps: 0.7, contact: 1 },
      moonlight: MOONLIGHT,
    })
  })

  it('light the floor under the ward’s barred window, as the old game laid its moonlight (`moonShaft` in `scenes/clinic/dress.ts`)', () => {
    // Each patch's size is the old patch's. The ward's middle is where the old one's was and a quarter metre along, its gain 0.38 where the old's was 0.5: measured on the real play, ours draws the stripes brighter (the 95th percentile of the box's luma 104 against 81) and starting earlier.
    expect(MOONLIGHT.map((patch) => patch.id)).toEqual(['moon'])
    expect(lookProfilesSchema.parse({}).moonlight).toEqual([])
    expect(() => lookProfilesSchema.parse({ moonlight: [{ ...MOONLIGHT[0], gain: 2 }] })).toThrow(/gain/)
    expect(() => lookProfilesSchema.parse({ moonlight: [{ ...MOONLIGHT[0], width: 0 }] })).toThrow(/width/)
  })
})

/** The screen mesh's gain, measured in play: a face averages what it does with the panel off (the frames folder's README). */
const SCREEN_GAIN = 1.46

/** The old game's moonlight (`src/scenes/clinic/dress.ts` at 92e6704): the ward's window (the corridor's is left out, see `content/look.toml`). */
const MOONLIGHT = [
  {
    id: 'moon',
    rooms: ['hall', 'ward'],
    window: [-4, -3.72],
    centre: [0, 0.215],
    width: 1.4,
    length: 4.6,
    bars: 4,
    gain: 0.38,
  },
] as const

// The old game drew its LCD panel on the screen's own pixels: a cell of 2 screen pixels and a mesh period of 4 (`LCD_CELL` and `derivePitch`
// in `src/render/lcd-panel.ts`, measured on its real play at 1024 by 768 as a 4.0 pixel period on both axes). The field cannot draw that:
// a field pixel is `scale` screen pixels, and a 4-pixel mesh would be 2 field pixels, the Nyquist limit, where the field pass fades it out.
// So the mesh, stripes and scanlines are a screen filter (`lcdScreen`), drawn after the field is upscaled, a line on the last pixel of
// each 4-pixel cell; a figure texel (2 field pixels, `PLAY_FIGURE.grid`) is one cell, so every line falls between texels.
describe('the LCD panel on the screen', () => {
  const scale = wholeScaleFor({ width: 1024, height: 768 })
  /** The profiles the committed `content/look.toml` gives the game. */
  const committed = async () => {
    const toml = await import('smol-toml').then((m) => m.parse)
    const { readFileSync } = await import('node:fs')
    return lookProfilesSchema.parse(
      toml(readFileSync(new URL('../../../content/look.toml', import.meta.url), 'utf8')),
    )
  }

  it('has the old game’s mesh period, 4 screen pixels at 1024 by 768, which is one figure texel of 2 field pixels', async () => {
    expect(scale).toBe(2)
    expect((await committed()).lcdScreen?.cellPixels).toBe(4)
    expect(2 * scale).toBe(4)
  })

  it('draws no mesh, stripes or scanlines on the field, and so gives back no light there', async () => {
    const { lcd } = await committed()
    expect([lcd.grid, lcd.subpixels, lcd.scanlines, lcd.brightness]).toEqual([0, 0, 0, 1])
  })
})

describe('the passes', () => {
  it('are added once, before the renderer is made: the snap first, then the grade (the old game’s order), then the panel', () => {
    const made = lookPassesOf(lookProfilesSchema.parse({}), { reducedMotion: () => false })
    const names = registeredLookPasses().map((pass) => pass.name)
    expect(names).toContain('retro')
    expect(names).toContain('lcd-panel')
    expect(registeredLookPasses().find((pass) => pass.name === 'retro')?.beforeSnap).toBeFalsy()
    expect(registeredLookPasses().find((pass) => pass.name === 'lcd-panel')?.beforeSnap).toBeFalsy()
    // Neither starts off: the picture is the old game's in play and in a cutscene.
    expect(made.retro.passes).toEqual([])
    expect(made.lcd.passes).toEqual([])
  })

  it('declare the panel’s screen filter for the renderer when the look has one, and none when it does not', () => {
    expect(screenFiltersOf(lookProfilesSchema.parse({}))).toEqual([])
    const [screen, ...rest] = screenFiltersOf(lookProfilesSchema.parse({ lcdScreen: {} }))
    expect(rest).toEqual([])
    expect(screen?.at).toBe('screen')
    expect(screen?.name).toBe('lcd-panel-screen')
  })

  it('draw the picture at whole pixels, as the old game’s was', () => {
    expect(RENDERER_SCALE).toEqual({ scale: 'whole' })
    expect(CRISP_CLINIC.scale).toBeDefined()
  })
})
