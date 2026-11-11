import { Container3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { createRoomOwnership } from '#src/features/room-visibility/room-ownership.ts'
import { POLICY } from './fixtures.ts'

const make = () => {
  const root = new Container3D()
  const own = createRoomOwnership(root, POLICY)
  const node = (label: string) => {
    const n = new Container3D()
    n.label = label
    root.addChild(n)
    return n
  }
  return { root, own, node }
}

describe('room ownership', () => {
  it('draws a node only while one of its rooms is visible, and global always', () => {
    const { own, node } = make()
    const bed = own.own(node('bed'), ['ward'])
    const sign = own.own(node('sign'), 'global')
    own.apply(new Set(['reception']))
    expect([bed.parent?.visible, sign.parent?.visible]).toEqual([false, true])
    own.apply(new Set(['ward']))
    expect(bed.parent?.visible).toBe(true)
  })

  it('leaves the node its own visibility, so a lamp that is off stays off in a visible room', () => {
    const { own, node } = make()
    const lamp = own.own(node('lamp'), ['ward'])
    lamp.visible = false
    own.apply(new Set(['ward']))
    expect(lamp.visible).toBe(false)
    expect(lamp.parent?.visible).toBe(true)
  })

  it('refuses a room the policy does not have, and an empty owner list', () => {
    const { own, node } = make()
    expect(() => own.own(node('a'), ['lobby'])).toThrow('unknown or empty room owners')
    expect(() => own.own(node('b'), [])).toThrow('unknown or empty room owners')
  })

  it('refuses a node that is not a child of the root', () => {
    const { own, node } = make()
    const inner = new Container3D()
    node('holder').addChild(inner)
    expect(() => own.own(inner, ['ward'])).toThrow('nested ownership must inherit its root node')
  })

  it('moves a node between rooms when its owners change, and follows a moving owner', () => {
    const { own, node } = make()
    let room = 'ward'
    const person = own.follow(node('person'), () => [room])
    own.apply(new Set(['ward']))
    expect(person.parent?.visible).toBe(true)
    room = 'corridor'
    own.apply(new Set(['ward']))
    expect(person.parent?.visible).toBe(false)
    expect(own.owners(person)).toEqual(['corridor'])
  })

  it('makes a layer a builder can draw into, owned from the start', () => {
    const { own, root } = make()
    const layer = own.layer(['ward'])
    expect(layer.parent?.parent).toBe(root)
    own.apply(new Set(['reception']))
    expect(layer.parent?.visible).toBe(false)
    own.apply(new Set(['ward']))
    expect(layer.parent?.visible).toBe(true)
    expect(() => own.layer(['lobby'])).toThrow('unknown or empty room owners')
  })

  it('scope tells a builder whose room it is building, and puts it back', () => {
    const { own } = make()
    expect(own.current()).toBeUndefined()
    own.scope(['ward'], () => expect(own.current()).toEqual(['ward']))
    expect(own.current()).toBeUndefined()
  })

  it('names the content no room owns', () => {
    const { own, node } = make()
    own.own(node('bed'), ['ward'])
    node('stray')
    expect(() => own.assertComplete()).toThrow('unowned room content: stray')
  })
})
