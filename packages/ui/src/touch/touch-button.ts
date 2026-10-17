/** One on-screen touch button (M4 spec §4.4): the action it holds and what it shows. */
export interface TouchButtonSpec {
  /** The profile's action id; also the button's `data-testid`. */
  readonly action: string
  /** The button's face. */
  readonly label: string
  /** Its name for assistive technology, where the face is a symbol. Default: the label. */
  readonly ariaLabel?: string | undefined
  /** Which lower corner's group it sits in. Default `start`. */
  readonly side?: 'start' | 'end' | undefined
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
  testId?: string | undefined
}
