<!--
  The chosen sound, music track, music order or event page as sentences. A sound is its tones and hisses, each with its pitch, timing
  and loudness; Play sounds it in the page, and nothing plays by itself. The event page says, for each thing that
  happens, which sound plays or why it is silent.
-->
<script lang="ts">
import type { Cue } from '@automata/audio-synth'
import { Button } from '@automata/editor/kit'
import { problemAt } from '../../shared/content-session.svelte.ts'
import type { Field } from '../../shared/fields.ts'
import { setOrInsert } from '../../shared/fields.ts'
import EditorPage from '../../shared/ui/EditorPage.svelte'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import AudioMusic from './AudioMusic.svelte'
import {
  addEventEdit,
  addVoiceEdit,
  audioProblemWords,
  eventLines,
  eventSoundEdits,
  removeEdit,
  soundFields,
  voiceLines,
} from './audio-model.ts'
import type { AudioSession } from './audio-session.svelte.ts'

const { session }: { session: AudioSession } = $props()
let removing = $state(false)
let adding = $state('')
let playing = $state(false)

const read = $derived(session.read)
const content = $derived(session.content)
const chosen = $derived(session.chosen)
const cue = $derived(chosen.kind === 'sound' ? content?.cue?.[chosen.index] : undefined)
const cueIds = $derived((content?.cue ?? []).map((one) => one.id))

function wordsAt(path: readonly (string | number)[]): string | undefined {
  const found = problemAt(session.problems, path)
  return found === undefined || content === undefined ? undefined : audioProblemWords(found, content)
}

function set(
  path: readonly (string | number)[],
  before: unknown,
  field: Field,
  value: number | string,
): void {
  void session.change(
    `Change ${field.label.toLowerCase()}`,
    [setOrInsert([...path, field.key], before, value)],
    [...path, field.key].join('.'),
  )
}

