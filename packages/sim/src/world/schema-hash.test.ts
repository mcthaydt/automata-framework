import { expect, test } from 'vitest'
import { z } from 'zod'
import { defineCommand, defineEvent, definePlugin, defineResource } from '../define/definitions'
import { createSim } from './sim'
import { SnapshotFormatError, SnapshotMismatchError } from './snapshot'

// M2.1 spec §10.4: a build whose resource, command or event schemas changed must not accept the old snapshot.
const snapshotWith = async (plugin: ReturnType<typeof definePlugin>) =>
  (await createSim({ seed: 1, plugins: [plugin] })).snapshot()
const restoreInto = async (plugin: ReturnType<typeof definePlugin>, bytes: Uint8Array) =>
  (await createSim({ seed: 1, plugins: [plugin] })).restore(bytes)

test.each([
  [
    'resource',
    (wide: boolean) => ({
      resources: [
        defineResource(
          'r',
          wide ? z.object({ a: z.number(), b: z.number().optional() }) : z.object({ a: z.number() }),
          () => ({ a: 1 }),
        ),
      ],
    }),
  ],
  [
    'command',
    (wide: boolean) => ({
      commands: [defineCommand('c', wide ? z.object({ a: z.number() }) : z.object({ a: z.string() }))],
    }),
  ],
  [
    'event',
    (wide: boolean) => ({
      events: [defineEvent('e', wide ? z.object({ a: z.number() }) : z.object({ a: z.string() }))],
    }),
  ],
])('a changed %s schema changes the schema hash', async (_, parts) => {
  const before = await snapshotWith(definePlugin({ name: 'p', ...parts(true) }))
  await expect(restoreInto(definePlugin({ name: 'p', ...parts(false) }), before)).rejects.toThrow(
    SnapshotMismatchError,
  )
})

test('a stored resource the current schema would strip is refused, not silently changed', async () => {
  const R = defineResource('r', z.object({ a: z.number().optional() }), () => ({ a: 1 }))
  const plugin = definePlugin({ name: 'p', resources: [R] })
  const bytes = await snapshotWith(plugin)
  // Same length, same schema hash: rename the stored key "a" to "b", which the schema strips on parse.
  const text = [...bytes].map((b) => String.fromCharCode(b)).join('')
  const at = text.indexOf('{"a":1}')
  expect(at).toBeGreaterThan(0)
  const edited = bytes.slice()
  edited[at + 2] = 'b'.charCodeAt(0)
  await expect(restoreInto(plugin, edited)).rejects.toThrow(SnapshotFormatError)
})

test('a plugin config is part of the schema hash: a snapshot from another config is refused (audit, §10.8)', async () => {
  const moon = definePlugin({ name: 'engine', config: { gravity: -1.62 } })
  const earth = definePlugin({ name: 'engine', config: { gravity: -9.81 } })
  const bytes = await snapshotWith(moon)
  await expect(restoreInto(earth, bytes)).rejects.toThrow(SnapshotMismatchError)
  await expect(restoreInto(moon, bytes)).resolves.toBeUndefined()
})

test('a plugin without a config keeps its schema hash, and a config must be canonical JSON', async () => {
  const plain = definePlugin({ name: 'engine' })
  expect(plain.config).toBeUndefined()
  // Same bytes as before configs existed: the snapshot golden in snapshot.parity.test.ts pins this too.
  const bytes = await snapshotWith(plain)
  await expect(restoreInto(definePlugin({ name: 'engine' }), bytes)).resolves.toBeUndefined()
  expect(() => definePlugin({ name: 'engine', config: { at: new Date(0) } })).toThrow(/canonicalJson/)
})

test('a plugin config is frozen all the way down, so the hashed value is the value the plugin reads', () => {
  const plugin = definePlugin({ name: 'engine', config: { gravity: { x: 0, y: -9.81 }, tags: ['a'] } })
  const config = plugin.config as { gravity: { y: number }; tags: string[] }
  expect(Object.isFrozen(config)).toBe(true)
  expect(Object.isFrozen(config.gravity)).toBe(true)
  expect(Object.isFrozen(config.tags)).toBe(true)
  expect(() => {
    config.gravity.y = 0
  }).toThrow(TypeError)
})
