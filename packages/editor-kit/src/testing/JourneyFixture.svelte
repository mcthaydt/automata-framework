<!--
  The page the kit's iPad journeys drive (plan EDK.6b decision 4; kit spec §9): a stepper and, below a tall gap in the
  same scroll region, a slider, both editing a kit `History` the journey holds; and a surface that reports every
  gesture the kit's recogniser makes of what lands on it. `data-mount` changes only when the fixture mounts again, so a
  journey can tell a remount from a re-render.
-->
<script module lang="ts">
let mounts = 0
</script>

<script lang="ts">
import { attachGestures } from '../gestures/attach-gestures'
import type { GestureHandlers } from '../gestures/gesture-events'
import type { History, Transaction } from '../history/history'
import Slider from '../widgets/Slider.svelte'
import Stepper from '../widgets/Stepper.svelte'
import type { EditEvent } from '../widgets/edit-event'

export interface JourneyState {
  readonly hp: number
  readonly volume: number
}

type Props = {
  history: History<JourneyState>
  /** Each gesture the surface recognised, by its handler's name. */
  onsurface: (name: string, event: unknown) => void
  /** Hands the journey the surface's teardown (EK-i). */
  ondetach?: ((detach: () => void) => void) | undefined
}

const { history, onsurface, ondetach }: Props = $props()

const mount = ++mounts
// The fixture is made for one history.
// svelte-ignore state_referenced_locally
let shown = $state.raw<JourneyState>(history.state)
$effect(() => history.subscribe((changed) => (shown = changed.state)))

let open: Transaction<JourneyState> | undefined
function edit(key: keyof JourneyState): (event: EditEvent<number>) => void {
  const set = (current: JourneyState, value: number): JourneyState => ({ ...current, [key]: value })
  return (event) => {
    if (event.phase === 'set') history.apply(`Set ${key}`, (current) => set(current, event.value))
    else if (event.phase === 'start') open = history.begin(`Set ${key}`)
    else if (event.phase === 'update') open?.update((current) => set(current, event.value))
    else if (event.phase === 'commit') {
      open?.update((current) => set(current, event.value))
      open?.commit()
    } else open?.cancel()
  }
}

let surface = $state<HTMLElement>()
$effect(() => {
  if (surface === undefined) return
  const report =
    (name: string) =>
    (event: unknown): void =>
      onsurface(name, event)
  const names = ['tap', 'longPress', 'dragStart', 'drag', 'dragEnd', 'pan', 'pinch', 'multiTap', 'hover'] as const
  const handlers = Object.fromEntries(names.map((name) => [name, report(name)])) as GestureHandlers
  const stop = attachGestures(surface, handlers)
  ondetach?.(stop)
  return stop
})
</script>

<div class="journey" data-mount={mount}>
  <div class="panel" data-scroll-region data-testid="panel">
    <Stepper label="Hit points" value={shown.hp} min={0} max={99} pixelsPerStep={8} onedit={edit('hp')} />
    <div class="gap"></div>
    <Slider label="Volume" value={shown.volume} min={0} max={100} onedit={edit('volume')} />
  </div>
  <div class="surface" data-testid="surface" bind:this={surface}></div>
</div>

<style>
  .journey {
    display: grid;
    grid-template-rows: 50vh 1fr;
    height: 100vh;
  }
  .panel {
    overflow-y: auto;
    padding: 16px;
  }
  .gap {
    height: 120vh;
  }
  .surface {
    background: #222;
  }
</style>
