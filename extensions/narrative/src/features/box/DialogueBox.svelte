<!--
  @component
  The dialogue box, in the play screen's `hud.overlay` slot: along the bottom of the visible region, the speaker's name and
  the line, then "Next" (which has the focus, so Enter, Space and a pad's A press it) or the choices, one button each with
  its number (keys 1 to 9 press them too). It reads the conversation from the sim through `usePlay()` and sends
  `narrative.advance` and `narrative.choose`; it never changes the game itself. It sits inside the play field, which the
  frame keeps clear of Pause, and tells the field its own height (`BOX_HEIGHT_VAR`) so a caption can sit above it.
-->
<script lang="ts">
import { usePlay } from '@automata/framework'
import { tick as afterRender, onMount, untrack } from 'svelte'
import { readerOf, view } from '../../shared/sim/dialogue.ts'
import type { LineRecord } from '../../shared/sim/lines.schema.ts'
import { NarrativeDialogue, NarrativeSceneResource } from '../../shared/sim/narrative.resource.ts'
import { puzzleReader } from '../../shared/sim/puzzle-reader.ts'
import { BOX_HEIGHT_VAR, dialogueBoxModel } from './dialogue-box.ts'
import LineBox from './LineBox.svelte'
import { prefersReducedMotion, type TypedView, type TypingOptions, typedFor } from './typing.ts'

interface Props {
  /** The game's message catalog: the words for a locale key, or undefined when there are none. */
  words: (key: string) => string | undefined
  /** A line record by id (the game's `lines` content). */
  lines: (id: string) => LineRecord | undefined
  /** The clock and rate lines with a delivery are typed at. */
  typing?: TypingOptions
}

const { words, lines, typing = {} }: Props = $props()
const play = usePlay()

// `tick` changes only when the sim steps, so the conversation is read again then and not at every frame.
const tick = $derived(play.sim?.tick ?? -1)
const model = $derived.by(() => {
  void tick
  const sim = play.sim
  if (sim === undefined) return null
  return untrack(() => {
    const dialogue = sim.resource(NarrativeDialogue)
    if (dialogue.graph === null) return null
    const graph = sim.resource(NarrativeSceneResource).graphs.find((each) => each.id === dialogue.graph)
    if (graph === undefined) return null
    const reader = readerOf(
      { stance: dialogue.stance, facts: dialogue.facts },
      puzzleReader({ resource: (def) => sim.resource(def) }),
    )
    return dialogueBoxModel(view(graph, dialogue.place, reader), lines, words, graph.speaker)
  })
})

// A command is taken at the next step, so a second tap before the sim has stepped is the same tap: it is ignored.
let sentAt: number | undefined
function send(type: string, payload: unknown): void {
  if (sentAt === tick) return
  sentAt = tick
  play.send({ type, payload })
}
// A line with a delivery is typed out. Time comes from the clock below; a press completes the line before it dismisses it.
const clock = (): number => typing.clock?.() ?? performance.now() / 1000
const reduced = prefersReducedMotion()
let startedAt = $state(0)
let now = $state(0)
let completed = $state(false)
let typedLine = ''
$effect(() => {
  const line = model?.lineId ?? ''
  if (line === typedLine) return
  typedLine = line
  startedAt = clock()
  now = startedAt
  completed = false
})
const reveal: TypedView = $derived(
  model === null
    ? { shown: 0, done: true }
    : completed
      ? { shown: model.text.length, done: true }
      : typedFor(model.text, model.delivery, now - startedAt, { rate: typing.rate, reducedMotion: reduced }),
)
// While a line is being typed, the clock is read each frame; once it is all there, nothing is.
$effect(() => {
  if (reveal.done) return
  let frame = requestAnimationFrame(function step() {
    now = clock()
    frame = requestAnimationFrame(step)
  })
  return () => cancelAnimationFrame(frame)
})
const advance = (): void => {
  if (!reveal.done) completed = true
  else send('narrative.advance', {})
}
const choose = (index: number): void => send('narrative.choose', { index })

// A key is never shown: a line with no words is told to whoever writes the game, once.
const told = new Set<string>()
$effect(() => {
  for (const id of model?.missing ?? []) {
    if (told.has(id)) continue
    told.add(id)
    globalThis.reportError?.(new Error(`The line "${id}" has no words yet. Write them in Writer.`))
  }
})

let box: HTMLElement | undefined = $state()
let next: HTMLButtonElement | undefined = $state()
let choiceButtons: HTMLButtonElement[] = $state([])

// Focus: onto Next when a line appears, onto the first choice when the choices do, and back to where it was when the talk ends.
let returnTo: Element | null = null
let showing = false
const choiceCount = $derived(model?.choices.length ?? 0)
$effect(() => {
  const open = model !== null
  const choices = choiceCount > 0 && reveal.done
  void afterRender().then(() => {
    if (open && !showing) returnTo = document.activeElement
    if (open) (choices ? choiceButtons[0] : next)?.focus({ preventScroll: true })
    else if (showing) {
      if (returnTo instanceof HTMLElement && returnTo.isConnected && returnTo !== document.body)
        returnTo.focus({ preventScroll: true })
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      returnTo = null
    }
    showing = open
  })
})

// The caption sits above the box: the field is told how tall the box is, and 0 when it is gone.
$effect(() => {
  const field = box?.parentElement
  if (field == null || box === undefined) return
  const place = (): void => field.style.setProperty(BOX_HEIGHT_VAR, `${box?.offsetHeight ?? 0}px`)
  place()
  const watch = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
  watch?.observe(box)
  return () => {
    watch?.disconnect()
    field.style.setProperty(BOX_HEIGHT_VAR, '0px')
  }
})

onMount(() => {
  // Keys 1 to 9 take the choice with that number.
  const onKey = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || !/^[1-9]$/.test(event.key)) return
    // A menu on top (Pause) has the keyboard: a number pressed there is for the menu, not for an answer behind it.
    const screen = event.target instanceof Element ? event.target.closest('[data-game-screen]') : null
    if (screen !== null && screen.getAttribute('data-game-screen') !== 'play') return
    const choice = reveal.done ? model?.choices[Number(event.key) - 1] : undefined
    if (choice === undefined) return
    event.preventDefault()
    choose(choice.index)
  }
  window.addEventListener('keydown', onKey)
  // A pad's A presses the focused button and its D-pad moves between the choices; the box asks the pad itself because the
  // default play screen only steers its menus with it.
  let frame = 0
  let held = false
  const pad = (): void => {
    const pads = navigator.getGamepads?.() ?? []
    const pressed = (button: number): boolean => pads.some((each) => each?.buttons[button]?.pressed === true)
    const a = pressed(0)
    if (
      a &&
      !held &&
      box !== undefined &&
      document.activeElement instanceof HTMLButtonElement &&
      box.contains(document.activeElement)
    )
      document.activeElement.click()
    held = a
    frame = requestAnimationFrame(pad)
  }
  frame = requestAnimationFrame(pad)
  return () => {
    window.removeEventListener('keydown', onKey)
    cancelAnimationFrame(frame)
  }
})
</script>

