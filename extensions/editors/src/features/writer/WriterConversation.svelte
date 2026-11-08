<!--
  A conversation as a branching script, read from where it starts: each part says its lines and then either goes on
  ("Then") or offers the player's choices. What is wrong is said beside the part it is about.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { DialogueNode } from '@automata/narrative/sim'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import WordsField from '../../shared/ui/WordsField.svelte'
import {
  conditionWords,
  factValueWords,
  partIdOf,
  partWords,
  readingOrder,
  stanceWords,
} from './dialogue-model.ts'
import WriterMap from './WriterMap.svelte'
import WriterPlay from './WriterPlay.svelte'
import { speakerChoices } from './writer-model.ts'
import { structureProblems } from './writer-problems.ts'
import type { WriterSession } from './writer-session.svelte.ts'

const { session, graph: index }: { session: WriterSession; graph: number } = $props()

const graph = $derived(session.graphs[index])
const lines = $derived(session.files?.lines.content?.lines ?? [])
const byId = $derived(new Map(lines.map((line, at) => [line.id, { line, at }])))
const order = $derived(graph === undefined ? [] : readingOrder(graph))
const problems = $derived(graph === undefined ? [] : structureProblems(graph, { lines }))
const range = $derived(
  Array.from({ length: session.stance.max - session.stance.min + 1 }, (_, at) => session.stance.min + at),
)
const speakers = $derived(speakerChoices(session.people, session.files?.lines.content))

let showMap = $state(false)
let playing = $state(false)
let renaming = $state<string | undefined>()
let renameTo = $state('')
let adding = $state<string | undefined>()
let draft = $state('')
let newPart = $state('')
let target = $state('')
let remembering = $state<string | undefined>()
let rememberName = $state('')
let rememberValue = $state('true')
let addingLine = $state<string | undefined>()
let lineDraft = $state('')
let lineSpeaker = $state('')

const NEW_PART = '__new__'
const parts = $derived(order.map((id) => ({ value: id, label: partWords(id) })))

function wordsOf(id: string): string {
  return byId.get(id)?.line.words ?? ''
}
function whoSays(id: string): string {
  const speaker = byId.get(id)?.line.speaker
  return speaker === undefined ? 'Someone' : session.nameOf(speaker)
}

async function rename(part: string): Promise<void> {
  const problem = await session.renamePart(index, part, renameTo)
  if (problem === undefined) renaming = undefined
}

async function addChoice(part: string): Promise<void> {
  const where = target === '' ? (order[0] as string) : target
  const done = await session.addChoice(
    index,
    part,
    draft,
    where === NEW_PART ? { newPart: newPart } : { part: where },
  )
  if (!done) return
  adding = undefined
  draft = ''
  newPart = ''
  target = ''
}

async function remember(part: string, choice: number): Promise<void> {
  if (rememberName.trim() === '') return
  const value = rememberValue === 'true' ? true : rememberValue === 'false' ? false : rememberValue
  await session.setChoiceFact(index, part, choice, partIdOf(rememberName), value)
  remembering = undefined
  rememberName = ''
}

async function addLineTo(part: string): Promise<void> {
  await session.addSay(index, part, 'dialogue', lineSpeaker === '' ? graph?.speaker : lineSpeaker, lineDraft)
  addingLine = undefined
  lineDraft = ''
}

function pick(part: string): void {
  document.getElementById(`part-${part}`)?.scrollIntoView?.({ block: 'start' })
}

const problemsOf = (part: string): string[] =>
  problems.filter((problem) => problem.part === part).map((problem) => problem.words)
const nodeOf = (part: string): DialogueNode => (graph?.nodes[part] ?? { say: [] }) as DialogueNode
</script>

