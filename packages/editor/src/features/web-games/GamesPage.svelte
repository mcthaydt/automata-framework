<!--
  The page of the person's own games: the list (Your games) or the one question of a new game. It does what the person
  chose against the games kept in this browser, then moves the page to the address that shows the result, so a
  reload lands in the same place. Everything the page's globals do (moving, saving a file) is handed in.
-->
<script lang="ts">
import { onMount } from 'svelte'
import type { WebGitHubSession } from '../../shared/kit/sync/web-sign-in'
import { openCopy, saveCopy } from './game-copy'
import NewGame from './NewGame.svelte'
import SignIn from './SignIn.svelte'
import type { GameEntry, GameFile, WebGames } from './web-games'
import YourGames from './YourGames.svelte'

interface Props {
  games: WebGames
  mode: 'list' | 'new'
  /** The files a new game starts from. */
  starter: () => readonly GameFile[]
  /** Moves the page to `?…` of its own address. */
  navigate: (search: string) => void
  /** Hands the person a file to keep. */
  save: (name: string, bytes: Uint8Array) => void
  now: () => number
  /** Signing in with GitHub, when the site has it set up; without it no sign-in is offered. */
  session?: WebGitHubSession | undefined
  /** GitHub was refused on the way back (`?github=denied`). */
  denied?: boolean
}

const { games, mode, starter, navigate, save, now, session, denied = false }: Props = $props()

let list = $state.raw<readonly GameEntry[]>([])
let trouble = $state<string | undefined>()

async function reload(): Promise<void> {
  list = await games.list()
}
onMount(() => void reload())

async function make(title: string): Promise<string | undefined> {
  try {
    const game = await games.create(title, starter())
    await games.remember(game.id)
    navigate(`?game=${game.id}`)
    return undefined
  } catch (error) {
    return `Could not make the game: ${error instanceof Error ? error.message : String(error)}`
  }
}

async function open(id: string): Promise<void> {
  await games.remember(id)
  navigate(`?game=${id}`)
}

async function copy(id: string): Promise<void> {
  trouble = undefined
  const game = list.find((entry) => entry.id === id)
  if (game === undefined) return
  save(`${game.id}.zip`, await saveCopy(await games.store(id)))
}

async function importCopy(file: File): Promise<void> {
  trouble = undefined
  const opened = await openCopy(
    new Uint8Array(await file.arrayBuffer()),
    games,
    file.name.replace(/\.zip$/i, ''),
  )
  if (!opened.ok) {
    trouble = opened.why
    return
  }
  await games.remember(opened.game.id)
  navigate(`?game=${opened.game.id}`)
}

async function removeAll(): Promise<void> {
  for (const game of await games.list()) await games.remove(game.id)
  await reload()
}

async function remove(id: string): Promise<void> {
  await games.remove(id)
  await reload()
}
</script>

{#if mode === 'new'}
  <NewGame taken={list.map((game) => game.id)} onmake={make} oncancel={() => navigate('?games')} />
{:else}
  {#if session}
    <div class="sign-in"><SignIn {session} back="/editor/app/?games" {denied} onremoveall={() => void removeAll()} /></div>
  {/if}
  <YourGames
    games={list}
    now={now()}
    kept={games.kept}
    canSignIn={session !== undefined}
    {trouble}
    onopen={(id) => void open(id)}
    onnew={() => navigate('?new=2d')}
    oncopy={(id) => void copy(id)}
    onimport={(file) => void importCopy(file)}
    onremove={(id) => void remove(id)}
  />
{/if}

<style>
  .sign-in {
    max-width: 40rem;
    margin: 0 auto;
    padding: var(--space-4) var(--space-4) 0;
  }
</style>
