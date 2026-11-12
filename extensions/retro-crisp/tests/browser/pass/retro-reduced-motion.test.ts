// The film's grain, dust and scratch hold still while the player has asked for less movement: the pass's clock, driven by Pixi's
// shared ticker, stands where it was while the setting is on and goes on when it is off. The setting is the game's to read each frame.
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK } from '@automata/3d'
import { Ticker } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { addRetroPass } from '#src/app/add-retro.ts'
import { SKY, target } from './support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

describe.runIf(hasWebGL2)('the retro pass under reduced motion', () => {
  it('its clock stands still while the setting is on, and runs again when it is off', async () => {
    let reduced = true
    const retro = addRetroPass({ reducedMotion: () => reduced })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const made = await createPixi3dRenderer({
      logicalWidth: 160,
      logicalHeight: 90,
      backgroundColor: SKY,
      views: {},
      look: DEFAULT_LOOK,
    })(target(host))
    if (!made.ok) throw made.reason
    open = made.value
    const pass = retro.passes[0]
    if (pass === undefined) throw new Error('the renderer made no retro pass')
    const held = pass.clock
    // Pixi's shared ticker clamps a frame to 100 ms, so each update here is one such frame.
    let now = performance.now() + 1000
    const frames = (): void => {
      for (let i = 0; i < 5; i++) {
        now += 100
        Ticker.shared.update(now)
      }
    }
    frames()
    expect(pass.clock).toBe(held)
    reduced = false
    frames()
    expect(pass.clock).toBeGreaterThan(held + 0.2)
  })
})
