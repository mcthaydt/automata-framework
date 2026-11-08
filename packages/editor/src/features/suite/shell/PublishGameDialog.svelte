<!--
  Publish on a game's own folder, in three plain steps: build the game (one press, on the computer that runs
  `automata editor`, which also checks it is ready for the web), download the one zip it makes, upload that. The step
  the person is on is marked, and its button is the dialog's one lime one. While it builds, the dialog says so and cannot
  be closed by accident; a build that fails says what to do in a sentence, shows the build's last lines and offers
  Try again. The change-set Publish (a sample's or a branch's) is `ShipDialog`.
-->
<script lang="ts">
import type { GamePublish, PublishResult } from '../../../shared/kit/storage/publish-client'
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'

interface Props {
  open: boolean
  publish: GamePublish
}

let { open = $bindable(), publish }: Props = $props()

const STEPS = ['Build your game', 'Download the zip', 'Upload it to itch.io or any website host'] as const

let phase = $state<'ready' | 'building' | 'done'>('ready')
let result = $state<PublishResult>()
let saving = $state(false)

async function build(): Promise<void> {
  phase = 'building'
  result = await publish.publish()
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

/** The step the person is on: build until a good build, then download, which is the last they do in the editor. */
const step = $derived(phase === 'done' && result?.ok === true ? 1 : 0)

function close(): void {
  open = false
  phase = 'ready'
  result = undefined
}
</script>

<Dialog {open} title="Put your game online" width="wide" dismissible={phase !== 'building'} onclose={close}>
  <p>Publish builds your game and checks it is ready for the web. You get one zip file to upload to itch.io or any website host.</p>
  <ol class="steps">
    {#each STEPS as words, index (words)}
      <li aria-current={index === step ? 'step' : undefined}>{words}</li>
    {/each}
  </ol>
  {#if phase === 'building'}
    <p class="result" role="status">Building your game… this can take a minute.</p>
  {:else if phase === 'done' && result?.ok === true}
    <p class="result" role="status">Your game is ready to upload.</p>
    <p class="note">On itch.io, make a new project, choose HTML as its kind, and upload this zip. Any website host takes it too.</p>
  {:else if phase === 'done' && result?.ok === false}
    <p class="result" role="alert">{result.problem}</p>
    {#if result.detail !== ''}<pre>{result.detail}</pre>{/if}
  {/if}
  {#snippet actions()}
    {#if phase === 'done' && result?.ok === true}
      <Button onclick={close}>Close</Button>
      <Button variant="primary" disabled={saving} onclick={() => result?.ok === true && void download(result.name)}>Download the zip</Button>
    {:else if phase === 'done'}
      <Button onclick={close}>Close</Button>
      <Button variant="primary" onclick={() => void build()}>Try again</Button>
    {:else}
      <Button onclick={close} disabled={phase === 'building'}>Cancel</Button>
      <Button variant="primary" disabled={phase === 'building'} onclick={() => void build()}
        >{phase === 'building' ? 'Building…' : 'Build my game'}</Button
      >
    {/if}
  {/snippet}
</Dialog>

<style>
  p {
    margin: 0;
  }
  .note {
    color: var(--muted);
  }
  .steps {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: step;
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    color: var(--muted);
    font: var(--text-body-13);
    counter-increment: step;
  }
  .steps li::before {
    content: counter(step);
    display: grid;
    place-items: center;
    flex: none;
    width: 20px;
    height: 20px;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    font: var(--text-mono-12);
  }
  .steps li[aria-current='step'] {
    border-color: var(--line-strong);
    color: var(--ink);
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
