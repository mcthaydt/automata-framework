import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { projectContentSchema } from '#src/shared/level-2d/content.schema.ts'

const PROJECT = fileURLToPath(new URL('./fixtures/room/content/project.toml', import.meta.url))
const base = parse(readFileSync(PROJECT, 'utf8')) as { entities: Record<string, unknown>[] }

const HERO = `
[entities.animation]
image = "assets/hero.png"
frame = { w = 16, h = 24 }
[[entities.animation.clips]]
id = "idle"
frames = [0, 1]
fps = 4
loop = true
[[entities.animation.clips]]
id = "run"
frames = [2, 3, 4, 5]
fps = 10
loop = true
`

/** The room's project with `animation` on its player start. */
function withAnimation(animation: unknown) {
  const [first, ...rest] = base.entities
  return {
    ...base,
    entities: [...rest, { ...first, id: 'hero', ...(animation === undefined ? {} : { animation }) }],
  }
}
const animationOf = (toml: string) =>
  (parse(`[entities]\n${toml}`).entities as { animation: unknown }).animation

describe('a character’s animation in the content export', () => {
  it('reads the spec’s example: a picture cut into frames and named clips', () => {
    const parsed = projectContentSchema.parse(withAnimation(animationOf(HERO)))
    const hero = parsed.entities.find((def) => def.id === 'hero')
    expect(hero?.animation?.image).toBe('assets/hero.png')
    expect(hero?.animation?.frame).toEqual({ w: 16, h: 24 })
    expect(hero?.animation?.clips.map((clip) => clip.id)).toEqual(['idle', 'run'])
  })

  it('reads a project with no animation as it always did', () => {
    const parsed = projectContentSchema.parse(base)
    expect(parsed.entities.every((def) => def.animation === undefined)).toBe(true)
  })

  it('refuses two clips with one name, in a sentence', () => {
    const doubled = { image: 'a.png', frame: { w: 8, h: 8 }, clips: [clip('run'), clip('run')] }
    const result = projectContentSchema.safeParse(withAnimation(doubled))
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Two clips are called "run".'])
  })

  it('refuses a clip that runs at no frames a second, or more than 60', () => {
    for (const fps of [0, 61])
      expect(() =>
        projectContentSchema.parse(
          withAnimation({ image: 'a.png', frame: { w: 8, h: 8 }, clips: [{ ...clip('run'), fps }] }),
        ),
      ).toThrow()
  })

  it('refuses an animation with no clip, and a clip with no frame', () => {
    expect(() =>
      projectContentSchema.parse(withAnimation({ image: 'a.png', frame: { w: 8, h: 8 }, clips: [] })),
    ).toThrow()
    expect(() =>
      projectContentSchema.parse(
        withAnimation({ image: 'a.png', frame: { w: 8, h: 8 }, clips: [{ ...clip('run'), frames: [] }] }),
      ),
    ).toThrow()
  })
})

function clip(id: string) {
  return { id, frames: [0], fps: 8, loop: true }
}
