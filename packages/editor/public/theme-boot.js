try {
  const stored = localStorage.getItem('automata-editor:theme')
  if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored
} catch {
  // Storage refused: the device decides.
}
