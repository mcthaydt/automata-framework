// The one shape every value widget reports its changes in (kit spec §4.6, decision EDK-D5).
//
//   set     one discrete change: a typed value, a step button, an arrow key, a tap on an option
//   start   a drag began; `value` is where it began
//   update  the drag moved; `value` is the live value
//   commit  the drag ended with a change; `value` is the final value
//   cancel  the drag was cancelled, or ended where it began; `value` is the value to go back to
//
// An editor maps `set` to `history.apply` and the other four to a transaction (`begin`, `update`, `commit`,
// `cancel`), so one drag is one undo step and a drag that changed nothing is none.

export type EditPhase = 'set' | 'start' | 'update' | 'commit' | 'cancel'

export interface EditEvent<T> {
  readonly value: T
  readonly phase: EditPhase
}

/** What every widget with a value or a choice shares for its disabled state (kit spec §4.6). */
export interface BlockedProps {
  /** The widget stays focusable and announces `reason`; it never reports an edit. */
  readonly disabled?: boolean | undefined
  readonly reason?: string | undefined
  /** Called when someone presses or types into a disabled widget, so the editor can say why. */
  readonly onblocked?: ((reason: string | undefined) => void) | undefined
}
