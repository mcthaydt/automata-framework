<!--
  Publish on a game's own folder, in two steps. One press makes the zip (on the computer that runs `automata editor`:
  the game is put together and checked for the web). Only then does the dialog ask where to put it: one button for each
  place the editor's server lists (itch.io first; with only one, there is nothing to choose, so its question stands
  open), or the person downloads the zip and uploads it anywhere. A place asks what it needs in one field, with an
  example (filled in when the game already knows it), and when it cannot go on it says the one thing to do next, with
  one green button at a time. While the zip
  is made the dialog says so and cannot be closed by accident; a failure says what to do in a sentence, shows the last
  lines the tools printed and offers Try again. The words are for someone who is not a programmer: the dialog never says "build". The change-set Publish
  (a sample's or a branch's) is `ShipDialog`.
-->
<script lang="ts">
import {
  type GamePublish,
  type PlaceInfo,
  type PlaceResult,
  type PublishResult,
  signInLabel,
} from '../../../shared/kit/storage/publish-client'
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'

interface Props {
  open: boolean
  publish: GamePublish
}

/** The guide the site renders from `docs/guides/publish-to-itch.md`: a person on a tablet has no repository to open. */
const ITCH_GUIDE = 'https://automataframework.com/docs/publish-to-itch'

let { open = $bindable(), publish }: Props = $props()

let phase = $state<'ready' | 'making' | 'done'>('ready')
let result = $state<PublishResult>()
let saving = $state(false)
let places = $state<readonly PlaceInfo[]>([])
let chosen = $state<PlaceInfo>()
let answers = $state<Record<string, string>>({})
let putting = $state(false)
let placed = $state<PlaceResult>()
let signing = $state(false)
let signInProblem = $state<{ problem: string; link?: string }>()
let copied = $state(false)

async function makeZip(): Promise<void> {
  phase = 'making'
  chosen = undefined
  placed = undefined
  result = await publish.publish()
  places = result.ok ? await publish.places() : []
  // One place is no choice to make: its questions are already there.
  if (places.length === 1 && places[0] !== undefined) choose(places[0])
  phase = 'done'
}

async function download(name: string): Promise<void> {
  saving = true
  try {
    await publish.download(name)
  } finally {
    saving = false
  }
}

function choose(place: PlaceInfo): void {
  chosen = place
  placed = undefined
  signInProblem = undefined
  answers = { ...place.known }
}

async function put(): Promise<void> {
  if (chosen === undefined) return
  putting = true
  placed = undefined
  copied = false
  try {
    placed = await publish.putInPlace(chosen.id, answers)
  } finally {
    putting = false
  }
}

async function signIn(): Promise<void> {
  if (chosen === undefined) return
  signing = true
  signInProblem = undefined
  try {
    const done = await publish.signInAtPlace(chosen.id)
    if (done.ok) await put()
    else signInProblem = done
  } finally {
    signing = false
  }
}

/** True when the only next step is to sign in here: Put would fail the same way again. */
function mustSignIn(place: PlaceInfo): boolean {
  return placed?.ok === false && placed.need === 'account' && place.signIn && publish.onThisComputer
}

async function copyLink(link: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(link)
    copied = true
  } catch {
    // Without a clipboard the link is still on the screen to read and press.
  }
}

function close(): void {
  open = false
  phase = 'ready'
  result = undefined
  chosen = undefined
  placed = undefined
}
</script>

