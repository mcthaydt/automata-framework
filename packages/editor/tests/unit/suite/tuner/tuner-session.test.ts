// The Tuner's session: the tuning file of one game, one history over its
// text, each edit one literal's span, written through the workspace port before it counts and taken back by Undo.
import { describe, expect, it } from 'vitest'
import type { Tunable } from '#src/features/suite/tuner/tuner-content.ts'
import { openTuner } from '#src/features/suite/tuner/tuner-session.ts'
import { TUNING_FIXTURE, tunerFixtureFiles, tunerFixturePorts } from '#src/testing/suite/tuner-fixtures.ts'

const PATH = 'content/tuning.toml'
const read = async (ports: Awaited<ReturnType<typeof tunerFixturePorts>>) =>
  (await ports.workspace.read(PATH))?.text

const tunablesOf = (tuner: Awaited<ReturnType<typeof openTuner>>): readonly Tunable[] => {
  const read = tuner.read()
  if ('problem' in read) throw new Error(read.problem)
  return read.tunables
}

const names = (tuner: Awaited<ReturnType<typeof openTuner>>): string[] => {
  const read = tuner.read()
  return 'problem' in read ? [] : read.tunables.map((tunable) => tunable.name)
}

describe('openTuner', () => {
  it('reads the tunables, with the compiler’s bounds for a bare row (EDS-a: nothing is written)', async () => {
    const ports = await tunerFixturePorts()
    const tuner = await openTuner(ports)
    expect(names(tuner)).toEqual(['MAX_RUN', 'GRAVITY', 'SCALE', 'DEBUG', 'GREETING', 'CURVE'])
    const gravity = tunablesOf(tuner).find((t) => t.name === 'GRAVITY')
    expect(gravity?.min).toBe(16)
    expect(tuner.history.canUndo).toBe(false)
    expect(await read(ports)).toBe(TUNING_FIXTURE)
  })

  it('has no file when the game has none, and offers to create it', async () => {
    const tuner = await openTuner(await tunerFixturePorts({}))
    expect(tuner.hasFile()).toBe(false)
    expect(tuner.read()).toEqual({ problem: 'There is no content/tuning.toml yet.' })
  })

  it('reads without bounds when the compiler has not run', async () => {
    const files = tunerFixtureFiles()
    delete files['content/generated/tuning-meta.json']
    const tuner = await openTuner(await tunerFixturePorts(files))
    expect(tuner.boundsUnavailable()).toBe(true)
    expect(tunablesOf(tuner).find((t) => t.name === 'GRAVITY')?.min).toBeUndefined()
  })
})

describe('set', () => {
  it('changes one number’s span, writes it, and Undo restores the text (EDS-b)', async () => {
    const ports = await tunerFixturePorts()
    const tuner = await openTuner(ports)
    expect(await tuner.set('MAX_RUN', 400)).toEqual({ ok: true })
    expect(await read(ports)).toBe(TUNING_FIXTURE.replace('value = 384', 'value = 400'))
    expect(tuner.history.undoLabel).toBe('Set MAX_RUN to 400')
    expect(await tuner.undo()).toEqual({ ok: true })
    expect(await read(ports)).toBe(TUNING_FIXTURE)
    expect(await tuner.redo()).toEqual({ ok: true })
    expect(await read(ports)).toBe(TUNING_FIXTURE.replace('value = 384', 'value = 400'))
  })

  it('writes a bare row, a toggle and a text row the same way', async () => {
    const ports = await tunerFixturePorts()
    const tuner = await openTuner(ports)
    await tuner.set('GRAVITY', 70)
    await tuner.set('DEBUG', true)
    await tuner.set('GREETING', 'hi')
    expect(await read(ports)).toBe(
      TUNING_FIXTURE.replace('GRAVITY = 64', 'GRAVITY = 70')
        .replace('DEBUG = false', 'DEBUG = true')
        .replace('"hello"', '"hi"'),
    )
  })

  it('refuses a value past a bound with the bound named, and writes nothing (EDS-c)', async () => {
    const ports = await tunerFixturePorts()
    const tuner = await openTuner(ports)
    expect(await tuner.set('MAX_RUN', 900)).toEqual({
      ok: false,
      message: 'MAX_RUN: 900 is past the largest it may be, 768',
    })
    expect(await read(ports)).toBe(TUNING_FIXTURE)
    expect(tuner.history.canUndo).toBe(false)
  })

  it('refuses a row it does not edit, and a name that is not in the file', async () => {
    const tuner = await openTuner(await tunerFixturePorts())
    expect(await tuner.set('CURVE', 1)).toEqual({
      ok: false,
      message: 'CURVE is a table or a list: change it in the file',
    })
    expect(await tuner.set('NOPE', 1)).toEqual({ ok: false, message: 'NOPE: there is no such tunable' })
  })

  it('refuses, with the port’s reason, when the file is read only here, and leaves the history alone', async () => {
    const ports = await tunerFixturePorts(undefined, { writable: false })
    const tuner = await openTuner(ports)
    expect(await tuner.set('MAX_RUN', 400)).toEqual({
      ok: false,
      message: 'content/tuning.toml: The file is read only here.',
    })
    expect(tuner.history.canUndo).toBe(false)
    expect(await read(ports)).toBe(TUNING_FIXTURE)
  })
})

