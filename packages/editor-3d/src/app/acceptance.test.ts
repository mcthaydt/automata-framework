// The 3D editor's acceptance cases that run headless (plan ED3D.12; ED3D spec §13), end to end through the app's own door
// (open, edit, Save) over a memory workspace: ED3-a (the shipped blockouts save byte-identical), ED3-b (one number's span),
// ED3-l (the clinic's sector plan rebuilt from an empty level). The cases that other suites already prove at their own
// layer are listed in `docs/evidence/ed3d-acceptance/2026-10-31.md`, generated from `acceptance-index.ts`.
import { describe, expect, it } from 'vitest'
import { createLevelEditor } from '../model/level-editor'
import { addSector, setHeights } from '../model/sector-edits'
import { lastLightProfile } from '../profile/last-light-profile'
import { FIXTURE_NAMES, loadFixture } from '../testing/fixtures'
import { createTestClock, memoryWorkspace, textOf } from '../testing/memory-workspace'
import { createEditorApp } from './editor-app'

const BLOCKOUTS = FIXTURE_NAMES.filter((name) => name !== 'facility')

async function opened(name: (typeof FIXTURE_NAMES)[number], text: string) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const path = `art/${name}/blockout.json`
  await workspace.store.write(path, text)
  clock.advance(1000)
  const app = createEditorApp({ workspace, clock })
  const outcome = await app.open(path)
  if (outcome.status !== 'opened') throw new Error(`${name} did not open: ${outcome.status}`)
  return { workspace, path, level: outcome.level, clock }
}

describe('ED3-a: each shipped blockout, changed nothing, saves byte-identical', () => {
  it.each(BLOCKOUTS)('%s', async (name) => {
    const text = loadFixture(name)
    const { workspace, path, level } = await opened(name, text)
    const saved = await level.document.save()
    expect(saved.status === 'saved' || saved.status === 'unchanged' || saved.status === 'clean').toBe(true)
    expect(textOf(await workspace.store.read(path))).toBe(text)
  })
})

describe('ED3-b: the hall’s ceiling from 4.9 to 5.1 changes exactly that number’s span, and undo restores the text', () => {
  it('differs from the original only where the number is', async () => {
    const text = loadFixture('blockout-clinic')
    const { workspace, path, level } = await opened('blockout-clinic', text)
    const result = level.editor.run(setHeights({ id: 'hall', ceiling: 5.1 }))
    expect(result.ok).toBe(true)
    await level.document.save()
    const after = textOf(await workspace.store.read(path))
    const start = [...text].findIndex((char, index) => char !== after[index])
    const endBefore =
      text.length - [...text].reverse().findIndex((char, index) => char !== after[after.length - 1 - index])
    expect(text.slice(start, endBefore)).toBe('4.9')
    expect(after.slice(start, after.length - (text.length - endBefore))).toBe('5.1')
    level.editor.history.undo()
    await level.document.save()
    expect(textOf(await workspace.store.read(path))).toBe(text)
  })
})

describe('ED3-l: the clinic’s sector plan rebuilt from an empty level equals the shipped one', () => {
  // The hall has a hole (the counter's footprint), which no editor edit draws: a sector with a hole comes from a file. So
  // the rebuild is of every sector without one, in the shipped order, and it is compared as ids, corners and heights.
  const parsed = lastLightProfile.parse(loadFixture('blockout-clinic'))
  if (!parsed.ok) throw new Error('the clinic does not parse')
  const shipped = lastLightProfile.sectors.list(parsed.value)
  const drawable = shipped.filter((sector) => sector.holes === undefined)

  const shape = (sectors: readonly (typeof shipped)[number][]) =>
    sectors.map((sector) => ({
      id: sector.id,
      floor: sector.floor,
      ceiling: sector.ceiling,
      corners: sector.corners.map(([x, z]) => [x, z]),
    }))

  it('draws every sector that has no hole and gets the same ids, corners and heights', () => {
    const empty = lastLightProfile.sectors.withSectors(parsed.value, [])
    const editor = createLevelEditor({ profile: lastLightProfile, level: empty })
    for (const sector of drawable) {
      const added = editor.run(
        addSector({
          id: sector.id,
          corners: sector.corners.map(([x, z]) => [x, z] as const),
          floor: sector.floor,
          ceiling: sector.ceiling,
          light: sector.light,
        }),
      )
      expect(added.ok, `${sector.id}: ${added.ok ? '' : added.reason}`).toBe(true)
    }
    expect(drawable.length).toBe(shipped.length - 1)
    expect(shape(lastLightProfile.sectors.list(editor.level))).toEqual(shape(drawable))
  })
})
