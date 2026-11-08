<!--
  Levels 3D's drawing tools in the suite's top bar (spec 10.3, V1): the plan's tool rail laid along the bar, each tool a
  44 px button named in words, the chosen one pressed. They are the same tools the plan canvas routes its pointer
  through (`planToolsOf`), so a tap here changes what the next tap on the plan does. The bar scrolls sideways where a
  phone's width holds too few; the suite owns Undo, Redo and the panel toggles beside them. The tools' keys (V S X P D N T,
  Enter, Backspace, Escape and Delete: `planToolCommands`) run for as long as the bar is shown, except while a field is
  typing, as they do in the standalone frame.
-->
<script lang="ts">
import { createCommandRegistry, createKeymap } from '@automata/editor/kit/core'
import { onDestroy } from 'svelte'
import type { Levels3dSuiteSession } from './levels-3d-suite-editor'
import { planToolCommands } from './plan/plan-tool-commands'
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

const commands = createCommandRegistry()
if (tools !== undefined)
  for (const command of planToolCommands(tools, () => opened?.selection.ids ?? [])) commands.register(command)
const keymap = createKeymap(
  commands,
  /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '') ? 'apple' : 'other',
)

/** Whether a key press is typing: focus in a field, a text area, a list or editable text. */
function inText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function onkeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return
  const handled = keymap.handle({
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    inText: inText(event.target),
  })
  if (handled) event.preventDefault()
}
</script>

<svelte:window {onkeydown} />

{#if tools !== undefined}
  <ToolRail {active} orientation="horizontal" onchoose={(tool) => tools.choose(tool)} />
{/if}
