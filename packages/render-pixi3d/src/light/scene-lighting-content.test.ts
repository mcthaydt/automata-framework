import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContent, type Diagnostic } from '@automataframework/automata-content'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { sceneLightingContent } from './scene-lighting.content.js'

const HALL = `ambient = 0.2

[fog]
near = 4
far = 12
color = 0x2e222f

[[lamps]]
id = "desk"
x = 0
y = 2.2
z = 0
color = 0xffd8a0
range = 4

[[lamps]]
id = "window"
x = 3
y = 2
z = -2
color = 0x8fd3ff
range = 5

[[planes]]
x = 0
y = 1.5
z = -3
normal = [0, 0, 1]
width = 8
height = 3
`

/** Compiles one lighting file, `content/lighting/hall.toml`, under the scene-lighting kind alone. */
async function compileHall(text: string) {
  const root = mkdtempSync(join(tmpdir(), 'scene-lighting-'))
  try {
    mkdirSync(join(root, 'content', 'lighting'), { recursive: true })
    writeFileSync(join(root, 'content', 'lighting', 'hall.toml'), text)
    return await Effect.runPromise(Effect.either(compileContent({ root, schemas: [sceneLightingContent] })))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const diagnosticsOf = (result: Awaited<ReturnType<typeof compileHall>>): readonly Diagnostic[] => {
  if (Either.isRight(result)) throw new Error('expected the compile to fail')
  return result.left._tag === 'ContentCompileFailed' ? result.left.diagnostics : []
}

describe('scene-lighting content', () => {
  it('is a presentation kind: a collection under content/lighting, kept out of the sim', () => {
    expect(sceneLightingContent).toMatchObject({
      kind: 'scene-lighting',
      place: { folder: 'lighting' },
      sim: false,
    })
  })

  it('compiles a room of lamps, a wall and fog with the defaults filled', async () => {
    const result = await compileHall(HALL)
    if (Either.isLeft(result)) throw new Error(String(result.left))
    const hall = (result.right.data['scene-lighting'] as Record<string, { lamps: { level: number }[] }>).hall
    expect(hall?.lamps.map((lamp) => lamp.level)).toEqual([1, 1])
  })

  it('reports a lamp with no range at its file, line and column', async () => {
    const text = HALL.replace('range = 5', 'range = 0')
    const diagnostics = diagnosticsOf(await compileHall(text))
    const line = text.split('\n').indexOf('range = 0') + 1
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        file: 'content/lighting/hall.toml',
        line,
        column: 1,
        keyPath: 'lamps.1.range',
      }),
    )
  })

  it('reports a duplicate lamp id at the second id', async () => {
    const text = HALL.replace('id = "window"', 'id = "desk"')
    const diagnostics = diagnosticsOf(await compileHall(text))
    const line = text.split('\n').lastIndexOf('id = "desk"') + 1
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ file: 'content/lighting/hall.toml', line, column: 1, keyPath: 'lamps.1.id' }),
    )
  })
})