async function play(id: string): Promise<void> {
  if (content === undefined || playing) return
  playing = true
  try {
    await session.play(content, { kind: 'sound', id })
  } catch (error) {
    session.message = `That could not be played: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    playing = false
  }
}

async function removeChosen(index: number, name: string): Promise<void> {
  const outcome = await session.change(`Remove ${name}`, [removeEdit('cue', index)])
  if (!outcome.ok) return
  removing = false
  session.chosen = index > 0 ? { kind: 'sound', index: index - 1 } : { kind: 'events' }
}

async function addEvent(): Promise<void> {
  const on = adding.trim()
  const first = cueIds[0]
  if (on === '' || content === undefined || first === undefined) return
  const outcome = await session.change('Add what plays when something happens', [
    addEventEdit(content, on, first),
  ])
  if (outcome.ok) adding = ''
}
</script>

{#snippet field(path: readonly (string | number)[], row: object, one: Field)}
  <FieldRow
    label={one.label}
    kind={one.kind}
    value={one.value}
    options={one.kind === 'choice' ? one.options : undefined}
    unit={one.kind === 'number' ? one.unit : undefined}
    min={one.kind === 'number' ? one.min : undefined}
    max={one.kind === 'number' ? one.max : undefined}
    step={one.kind === 'number' ? one.step : undefined}
    problem={wordsAt([...path, one.key])}
    onchange={(value) => set(path, (row as Record<string, unknown>)[one.key], one, value)}
  />
{/snippet}

{#snippet soundView(sound: Cue, index: number)}
  <header class="actions">
    <h2>{sound.id}</h2>
    <Button variant="primary" disabled={playing} onclick={() => void play(sound.id)}>Play</Button>
  </header>
  <div class="fields">
    {#each soundFields(sound) as one (one.key)}{@render field(['cue', index], sound, one)}{/each}
  </div>
  {#each voiceLines(sound) as voice (voice.index)}
    <article class="card" aria-label={voice.words}>
      <header>
        <h3>{voice.words}</h3>
        <Button
          variant="quiet"
          aria-label={`Remove this ${voice.words.toLowerCase()}`}
          onclick={() => void session.change(`Remove a ${voice.words.toLowerCase()}`, [removeEdit('cue', index, 'voices', voice.index)])}
        >
          Remove
        </Button>
      </header>
      <div class="fields">
        {#each voice.fields as one (one.key)}
          {@render field(['cue', index, 'voices', voice.index], sound.voices[voice.index] ?? {}, one)}
        {/each}
      </div>
    </article>
  {:else}
    <p>This sound is silent. Add a tone or a hiss to hear it.</p>
  {/each}
  <div class="actions">
    <Button onclick={() => void session.change('Add a tone', [addVoiceEdit(index, 'tone')])}>Add a tone</Button>
    <Button onclick={() => void session.change('Add a hiss', [addVoiceEdit(index, 'hiss')])}>Add a hiss</Button>
    {@render remover(index, sound.id)}
  </div>
{/snippet}

{#snippet remover(index: number, name: string)}
  {#if removing}
    <span class="actions" role="group" aria-label={`Remove ${name}?`}>
      <p>Remove {name}? Anything that plays it will play nothing.</p>
      <Button variant="danger" onclick={() => void removeChosen(index, name)}>Remove</Button>
      <Button variant="quiet" onclick={() => (removing = false)}>Keep it</Button>
    </span>
  {:else}
    <Button variant="quiet" onclick={() => (removing = true)}>Remove {name}</Button>
  {/if}
{/snippet}

<EditorPage label="Audio">
  {#if session.message !== undefined}<p class="bad" role="alert">{session.message}</p>{/if}
  {#if read.kind === 'missing'}
    <h2>This game has no audio file yet.</h2>
    <p>An audio file holds the game's sounds, which music track plays when, and which sound plays when something happens.</p>
    <div class="actions"><Button variant="primary" onclick={() => void session.start()}>Start an audio file</Button></div>
  {:else if read.kind === 'syntax'}
    <h2>The audio file has a mistake{read.line === undefined ? '' : ` on line ${String(read.line)}`}.</h2>
    <p>It opens read only until the mistake is fixed. Your file is unchanged.</p>
  {:else if content !== undefined && chosen.kind === 'events'}
    <h2>When things happen</h2>
    <p>Each thing that happens in the game can play a sound.</p>
    {#each eventLines(content) as line (line.index)}
      <div class="card" role="group" aria-label={line.words}>
        <h3>{line.words}</h3>
        {#if line.silent !== undefined && cueIds.length === 0}
          <p>Silent: {line.silent}</p>
        {:else}
          <FieldRow
            label="Play"
            kind="choice"
            value={line.cue ?? ''}
            options={[
              ...(line.cue === undefined || cueIds.includes(line.cue) ? [] : [{ value: line.cue, label: line.cue }]),
              ...(line.silent === undefined ? [] : [{ value: '', label: 'Nothing' }]),
              ...cueIds.map((id) => ({ value: id, label: id })),
            ]}
            problem={wordsAt(['event', line.index, 'cue']) ?? wordsAt(['event', line.index, 'on'])}
            onchange={(value) =>
              void session.change(`Play ${String(value)} ${line.words.toLowerCase()}`, eventSoundEdits(content, line.index, String(value)))}
          />
        {/if}
        <div class="actions">
          <Button
            variant="quiet"
            onclick={() => void session.change(`Remove what plays ${line.words.toLowerCase()}`, [removeEdit('event', line.index)])}
          >
            Remove
          </Button>
        </div>
      </div>
    {:else}
      <p>Nothing plays a sound yet.</p>
    {/each}
    {#if cueIds.length > 0}
      <form
        class="actions"
        onsubmit={(event) => {
          event.preventDefault()
          void addEvent()
        }}
      >
        <FieldRow label="What happens in the game?" kind="text" value={adding} onchange={(value) => (adding = String(value))} />
        <Button variant="primary" disabled={adding.trim() === ''} onclick={() => void addEvent()}>Add</Button>
      </form>
    {:else}
      <p>Add a sound first, then choose when it plays.</p>
    {/if}
  {:else if cue !== undefined && chosen.kind === 'sound'}
    {@render soundView(cue, chosen.index)}
  {:else if chosen.kind === 'track' || chosen.kind === 'rules'}
    <AudioMusic {session} />
  {:else}
    <h2>No sounds yet.</h2>
    <p>Add a sound, then choose when it plays.</p>
  {/if}
</EditorPage>
