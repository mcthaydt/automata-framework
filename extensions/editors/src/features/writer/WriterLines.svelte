<!-- A scene's lines as a script: who says each one, the words, and what the line is for. -->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import WordsField from '../../shared/ui/WordsField.svelte'
import { scriptLines, speakerChoices } from './writer-model.ts'
import type { WriterSession } from './writer-session.svelte.ts'
import { ADDABLE_KINDS, KIND_WORDS } from './writer-words.ts'

const { session }: { session: WriterSession } = $props()
const lines = $derived(session.files?.lines.content)
const rows = $derived(lines?.lines === undefined ? [] : scriptLines(lines, session.people))
let adding = $state(false)
let speaker = $state('')
let kind = $state<(typeof ADDABLE_KINDS)[number]>('dialogue')
const speakers = $derived(speakerChoices(session.people, lines))
const NO_ONE = { value: '', label: 'No one' }

let draft = $state('')

async function add(): Promise<void> {
  const id = await session.addLine(kind, speaker === '' ? undefined : speaker, draft)
  if (id === undefined) return
  adding = false
  draft = ''
}

const removing = $derived(session.removing)
</script>

<h2>Lines</h2>
{#if rows.length === 0}
  <div class="empty">
    <h3>This scene has no lines yet.</h3>
    <p>A line is one thing someone says, calls out or reads.</p>
  </div>
{/if}

{#each rows as row (row.id)}
  <article class="card" aria-label={`Line ${String(row.index + 1)}`}>
    <header>
      <h3>{row.who === '' ? 'No one in particular' : row.who}</h3>
      <span class="kind">{row.kind}</span>
    </header>
    <WordsField
      label="What it says"
      value={row.words ?? ''}
      placeholder="No words yet"
      onchange={(words) => void session.setWords(row.index, words)}
    />
    {#if row.words === undefined}<p>No words yet</p>{/if}
    {#if removing?.index === row.index}
      <div class="confirm" role="group" aria-label="Remove this line?">
        <p>
          {removing.places.length === 1
            ? `${removing.places[0]?.replace(/^./, (c) => c.toUpperCase())} still says this line.`
            : `${removing.places.join(' and ').replace(/^./, (c) => c.toUpperCase())} still say this line.`}
        </p>
        <div class="actions">
          <Button variant="danger" onclick={() => void session.removeLine(row.index, true)}>Remove anyway</Button>
          <Button variant="quiet" onclick={() => (session.removing = undefined)}>Keep it</Button>
        </div>
      </div>
    {:else}
      <div class="actions">
        <Button variant="quiet" aria-label={`Remove line ${String(row.index + 1)}`} onclick={() => void session.removeLine(row.index)}>
          Remove
        </Button>
      </div>
    {/if}
  </article>
{/each}

{#if adding}
  <div class="card" role="group" aria-label="Add a line">
    <FieldRow
      label="Who says it?"
      kind="choice"
      value={speaker}
      options={[NO_ONE, ...speakers]}
      onchange={(value) => (speaker = String(value))}
    />
    <FieldRow
      label="What is it for?"
      kind="choice"
      value={kind}
      options={ADDABLE_KINDS.map((each) => ({ value: each, label: KIND_WORDS[each] }))}
      onchange={(value) => (kind = value as typeof kind)}
    />
    <WordsField label="What do they say?" value={draft} oninput={(words) => (draft = words)} />
    <div class="actions">
      <Button variant="quiet" onclick={() => (adding = false)}>Cancel</Button>
      <Button disabled={draft.trim() === ''} onclick={() => void add()}>Add this line</Button>
    </div>
  </div>
{:else}
  <div class="actions">
    <Button onclick={() => (adding = true)}>
      {rows.length === 0 ? 'Write the first line' : 'Add a line'}
    </Button>
  </div>
{/if}

<style>
  .kind {
    color: var(--color-text-faint);
    font: var(--text-body-13);
  }
  .empty {
    display: grid;
    gap: var(--space-2);
  }
  .confirm {
    display: grid;
    gap: var(--space-2);
  }
</style>
