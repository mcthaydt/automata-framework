<!--
  The Studio's regions in the editor suite's shell (EDS.9a to EDS.9c; editor suite spec §4.1, EDS-D12): the figure, pose
  and clip lists as the panel, the stage as the canvas, the mode's fields as the inspector and the timeline as the dock
  (shown in Animate). Each is drawn from the controller the suite keeps, so a switch and return finds the choice, the
  camera and the playhead as they were.
-->
<script module lang="ts">
import type { StudioSuiteSession } from '../studio-suite-editor'
import StudioCanvas from './StudioCanvas.svelte'
import StudioInspector from './StudioInspector.svelte'
import StudioPanel from './StudioPanel.svelte'
import StudioTimeline from './StudioTimeline.svelte'

export { canvas, dock, inspector, panel }
</script>

{#snippet panel(session: StudioSuiteSession)}
  <StudioPanel controller={session.controller} />
{/snippet}

{#snippet canvas(session: StudioSuiteSession)}
  <StudioCanvas
    controller={session.controller}
    stage={session.stage}
    frames={session.frames}
    background={session.background}
  />
{/snippet}

{#snippet inspector(session: StudioSuiteSession)}
  <StudioInspector controller={session.controller} />
{/snippet}

{#snippet dock(session: StudioSuiteSession)}
  <StudioTimeline controller={session.controller} />
{/snippet}
