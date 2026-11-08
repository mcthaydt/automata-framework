// The Studio's session (EDS.9a; editor suite spec §4.4, §6.2): the figure content of one game, one history over every
// file's text, each edit a span-preserving change of one literal that the figures schemas must still accept, written
// through the workspace port before it counts, and taken back by Undo (EDS-r, EDS-aa).
import { describe, expect, it } from 'vitest'
import { openStudio } from './studio-session'
import { studioFixtureFiles, studioFixturePorts } from './testing/studio-fixtures'

const WICK = 'content/figures/wick.toml'
const read = async (ports: Awaited<ReturnType<typeof studioFixturePorts>>, path: string) =>
  (await ports.workspace.read(path))?.text

describe('openStudio', () => {
  it('reads the game’s figure files through the workspace', async () => {
    const studio = await openStudio(await studioFixturePorts())
    expect(studio.content().figures.map((entry) => entry.id)).toEqual(['wick'])
    expect(studio.content().clips.map((entry) => entry.id)).toEqual(['guard', 'pickup', 'roll'])
    expect(studio.content().problems).toEqual([])
    expect(studio.history.canUndo).toBe(false)
  })
})

describe('edit', () => {
  it('changes one literal, writes the file, and Undo writes it back (EDS-r: a value edit)', async () => {
    const ports = await studioFixturePorts()
    const studio = await openStudio(ports)
    const before = studioFixtureFiles()[WICK] as string
    const result = await studio.edit(
      WICK,
      [{ keyPath: ['sliders', 'height'], expected: 120, set: 132 }],
      'Set height of wick',
    )
    expect(result).toEqual({ ok: true })
    const after = (await read(ports, WICK)) as string
    expect(after).toBe(before.replace('height = 120', 'height = 132'))
    expect(studio.content().figures[0]?.value?.sliders.height).toBe(132)
    expect(studio.history.undoLabel).toBe('Set height of wick')

    expect(await studio.undo()).toEqual({ ok: true })
    expect(await read(ports, WICK)).toBe(before)
    expect(studio.content().figures[0]?.value?.sliders.height).toBe(120)
    expect(await studio.redo()).toEqual({ ok: true })
    expect(await read(ports, WICK)).toBe(after)
  })

  it('refuses a value the figures schema rejects, before anything is written', async () => {
    const ports = await studioFixturePorts()
    const studio = await openStudio(ports)
    const result = await studio.edit(WICK, [{ keyPath: ['hand'], expected: 'R', set: 'middle' }], 'Set hand')
    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.message).toMatch(/hand/)
    expect(await read(ports, WICK)).toBe(studioFixtureFiles()[WICK])
    expect(studio.history.canUndo).toBe(false)
  })

  it('refuses a file that changed since it was read, naming the file, and keeps the step out of the history', async () => {
    const ports = await studioFixturePorts()
    const studio = await openStudio(ports)
    const current = (await ports.workspace.read(WICK)) as { text: string; mtime: number }
    await ports.workspace.write(WICK, `${current.text}\n# edited elsewhere\n`, { mtime: current.mtime })
    const result = await studio.edit(
      WICK,
      [{ keyPath: ['sliders', 'height'], expected: 120, set: 130 }],
      'Set height',
    )
    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.message).toContain(WICK)
    expect(studio.history.canUndo).toBe(false)
  })
})

describe('the shell’s write protocol', () => {
  it('has applied the step when the routed write runs, so the write is recorded under the step’s label', async () => {
    const ports = await studioFixturePorts()
    const seen: (string | undefined)[] = []
    const holder: { studio?: Awaited<ReturnType<typeof openStudio>> } = {}
    const wrapped = {
      ...ports,
      workspace: {
        ...ports.workspace,
        write: (...args: Parameters<typeof ports.workspace.write>) => {
          seen.push(holder.studio?.history.undoLabel)
          return ports.workspace.write(...args)
        },
      },
    }
    holder.studio = await openStudio(wrapped)
    await holder.studio.edit(
      WICK,
      [{ keyPath: ['sliders', 'height'], expected: 120, set: 132 }],
      'Set height of wick',
    )
    expect(seen).toEqual(['Set height of wick'])
  })

  it('takes the step back when the write is refused, as the history it was', async () => {
    const ports = await studioFixturePorts()
    const refusing = {
      ...ports,
      workspace: {
        ...ports.workspace,
        write: async () => ({ ok: false as const, reason: 'policy' as const, message: 'no' }),
      },
    }
    const studio = await openStudio(refusing)
    const before = studio.history.state
    const result = await studio.edit(
      WICK,
      [{ keyPath: ['sliders', 'height'], expected: 120, set: 132 }],
      'Set height',
    )
    expect(result.ok).toBe(false)
    expect(studio.history.canUndo).toBe(false)
    expect(studio.history.state).toBe(before)
    // The refused step stays on the redo stack, as the fixture editor's does: a Redo retries the same write.
    expect(studio.history.canRedo).toBe(true)
  })
})

describe('create', () => {
  it('adds a pose as a new file and Undo removes it; a file edited outside the suite is not removed (EDS-aa)', async () => {
    const ports = await studioFixturePorts()
    const studio = await openStudio(ports)
    const text = 'about = "A new pose."\n\n[effectors.handL]\npos = [ 0.2, 0.9, 0.1 ]\n'
    expect(await studio.create('content/figure-poses/wave.toml', text, 'Add pose wave')).toEqual({ ok: true })
    expect(await read(ports, 'content/figure-poses/wave.toml')).toBe(text)
    expect(studio.content().poses.map((entry) => entry.id)).toContain('wave')

    expect(await studio.undo()).toEqual({ ok: true })
    expect(await read(ports, 'content/figure-poses/wave.toml')).toBeUndefined()
    expect(studio.content().poses.map((entry) => entry.id)).not.toContain('wave')

    expect(await studio.redo()).toEqual({ ok: true })
    const file = (await ports.workspace.read('content/figure-poses/wave.toml')) as { mtime: number }
    await ports.workspace.write('content/figure-poses/wave.toml', `${text}# mine\n`, { mtime: file.mtime })
    const refused = await studio.undo()
    expect(refused.ok).toBe(false)
    expect(refused.ok ? '' : refused.message).toContain('content/figure-poses/wave.toml')
    expect(await read(ports, 'content/figure-poses/wave.toml')).toBe(`${text}# mine\n`)
  })

  it('refuses a file that already exists, and a pose that fails its schema', async () => {
    const studio = await openStudio(await studioFixturePorts())
    expect((await studio.create('content/figure-poses/stand.toml', 'about = "x"\n', 'Add')).ok).toBe(false)
    expect((await studio.create('content/figure-poses/bad.toml', 'effectors = 3\n', 'Add')).ok).toBe(false)
  })
})
