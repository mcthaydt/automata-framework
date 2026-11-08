import { describe, expect, it } from 'vitest'
import { CHEATSHEET_MODULES, searchCheatsheet } from '../src/data/cheatsheet'

describe('Cheatsheet Data & Search', () => {
  it('covers core modules, the replay subpath and shipping, and not physics (Automata Plus since framework 233c9da)', () => {
    const moduleNames = CHEATSHEET_MODULES.map((m) => m.name)
    expect(moduleNames).toContain('@mcthaydt/automata-sim')
    expect(moduleNames).toContain('@mcthaydt/automata-runtime')
    expect(moduleNames).toContain('@mcthaydt/automata-render-pixi')
    expect(moduleNames).not.toContain('@mcthaydt/automata-physics/2d')
    expect(moduleNames).toContain('@mcthaydt/automata-sim/replay')
    expect(moduleNames).toContain('@mcthaydt/automata-ship')
    expect(moduleNames).toContain('@mcthaydt/automata-ui')
    expect(moduleNames).toContain('@mcthaydt/automata-host')
    expect(moduleNames).toContain('@mcthaydt/automata-content')
  })

  it('safely handles search query with special regex characters', () => {
    expect(() => searchCheatsheet('createSim(')).not.toThrow()
    expect(() => searchCheatsheet('[tag]')).not.toThrow()
    expect(() => searchCheatsheet('*')).not.toThrow()
    expect(() => searchCheatsheet('define<T>')).not.toThrow()
    const results = searchCheatsheet('createSim')
    expect(results.length).toBeGreaterThan(0)
  })
})
