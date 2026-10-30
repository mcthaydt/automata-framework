import { describe, expect, it } from 'vitest'
import LevelView from '../level/LevelView.svelte'
import PendingView from './PendingView.svelte'
import { componentOf } from './views'

describe('the view components', () => {
  it('maps the Level view by its component name', () => {
    expect(componentOf('LevelView')).toBe(LevelView)
  })

  it('maps a view not built yet to the pending view', () => {
    expect(componentOf('WorldView')).toBe(PendingView)
    expect(componentOf('')).toBe(PendingView)
  })
})
