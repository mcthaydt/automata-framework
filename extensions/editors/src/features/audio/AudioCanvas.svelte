<!--
  The chosen sound, music track, music order or event page as sentences. A sound is its tones and hisses, each with its pitch, timing
  and loudness; Play sounds it in the page, and nothing plays by itself. The event page says, for each thing that
  happens, which sound plays or why it is silent.
-->
<script lang="ts">
import type { Cue, Voice } from '@automata/audio-synth'
import { Button } from '@automata/editor/kit'
import { problemAt } from '../../shared/content-session.svelte.ts'
import type { Field } from '../../shared/fields.ts'
import { setOrInsert } from '../../shared/fields.ts'
import EditorPage from '../../shared/ui/EditorPage.svelte'
import EventPicker from '../../shared/ui/EventPicker.svelte'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import AudioChecks from './AudioChecks.svelte'
import AudioMix from './AudioMix.svelte'
import AudioMusic from './AudioMusic.svelte'
import AudioPicture from './AudioPicture.svelte'
import {
  addEventEdit,
  addVoiceEdit,
  audioProblemWords,
  eventLines,
  eventSoundEdits,
  flagEdit,
  removeEdit,
  removeSoundEdits,
  rowsPlaying,
  soundFields,
  soundFlags,
  voiceFieldEdit,
  voiceLines,
} from './audio-model.ts'
import type { AudioSession } from './audio-session.svelte.ts'
import {
  keepQuietEdits,
  moveEventEdits,
  quietReasonEdit,
  shadowedRows,
  shadowWords,
  unanswered,
} from './event-model.ts'

const { session }: { session: AudioSession } = $props()
let removing = $state(false)
let adding = $state(false)
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

function setVoice(cue: number, index: number, voice: Voice, field: Field, value: number | string): void {
  void session.change(
    `Change ${field.label.toLowerCase()}`,
    [voiceFieldEdit(cue, index, voice, field, value)],
    ['cue', cue, 'voices', index, field.key].join('.'),
  )
}