<Dialog {open} title="Publish your game" width="wide" dismissible={phase !== 'making' && !putting} onclose={close}>
  {#if phase === 'making'}
    <p class="result" role="status">Making your game’s zip… this can take a minute.</p>
  {:else if phase === 'done' && result?.ok === true}
    <p class="result" role="status">Your game is ready to upload.</p>
    {#if places.length > 1}
      <h3>Where do you want to put it?</h3>
      <div class="places">
        {#each places as place (place.id)}
          <Button aria-pressed={chosen?.id === place.id} onclick={() => choose(place)}>{place.name}</Button>
        {/each}
      </div>
    {/if}
    {#if chosen !== undefined}
      {@const place = chosen}
      <form
        onsubmit={(event) => {
          event.preventDefault()
          void put()
        }}
      >
        {#if place.note !== undefined}<p class="note">{place.note}</p>{/if}
        {#each place.asks as question (question.id)}
          <label>
            <span>{question.label}</span>
            <input type="text" bind:value={answers[question.id]} placeholder={question.example} autocomplete="off" spellcheck="false" />
            <span class="example">Like {question.example}</span>
          </label>
        {/each}
        {#if place.makePage !== undefined}
          <p class="note">No page yet? <a href={place.makePage.href} target="_blank" rel="noreferrer">{place.makePage.label}</a></p>
        {/if}
        {#if !mustSignIn(place)}
          <Button variant="primary" disabled={putting} onclick={() => void put()}>{putting ? 'Putting it there…' : `Put it on ${place.name}`}</Button>
        {/if}
      </form>
      {#if placed?.ok === true}
        <p class="result" role="status">Your game is on {place.name}.</p>
        {#if place.afterNote !== undefined}<p class="note">{place.afterNote}</p>{/if}
        <p><a href={placed.link} target="_blank" rel="noreferrer">{placed.link}</a></p>
        <Button onclick={() => placed?.ok === true && void copyLink(placed.link)}>{copied ? 'Link copied' : 'Copy link'}</Button>
      {:else if placed !== undefined}
        <p class="result" role="alert">{placed.problem}</p>
        {#if placed.need === 'account' && place.signIn}
          {#if publish.onThisComputer}
            <Button variant="primary" disabled={signing} onclick={() => void signIn()}>{signInLabel(place.name)}</Button>
            {#if signing}
              <p class="note" role="status">Finish signing in in the page that opened. This waits for you.</p>
            {/if}
          {:else}
            <p class="note">Finish signing in on your computer, the one that runs the editor, then try again.</p>
          {/if}
          {#if signInProblem !== undefined}
            <p role="alert">{signInProblem.problem}</p>
            {#if signInProblem.link !== undefined}
              <p class="note">If no page opened, open this one:</p>
              <p><a href={signInProblem.link} target="_blank" rel="noreferrer">{signInProblem.link}</a></p>
            {/if}
          {/if}
        {:else if placed.help !== undefined && placed.help.href !== place.makePage?.href}
          <p><a href={placed.help.href} target="_blank" rel="noreferrer">{placed.help.label}</a></p>
        {/if}
        {#if placed.detail !== undefined && placed.detail !== ''}<pre>{placed.detail}</pre>{/if}
      {/if}
    {/if}
    <p class="note">Or upload the zip yourself: on itch.io, make a new project, choose HTML as its kind, and upload this zip. Any website host takes it too.</p>
    <p><a href={ITCH_GUIDE} target="_blank" rel="noreferrer">How to put it on itch.io</a></p>
  {:else if phase === 'done' && result?.ok === false}
    <p class="result" role="alert">{result.problem}</p>
    {#if result.detail !== ''}<pre>{result.detail}</pre>{/if}
  {:else}
    <p>This gets your game ready for the web and makes one zip file. Nothing goes online yet: then you choose where to put it, or download the zip and upload it to itch.io or any website host.</p>
  {/if}
  {#snippet actions()}
    {#if phase === 'done' && result?.ok === true}
      <Button onclick={close}>Close</Button>
      <Button variant={places.length > 0 ? 'plain' : 'primary'} disabled={saving} onclick={() => result?.ok === true && void download(result.name)}>Download the zip</Button>
    {:else if phase === 'done'}
      <Button onclick={close}>Close</Button>
      <Button variant="primary" onclick={() => void makeZip()}>Try again</Button>
    {:else}
      <Button onclick={close} disabled={phase === 'making'}>Cancel</Button>
      <Button variant="primary" disabled={phase === 'making'} onclick={() => void makeZip()}
        >{phase === 'making' ? 'Making…' : 'Make my zip'}</Button
      >
    {/if}
  {/snippet}
</Dialog>

<style>
  p {
    margin: 0;
  }
  .note {
    color: var(--color-text-dim);
  }
  h3 {
    margin: var(--space-3) 0 0;
    font: var(--text-label-12);
  }
  .places {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  form {
    display: grid;
    gap: var(--space-2);
  }
  label {
    display: grid;
    gap: var(--space-1);
    font: var(--text-label-12);
  }
  .example {
    color: var(--color-text-dim);
  }
  input {
    box-sizing: border-box;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: inherit;
    font: var(--text-body-13);
  }
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  pre {
    max-height: 16rem;
    margin: 0;
    overflow: auto;
    padding: var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    font: var(--text-mono-12);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
