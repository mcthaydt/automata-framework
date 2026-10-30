import { describe, expect, it } from 'vitest'
import { levelProject } from '../../profiles/level-project/level-project'
import type { ViewDef } from '../../profiles/profile'
import { routeOf, viewsOf } from './view-router'

describe('the view router', () => {
  it('lists the profile views in order, as the rail shows them', () => {
    expect(viewsOf(levelProject).map((view) => view.label)).toEqual([
      'Level',
      'World',
      'Tilesets',
      'Entities',
      'Checks',
      'Export',
    ])
  })

  it('routes to the named view, and to the first for an id it does not know', () => {
    const views = viewsOf(levelProject)
    expect(routeOf(views, 'checks')?.id).toBe('checks')
    expect(routeOf(views, 'gone')?.id).toBe(views[0]?.id)
    expect(routeOf(views, undefined)?.id).toBe(views[0]?.id)
  })

  it('routes to none when the profile has no views', () => {
    const none: readonly ViewDef[] = []
    expect(routeOf(none, 'level')).toBeUndefined()
  })
})
