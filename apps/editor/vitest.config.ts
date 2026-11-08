import { defineTests } from '@mcthaydt/vitest-preset'

// The app's pure logic (compile a game, the app's store, sync, Review) runs on Node against fakes; the page and the
// real Tauri window are proved by the browser and e2e suites of later tasks.
export default defineTests({ browsers: [] })
