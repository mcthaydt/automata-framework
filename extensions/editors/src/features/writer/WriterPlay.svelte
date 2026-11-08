<!--
  Read it through: the conversation walked in the editor. The lines appear in turn, the choices are buttons, and what a
  choice remembers is kept for the walk only. It reads the files; it never runs the game.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { DialogueGraph } from '@automata/narrative/sim'
import { untrack } from 'svelte'
import { type Facts, partView, playChoose } from './writer-problems.ts'
import type { WriterSession } from './writer-session.svelte.ts'

const { session, graph }: { session: WriterSession; graph: DialogueGraph } = $props()
const lines = $derived(new Map((session.files?.lines.content?.lines ?? []).map((line) => [line.id, line])))

interface Said {
  readonly who: string
  readonly words: string
}
let said = $state<Said[]>([])
let facts = $state<Facts>({})
let at = $state(untrack(() => graph.start))

function say(id: string, you = false): Said {
  const line = lines.get(id)
  return {
    who: you
      ? 'You'
      : line?.speaker === undefined
        ? graph.speaker && session.nameOf(graph.speaker)
        : session.nameOf(line.speaker),
    words: line?.words ?? 'No words yet',
  }
}

const view = $derived(partView(graph, at, facts))
let shown = $state<string | undefined>()

// A part's lines are said once when the walk arrives at it.
$effect(() => {
  if (shown === `${view.at}`) return
  shown = view.at
  said = [...said, ...view.said.map((id) => say(id))]
})

function restart(): void {
  said = []
  facts = {}
  shown = undefined
  at = graph.start
}

function choose(index: number, line: string): void {
  said = [...said, say(line, true)]
  const next = playChoose(graph, view.at, facts, index)
  facts = next.facts
  shown = undefined
  at = next.at
}

function goOn(): void {
  if (view.goesOn === undefined) return
  shown = undefined
  at = view.goesOn
}
</script>

<section class="card play" aria-label="Playing the conversation">
  <ol>
    {#each said as line, index (index)}
      <li><strong>{line.who}:</strong> {line.words}</li>
    {/each}
  </ol>
  {#if view.choices.length > 0}
    <div class="actions" role="group" aria-label="Choose">
      {#each view.choices as choice (choice.index)}
        <Button onclick={() => choose(choice.index, choice.line)}>{lines.get(choice.line)?.words ?? 'No words yet'}</Button>
      {/each}
    </div>
  {:else if view.goesOn !== undefined}
    <div class="actions"><Button onclick={goOn}>Next</Button></div>
  {:else}
    <p>The end.</p>
    <div class="actions"><Button onclick={restart}>Start again</Button></div>
  {/if}
</section>

<style>
  ol {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
</style>
