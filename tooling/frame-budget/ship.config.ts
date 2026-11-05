import { defineShipConfig } from '@mcthaydt/automata-tools'

// The stress example's Ruken manifest: only so `vite preview` serves its build with the headers Ruken would
// (`previewHeaders`, Ruken's CSP with no eval), as spike S8 measured. It is never published.
export default defineShipConfig({
  game: {
    id: 'af-stress-core',
    title: 'AF core stress',
    version: '0.0.0',
    entry: 'index.html',
    sdk: '^0.0.0',
  },
  runtime: {
    renderer: 'webgl2',
    orientation: 'any',
    inputs: ['touch', 'keyboard'],
    pause_behavior: 'pause',
  },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})
