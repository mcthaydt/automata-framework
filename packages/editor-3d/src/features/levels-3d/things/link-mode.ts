// The Things tool's link mode (ED3D.7c): joining two things of the profile's links (Last Light's nav nodes) and parting
// them. `start` with one such thing selected begins a link from it; while linking, a tap on another one joins the two
// as one undo step (a refusal keeps the mode, with the sentence), and a tap anywhere else, a drag, `stop` or the links'
// sub-layer going off ends it. What a tap would do is a dry run of the very edit, as the place of a new thing is. The
// controller owns the pointer and the view; this owns only whether a link is being made, and from where.

import type { LevelEditor } from '../../../shared/edit/level-editor'
import { addLink, NO_LINKS, removeLink } from '../../../shared/edit/link-edits'
import type { ThingLink } from '../../../shared/level-session/thing-links'
import type { ThingHit } from '../plan/thing-pick'

/** What a tap on a thing would do while linking: join it to the one the link starts from, or not, and why. */
export type LinkPlace = ThingLink &
  ({ readonly action: 'add' } | { readonly action: 'none'; readonly reason: string })

/** The thing a link starts from, and what it will pass through. */
export interface Linking {
  readonly from: string
  readonly via: string | undefined
}

export interface LinkMode {
  readonly linking: Linking | undefined
  /** Ends the mode when the level has no links any more or their sub-layer is off. */
  settle(): void
  /** While linking, what a tap on `hit` would do: only for a thing of the links' definition. */
  preview(hit: ThingHit | undefined): LinkPlace | undefined
  /** A tap while linking: joins `hit` when it is a thing of the links, else ends the mode. Answers a refusal's sentence. */
  tap(hit: ThingHit | undefined): string | undefined
  /** Starts a link from the one thing of `selected`, through `via`; answers the sentence it was refused with. */
  start(
    selected: readonly { readonly def: string; readonly id: string }[],
    via: string | undefined,
  ): string | undefined
  stop(): void
  /** Parts two things as one undo step; answers the edit's sentence, else nothing. */
  unlink(a: string, b: string): string | undefined
}

export function createLinkMode<D>(
  editor: LevelEditor<D>,
  layerProblem: (def: string) => string | undefined,
): LinkMode {
  let linking: Linking | undefined

  /** The sentence a link action is refused with before it is tried: no links, or their sub-layer is off. */
  const problem = (): string | undefined => {
    const { links } = editor.profile
    return links === undefined ? NO_LINKS : layerProblem(links.def)
  }

  const linkTo = (hit: ThingHit | undefined): ThingLink | undefined =>
    linking === undefined || hit === undefined || hit.def !== editor.profile.links?.def
      ? undefined
      : linking.via === undefined
        ? { a: linking.from, b: hit.id }
        : { a: linking.from, b: hit.id, via: linking.via }

  return {
    get linking() {
      return linking
    },
    settle() {
      if (linking !== undefined && problem() !== undefined) linking = undefined
    },
    preview(hit) {
      const link = linkTo(hit)
      if (link === undefined) return undefined
      const trial = addLink<D>(link).run(editor.profile, editor.level)
      return trial.ok ? { ...link, action: 'add' } : { ...link, action: 'none', reason: trial.reason }
    },
    tap(hit) {
      const link = linkTo(hit)
      if (link === undefined) {
        linking = undefined
        return undefined
      }
      const result = editor.run(addLink(link))
      if (!result.ok) return result.reason
      linking = undefined
      return undefined
    },
    start(selected, via) {
      const { links } = editor.profile
      const refused = problem()
      if (links === undefined || refused !== undefined) return refused
      const [from] = selected
      if (selected.length !== 1 || from === undefined || from.def !== links.def)
        return `select one ${links.def} first`
      linking = { from: from.id, via }
      return undefined
    },
    stop() {
      linking = undefined
    },
    unlink(a, b) {
      const refused = problem()
      if (refused !== undefined) return refused
      const result = editor.run(removeLink({ a, b }))
      return result.ok ? undefined : result.reason
    },
  }
}
