<!--
  Home, from the approved mockup (v2, 2026-11-08): the claim and the game it makes, a numbers row read from the
  workspace, who made a game with it, the code beside what it draws, the same game in every browser, the editor,
  six examples, the four places a game goes, the latest changes, and one closing ask. One lime button per screen
  (Make a game); everything else is the secondary or a plain link. Every claim is something the framework does today
  (`home-content.ts` holds them, and its test holds them to the framework). Each section is a component of its own.
-->
<script lang="ts">
import './home.css'
import HomeChangelog from './HomeChangelog.svelte'
import HomeCode from './HomeCode.svelte'
import HomeDeterminism from './HomeDeterminism.svelte'
import HomeEditor from './HomeEditor.svelte'
import HomeExamples from './HomeExamples.svelte'
import HomeFacts from './HomeFacts.svelte'
import HomeHero from './HomeHero.svelte'
import HomeMadeWith from './HomeMadeWith.svelte'
import HomeStart from './HomeStart.svelte'
import HomeTargets from './HomeTargets.svelte'
</script>

<HomeHero />
<HomeFacts />
<HomeMadeWith />
<HomeCode />
<HomeDeterminism />
<HomeEditor />
<HomeExamples />
<HomeTargets />
<HomeChangelog />
<HomeStart />
