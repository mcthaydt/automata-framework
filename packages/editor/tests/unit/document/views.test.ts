// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { componentOf } from '#src/app/level-2d/views.ts'
import EntitiesView from '#src/features/characters/EntitiesView.svelte'
import PendingView from '#src/features/document/PendingView.svelte'
import LevelView from '#src/features/level/LevelView.svelte'
import WorldView from '#src/features/map/WorldView.svelte'
import TilesetsView from '#src/features/tiles/TilesetsView.svelte'

describe('the view components', () => {
  it('maps the Level view by its component name', () => {
    expect(componentOf('LevelView')).toBe(LevelView)
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
    // Checks and Export are no longer views: Problems and Share live in the top bar.
    expect(componentOf('ChecksView')).toBe(PendingView)
    expect(componentOf('')).toBe(PendingView)
  })
})
