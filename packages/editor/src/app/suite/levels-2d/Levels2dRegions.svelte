<!--
  The Levels 2D regions in the editor suite's shell: the panel, canvas and inspector of the view the person chose
  (`Levels2dPane`), and in the suite's top bar the views and the level picker (`tools`), each drawn from the session the
  suite keeps. The suite owns the top bar (Undo and Redo among it) and the Panel and Details toggles.
-->
<script module lang="ts">
import type { CanvasContext } from '../../../shared/kit/ports/suite-editor'
import Levels2dPane from './Levels2dPane.svelte'
import Levels2dStatus from './Levels2dStatus.svelte'
import Levels2dTools from './Levels2dTools.svelte'
import type { Levels2dSession } from './levels-2d-session'

export { canvas, inspector, panel, status, tools }
</script>

{#snippet panel(session: Levels2dSession)}
  <Levels2dPane {session} part="panel" />
{/snippet}

{#snippet canvas(session: Levels2dSession, context: CanvasContext)}
  <Levels2dPane {session} part="canvas" mode={context.mode} />
{/snippet}

{#snippet inspector(session: Levels2dSession)}
  <Levels2dPane {session} part="inspector" />
{/snippet}

{#snippet tools(session: Levels2dSession)}
  <Levels2dTools {session} />
{/snippet}

{#snippet status(session: Levels2dSession)}
  <Levels2dStatus {session} />
{/snippet}
