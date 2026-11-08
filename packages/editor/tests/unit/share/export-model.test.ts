import { describe, expect, it } from 'vitest'
import { exportState, exportTargets, sizeLabel } from '#src/features/share/export-model.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { levelProject } from '#src/shared/level-2d/profiles/level-project/level-project.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import type { Profile } from '#src/shared/level-2d/profiles/profile.ts'

const profile = levelProject as Profile<unknown>
const project = (name = 'Rooftops'): Project => ({ ...platformerTemplate.create(counterIds()), name })
const bytes = (text: string): number => new TextEncoder().encode(text).length

describe('exportTargets', () => {
  it("lists the profile's targets with each file's UTF-8 size and the target's total", () => {
    const targets = exportTargets(profile, project('Café'), '')
    expect(targets.map((target) => target.id)).toEqual(['af2d-json', 'af-content'])
    const [working, content] = targets
    expect(working?.files.map((file) => file.path)).toEqual([expect.stringMatching(/\.af2d\.json$/)])
    for (const file of [...(working?.files ?? []), ...(content?.files ?? [])])
      expect(file.bytes).toBe(bytes(file.contents))
    expect(content?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['project.toml', 'world.toml', expect.stringMatching(/^levels\/.+\.toml$/)]),
    )
    expect(content?.bytes).toBe(content?.files.reduce((sum, file) => sum + file.bytes, 0))
    // A name with a non-ASCII letter counts its bytes, not its characters.
    expect(working?.files[0]?.contents).toContain('Café')
    expect(working?.files[0]?.bytes).toBeGreaterThan(working?.files[0]?.contents.length ?? 0)
  })
})

describe('sizeLabel', () => {
  it('says bytes under a kilobyte, then KB and MB to one decimal', () => {
    expect(sizeLabel(0)).toBe('0 B')
    expect(sizeLabel(1023)).toBe('1023 B')
    expect(sizeLabel(1024)).toBe('1.0 KB')
    expect(sizeLabel(2150)).toBe('2.1 KB')
    expect(sizeLabel(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })
})

describe('exportState', () => {
  const targets = exportTargets(profile, project(), '')
  const all = new Set(['af2d-json', 'af-content'])
  const folder = { kind: 'folder', persistent: true } as const
  const device = { kind: 'opfs', persistent: true } as const

  it('chooses the files of the chosen targets, with their total size', () => {
    const state = exportState(targets, all, 0, device)
    expect(state.files.length).toBe((targets[0]?.files.length ?? 0) + (targets[1]?.files.length ?? 0))
    expect(state.bytes).toBe((targets[0]?.bytes ?? 0) + (targets[1]?.bytes ?? 0))
    expect(state.download).toBe(true)
    expect(state.single).toBeUndefined()
  })

  it('offers Share and Copy only for exactly one file', () => {
    const state = exportState(targets, new Set(['af2d-json']), 0, device)
    expect(state.single?.path).toBe(targets[0]?.files[0]?.path)
    const none = exportState(targets, new Set(), 0, device)
    expect(none.download).toBe(false)
    expect(none.single).toBeUndefined()
  })

  it('writes into a folder only with zero errors, and says why not otherwise (ED2D-D12)', () => {
    expect(exportState(targets, all, 0, folder).write).toEqual({ ok: true })
    expect(exportState(targets, all, 2, folder).write).toEqual({
      ok: false,
      why: 'Fix the 2 errors in Checks first.',
    })
    expect(exportState(targets, all, 1, folder).write).toEqual({
      ok: false,
      why: 'Fix the 1 error in Checks first.',
    })
    expect(exportState(targets, all, 0, device).write).toEqual({
      ok: false,
      why: 'Open a game folder to write into it.',
    })
    // Errors never stop a download.
    expect(exportState(targets, all, 2, folder).download).toBe(true)
  })

  it('offers Write to folder everywhere except where Save already writes the game files', () => {
    expect(exportState(targets, all, 0, device).offersWrite).toBe(true)
    expect(exportState(targets, all, 0, { kind: 'http', persistent: true }).offersWrite).toBe(true)
    const saves = { kind: 'http', persistent: true, savesGame: true } as const
    expect(exportState(targets, all, 0, saves).offersWrite).toBe(false)
    expect(exportState(targets, all, 0, saves).download).toBe(true)
  })
})
