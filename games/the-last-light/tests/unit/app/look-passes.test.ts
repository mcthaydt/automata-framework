import { registeredLookPasses } from '@automata/3d'
import { LCD_CLINIC } from '@automata/lcd-panel'
import { CRISP_CLINIC, RETRO_CLINIC } from '@automata/retro-crisp'
import { describe, expect, it } from 'vitest'
import { lookPassesOf, RENDERER_SCALE } from '#src/app/look-passes.ts'
import { lookProfilesSchema } from '#src/app/look-profiles.content.ts'

// The old game's own picture: its LCD panel and its retro grade (`src/render/lcd-panel.ts`, `retro-filter.ts` at 92e6704), added once
// before the renderer is made, on in play and in cutscenes, the film holding still for a player who asked for less motion. The numbers
// are the old game's (the extensions' defaults); `content/look.toml` holds the keys the game changes.

describe('the profiles', () => {
  it('are the old game’s numbers when the file changes none of them', () => {
    const profiles = lookProfilesSchema.parse({})
    expect(profiles.lcd).toEqual(LCD_CLINIC)
    expect(profiles.retro).toEqual(RETRO_CLINIC)
  })

  it('refuse a setting out of range, naming it', () => {
    expect(() => lookProfilesSchema.parse({ lcd: { grid: 2 } })).toThrow(/grid/)
    expect(() => lookProfilesSchema.parse({ retro: { vignette: 3 } })).toThrow(/vignette/)
  })

  it('are in the committed file, which is the old game’s', async () => {
    const toml = await import('smol-toml').then((m) => m.parse)
    const { readFileSync } = await import('node:fs')
    const file = toml(readFileSync(new URL('../../../content/look.toml', import.meta.url), 'utf8'))
    expect(lookProfilesSchema.parse(file)).toEqual(lookProfilesSchema.parse({}))
  })
})

describe('the passes', () => {
  it('are added once, before the renderer is made: the grade ahead of the snap, the panel after it', () => {
    const made = lookPassesOf(lookProfilesSchema.parse({}), { reducedMotion: () => false })
    const names = registeredLookPasses().map((pass) => pass.name)
    expect(names).toContain('retro')
    expect(names).toContain('lcd-panel')
    expect(registeredLookPasses().find((pass) => pass.name === 'retro')?.beforeSnap).toBe(true)
    expect(registeredLookPasses().find((pass) => pass.name === 'lcd-panel')?.beforeSnap).toBeFalsy()
    // Neither starts off: the picture is the old game's in play and in a cutscene.
    expect(made.retro.passes).toEqual([])
    expect(made.lcd.passes).toEqual([])
  })

  it('draw the picture at whole pixels, as the old game’s was', () => {
    expect(RENDERER_SCALE).toEqual({ scale: 'whole' })
    expect(CRISP_CLINIC.scale).toBeDefined()
  })
})
