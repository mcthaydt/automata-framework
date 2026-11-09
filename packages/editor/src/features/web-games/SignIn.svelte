<!--
  The sign-in card on Your games. Signed out: what signing in is for, in one line, and the button. Signed in: who, "Your games
  stay on this device.", Sign out, and a second way out that also removes the games from this browser (it asks first).
  After GitHub said no it says so once. The page that mounts it hands in the session and says what removing the games
  does; with no session (the site has no sign-in set up) nothing is drawn.
-->
<script lang="ts">
import type { WebGitHubSession } from '../../shared/kit/sync/web-sign-in'
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'

interface Props {
  session: WebGitHubSession
  /** Where the person comes back to after GitHub. */
  back: string
  /** The address said GitHub was refused (`?github=denied`). */
  denied?: boolean
  /** Removes every game from this browser; run after the person confirmed. */
  onremoveall: () => void
}

const { session, back, denied = false, onremoveall }: Props = $props()

let signedIn = $state<boolean | undefined>(session.signedIn)
let login = $state<string | undefined>()
let confirming = $state(false)

$effect(() => {
  const read = () => {
    signedIn = session.signedIn
    if (session.signedIn === true) void session.login().then((name) => (login = name))
    else login = undefined
  }
  const stop = session.subscribe(read)
  // The first look: the function says whether a sign-in is already kept for this browser.
  void session.token().then(read)
  return stop
})
</script>

{#if signedIn !== undefined}
  <section class="card" aria-label="Sign in" data-testid="sign-in">
    {#if signedIn}
      <p class="who">Signed in{login ? ` as ${login}` : ''}.</p>
      <p class="note">Your games stay on this device.</p>
      <div class="acts">
        <Button onclick={() => void session.signOut()}>Sign out</Button>
        <Button variant="quiet" onclick={() => (confirming = true)}>Sign out and remove my games from this browser</Button>
      </div>
    {:else}
      {#if denied}<p class="trouble" role="alert">GitHub said no. Start again if you want to connect.</p>{/if}
      <h2>Keep your games on all your devices</h2>
      <p class="note">Your games are kept in your own GitHub account. Automata keeps nothing.</p>
      <Button variant="primary" onclick={() => session.signIn(back)}>Sign in with GitHub (free)</Button>
    {/if}
  </section>
{/if}

<Dialog bind:open={confirming} title="Remove your games from this browser?">
  <p>Sign out and remove every game from this browser? A copy on GitHub stays. A game that is only on this device is gone, so save a copy first.</p>
  {#snippet actions({ close })}
    <Button variant="quiet" onclick={close}>Keep them</Button>
    <Button
      variant="danger"
      onclick={() => {
        void session.signOut().then(onremoveall)
        close()
      }}>Sign out and remove</Button
    >
  {/snippet}
</Dialog>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--paper);
    color: var(--ink);
    font: var(--text-body-13);
  }
  h2 {
    margin: 0;
    font: var(--text-title-15);
  }
  p {
    margin: 0;
  }
  .note {
    color: var(--muted);
  }
  .trouble {
    color: var(--bad);
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
