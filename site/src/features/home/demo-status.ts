// Bundles are trusted, same-origin outputs. Read their existing boot contract, not iframe load events.
export function demoStatus(doc: Document | null): 'loading' | 'ready' | 'failed' {
  const root = doc?.documentElement
  if (root?.dataset.state === 'failed') return 'failed'
  if (root?.dataset.state === 'ready' || root?.hasAttribute('data-ready')) return 'ready'
  if (doc?.querySelector('.gallery select[name="show"]') && doc.querySelector('.gallery iframe'))
    return 'ready'
  return 'loading'
}
