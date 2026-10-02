// @vitest-environment jsdom
import { storageSuite } from './storage-suite'

storageSuite('jsdom localStorage (reference)', () => {
  window.localStorage.clear()
  return window.localStorage
})
