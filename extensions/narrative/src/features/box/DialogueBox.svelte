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

interface Props {
  /** The game's message catalog: the words for a locale key, or undefined when there are none. */
  words: (key: string) => string | undefined
  /** A line record by id (the game's `lines` content). */
  lines: (id: string) => LineRecord | undefined
}

const { words, lines }: Props = $props()
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
const advance = (): void => send('narrative.advance', {})
const choose = (index: number): void => send('narrative.choose', { index })

// A key is never shown: a line with no words is told to whoever writes the game, once.
const told = new Set<string>()
$effect(() => {
  for (const id of model?.missing ?? []) {
    if (told.has(id)) continue
    told.add(id)
    globalThis.reportError?.(new Error(`The line "${id}" has no words yet. Write them in Writer.`))
  }
  for (const id of model?.missingSpeakers ?? []) {
    if (told.has(`speaker:${id}`)) continue
    told.add(`speaker:${id}`)
    globalThis.reportError?.(
      new Error(`The speaker "${id}" has no name yet. Write it in Writer as "speaker.${id}".`),
    )
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
  const choices = choiceCount > 0
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
    const choice = model?.choices[Number(event.key) - 1]
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
  <section class="af-dialogue-box" data-testid="dialogue-box" aria-live="polite" bind:this={box}>
    {#if model.speaker !== ''}
      <p class="speaker" data-testid="dialogue-speaker">{model.speaker}</p>
    {/if}
    <p class="line" data-testid="dialogue-line">{model.text}</p>
    {#if model.choices.length > 0}
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
    {:else if model.next}
      <button
        type="button"
        class="af-control af-control--primary"
        data-kind="primary"
        data-testid="dialogue-next"
        bind:this={next}
        onclick={advance}>{words('dialogue.next') ?? 'Next'}</button
      >
    {/if}
  </section>
{/if}

<style>
  .af-dialogue-box {
    position: absolute;
    inset: auto 0 0;
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    max-height: 100%;
    overflow-y: auto;
    padding: 12px var(--af-gutter, 16px);
    border: var(--af-edge-width, 2px) solid var(--af-edge, #a6aeba);
    border-radius: var(--af-radius, 6px);
    background: var(--af-surface, #181f2f);
    color: var(--af-ink, #f5f7fa);
    font: var(--af-text-body, 16px) / 1.4 var(--af-font, system-ui, sans-serif);
    pointer-events: auto;
  }
  .speaker {
    margin: 0;
    color: var(--af-accent, #ffcf05);
    font-weight: 700;
  }
  .line {
    margin: 0;
    overflow-wrap: anywhere;
    min-height: 1.4em;
  }
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
