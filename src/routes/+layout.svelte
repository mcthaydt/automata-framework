<script lang="ts">
  import '../app.css'
  import Header from '$lib/components/Header.svelte'
  import Footer from '$lib/components/Footer.svelte'
  import CommandMenu from '$lib/components/CommandMenu.svelte'

  interface Props {
    children?: import('svelte').Snippet
  }

  let { children }: Props = $props()
  let isSearchOpen = $state(false)

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      isSearchOpen = !isSearchOpen
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
  <Header onOpenSearch={() => (isSearchOpen = true)} />
  <div class="flex-1">
    {@render children?.()}
  </div>
  <Footer />
  <CommandMenu isOpen={isSearchOpen} onClose={() => (isSearchOpen = false)} />
</div>
