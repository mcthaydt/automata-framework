/**
 * Mounts a Svelte component with fixture props and no renderer, host or server (M1.6 spec §3.10),
 * the way layout contracts and demos put a primitive on the page.
 */

import { type Component, flushSync, mount, unmount } from 'svelte'

export interface MountedFixture {
  readonly target: HTMLElement
  /** Unmounts the component; removes the target too when `mountFixture` created it. */
  unmount(): Promise<void>
}

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
