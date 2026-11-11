// The clinic (`spikes/clinic`), opened by the level editor's own profile: what the editor reads of it, lists, checks and
// writes back. It is the evidence behind `docs/refactor/clinic/editor-gaps.md`: each `it` is a claim about what the editor
// can or cannot do with the clinic's data today, so a gap that closes fails here and the ledger is updated with it.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { moveThing } from '#src/shared/edit/thing-edits.ts'
import { afSectorCodec } from '#src/shared/level-session/af-sector/af-codec.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'

const text = readFileSync(
  new URL('../../../../../../../spikes/clinic/content/clinic.af-sector.json', import.meta.url),
  'utf8',
)
const source = JSON.parse(text)
const parsed = afSectorProfile.parse(text)
if (!parsed.ok) throw new Error(`the clinic does not open in the editor: ${JSON.stringify(parsed)}`)
const clinic = parsed.value

describe('the clinic in the level editor', () => {
  it('opens, and the editor lists every prop and lamp the level places as a thing', () => {
    const things = afSectorProfile.entities(clinic).things
    expect(
      things.filter((thing) => thing.def.startsWith('prop.') || thing.def.startsWith('kind.')),
    ).toHaveLength(source.props.length)
    expect(things.filter((thing) => thing.def.startsWith('lamp.'))).toHaveLength(source.lamps.length)
  })

  it('moves a fitted piece of furniture and writes back its nested `with` as it was', () => {
    const fitted = afSectorProfile.entities(clinic).things.find((thing) => thing.def === 'prop.fit')
    if (fitted === undefined) throw new Error('the clinic has no fitted prop')
    const moved = moveThing<typeof clinic>({
      def: fitted.def,
      id: fitted.id,
      x: fitted.x + 0.5,
      z: fitted.z,
    }).run(afSectorProfile, clinic)
    if (!moved.ok) throw new Error(moved.reason)
    const written = afSectorCodec.patch(text, clinic, moved.level)
    if (!written.ok) throw new Error(written.detail)
    const place = (file: { props: { id: string; with?: unknown }[] }) =>
      file.props.find((p) => p.id === fitted.id)
    expect(place(JSON.parse(written.text))).toMatchObject({ with: place(source)?.with })
    // Only the one place changed.
    expect(JSON.parse(written.text).props.filter((p: { id: string }) => p.id !== fitted.id)).toEqual(
      source.props.filter((p: { id: string }) => p.id !== fitted.id),
    )
  })

  it("keeps the members it has no edit for: masses, views, visibility, bounce and the lamps' light", () => {
    const moved = moveThing<typeof clinic>({ def: 'lamp.desk', id: 'deskLamp', x: 3.1, z: 1.15 }).run(
      afSectorProfile,
      clinic,
    )
    if (!moved.ok) throw new Error(moved.reason)
    const written = afSectorCodec.patch(text, clinic, moved.level)
    if (!written.ok) throw new Error(written.detail)
    const after = JSON.parse(written.text)
    for (const member of ['masses', 'views', 'visibility', 'bounce', 'time'])
      expect(after[member]).toEqual(source[member])
    expect(after.lamps.find((l: { id: string }) => l.id === 'deskLamp')).toMatchObject({
      range: 5,
      radius: 1.7,
      color: source.lamps.find((l: { id: string }) => l.id === 'deskLamp').color,
    })
  })

  it('offers a lamp or a prop only a position and a turn: nothing of its range, radius, colour or `with` to set', () => {
    const defs = afSectorProfile.entities(clinic).definitions
    for (const def of defs.filter((d) => /^(prop|kind|lamp)\./.test(d.id)))
      expect((def.fields ?? []).map((field) => field.id)).toEqual(def.id.startsWith('lamp.') ? [] : ['angle'])
  })

  it('has one failing check: the two pipe runs whose first point is not inside a room', () => {
    // A wall-mounted run starts on or in a wall, which the "stands outside every room" rule reads as outside: a gap of the
    // editor (a thing that rides on a wall has no wall to name), not of the level.
    const failed = afSectorProfile.checks(clinic).filter((check) => !check.ok)
    expect(failed.map((check) => check.id)).toEqual(['entities'])
    expect(failed[0]?.detail).toContain('dress-pipe-ne-low')
    expect(failed[0]?.detail).toContain('dress-pipe-ne-high')
  })
})
