<!--
  The display covers for the layout contracts (M4 spec §4.9, §7, M4.7): the landscape gate in each of its states, and
  the rotate hint, each over a screen as a game would draw it. Words are English stand-ins of a typical length.
-->
<script lang="ts" module>
export const DISPLAY_SHOWS = ['gate-fullscreen', 'gate-upright', 'rotate'] as const
export type DisplayShow = (typeof DISPLAY_SHOWS)[number]
</script>

<script lang="ts">
import LandscapeGate from '../display/LandscapeGate.svelte'
import RotateHint from '../display/RotateHint.svelte'
import ScreenFrame from '../layout/ScreenFrame.svelte'

const { show }: { show: DisplayShow } = $props()
const none = (): void => undefined
const GATE_COPY = {
  title: 'Play fullscreen',
  body: 'Your browser’s bar takes too much of the screen sideways. One tap hides it.',
  go: 'Go fullscreen',
  uprightTitle: 'Turn your phone upright',
  uprightBody: 'Or add the game to your Home Screen to play it sideways.',
}
</script>

<ScreenFrame arrangement="stack" back={none} backLabel="Back">
  {#snippet body()}<p style="margin: 0">The game</p>{/snippet}
</ScreenFrame>

{#if show === 'rotate'}
  <RotateHint shown copy={{ title: 'Turn your phone', body: 'This game plays in landscape.' }} />
{:else}
  <LandscapeGate state={show === 'gate-fullscreen' ? 'fullscreen' : 'rotate-or-install'} copy={GATE_COPY} onfullscreen={none} />
{/if}
