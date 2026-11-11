import { describe, expect, it } from 'vitest'
import { createWallHider } from '#src/features/room-visibility/wall-hider.ts'

const node = () => ({ visible: true })

describe('the wall hider', () => {
  it('hides the nodes of the groups a zone hides, and shows the rest', () => {
    const [a, b, c] = [node(), node(), node()]
    const hider = createWallHider()
    hider.add('bulkhead', a, b)
    hider.add('other', c)
    hider.apply(new Set(['bulkhead']))
    expect([a.visible, b.visible, c.visible]).toEqual([false, false, true])
    hider.apply(new Set())
    expect([a.visible, b.visible, c.visible]).toEqual([true, true, true])
  })

  it('says which groups it holds nodes for, so a level wall with no node is found', () => {
    const hider = createWallHider()
    hider.add('bulkhead', node())
    expect(hider.groups()).toEqual(['bulkhead'])
  })

  it('stops holding a node when told', () => {
    const a = node()
    const hider = createWallHider()
    hider.add('bulkhead', a)
    hider.remove(a)
    hider.apply(new Set(['bulkhead']))
    expect(a.visible).toBe(true)
    expect(hider.groups()).toEqual([])
  })
})
