// The 3D editor's acceptance cases that run headless (plan ED3D.12; ED3D spec §13), end to end through the app's own door
// (open, edit, Save) over a memory workspace: ED3-a (the shipped depot saves byte-identical), ED3-b (one number's span),
// ED3-l (the depot's sector plan rebuilt from an empty level). The cases that other suites already prove at their own
// layer are listed in `docs/evidence/ed3d-acceptance/2026-10-31.md`, generated from `acceptance-index.ts`.
import { describe, expect, it } from 'vitest'
import { createLevelEditor } from '../model/level-editor'
import { addSector, setHeights } from '../model/sector-edits'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { createTestClock, memoryWorkspace, textOf } from '../testing/memory-workspace'
import { createEditorApp } from './editor-app'

const DEPOT = 'depot.af-sector'
const PATH = 'art/depot/depot.json'

async function opened(text: string) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  await workspace.store.write(PATH, text)
  clock.advance(1000)
  const app = createEditorApp({ workspace, clock })
  const outcome = await app.open(PATH)
  if (outcome.status !== 'opened') throw new Error(`the depot did not open: ${outcome.status}`)
  return { workspace, path: PATH, level: outcome.level, clock }
}

describe('ED3-a: the shipped depot, changed nothing, saves byte-identical', () => {
  it('writes back the text it read', async () => {
    const text = loadAuthored(DEPOT)
    const { workspace, path, level } = await opened(text)
    const saved = await level.document.save()
    expect(['conflict', 'failed', 'refused']).not.toContain(saved.status)
    expect(textOf(await workspace.store.read(path))).toBe(text)
  })
})

describe('ED3-b: the hall’s ceiling from 4 to 5.1 changes exactly that number’s span, and undo restores the text', () => {
  it('differs from the original only where the number is', async () => {
    const text = loadAuthored(DEPOT)
    const { workspace, path, level } = await opened(text)
    const result = level.editor.run(setHeights({ id: 'hall', ceiling: 5.1 }))
    expect(result.ok).toBe(true)
    await level.document.save()
    const after = textOf(await workspace.store.read(path)) ?? ''
    const start = [...text].findIndex((char, index) => char !== after[index])
    const endBefore =
      text.length - [...text].reverse().findIndex((char, index) => char !== after[after.length - 1 - index])
    expect(text.slice(start, endBefore)).toBe('4')
    expect(after.slice(start, after.length - (text.length - endBefore))).toBe('5.1')
    level.editor.history.undo()
    await level.document.save()
    expect(textOf(await workspace.store.read(path))).toBe(text)
  })
})

describe('ED3-l: the depot’s sector plan rebuilt from an empty level equals the shipped one', () => {
  const parsed = afSectorProfile.parse(loadAuthored(DEPOT))
  if (!parsed.ok) throw new Error('the depot does not parse')
  const shipped = afSectorProfile.sectors.list(parsed.value)

  const shape = (sectors: readonly (typeof shipped)[number][]) =>
    sectors.map((sector) => ({
      id: sector.id,
      floor: sector.floor,
      ceiling: sector.ceiling,
      corners: sector.corners.map(([x, z]) => [x, z]),
    }))

  it('draws every sector and gets the same ids, corners and heights', () => {
    const empty = afSectorProfile.sectors.withSectors(parsed.value, [])
    const editor = createLevelEditor({ profile: afSectorProfile, level: empty })
    for (const sector of shipped) {
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
    expect(shape(afSectorProfile.sectors.list(editor.level))).toEqual(shape(shipped))
  })
})
