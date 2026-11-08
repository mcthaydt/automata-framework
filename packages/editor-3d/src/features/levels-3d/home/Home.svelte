<!--
  The 3D editor's Home (plan ED3D.5c, decisions 2 to 4): the kit's `HomeScreen` (the sources panel, the levels with a
  search, the selected level; the same screen as the 2D editor's) with what is this editor's own: Import folder (a game's
  art folder, each file under the folder's name) and Import zip, and the level summary with Open. New level asks for
  a name and writes an `af-sector/1` level (ED3D.13b). It only wires; the controller decides (`app/home/home-controller.ts`).
-->
<script lang="ts">
import { Button, FilePick, HomeScreen } from '@automata/editor/kit'
import type { ToastStore, Workspace } from '@automata/editor/kit/core'
import type { GeometryState } from '@automata/framework'
import type { HomeController } from './home-controller'
import { levelCard } from './home-model'
import LevelSummary from './LevelSummary.svelte'
import NewLevelDialog from './NewLevelDialog.svelte'
import type { ProjectEntry } from './project-list'

interface Props {
  geometry: GeometryState
  controller: HomeController
  workspace: Workspace
  /** The installed profiles, for the cards' colours. */
  installed: readonly string[]
  toasts: ToastStore
  /** The time the ages on the cards are told against. */
  clock: { now(): number }
}

const { geometry, controller, workspace, installed, toasts, clock }: Props = $props()

let naming = $state(false)

const card = (entry: ProjectEntry) => levelCard(entry, installed)
</script>

<HomeScreen
  {geometry}
  source={controller}
  {card}
  {workspace}
  {toasts}
  {clock}
  emptyHint="Import a folder or a zip to start."
  onopen={(path) => controller.open(path)}
>
  {#snippet importers({ busy })}
    <Button disabled={busy} onclick={() => (naming = true)}>New level…</Button>
    <FilePick
      label="Import folder…"
      directory
      multiple
      {busy}
      testId="import-folder"
      onpick={(files) => controller.importFolder(files)}
    />
    <FilePick
      label="Import zip…"
      accept=".zip,application/zip"
      {busy}
      testId="import-zip"
      onpick={([file]) => {
        if (file !== undefined) void controller.importZip(file)
      }}
    />
  {/snippet}

  {#snippet inspector({ selected, busy, now })}
    <LevelSummary entry={selected} {busy} {now} {installed} onopen={() => controller.open()} />
  {/snippet}
</HomeScreen>
{#if naming}
  <NewLevelDialog oncreate={(name) => void controller.create(name)} onclose={() => (naming = false)} />
{/if}
