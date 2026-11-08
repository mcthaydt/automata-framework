/**
 * Mounts a Svelte component with fixture props and no renderer, host or server,
 * the way layout contracts and demos put a primitive on the page.
 */

import { type Component, flushSync, mount, unmount } from 'svelte'

/** A mounted Svelte fixture: the element it was mounted into and a way to unmount it. */
export interface MountedFixture {
  readonly target: HTMLElement
  /** Unmounts the component; removes the target too when `mountFixture` created it. */
  unmount(): Promise<void>
}

/**
 * Mounts a Svelte component with the given props and no renderer or host, and flushes effects so the first
 * render is finished. Mounts into `target`, or into a new `div` in `document.body`, which `unmount` removes.
 */
export function mountFixture<Props extends Record<string, unknown>>(
  component: Component<Props>,
  props: Props,
  target?: HTMLElement,
): MountedFixture {
  const owned = target === undefined
  const host = target ?? document.body.appendChild(document.createElement('div'))
  const instance = mount(component, { target: host, props })
  // Effects run now, so a test measures the finished first render.
  flushSync()
  return {
    target: host,
    async unmount() {
      await unmount(instance)
      if (owned) host.remove()
    },
  }
}
