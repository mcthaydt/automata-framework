import { type EditorSize, REST } from '@mcthaydt/automata-editor-kit/testing'
import { publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '../ui/boot'
import { createTestClock, type MemoryWorkspace, memoryWorkspace } from './memory-workspace'

// Starting the 3D editor for a layout test (plan ED3D.5c step 9): at a window size, with the real window and so the
// real geometry owner, over a memory workspace a test fills first. `main.ts` starts it the same way.

let started: EditorHandle | undefined
let target: HTMLElement | undefined

/** Takes the editor of the last test off the page. */
export async function stopEditor(): Promise<void> {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
}

export async function startAt(
  size: EditorSize,
  fill: (workspace: MemoryWorkspace) => Promise<void>,
): Promise<{ conditions: ReturnType<typeof publishConditions>; workspace: MemoryWorkspace }> {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST)
  const clock = createTestClock(Date.now())
  const workspace = memoryWorkspace(clock)
  await fill(workspace)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startEditor(target, {
    window,
    document,
    workspace,
    clock: {
      now: () => Date.now(),
      setTimer: (ms, run) => window.setTimeout(run, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    },
  })
  await settleLayout()
  return { conditions, workspace }
}