{#if graph === undefined}
  <p>This conversation is gone.</p>
{:else}
  <header class="top">
    <h2>{session.nameOf(graph.speaker)}</h2>
    <div class="actions">
      <Button aria-pressed={showMap} onclick={() => (showMap = !showMap)}>Map</Button>
      <Button variant="primary" onclick={() => (playing = !playing)}>{playing ? 'Stop playing' : 'Play it'}</Button>
    </div>
  </header>

  {#if playing}
    <WriterPlay {session} {graph} />
  {/if}

  <div class="layout" data-map={showMap}>
    <div class="script">
      {#each order as part (part)}
        {@const node = nodeOf(part)}
        <article class="card" id={`part-${part}`} aria-label={partWords(part)}>
          <header>
            <h3>{partWords(part)}</h3>
            {#if graph.start === part}<span class="kind">Where it starts</span>{/if}
          </header>

          {#each problemsOf(part) as words (words)}<p class="bad" role="alert">{words}</p>{/each}

          {#each node.when ?? [] as cond, at (at)}
            <div class="actions">
              <p>Only if {conditionWords(cond, (id) => id)}</p>
              <Button variant="quiet" onclick={() => void session.removeCondition(index, part, at)}>Remove this condition</Button>
            </div>
          {/each}

          {#each node.say as id, at (`${id}.${String(at)}`)}
            {#if byId.has(id)}
              <WordsField
                label={`${whoSays(id)} says`}
                value={wordsOf(id)}
                placeholder="No words yet"
                onchange={(words) => void session.setWords(byId.get(id)?.at ?? 0, words)}
              />
            {/if}
          {/each}

          {#if addingLine === part}
            <div class="card" role="group" aria-label="Add a line to this part">
              <FieldRow label="Who says it?" kind="choice" value={lineSpeaker} options={[{ value: '', label: session.nameOf(graph.speaker) }, ...speakers]} onchange={(value) => (lineSpeaker = String(value))} />
              <WordsField label="What do they say?" value={lineDraft} oninput={(words) => (lineDraft = words)} />
              <div class="actions">
                <Button variant="quiet" onclick={() => (addingLine = undefined)}>Cancel</Button>
                <Button variant="primary" disabled={lineDraft.trim() === ''} onclick={() => void addLineTo(part)}>Add this line</Button>
              </div>
            </div>
          {:else}
            <div class="actions"><Button variant="quiet" onclick={() => ((addingLine = part), (lineSpeaker = ''))}>Add a line to this part</Button></div>
          {/if}

          {#if (node.choices ?? []).length === 0}
            <FieldRow
              label="Then"
              kind="choice"
              value={node.next ?? ''}
              options={[{ value: '', label: 'The conversation ends' }, ...parts.filter((each) => each.value !== part)]}
              onchange={(value) => void session.setThen(index, part, value === '' ? undefined : String(value))}
            />
          {/if}

          {#each node.choices ?? [] as choice, at (`${choice.line}.${String(at)}`)}
            <section class="choice" aria-label={`Choice ${String(at + 1)}`}>
              <WordsField
                label="You say"
                value={wordsOf(choice.line)}
                placeholder="No words yet"
                onchange={(words) => void session.setWords(byId.get(choice.line)?.at ?? 0, words)}
              />
              <FieldRow
                label="Goes to"
                kind="choice"
                value={choice.next}
                options={parts}
                onchange={(value) => void session.setChoiceNext(index, part, at, String(value))}
              />
              <FieldRow
                label="Standing"
                kind="choice"
                value={String(choice.stance ?? 0)}
                options={range.map((n) => ({ value: String(n), label: stanceWords(n) }))}
                onchange={(value) => void session.setChoiceStance(index, part, at, Number(value))}
              />
              {#each Object.entries(choice.set ?? {}) as [name, value] (name)}
                <div class="actions">
                  <p>Remembers: {name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()} = {factValueWords(value)}</p>
                  <Button variant="quiet" onclick={() => void session.setChoiceFact(index, part, at, name, undefined)}>Forget this</Button>
                </div>
              {/each}
              {#if remembering === `${part}.${String(at)}`}
                <div role="group" aria-label="Remember something">
                  <label for={`fact-${part}-${String(at)}`}>What is remembered?</label>
                  <input id={`fact-${part}-${String(at)}`} bind:value={rememberName} />
                  <FieldRow label="It is" kind="choice" value={rememberValue} options={[{ value: 'true', label: 'yes' }, { value: 'false', label: 'no' }]} onchange={(value) => (rememberValue = String(value))} />
                  <div class="actions">
                    <Button variant="quiet" onclick={() => (remembering = undefined)}>Cancel</Button>
                    <Button variant="primary" disabled={rememberName.trim() === ''} onclick={() => void remember(part, at)}>Remember</Button>
                  </div>
                </div>
              {:else}
                <div class="actions">
                  <Button variant="quiet" onclick={() => (remembering = `${part}.${String(at)}`)}>Remember something</Button>
                  <Button variant="quiet" aria-label={`Remove choice ${String(at + 1)}`} onclick={() => void session.removeChoice(index, part, at)}>Remove this choice</Button>
                </div>
              {/if}
            </section>
          {/each}

          {#if adding === part}
            <div class="card" role="group" aria-label="Add a choice">
              <WordsField label="What does the player say?" value={draft} oninput={(words) => (draft = words)} />
              <FieldRow
                label="Where does it go?"
                kind="choice"
                value={target === '' ? (order[0] ?? '') : target}
                options={[...parts, { value: NEW_PART, label: 'A new part…' }]}
                onchange={(value) => (target = String(value))}
              />
              {#if target === NEW_PART}
                <div>
                  <label for={`new-part-${part}`}>What is the new part called?</label>
                  <input id={`new-part-${part}`} bind:value={newPart} />
                </div>
              {/if}
              <div class="actions">
                <Button variant="quiet" onclick={() => (adding = undefined)}>Cancel</Button>
                <Button variant="primary" disabled={draft.trim() === ''} onclick={() => void addChoice(part)}>Add this choice</Button>
              </div>
            </div>
          {:else}
            <div class="actions">
              <Button onclick={() => ((adding = part), (draft = ''), (target = ''))}>Add a choice</Button>
            </div>
          {/if}

          {#if renaming === part}
            <div role="group" aria-label="Rename this part">
              <label for={`rename-${part}`}>What is this part called?</label>
              <input id={`rename-${part}`} bind:value={renameTo} />
              <div class="actions">
                <Button variant="quiet" onclick={() => (renaming = undefined)}>Cancel</Button>
                <Button variant="primary" onclick={() => void rename(part)}>Rename</Button>
              </div>
            </div>
          {:else}
            <div class="actions">
              <Button variant="quiet" onclick={() => ((renaming = part), (renameTo = partWords(part)))}>Rename this part</Button>
              <Button variant="quiet" onclick={() => void session.removePart(index, part)}>Remove this part</Button>
            </div>
          {/if}
        </article>
      {/each}
      <div class="actions">
        <Button
          onclick={() => {
            const name = `Part ${String(order.length + 1)}`
            void session.addPart(index, name)
          }}
        >
          Add a part
        </Button>
      </div>
    </div>
    {#if showMap}
      <aside class="map" aria-label="Map of the conversation">
        <WriterMap {graph} onpick={pick} />
      </aside>
    {/if}
  </div>
{/if}

<style>
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .layout {
    display: grid;
    gap: var(--space-4);
  }
  .script {
    display: grid;
    gap: var(--space-4);
  }
  .choice {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border-left: 2px solid var(--color-border-default);
  }
  .kind {
    color: var(--color-text-faint);
    font: var(--text-body-13);
  }
  label {
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  input {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  /* Beside the script when there is room, above it when there is not. */
  @container (min-width: 820px) {
    .layout[data-map='true'] {
      grid-template-columns: minmax(0, 1fr) 16rem;
    }
  }
</style>
