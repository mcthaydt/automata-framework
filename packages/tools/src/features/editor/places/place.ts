// Where Publish can put a game once its zip is made. A place is a small record in a list: its name, what it needs to
// ask the person, and how it uploads. The editor's page draws one button per entry from `GET /api/places`, so the next
// place (a web host, Ruken) is one new entry here and no change to the dialog.
import { itchPlace } from './itch-place.ts'

/** One thing a place asks the person, once: a label and an example of the answer. */
export interface PlaceQuestion {
  readonly id: string
  readonly label: string
  readonly example: string
}

export type PlaceNeed = 'butler' | 'account' | 'project' | 'push'

/** What came of putting the zip somewhere: the game's link, or what the person does next. */
export type PlaceOutcome =
  | { readonly ok: true; readonly link: string }
  | {
      readonly ok: false
      /** What is missing: the page shows the matching help. `push` is any other failure; `detail` says what it printed. */
      readonly need: PlaceNeed
      readonly problem: string
      readonly help?: { readonly label: string; readonly href: string } | undefined
      readonly detail?: string | undefined
    }

export type PlaceSignIn =
  | { readonly ok: true }
  /** `link` is the sign-in address the place printed, for the person whose browser did not open. */
  | { readonly ok: false; readonly problem: string; readonly link?: string }

export interface Place {
  readonly id: string
  readonly name: string
  readonly asks: readonly PlaceQuestion[]
  /** A sentence the page shows before the first put: what to set on the place's own page. */
  readonly note?: string
  /** A sentence the page shows once the game is there. */
  readonly afterNote?: string
  /** Where a person with no page on the place yet makes one; the page shows it under the questions. */
  readonly makePage?: { readonly label: string; readonly href: string }
  /** The answers the game already holds (the page the last push went to), so the person types them once. */
  known?(root: string): Readonly<Record<string, string>>
  /** Puts the zip made for the game in `root` there; never throws for a thing the person can fix. */
  put(root: string, zip: string, answers: Readonly<Record<string, string>>): Promise<PlaceOutcome>
  /** Signs the person in on this computer, for a place that needs it (itch.io: `butler login`). */
  signIn?(): Promise<PlaceSignIn>
}

/** What the page is told of a place. */
export interface PlaceInfo {
  readonly id: string
  readonly name: string
  readonly asks: readonly PlaceQuestion[]
  readonly note?: string
  readonly afterNote?: string
  readonly makePage?: { readonly label: string; readonly href: string }
  /** Answers to prefill, left out when there are none. */
  readonly known?: Readonly<Record<string, string>>
  /** The page may offer a sign-in button. */
  readonly signIn: boolean
}

export const placeInfo = (place: Place, root: string): PlaceInfo => {
  const known = place.known?.(root) ?? {}
  return {
    id: place.id,
    name: place.name,
    asks: place.asks,
    ...(place.note === undefined ? {} : { note: place.note }),
    ...(place.afterNote === undefined ? {} : { afterNote: place.afterNote }),
    ...(place.makePage === undefined ? {} : { makePage: place.makePage }),
    ...(Object.keys(known).length === 0 ? {} : { known }),
    signIn: place.signIn !== undefined,
  }
}

/** The places, in the order the dialog shows them: itch.io first. */
export const PLACES: readonly Place[] = [itchPlace]
