// Where the world kit's passes run on `@pixi/3d` 0.1.0-beta.3, which stages post effects: before tone mapping (linear light, the
// default) or after it (the picture as shown). The question for each is what it does:
// - light added to a scene is before: a bloom of what is brighter than white, a lamp's glow as light. None of the kit's is that.
// - a thing drawn on the picture is after, and so is anything that reads the picture's colours.
// Every pass here reads DUEL colours the snap has already chosen (the glow finds the lamps' step colours and moves each a step up
// its own ramp; the shafts, rain, stars, particles and reflections step a pixel up its ramp or draw palette colours over it),
// so they are all on the picture, after tone mapping.
import { describe, expect, it } from 'vitest'
import { GlowEffect } from '#src/features/sky/glow-effect.ts'
import { ParticlesEffect } from '#src/features/sky/particles-effect.ts'
import { RainEffect } from '#src/features/sky/rain-effect.ts'
import { ReflectEffect } from '#src/features/sky/reflect-effect.ts'
import { ShaftsEffect } from '#src/features/sky/shafts-effect.ts'
import { StarsEffect } from '#src/features/sky/stars-effect.ts'

const kit = {
  glow: new GlowEffect(),
  rain: new RainEffect(0.5, [0.5, 0.8, 1]),
  stars: new StarsEffect(1),
  shafts: new ShaftsEffect(),
  reflect: new ReflectEffect(),
  particles: new ParticlesEffect(),
}

describe('the world kit’s passes run after tone mapping', () => {
  for (const [name, pass] of Object.entries(kit))
    it(`the ${name} pass reads the picture as shown`, () => {
      expect(pass.stage).toBe('afterToneMapping')
    })

  it('keeps the stage when the stars are turned off', () => {
    expect(new StarsEffect(0, { enabled: false }).stage).toBe('afterToneMapping')
  })
})
