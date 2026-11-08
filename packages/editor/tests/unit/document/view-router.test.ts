import { describe, expect, it } from 'vitest'
import { routeOf, viewsOf } from '#src/features/document/view-router.ts'
import { levelProject } from '#src/shared/level-2d/profiles/level-project/level-project.ts'
import type { ViewDef } from '#src/shared/level-2d/profiles/profile.ts'

describe('the view router', () => {
  it('lists the profile views in order, as the switcher shows them, in plain words', () => {
    expect(viewsOf(levelProject).map((view) => view.label)).toEqual(['Level', 'Characters'])
  })

  it('routes to the named view, and to the first for an id it does not know', () => {
    const views = viewsOf(levelProject)
    expect(routeOf(views, 'entities')?.id).toBe('entities')
    expect(routeOf(views, 'gone')?.id).toBe(views[0]?.id)
    expect(routeOf(views, undefined)?.id).toBe(views[0]?.id)
  })

  it('routes to none when the profile has no views', () => {
    const none: readonly ViewDef[] = []
    expect(routeOf(none, 'level')).toBeUndefined()
  })
})
