/// <reference lib="webworker" />
import { compileExample } from './compile'

// The compile worker: Babel and sucrase run off the page's main thread, and are downloaded only when the
// editor is (F2). It answers `{ seq, result }` to each `{ seq, source, example }`; the page drops any answer whose
// `seq` is not the latest it sent (`live.ts`).

self.onmessage = (
  event: MessageEvent<{ seq: number; source: string; example: { id: string; moduleUrl: string } }>,
) => {
  const { seq, source, example } = event.data
  self.postMessage({ seq, result: compileExample(source, example) })
}