{#if model !== null}
  <LineBox speaker={model.speaker} text={model.text} shown={reveal.shown} bind:element={box}>
    {#if reveal.done && model.choices.length > 0}
      <ol class="choices">
        {#each model.choices as choice, position (choice.index)}
          <li>
            <button
              type="button"
              class="af-control choice"
              data-testid={`dialogue-choice-${position + 1}`}
              bind:this={choiceButtons[position]}
              onclick={() => choose(choice.index)}
            >
              <span class="number" aria-hidden="true">{position + 1}</span>
              <span>{choice.text}</span>
            </button>
          </li>
        {/each}
      </ol>
    {:else if model.next || !reveal.done}
      <button
        type="button"
        class="af-control af-control--primary"
        data-kind="primary"
        data-testid="dialogue-next"
        bind:this={next}
        onclick={advance}>{words('dialogue.next') ?? 'Next'}</button
      >
    {/if}
  </LineBox>
{/if}

<style>
  .choices {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    /* Side by side where there is room, one under another on a phone. */
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  }
  .choice {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    min-height: var(--af-target-primary, 48px);
    text-align: start;
  }
  .number {
    flex: none;
    min-width: 1.5em;
    color: var(--af-accent, #ffcf05);
    font-weight: 700;
  }
  [data-testid="dialogue-next"] {
    justify-self: end;
    min-width: 8rem;
  }
</style>
