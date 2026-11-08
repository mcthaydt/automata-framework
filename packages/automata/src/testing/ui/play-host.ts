import type { Sim } from '@automata/sim'
import { mount, unmount } from 'svelte'
import '../../app/screens/screens.css'
import '../../shared/ui/theme.css'
import { PlaySession } from '../../shared/ui/slots/play-context.svelte.ts'
import type { UiComponent } from '../../shared/ui/slots/ui-slot.ts'
import PlayHost from './PlayHost.svelte'

/** A slot component mounted as the play screen draws it: the element it is in, the session it reads and sends through, and how to remove it. */
export interface PlayMount {
  readonly host: HTMLElement
  /** `refresh()` says a frame passed; `commands(tick, [])` takes what the component sent. */
  readonly session: PlaySession
  unmount(): void
}

/** Mounts `slot` (a `hud.overlay` component) over `sim` with the play context, into `target` or a new element of the page. */
export function mountInPlay(slot: UiComponent, sim: Sim | undefined, target?: HTMLElement): PlayMount {
  const host = target ?? document.body.appendChild(document.createElement('div'))
  const session = new PlaySession(sim)
  const instance = mount(PlayHost, { target: host, props: { session, slot } })
  return {
    host,
    session,
    unmount() {
      void unmount(instance)
      if (target === undefined) host.remove()
    },
  }
}
