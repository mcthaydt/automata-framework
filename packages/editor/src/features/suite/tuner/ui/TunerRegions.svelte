<!--
  The Tuner's regions in the editor suite's shell: the search and the list as the
  panel, the running game beside the rows as the canvas (`TunerCanvas`), the chosen tunable as the inspector. Each is drawn from the controller the suite keeps, so a
  switch and return finds the search, the choice and the locks as they were.
-->
<script module lang="ts">
import type { TunerSuiteSession } from '../tuner-suite-editor'
import TunerCanvas from './TunerCanvas.svelte'
import TunerInspector from './TunerInspector.svelte'
import TunerPanel from './TunerPanel.svelte'

export { canvas, inspector, panel }
</script>

{#snippet panel(session: TunerSuiteSession)}
  <TunerPanel controller={session.controller} />
{/snippet}

{#snippet canvas(session: TunerSuiteSession)}
  <TunerCanvas {session} />
{/snippet}

{#snippet inspector(session: TunerSuiteSession)}
  <TunerInspector controller={session.controller} />
{/snippet}
