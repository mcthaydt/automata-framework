import type { Profile, ViewDef } from '../../shared/level-2d/profiles/profile'

// Which view an open document shows (plan ED2D.4c4a decision 1; 2D editor spec §7, §8). The profile lists its views as
// data (`ViewDef`), so the rail and the route come from the registry and the app names no profile (G-s).

/** The rail's destinations, in the profile's order. */
export function viewsOf(profile: Profile<unknown>): readonly ViewDef[] {
  return profile.views
}

/** The view with this id; the first one for an id the profile does not have; none when it has no views. */
export function routeOf(views: readonly ViewDef[], id: string | undefined): ViewDef | undefined {
  return views.find((view) => view.id === id) ?? views[0]
}
