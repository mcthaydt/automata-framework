<!--
  The Tuner's one region in the editor suite's shell: the canvas, a split view of the running game and its settings
  (`TunerCanvas`). The Tuner has no panel and no inspector: the settings are the list, and a setting's card is where it
  is changed, so nothing is shown twice. The controller the suite keeps holds the choice and the locks, so a switch and
  return finds them as they were.
-->
<script module lang="ts">
import type { TunerSuiteSession } from '../tuner-suite-editor'
import TunerCanvas from './TunerCanvas.svelte'

export { canvas }
</script>

{#snippet canvas(session: TunerSuiteSession)}
  <TunerCanvas {session} />
{/snippet}
