try {
  const stored = localStorage.getItem('automata-editor:theme')
  document.documentElement.dataset.theme = stored === 'light' || stored === 'device' ? stored : 'dark'
} catch {
  // Storage refused: the editors open Dark.
  document.documentElement.dataset.theme = 'dark'
}
