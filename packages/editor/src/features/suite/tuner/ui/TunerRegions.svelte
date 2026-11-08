<!--
  The Tuner's regions in the editor suite's shell (EDS.4a; editor suite spec §4.1, §6.1): the search and the list as the
  panel, the rows as the canvas, the chosen tunable as the inspector. Each is drawn from the controller the suite keeps, so a
  switch and return finds the search, the choice and the locks as they were.
-->
<script module lang="ts">
import type { TunerSuiteSession } from '../tuner-suite-editor'
import TunerInspector from './TunerInspector.svelte'
import TunerPanel from './TunerPanel.svelte'
import TunerRows from './TunerRows.svelte'

export { canvas, inspector, panel }
</script>

{#snippet panel(session: TunerSuiteSession)}
  <TunerPanel controller={session.controller} />
{/snippet}

{#snippet canvas(session: TunerSuiteSession)}
  <TunerRows controller={session.controller} />
{/snippet}

{#snippet inspector(session: TunerSuiteSession)}
  <TunerInspector controller={session.controller} />
{/snippet}
