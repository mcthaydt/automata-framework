import { describe, expect, it } from 'vitest'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { contentMismatches } from '#src/testing/level-2d/content-roundtrip.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { hollowmere, mossgate } from '#src/testing/level-2d/samples.ts'

// ED2D.10 acceptance, headless half: the platformer and the RPG, built by the editor
// and kept as the samples Mossgate and Hollowmere, go through the one app on one registry: imported, opened, checked
// with zero errors, exported as AF content that validates, saved and opened again equal. The same code path opens both,
// which is G-s together with `architecture.test.ts` (no profile or template id in `app`, `tiles`, `canvas`). G-t is
// `definition-uses.test.ts` ("a project defined from blank"); the touch journeys are `src/journeys/`.

const CASES: [string, string, () => Project][] = [
  ['G-q', 'Mossgate', () => mossgate(counterIds())],
  ['G-r', 'Hollowmere', () => hollowmere(counterIds())],
]

describe.each(CASES)('%s: %s through the one editor app', (_id, name, make) => {
  it('opens, has zero errors, exports valid content, saves and re-opens equal', async () => {
    const clock = createTestClock()
    const app = createEditorApp({
      workspace: memoryWorkspace(clock),
      registry: createAppProfiles(),
      ids: counterIds(),
      clock,
    })
    const project = make()
    const text = printProject(project)
    const imported = await app.importFile(`${name}.af2d.json`, new TextEncoder().encode(text))
    if (imported.status !== 'imported') throw new Error(imported.status)

    const opened = await app.open(imported.path)
    if (opened.status !== 'opened') throw new Error(opened.status)
    const state = opened.document.history.state as Project
    expect(printProject(state)).toBe(text)
    expect(checkProject(state, {}).filter((finding) => finding.severity === 'error')).toEqual([])
    expect(contentMismatches(state)).toEqual([])

    expect(await opened.document.save()).toMatchObject({ status: 'saved' })
    opened.document.dispose()
    const again = await app.open(imported.path)
    if (again.status !== 'opened') throw new Error(again.status)
    expect(printProject(again.document.history.state as Project)).toBe(text)
    again.document.dispose()
  })
})
