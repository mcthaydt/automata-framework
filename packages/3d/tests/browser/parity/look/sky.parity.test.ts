// The look's sky, stars and rain on a real WebGL2 context. WebGPU parity is the GPU runner's: Chromium here has no adapter.
import '#src/entries/no-eval.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { GlowEffect } from '#src/features/look/passes/glow-effect.ts'
import { RainEffect } from '#src/features/look/passes/rain-effect.ts'
import { SkyEffect } from '#src/features/look/passes/sky-effect.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'
import { colourAt, DUEL, drawn, passOf, SIZE, type SkyScene, shot, startSky } from './sky-support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

async function start(scene: SkyScene = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const made = await startSky(host, scene)
  open = made
  return made.renderer
}

/** One frame of a scene with the glow off, its renderer closed again. */
async function dark(scene: SkyScene): Promise<Uint8Array> {
  const renderer = await start(scene)
  passOf(renderer, GlowEffect).enabled = false
  const px = shot(renderer)
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
  return px
}

const RAIN = { density: 1, colour: '#88d6ff' }
const rainy = timeOfDay('night', { scene: { rain: RAIN } })
const row = (px: Uint8Array, y: number): number[] =>
  Array.from({ length: SIZE.width }, (_, x) => colourAt(px, y * SIZE.width + x))

describe.runIf(hasWebGL2)('the look’s sky on WebGL2', () => {
  it('puts the sky after core’s snap, then the glow, and the rain only when the time has some', async () => {
    const dry = await start()
    expect(dry.view.passes.map((p) => p.constructor.name)).toEqual([
      'CellCompositePass',
      'DuelSnapEffect',
      'SkyEffect',
      'GlowEffect',
      'ShaftsEffect',
      'FinishEffect',
    ])
    open?.dispose()
    const wet = await start({ time: rainy })
    expect(wet.view.passes.map((p) => p.constructor.name)).toContain('RainEffect')
  })

  it('shows the time’s bands where nothing is drawn: DUEL colours, the top band above the horizon band', async () => {
    const renderer = await start({ time: timeOfDay('dusk') })
    passOf(renderer, GlowEffect).enabled = false
    const px = shot(renderer)
    // The letterbox's bar takes the first rows, so the sky's top is the first row past it.
    const top = row(px, 8)
    const near = row(px, Math.floor(SIZE.height / 2) - 2)
    expect(top.every((c) => DUEL.has(c))).toBe(true)
    expect(near.every((c) => DUEL.has(c))).toBe(true)
    expect(new Set(top).size).toBeLessThan(5)
    expect(top[0]).not.toBe(near[0])
  })

  it('stands a city on the horizon that turns with the camera', async () => {
    const dusk = timeOfDay('dusk')
    const horizon = [{ kind: 'city', colour: '#2b2b45', height: 0.2, seed: 3 }] as const
    const bare = await dark({ time: dusk })
    const renderer = await start({ time: dusk, horizon })
    passOf(renderer, GlowEffect).enabled = false
    const withCity = shot(renderer)
    // The camera looks level, so the horizon is the middle row: the silhouette stands above it and nowhere far from it.
    const middle = Math.floor(SIZE.height / 2)
    const city = drawn(bare, withCity)
    expect(city.filter((i) => Math.floor(i / SIZE.width) < middle).length).toBeGreaterThan(SIZE.width)
    expect(city.every((i) => Math.floor(i / SIZE.width) >= middle - 25)).toBe(true)
    passOf(renderer, SkyEffect).aim(0.5, 0)
    expect(drawn(withCity, shot(renderer)).length).toBeGreaterThan(SIZE.width / 2)
  })

  it('shows stars only on the sky, above the horizon, in DUEL colours', async () => {
    const starless = await dark({ time: timeOfDay('night', { scene: { stars: 0 } }) })
    const night = await dark({})
    const stars = drawn(starless, night)
    expect(stars.length).toBeGreaterThan(5)
    expect(stars.every((i) => DUEL.has(colourAt(night, i)))).toBe(true)
    expect(stars.every((i) => Math.floor(i / SIZE.width) < SIZE.height / 2)).toBe(true)
  })

  it('holds the stars’ places as the camera turns: the same sky comes back, a turn moves it', async () => {
    const renderer = await start()
    passOf(renderer, GlowEffect).enabled = false
    const sky = passOf(renderer, SkyEffect)
    const before = shot(renderer)
    sky.aim(0.4, 0)
    const turned = shot(renderer)
    sky.aim(0, 0)
    expect(drawn(before, turned).length).toBeGreaterThan(5)
    expect(drawn(before, shot(renderer))).toEqual([])
  })

  it('draws a star only where the sky shows: a wall in front keeps the sky behind it out', async () => {
    const open1 = await start({ near: true })
    passOf(open1, GlowEffect).enabled = false
    const walled = shot(open1)
    // The wall fills the view, so the picture holds no sky colour from the time's top band and no star.
    expect(new Set(row(walled, 5)).size).toBeLessThanOrEqual(2)
  })

  it('has rain fall in the open, a streak at a time, moving with the clock, and not through a nearer wall', async () => {
    const renderer = await start({ time: rainy })
    passOf(renderer, GlowEffect).enabled = false
    const rain = passOf(renderer, RainEffect)
    rain.enabled = false
    const dry = shot(renderer)
    rain.enabled = true
    const a = shot(renderer)
    rain.clock = 0.4
    const b = shot(renderer)
    expect(drawn(dry, a).length).toBeGreaterThan(10)
    expect(drawn(a, b).length).toBeGreaterThan(10)
    expect(drawn(dry, b).every((i) => DUEL.has(colourAt(b, i)))).toBe(true)
    open?.dispose()
    const walled = await start({ time: rainy, near: true })
    passOf(walled, GlowEffect).enabled = false
    const wall = passOf(walled, RainEffect)
    wall.enabled = false
    const dryWall = shot(walled)
    wall.enabled = true
    expect(drawn(dryWall, shot(walled)).length).toBe(0)
  })
})