describe('a drag', () => {
  it('is one undo step, shown live and written when it ends', async () => {
    const ports = await tunerFixturePorts()
    const tuner = await openTuner(ports)
    expect(tuner.drag.start('MAX_RUN')).toEqual({ ok: true })
    tuner.drag.update(500)
    tuner.drag.update(520)
    expect(tunablesOf(tuner)[0]?.value).toBe(520)
    expect(await read(ports)).toBe(TUNING_FIXTURE)
    expect(await tuner.drag.commit()).toEqual({ ok: true })
    expect(await read(ports)).toBe(TUNING_FIXTURE.replace('value = 384', 'value = 520'))
    expect(tuner.history.undoLabel).toBe('Set MAX_RUN')
    await tuner.undo()
    expect(await read(ports)).toBe(TUNING_FIXTURE)
    expect(tuner.history.canUndo).toBe(false)
  })

  it('is no step when cancelled, and a live value past a bound is refused and not shown', async () => {
    const ports = await tunerFixturePorts()
    const tuner = await openTuner(ports)
    tuner.drag.start('MAX_RUN')
    expect(tuner.drag.update(9000)).toEqual({
      ok: false,
      message: 'MAX_RUN: 9000 is past the largest it may be, 768',
    })
    tuner.drag.update(500)
    tuner.drag.cancel()
    expect(tunablesOf(tuner)[0]?.value).toBe(384)
    expect(tuner.history.canUndo).toBe(false)
  })
})

describe('create', () => {
  it('creates the file when the game has none, as one undo step', async () => {
    const ports = await tunerFixturePorts({})
    const tuner = await openTuner(ports)
    expect(await tuner.create()).toEqual({ ok: true })
    expect(tuner.hasFile()).toBe(true)
    expect((await ports.workspace.read(PATH))?.text).toMatch(/^# /)
    expect(tuner.history.undoLabel).toBe('Create content/tuning.toml')
  })

  it('lists the Tuner in the game first, then makes the file', async () => {
    const ports = await tunerFixturePorts({})
    const asked: string[] = []
    const tuner = await openTuner({
      ...ports,
      list: {
        ensure: async (id) => {
          asked.push(id)
          return { ok: true, unchanged: true }
        },
      },
    })
    expect(await tuner.create()).toEqual({ ok: true })
    expect(asked).toEqual(['tuner'])
    expect(await ports.workspace.read(PATH)).toBeDefined()
  })

  it('makes nothing, and says why, when the game’s list cannot take the Tuner', async () => {
    const ports = await tunerFixturePorts({})
    const tuner = await openTuner({
      ...ports,
      list: {
        ensure: async () => ({ ok: false, reason: 'policy', message: 'The list has a problem.' }),
      },
    })
    expect(await tuner.create()).toEqual({ ok: false, message: 'The list has a problem.' })
    expect(tuner.hasFile()).toBe(false)
    expect(await ports.workspace.read(PATH)).toBeUndefined()
  })
})
