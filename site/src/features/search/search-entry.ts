/** One row the search can find: what it shows, the words it matches and where it leads. */
export interface SearchEntry {
  readonly title: string
  readonly detail: string
  readonly url: string
}
