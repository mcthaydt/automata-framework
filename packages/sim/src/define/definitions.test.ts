import { expect, test } from 'vitest'
import { z } from 'zod'
import {
  defineCommand,
  defineComponent,
  defineEvent,
  definePlugin,
  defineResource,
  defineSystem,
  PHASES,
} from './definitions'

test('defineComponent keeps id, fields and the render flag (default true)', () => {
  const Health = defineComponent('health', { current: 'f32', max: 'f32' })
  expect(Health.kind).toBe('component')
  expect(Health.id).toBe('health')
  expect(Health.fieldNames).toEqual(['current', 'max'])
  expect(Health.render).toBe(true)
  expect(defineComponent('velocity', { x: 'f32' }, { render: false }).render).toBe(false)
})

test('field names are exposed in sorted order regardless of declaration order', () => {
  expect(defineComponent('pos', { y: 'f32', x: 'f32' }).fieldNames).toEqual(['x', 'y'])
})

test.each(['Health', 'has space', '1st', 'a..b', ''])('rejects invalid id %j', (id) => {
  expect(() => defineComponent(id, { x: 'f32' })).toThrow(/id/)
})

test('rejects unknown field types and empty field sets', () => {
  expect(() => defineComponent('bad', { x: 'f16' as never })).toThrow(/field type/)
  expect(() => defineComponent('empty', {})).toThrow(/at least one field/)
})

test('commands, events and resources carry their zod schema', () => {
  const Move = defineCommand('move', z.object({ x: z.number() }))
  const Hit = defineEvent('hit', z.object({ amount: z.number() }))
  const Score = defineResource('score', z.object({ value: z.number() }), () => ({ value: 0 }))
  expect([Move.kind, Hit.kind, Score.kind]).toEqual(['command', 'event', 'resource'])
  expect(Move.schema.parse({ x: 1 })).toEqual({ x: 1 })
  expect(Score.init()).toEqual({ value: 0 })
})

test('defineSystem validates the phase; PHASES is the fixed order', () => {
  expect(PHASES).toEqual(['input', 'prePhysics', 'physics', 'postPhysics', 'gameplay', 'cleanup'])
  const s = defineSystem({ name: 'movement', phase: 'gameplay', after: ['commands.apply'], run: () => {} })
  expect(s.before).toEqual([])
  expect(s.after).toEqual(['commands.apply'])
  expect(() => defineSystem({ name: 'x', phase: 'late' as never, run: () => {} })).toThrow(/phase/)
})

test('definePlugin fills empty lists', () => {
  const p = definePlugin({ name: 'my-game' })
  expect(p).toMatchObject({ kind: 'plugin', name: 'my-game', components: [], systems: [], dependsOn: [] })
})
