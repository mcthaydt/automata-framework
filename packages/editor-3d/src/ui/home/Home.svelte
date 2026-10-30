<!--
  The 3D editor's Home (plan ED3D.5c, decisions 2 to 4): the kit's `HomeScreen` (the sources panel, the levels with a
  search, the selected level; the same screen as the 2D editor's) with what is this editor's own: Import folder (a game's
  art folder, each file under the folder's name) and Import zip, and the level summary with Open. New level arrives with
  ED3D.13b. It only wires; the controller decides (`app/home/home-controller.ts`).
-->
<script lang="ts">
import { FilePick, HomeScreen } from '@mcthaydt/automata-editor-kit'
import type { ToastStore, Workspace } from '@mcthaydt/automata-editor-kit/core'
import type { GeometryState } from '@mcthaydt/automata-ui'
import type { HomeController } from '../../app/home/home-controller'
import { levelCard } from '../../app/home/home-model'
import type { ProjectEntry } from '../../app/project-list'
import LevelSummary from './LevelSummary.svelte'

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
