import { type ComponentProps, mount, unmount } from 'svelte'
import BootFailurePanel from '../../shared/ui/status/BootFailurePanel.svelte'
import ErrorPanel from '../../shared/ui/status/ErrorPanel.svelte'
import LoaderOverlay from '../../shared/ui/status/LoaderOverlay.svelte'

export interface LoaderControls {
  setProgress(fraction: number | undefined): void
  setSlow(slow: boolean): void
  close(): void
}

export interface PageLayers {
  readonly root: HTMLElement
  readonly stage: HTMLElement
  readonly screens: HTMLElement
  readonly overlay: HTMLElement
  setState(state: 'loading' | 'ready' | 'failed'): void
  showLoader(options: { label: string; slowLabel: string }): LoaderControls
  showBootFailure(props: ComponentProps<typeof BootFailurePanel>): () => void
  showError(props: ComponentProps<typeof ErrorPanel>): () => void
  dispose(): void
}

/**
 * Creates the three-layer runtime DOM structure (stage, screens, overlay)
 * and manages mount/unmount of status overlays (spec §4 step 1, §6).
 */
export function createPageLayers(root: HTMLElement, doc: Document = document): PageLayers {
  const stage = doc.createElement('div')
  stage.setAttribute('data-layer', 'stage')

  const screens = doc.createElement('div')
  screens.setAttribute('data-layer', 'screens')

  const overlay = doc.createElement('div')
  overlay.setAttribute('data-layer', 'overlay')

  root.appendChild(stage)
  root.appendChild(screens)
  root.appendChild(overlay)

  const activeUnmounts = new Set<() => void>()
  let disposed = false

  return {
    root,
    stage,
    screens,
    overlay,
    setState(state: 'loading' | 'ready' | 'failed') {
      if (disposed) return
      doc.documentElement.setAttribute('data-state', state)
    },
    showLoader(options: { label: string; slowLabel: string }): LoaderControls {
      if (disposed) {
        return {
          setProgress: () => {},
          setSlow: () => {},
          close: () => {},
        }
      }

      const loaderState = $state<{
        label: string
        slowLabel: string
        progress: number | undefined
        slow: boolean
      }>({
        label: options.label,
        slowLabel: options.slowLabel,
        progress: undefined,
        slow: false,
      })

      const instance = mount(LoaderOverlay, {
        target: overlay,
        props: loaderState,
      })

      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        activeUnmounts.delete(close)
        unmount(instance)
      }
      activeUnmounts.add(close)

      return {
        setProgress(fraction) {
          loaderState.progress = fraction
        },
        setSlow(slow) {
          loaderState.slow = slow
        },
        close,
      }
    },
    showBootFailure(props: ComponentProps<typeof BootFailurePanel>): () => void {
      if (disposed) return () => {}
      const instance = mount(BootFailurePanel, {
        target: overlay,
        props,
      })

      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        activeUnmounts.delete(close)
        unmount(instance)
      }
      activeUnmounts.add(close)
      return close
    },
    showError(props: ComponentProps<typeof ErrorPanel>): () => void {
      if (disposed) return () => {}
      const instance = mount(ErrorPanel, {
        target: overlay,
        props,
      })

      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        activeUnmounts.delete(close)
        unmount(instance)
      }
      activeUnmounts.add(close)
      return close
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const unmountFn of [...activeUnmounts]) {
        unmountFn()
      }
      activeUnmounts.clear()
      root.replaceChildren()
    },
  }
}
