// @vitest-environment jsdom
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'

// A new game's first place is written to a file named after the game's level, so the game finds it by the same name.
async function openIn(files: Record<string, string>) {
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({
      path,
      editor: path.startsWith('content/levels/')
        ? path.endsWith('.af-sector.json')
          ? 'levels-3d'
          : 'levels-2d'
        : 'schematic',
      gates: [],
      checks: [],
      modes: ['edit'],
      writable: true,
    }),
    changeSet: false,
  })
  return createSchematic().open(await ports.workspace.files('schematic'), ports)
}

describe('the first scene of a game with none', () => {
  it('is named after its 2D level', async () => {
    const session = await openIn({ 'content/levels/hall.af2d.json': '{}' })
    expect(session.scene).toBe('hall')
    expect(session.files.nav.path).toBe('content/nav/hall.toml')
  })

  it('is named after its 3D level', async () => {
    const session = await openIn({ 'content/levels/clinic.af-sector.json': '{}' })
    expect(session.scene).toBe('clinic')
  })

  it('is main when the game has no level, or several to choose between', async () => {
    expect((await openIn({})).scene).toBe('main')
    const two = await openIn({ 'content/levels/a.af2d.json': '{}', 'content/levels/b.af2d.json': '{}' })
    expect(two.scene).toBe('main')
  })

  it('does not change a game that already has scene files', async () => {
    const session = await openIn({
      'content/levels/hall.af2d.json': '{}',
      'content/systems/guard.toml': 'scene = "guard"\n',
    })
    expect(session.scene).toBe('guard')
  })
})
