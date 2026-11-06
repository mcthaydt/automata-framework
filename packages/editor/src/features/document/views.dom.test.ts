import { describe, expect, it } from 'vitest'
import EntitiesView from '../characters/EntitiesView.svelte'
import LevelView from '../level/LevelView.svelte'
import WorldView from '../map/WorldView.svelte'
import ChecksView from '../problems/ChecksView.svelte'
import TilesetsView from '../tiles/TilesetsView.svelte'
import PendingView from './PendingView.svelte'
import { componentOf } from './views'

describe('the view components', () => {
  it('maps the Level view by its component name', () => {
    expect(componentOf('LevelView')).toBe(LevelView)
    expect(componentOf('ChecksView')).toBe(ChecksView)
  })

  it('maps the Tilesets view by its component name', () => {
    expect(componentOf('TilesetsView')).toBe(TilesetsView)
  })

  it('maps the Entities view by its component name', () => {
    expect(componentOf('EntitiesView')).toBe(EntitiesView)
  })

  it('maps the World view by its component name', () => {
    expect(componentOf('WorldView')).toBe(WorldView)
  })

  it('maps a view not built yet to the pending view', () => {
    expect(componentOf('ComposeView')).toBe(PendingView)
    expect(componentOf('')).toBe(PendingView)
  })
})
