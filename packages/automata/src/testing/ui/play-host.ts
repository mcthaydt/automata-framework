import type { Sim } from '@automata/sim'
import { mount, unmount } from 'svelte'
import '../../app/screens/screens.css'
import '../../shared/ui/theme.css'
import { type InputMethod, InputMethodTracker } from '../../shared/ui/browser/input-method.svelte.ts'
import { PlaySession } from '../../shared/ui/slots/play-context.svelte.ts'
import type { UiComponent } from '../../shared/ui/slots/ui-slot.ts'
import PlayHost from './PlayHost.svelte'

/** A slot component mounted as the play screen draws it: the element it is in, the session it reads and sends through, and how to remove it. */
export interface PlayMount {
  readonly host: HTMLElement
  /** `refresh()` says a frame passed; `commands(tick, [])` takes what the component sent. */
  readonly session: PlaySession
  /** Says how the player is playing now (`touch`, `keyboard` or `gamepad`), as their next press would; the component sees it as `usePlay().inputMethod`. */
  noteInputMethod(method: InputMethod): void
  unmount(): void
}

/**
 * Mounts `slot` (a `hud.overlay` component) over `sim` with the play context, into `target` or a new element of the page. The
 * player starts as the page's pointer says (a coarse one is touch); `inputMethod` says otherwise.
 */
export function mountInPlay(
  slot: UiComponent,
  sim: Sim | undefined,
  target?: HTMLElement,
  inputMethod?: InputMethod,
): PlayMount {
  const host = target ?? document.body.appendChild(document.createElement('div'))
  const session = new PlaySession(sim)
  const tracker = new InputMethodTracker()
  if (inputMethod !== undefined) tracker.note(inputMethod)
  const instance = mount(PlayHost, { target: host, props: { session, slot, tracker } })
  return {
    host,
    session,
    noteInputMethod: (method) => tracker.note(method),
    unmount() {
      void unmount(instance)
      if (target === undefined) host.remove()
    },
  }
}
