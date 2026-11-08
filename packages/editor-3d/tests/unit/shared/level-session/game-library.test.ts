import { describe, expect, it } from 'vitest'
import { EMPTY_LIBRARY, readGameLibrary, worldLibrary } from '#src/shared/level-session/game-library.ts'
import { base3dWorkspace, emptyWorkspace, filesWorkspace } from '#src/testing/game-files.ts'

// The game's furniture, materials and characters, read through the suite workspace and never written (Levels 3D spec §7).

describe('readGameLibrary', () => {
  it("reads base-3d's furniture and swatches by name", async () => {
    const library = await readGameLibrary('content/levels/room.af-sector.json', base3dWorkspace())
    expect(library.found).toBe(true)
    expect([...library.props.keys()]).toEqual(['barrel', 'crate'])
    expect([...library.swatches.keys()]).toContain('lava')
    expect(library.figures).toEqual(['wick'])
    expect(library.problems).toEqual([])
  })

  it("answers core's own library shape, so the editor and the game ask the same rules", async () => {
    const library = worldLibrary(
      await readGameLibrary('content/levels/room.af-sector.json', base3dWorkspace()),
    )
    expect(Object.keys(library.swatches)).toContain('crate')
    expect(library.props?.crate).toMatchObject({ kind: 'box' })
  })

  it('finds the content folder from the level, wherever the level sits in it', async () => {
    const files = { 'game/content/world-props/crate.toml': 'kind = "box"\n' }
    const library = await readGameLibrary('game/content/levels/hall.af-sector.json', filesWorkspace(files))
    expect([...library.props.keys()]).toEqual(['crate'])
  })

  it('is the empty library for a game with no library folders, a level outside levels/, or no listing', async () => {
    expect(await readGameLibrary('levels/toy.af-sector.json', emptyWorkspace())).toEqual(EMPTY_LIBRARY)
    expect(await readGameLibrary('somewhere/toy.json', base3dWorkspace())).toEqual(EMPTY_LIBRARY)
    const files = { 'content/world-props/crate.toml': 'kind = "box"\n' }
    expect(await readGameLibrary('content/levels/a.json', filesWorkspace(files, false))).toEqual(
      EMPTY_LIBRARY,
    )
  })

  it('leaves out a record that does not parse and names it', async () => {
    const files = {
      'content/world-swatches/good.toml': 'ramp = "rose"\nstep = 1\n',
      'content/world-swatches/bad.toml': 'ramp = "nonesuch"\nstep = 1\n',
      'content/world-props/broken.toml': 'kind = [\n',
    }
    const library = await readGameLibrary('content/levels/a.json', filesWorkspace(files))
    expect([...library.swatches.keys()]).toEqual(['good'])
    expect(library.props.size).toBe(0)
    expect(library.problems).toEqual([
      `The material "Bad" in the game isn't written the way a material is, so it was left out.`,
      `The furniture "Broken" in the game isn't written the way furniture is, so it was left out.`,
    ])
  })
})
