import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { openTomlSession } from '#src/shared/toml-session.ts'

const PATH = 'content/feel/feel.toml'
const schema = z.strictObject({
  entry: z.array(z.strictObject({ on: z.string(), shake: z.number().max(1) })).optional(),
})
const TEXT = '# What the player feels.\n[[entry]]\non = "player.hit"\nshake = 0.2 # a light knock\n'

async function portsWith(files: Record<string, string>) {
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({ path, editor: 'feel', gates: [], checks: [], modes: ['edit'], writable: true }),
    changeSet: false,
  })
  return ports
}

describe('openTomlSession', () => {
  it('reads a file that parses and passes its schema', async () => {
    const session = await openTomlSession({
      path: PATH,
      ports: await portsWith({ [PATH]: TEXT }),
      schema,
      empty: '',
    })
    expect(session.exists()).toBe(true)
    expect(session.read()).toEqual({
      kind: 'ok',
      value: { entry: [{ on: 'player.hit', shake: 0.2 }] },
      problems: [],
    })
  })

  it('writes an edit as one undo step, keeping the comments, and undoes it', async () => {
    const ports = await portsWith({ [PATH]: TEXT })
    const session = await openTomlSession({ path: PATH, ports, schema, empty: '' })
    const outcome = await session.edit('Shake harder', [
      { keyPath: ['entry', 0, 'shake'], expected: 0.2, set: 0.4 },
    ])
    expect(outcome).toEqual({ ok: true })
    const written = await ports.workspace.read(PATH)
    expect(written?.text).toBe(TEXT.replace('0.2', '0.4'))
    expect(session.history.undoLabel).toBe('Shake harder')
    expect(await session.undo()).toEqual({ ok: true })
    expect((await ports.workspace.read(PATH))?.text).toBe(TEXT)
    expect(await session.redo()).toEqual({ ok: true })
    expect((await ports.workspace.read(PATH))?.text).toBe(TEXT.replace('0.2', '0.4'))
  })

  it('reads a file that does not parse as a syntax problem with its line, without throwing', async () => {
    const session = await openTomlSession({
      path: PATH,
      ports: await portsWith({ [PATH]: '[[entry]\n' }),
      schema,
      empty: '',
    })
    const read = session.read()
    expect(read.kind).toBe('syntax')
    if (read.kind === 'syntax') expect(read.line).toBe(1)
  })

  it('names a schema problem by its key path, in words', async () => {
    const session = await openTomlSession({
      path: PATH,
      ports: await portsWith({ [PATH]: '[[entry]]\non = "a"\nshake = 3\n' }),
      schema,
      empty: '',
    })
    const read = session.read()
    expect(read.kind).toBe('invalid')
    if (read.kind === 'invalid')
      expect(read.problems).toEqual([{ keyPath: ['entry', 0, 'shake'], message: 'Must be 1 or less.' }])
  })

  it('keeps the old state when the workspace refuses the write', async () => {
    const ports = await portsWith({ [PATH]: TEXT })
    const session = await openTomlSession({ path: PATH, ports, schema, empty: '' })
    const outside = await ports.workspace.read(PATH)
    await ports.workspace.write(PATH, TEXT.replace('player.hit', 'player.fall'), {
      mtime: outside?.mtime ?? 0,
    })
    const outcome = await session.edit('Shake harder', [
      { keyPath: ['entry', 0, 'shake'], expected: 0.2, set: 0.4 },
    ])
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toMatch(/changed/i)
    expect(session.history.state.text).toBe(TEXT)
    expect(session.history.canUndo).toBe(false)
  })

  it('refuses an edit the document cannot make, in words, and writes nothing', async () => {
    const ports = await portsWith({ [PATH]: TEXT })
    const session = await openTomlSession({ path: PATH, ports, schema, empty: '' })
    const outcome = await session.edit('Shake harder', [
      { keyPath: ['entry', 0, 'shake'], expected: 0.9, set: 0.4 },
    ])
    expect(outcome.ok).toBe(false)
    expect((await ports.workspace.read(PATH))?.text).toBe(TEXT)
  })

  it('makes a missing file from its empty text', async () => {
    const ports = await portsWith({})
    const session = await openTomlSession({ path: PATH, ports, schema, empty: '# What the player feels.\n' })
    expect(session.exists()).toBe(false)
    expect(session.read()).toEqual({ kind: 'missing' })
    expect(await session.create('Start a feel file')).toEqual({ ok: true })
    expect(session.exists()).toBe(true)
    expect((await ports.workspace.read(PATH))?.text).toBe('# What the player feels.\n')
    expect(session.read()).toEqual({ kind: 'ok', value: {}, problems: [] })
  })

  it('takes a whole new text as one undo step', async () => {
    const ports = await portsWith({ [PATH]: TEXT })
    const session = await openTomlSession({ path: PATH, ports, schema, empty: '' })
    const next = TEXT.replace('0.2', '0.5')
    expect(await session.accept(next, 'Ask: shake more')).toEqual({ ok: true })
    expect(session.history.undoLabel).toBe('Ask: shake more')
    expect((await ports.workspace.read(PATH))?.text).toBe(next)
  })
})
