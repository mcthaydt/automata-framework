/**
 * A width listener for the layout primitives (from FloorFifty `ui/layout/observe-size.ts`).
 *
 * The primitives answer to their own container, never to the viewport. Where a container query
 * can say it in CSS they use one; where the answer depends on measuring (an ActionBar's rows) they
 * measure, and this is the one place they do. A no-op where ResizeObserver is missing, so a
 * component mounts under jsdom and stays in its unmeasured state.
 */
export function observeWidth(node: Element, listener: (width: number) => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {}
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) listener(entry.contentRect.width)
  })
  observer.observe(node)
  return () => observer.disconnect()
}

/** Like `observeWidth`, but for any change of size, height included (a keyboard rising). */
export function observeSize(node: Element, listener: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {}
  const observer = new ResizeObserver(() => listener())
  observer.observe(node)
  return () => observer.disconnect()
}
