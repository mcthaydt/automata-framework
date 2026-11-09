/** One on-screen touch button: the action it holds and what it shows. */
export interface TouchButtonSpec {
  /** The profile's action id; also the button's `data-testid`. */
  readonly action: string
  /** The button's face. */
  readonly label: string
  /** Its name for assistive technology, where the face is a symbol. Default: the label. */
  readonly ariaLabel?: string | undefined
  /** Which lower corner's group it sits in. Default `start`. */
  readonly side?: 'start' | 'end' | undefined
  /** The game cannot be played without it: where the buttons do not all fit, only these show. */
  readonly required?: boolean | undefined
}

/** The overlay's move stick. */
export interface TouchStickSpec {
  /** Its name for assistive technology ("Move"). */
  readonly label: string
}

/** TouchControls' props. */
export interface TouchControlsProps {
  buttons: readonly TouchButtonSpec[]
  /** An action's first finger landed. */
  onhold: (action: string) => void
  /** An action's last finger lifted, or the controls hid or came down while it was held. */
  onrelease: (action: string) => void
  /** False hides the controls without remounting them (the player put touch down). Default true. */
  shown?: boolean | undefined
  /**
   * A floating move stick at the overlay's start: its accessible name. None draws no stick, as in 2D. The
   * stick is always shown: the reduced set never drops it.
   */
  stick?: TouchStickSpec | undefined
  /** The stick's vector as the thumb moves, clamped to length 1, `y` positive down (runtime's `Input.touchStick.set`). */
  onstick?: ((x: number, y: number) => void) | undefined
  /** The stick let go: a lift, a cancel, the controls hiding or coming down (`Input.touchStick.release`). */
  onstickend?: (() => void) | undefined
  testId?: string | undefined
  /**
   * Where the buttons stand. `foot` (default) is a row along the foot of the frame the controls are in. `bars` stands
   * each side's buttons in a column in the empty bar beside a fitted level, `barRoom` px wide (the play screen
   * decides when that fits); the stick is never moved, so a stick keeps `foot`.
   */
  placement?: 'foot' | 'bars' | undefined
  /** The width of the column in each bar, in px, when `placement` is `bars`. */
  barRoom?: number | undefined
}
