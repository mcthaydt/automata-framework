// The acceptance index (plan ED3D.12; ED3D spec §13): each of ED3-a to ED3-s, the test files that prove it, and what is
// cut. The test checks that every named file exists and mentions the case, so the table cannot drift from the suites;
// `ED3D_ACCEPTANCE=1` writes `docs/evidence/ed3d-acceptance/<date>.md` from it. Whether the suites pass is the run's
// result (the PR's gate list), not this file's claim.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface Case {
  readonly id: string
  readonly what: string
  /** Test files under `packages/editor-3d/`, by layer. */
  readonly proofs: readonly string[]
  /** `cut`: the milestone that carried it is cut (M3.9a, ED3D.9c, ED3D.10b); `partial`: said why. */
  readonly status: 'covered' | 'partial' | 'cut'
  readonly note?: string
}

const CASES: readonly Case[] = [
  {
    id: 'ED3-a',
    what: 'The shipped depot level saves byte-identical',
    proofs: ['src/app/acceptance.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-b',
    what: 'One number’s span changes; undo restores the text',
    proofs: ['src/app/acceptance.test.ts', 'src/model/sector-edits.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-c',
    what: 'A rectangle against a wall is offered a portal; accepting adds both',
    proofs: ['src/ui/plan/draw-journeys.layout.test.ts', 'src/journeys/draw.journey.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-d',
    what: 'A polygon over a sector is refused, naming it',
    proofs: ['src/model/sector-edits.test.ts', 'src/ui/plan/draw-journeys.layout.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-e',
    what: 'One side of a portal made solid fails `openings`; undo clears it',
    proofs: ['src/model/wall-edits.test.ts', 'src/model/corner-edits.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-f',
    what: 'A wall made a window in Walk shows on Plan; one undo reverts both',
    proofs: [
      'src/app/walk-cases.test.ts',
      'src/ui/walk/WalkCanvas.dom.test.ts',
      'src/journeys/walk.journey.test.ts',
    ],
    status: 'covered',
  },
  {
    id: 'ED3-g',
    what: 'A palm while the Pencil draws is ignored',
    proofs: ['src/journeys/draw.journey.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-h',
    what: 'A turn mid-draw keeps the draft',
    proofs: ['src/journeys/draw.journey.test.ts'],
    status: 'partial',
    note: 'The journey proves the first corner and the tool survive; finishing the rectangle by pixel after the turn is left to the Owner’s device pass.',
  },
  {
    id: 'ED3-i',
    what: 'Move a wing in World and Save',
    proofs: [],
    status: 'cut',
    note: 'World (ED3D.9c) is cut from AF 1.0.',
  },
  {
    id: 'ED3-j',
    what: 'Ask returns a change that breaks `shared-walls`',
    proofs: [],
    status: 'cut',
    note: 'Ask (ED3D.10b) is cut from AF 1.0.',
  },
  {
    id: 'ED3-k',
    what: 'Save when the file changed on disk shows the conflict dialog',
    proofs: ['src/app/document/document-controller.test.ts', 'src/ui/document/open-flows.layout.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-l',
    what: 'The depot’s sector plan rebuilt from empty equals the shipped one',
    proofs: ['src/app/acceptance.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-m',
    what: 'Two corners and Close is refused',
    proofs: ['src/model/sector-edits.test.ts', 'src/ui/plan/SectorOptions.dom.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-n',
    what: 'No spawn: Walk starts in the first sector with a warning',
    proofs: ['src/app/walk-cases.test.ts', 'src/view/walk/walk-controller.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-o',
    what: 'A level the codec cannot patch holds Save with the path and reason',
    proofs: ['src/app/document/document-controller.test.ts', 'src/ui/document/open-flows.layout.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-p',
    what: 'WebGL unavailable: the plan works and the 3D views offer recovery',
    proofs: ['src/ui/walk/WalkCanvas.dom.test.ts', 'src/ui/walk/walk.layout.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-q',
    what: 'A new or shipped `af-sector/1` level opens and saves byte-identical',
    proofs: ['src/app/ed3-r-cases.test.ts', 'src/profile/af-sector/af-codec.test.ts'],
    status: 'covered',
  },
  {
    id: 'ED3-r',
    what: 'Define an entity, place instances, retype with refusal, reopen',
    proofs: [
      'src/app/ed3-r-cases.test.ts',
      'src/app/definitions-controller.test.ts',
      'src/journeys/walk.journey.test.ts',
    ],
    status: 'covered',
  },
  {
    id: 'ED3-s',
    what: 'Draw a rectangle against the hall, accept the portal, walk through',
    proofs: ['src/app/walk-cases.test.ts'],
    status: 'covered',
  },
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

describe('the acceptance index', () => {
  it('names every case from ED3-a to ED3-s once', () => {
    expect(CASES.map((each) => each.id)).toEqual(
      'abcdefghijklmnopqrs'.split('').map((letter) => `ED3-${letter}`),
    )
  })

  it.each(CASES.filter((each) => each.status !== 'cut'))(
    '$id: each proof exists and names the case',
    (each) => {
      expect(each.proofs.length).toBeGreaterThan(0)
      for (const proof of each.proofs) {
        expect(existsSync(resolve(root, proof)), proof).toBe(true)
        expect(readFileSync(resolve(root, proof), 'utf8'), proof).toContain(each.id)
      }
    },
  )

  it('writes the evidence page when ED3D_ACCEPTANCE=1', () => {
    if (process.env['ED3D_ACCEPTANCE'] !== '1') return
    const rows = CASES.map(
      (each) =>
        `| ${each.id} | ${each.what} | ${each.status} | ${each.proofs.map((proof) => `\`${proof}\``).join(', ') || 'none'} | ${each.note ?? ''} |`,
    )
    const text = [
      '# 3D editor acceptance, ED3-a to ED3-s',
      '',
      'Generated by `packages/editor-3d/src/app/acceptance-index.test.ts` (`ED3D_ACCEPTANCE=1`). A case is listed with the suites that prove it; each file exists and names the case. Whether the suites pass is the gate list of the pull request, not this page. The Owner’s iPad pass (real Pencil, palm and rotation) is separate and stays the Owner’s.',
      '',
      '| Case | What | Status | Proved by | Note |',
      '|---|---|---|---|---|',
      ...rows,
      '',
    ].join('\n')
    const out = resolve(root, '../../docs/evidence/ed3d-acceptance/2026-10-31.md')
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, text)
  })
})
