<!--
  The Plan's tools as the rail draws them, kept in step with the tool the plan canvas routes its pointer through
  (`planToolsOf`): in the suite's top bar where there is room, floating at the plan's foot on a phone.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import type { LevelEditor } from '../../shared/edit/level-editor'
import type { PlanToolId } from './plan/plan-tools'
import ToolRail from './plan/ToolRail.svelte'
import { planToolsOf } from './plan-tools-of'

const { editor }: { editor: LevelEditor<unknown> } = $props()

// svelte-ignore state_referenced_locally
const tools = planToolsOf(editor)
let active = $state<PlanToolId>(tools.state.tool)
const stop = tools.subscribe(() => (active = tools.state.tool))
onDestroy(stop)
</script>

<ToolRail {active} orientation="horizontal" onchoose={(tool) => tools.choose(tool)} />
