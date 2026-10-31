import { describe, expect, it } from 'vitest'
import { debugPanels } from './panels'
import { Blank } from './testing/blank'

describe('debugPanels', () => {
  it('returns the panels in the order given', () => {
    const panels = debugPanels(
      { id: 'sim', title: 'Sim', component: Blank },
      { id: 'bus', title: 'Bus', component: Blank },
    )
    expect(panels.map((p) => p.id)).toEqual(['sim', 'bus'])
  })
  it('refuses an id that is not kebab-case', () => {
    expect(() => debugPanels({ id: 'Sim Panel', title: 'x', component: Blank })).toThrow(/kebab-case/)
  })
  it('refuses a repeated id and names it', () => {
    expect(() =>
      debugPanels({ id: 'sim', title: 'a', component: Blank }, { id: 'sim', title: 'b', component: Blank }),
    ).toThrow(/sim/)
  })
  it('refuses an empty title', () => {
    expect(() => debugPanels({ id: 'sim', title: '', component: Blank })).toThrow(/title/)
  })
})
