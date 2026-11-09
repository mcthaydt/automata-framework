<!--
  The stress example's UI: a readout and an ActionBar (ui) over the canvas, so the frame includes a live DOM
  overlay as a real game's would. The tick count comes from the sim's Beat events on the presentation bus.
-->
<script lang="ts">
import { ActionBar, type BarAction } from '@automata/framework'

interface Props {
  entities: number
  systems: number
  onPauseChange: (paused: boolean) => void
}

const { entities, systems, onPauseChange }: Props = $props()

let ticks = $state(0)
let paused = $state(false)

export function showTicks(value: number): void {
  ticks = value
}

const actions: BarAction[] = $derived([
  {
    id: 'pause',
    label: paused ? 'Resume' : 'Pause',
    kind: 'primary',
    pressed: paused,
    onSelect: () => {
      paused = !paused
      onPauseChange(paused)
    },
  },
])
</script>

<div
  class="stress-hud"
  data-testid="stress-hud"
  data-stress-entities={entities}
  data-stress-systems={systems}
  data-stress-ticks={ticks}
>
  <p class="stress-hud__readout">{entities} entities · {systems} systems · tick {ticks}</p>
  <ActionBar {actions} testId="stress-actions" />
</div>

<style>
  .stress-hud {
    position: absolute;
    inset: auto 0 0 0;
    padding: 8px 16px;
    pointer-events: auto;
  }
  .stress-hud__readout {
    margin: 0 0 8px;
    font: 14px/1.4 system-ui, sans-serif;
    color: #fff;
  }
</style>
