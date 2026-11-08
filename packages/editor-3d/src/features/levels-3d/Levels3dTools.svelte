<!--
  Levels 3D's drawing tools in the suite's top bar (spec 10.3, V1): the plan's tool rail laid along the bar, each tool a
  44 px button named in words, the chosen one pressed. They are the same tools the plan canvas routes its pointer
  through (`planToolsOf`), so a tap here changes what the next tap on the plan does. The bar scrolls sideways where a
  phone's width holds too few; the suite owns Undo, Redo and the panel toggles beside them.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import type { Levels3dSuiteSession } from './levels-3d-suite-editor'
import type { PlanToolId } from './plan/plan-tools'
import ToolRail from './plan/ToolRail.svelte'
import { planToolsOf } from './plan-tools-of'

interface Props {
  session: Levels3dSuiteSession
}

const { session }: Props = $props()

// svelte-ignore state_referenced_locally
const opened = session.level.state.kind === 'open' ? session.level.state.editor : undefined
// svelte-ignore state_referenced_locally
const tools = opened === undefined ? undefined : planToolsOf(opened)
let active = $state<PlanToolId>(tools?.state.tool ?? 'select')
const stop = tools?.subscribe(() => (active = tools.state.tool))
onDestroy(() => stop?.())
</script>

{#if tools !== undefined}
  <ToolRail {active} orientation="horizontal" onchoose={(tool) => tools.choose(tool)} />
{/if}