async function play(id: string): Promise<void> {
  if (content === undefined || playing) return
  playing = true
  try {
    await session.play(content, { kind: 'sound', id })
    session.heard = true
  } catch (error) {
    session.message = `That could not be played: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    playing = false
  }
}

async function removeChosen(index: number, name: string): Promise<void> {
  if (content === undefined) return
  const outcome = await session.change(`Remove ${name}`, removeSoundEdits(content, index))
  if (!outcome.ok) return
  removing = false
  session.chosen = index > 0 ? { kind: 'sound', index: index - 1 } : { kind: 'events' }
}

// A new row starts on the sound the person looked at last, else the first the game has.
async function addEvent(on: string): Promise<void> {
  const sound = session.recent !== undefined && cueIds.includes(session.recent) ? session.recent : cueIds[0]
  if (content === undefined || sound === undefined) return
  const outcome = await session.change(
    'Add what plays when something happens',
    addEventEdit(content, on, sound),
  )
  if (outcome.ok) adding = false
}

// What the person is looking at is what a new row will play.
$effect(() => {
  if (cue !== undefined) session.recent = cue.id
})
</script>

{#snippet field(path: readonly (string | number)[], row: object, one: Field, commit?: (value: number | string) => void)}
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
    onchange={commit ?? ((value) => set(path, (row as Record<string, unknown>)[one.key], one, value))}
  />
{/snippet}

{#snippet soundView(sound: Cue, index: number)}
  <header class="actions">
    <h2>{sound.id}</h2>
    <Button variant="primary" disabled={playing} onclick={() => void play(sound.id)}>
      {session.heard ? 'Play' : 'Tap to hear'}
    </Button>
  </header>
  <AudioPicture cue={sound} />
  <AudioChecks {session} id={sound.id} />
  <div class="fields">
    {#each soundFields(sound) as one (one.key)}{@render field(['cue', index], sound, one)}{/each}
    {#each soundFlags(sound) as flag (flag.key)}
      <label class="check">
        <input
          type="checkbox"
          checked={flag.on}
          onchange={(event) =>
            void session.change(`Change ${flag.label.toLowerCase()}`, flagEdit(index, sound, flag.key, event.currentTarget.checked))}
        />
        {flag.label}
      </label>
    {/each}
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
          {@render field(['cue', index, 'voices', voice.index], sound.voices[voice.index] ?? {}, one, (value) =>
            setVoice(index, voice.index, sound.voices[voice.index] as Voice, one, value),
          )}
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
      <p>
        Remove {name}?
        {#if content !== undefined && rowsPlaying(content, index) > 0}
          The {rowsPlaying(content, index)} row{rowsPlaying(content, index) === 1 ? '' : 's'} that
          {rowsPlaying(content, index) === 1 ? 'plays' : 'play'} it {rowsPlaying(content, index) === 1 ? 'is' : 'are'} removed too.
        {/if}
      </p>
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
      {@const late = shadowedRows(content).find((each) => each.index === line.index)}
      <div class="card" role="group" aria-label={line.words}>
        <h3>{line.words}</h3>
        {#if late !== undefined}
          <p class="warn">{shadowWords(content.event?.[late.by]?.on ?? '')}</p>
        {/if}
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
        {#if line.silent !== undefined}
          <FieldRow
            label="Quiet because"
            kind="text"
            value={line.silent}
            onchange={(value) =>
              void session.change(`Say why ${line.words.toLowerCase()} is quiet`, [
                quietReasonEdit(line.index, line.silent ?? '', String(value)),
              ])}
          />
        {/if}
        <div class="actions">
          {#if late !== undefined}
            <Button
              variant="primary"
              onclick={() => void session.change(`Move ${line.words.toLowerCase()} up`, moveEventEdits(content, line.index, late.by))}
            >
              Move up
            </Button>
          {/if}
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
    {#if unanswered(content, session.events).length > 0}
      <section class="card" aria-label="Nothing plays yet">
        <h3>Nothing plays yet</h3>
        <p>The game does these things, and no row above answers them.</p>
        {#each unanswered(content, session.events) as missing (missing.id)}
          <div class="fields" role="group" aria-label={missing.words}>
            <p>{missing.words}</p>
            {#if cueIds.length > 0}
              <FieldRow
                label="Pick a sound"
                kind="choice"
                value=""
                options={[{ value: '', label: 'Choose a sound' }, ...cueIds.map((id) => ({ value: id, label: id }))]}
                onchange={(value) =>
                  void session.change(`Play ${String(value)} when ${missing.words}`, addEventEdit(content, missing.id, String(value)))}
              />
            {/if}
            <div class="actions">
              <Button
                variant="quiet"
                onclick={() => void session.change(`Keep ${missing.words} quiet`, keepQuietEdits(content, missing.id))}
              >
                Keep it quiet
              </Button>
            </div>
          </div>
        {/each}
      </section>
    {/if}
    {#if cueIds.length > 0}
      {#if adding}
        <EventPicker
          events={session.events}
          answered={new Set((content.event ?? []).map((row) => row.on))}
          onpick={(on) => void addEvent(on)}
          oncancel={() => (adding = false)}
        />
      {:else}
        <div class="actions"><Button variant="primary" onclick={() => (adding = true)}>Add what happens</Button></div>
      {/if}
    {:else}
      <p>Add a sound first, then choose when it plays.</p>
    {/if}
  {:else if cue !== undefined && chosen.kind === 'sound'}
    {@render soundView(cue, chosen.index)}
  {:else if chosen.kind === 'mix'}
    <AudioMix {session} />
  {:else if chosen.kind === 'track' || chosen.kind === 'rules'}
    <AudioMusic {session} />
  {:else}
    <h2>No sounds yet.</h2>
    <p>Add a sound, then choose when it plays.</p>
  {/if}
</EditorPage>

<style>
  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--size-hit);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .warn {
    color: var(--color-state-warn);
  }
  .check input {
    width: 1.25rem;
    height: 1.25rem;
  }
</style>
