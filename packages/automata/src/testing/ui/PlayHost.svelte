<!--
  A stand-in for the game around the play screen in a test: the real play screen, with `slot` in its `hud.overlay` and
  `session` as the running game, so a slot component sees `usePlay()`, the frame, Pause and the field it is drawn in as
  it will in a game. `mountInPlay` makes one.
-->
<script lang="ts">
import PlayScreen from '../../app/screens/PlayScreen.svelte'
import { DEFAULT_SCREENS_COPY } from '../../app/screens/screens-copy.ts'
import type { InputMethodTracker } from '../../shared/ui/browser/input-method.svelte'
import type { PlaySession } from '../../shared/ui/slots/play-context.svelte.ts'
import type { UiComponent } from '../../shared/ui/slots/ui-slot'

interface Props {
  session: PlaySession
  slot: UiComponent
  /** How the player is playing, which the play screen gives the session (`mountInPlay` makes it and moves it). */
  tracker: InputMethodTracker
}

const { session, slot, tracker }: Props = $props()
const nothing = (): void => {}
</script>

<PlayScreen
  onPause={nothing}
  copy={{ current: DEFAULT_SCREENS_COPY }}
  {tracker}
  touchButtons={[]}
  onHold={nothing}
  onRelease={nothing}
  hud={[slot]}
  play={session}
/>
