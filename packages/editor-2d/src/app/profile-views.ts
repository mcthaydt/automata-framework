import type { Component } from 'svelte'
import StageView from '../profiles/floorfifty-stage/views/StageView.svelte'
import type { ViewProps } from './views/view-props'

// The views a registered profile brings (plan EDFF.2a-1 decision 4), by the component name its `ViewDef`s use. A
// profile's views live in the profile, so they may call its commands; this list, the second registration file beside
// `profiles.ts`, is how `app/` reaches them. It is apart from `profiles.ts` so the headless registry imports no
// component.

export function profileViews(): Readonly<Record<string, Component<ViewProps>>> {
  return { StageView }
}
