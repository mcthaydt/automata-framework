/** One entry of the type ramp: which family, and the numbers behind a `font` shorthand. */
export interface RampEntry {
  readonly family: 'sans' | 'mono'
  readonly weight: number
  readonly size: number
  readonly line: number
  /** Letter spacing in px. */
  readonly tracking: number
}

/** The shape of `tokens.json`, the source of truth for `tokens.css`. */
export interface EditorTokens {
  /** `color.<group>.<name>`: any CSS color, used verbatim. */
  readonly color: Readonly<Record<string, Readonly<Record<string, string>>>>
  /** px lengths. */
  readonly space: Readonly<Record<string, number>>
  readonly radius: Readonly<Record<string, number>>
  readonly size: Readonly<Record<string, number>>
  readonly font: {
    readonly sans: string
    readonly mono: string
    readonly ramp: Readonly<Record<string, RampEntry>>
  }
}
