// How far the foot of the editor shell rises from the bottom of the window: the tab bar, and the status line above it or
// beside the canvas. A toast in the shell's `sheets` sits above that height rather than over the controls under it.
// Without a ResizeObserver (jsdom) nothing is measured and the toast keeps to the window's foot.

interface FootOptions {
  /** The rail's and the status line's elements: both, in this order, once the shell has drawn them. */
  readonly elements: () => readonly [HTMLElement | undefined | null, HTMLElement | undefined | null]
  /** Whether the rail is a bar along the foot (it is a column in the wide layout, and some screens have none). */
  readonly railShown: () => boolean
  readonly statusShown: () => boolean
}

/** Call while a component is set up: it watches the two elements and gives the foot's height as a CSS length. */
export function shellFoot(options: FootOptions): { readonly lift: string } {
  let railHeight = $state(0)
  let statusHeight = $state(0)
  $effect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const [rail, status] = options.elements()
    // A region taken away while shown leaves its binding null, not undefined: measure only elements that are there.
    const measured = [rail, status].filter((element) => element instanceof Element)
    const observer = new ResizeObserver(() => {
      railHeight = rail?.offsetHeight ?? 0
      statusHeight = status?.offsetHeight ?? 0
    })
    for (const element of measured) observer.observe(element)
    return () => observer.disconnect()
  })
  const lift = $derived(
    `${(options.railShown() ? railHeight : 0) + (options.statusShown() ? statusHeight : 0)}px`,
  )
  return {
    get lift() {
      return lift
    },
  }
}
