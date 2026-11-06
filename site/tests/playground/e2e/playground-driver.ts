import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { playgroundFrameOrigin } from '@mcthaydt/examples-runner/host/ports'
import { expect, type Page } from '@playwright/test'

// What the playground's browser cases share: the test-only compile and a parent that frames an example and logs what
// its frame says. The site's compile step does not exist here, so the source's types are stripped with Node's own
// stripper (which keeps every line where it was), import.meta.url is rewritten and a sourceURL names the file, as the
// compile step will do. Every wait is on a message from the frame, never a sleep.

export interface Message {
  readonly type: string
  readonly runId?: number
  readonly phase?: string
  readonly message?: string
  readonly line?: number
  readonly hung?: boolean
  readonly golden?: string
  readonly hash?: string
  readonly ticks?: number
}

export const examples = new URL('../../../../examples/2d/', import.meta.url)

export function compiled(module: string, name: string, source?: string): string {
  const file = `${module}/${module}-${name}.ts`
  const text = source ?? readFileSync(new URL(file, examples), 'utf8')
  const moduleUrl = `${playgroundFrameOrigin}/playground/examples/${file}`
  return `${stripTypeScriptTypes(text).replaceAll('import.meta.url', JSON.stringify(moduleUrl))}\n//# sourceURL=examples/${file}\n`
}

export async function run(
  page: Page,
  module: string,
  name: string,
  code: string,
  determinism?: { ticks: number; replay?: string },
): Promise<void> {
  await page.goto(`${playgroundFrameOrigin}/`)
  await page.evaluate(
    ([url, text, check]) =>
      (window as unknown as { run(u: string, c: string, d?: unknown): void }).run(
        url,
        text,
        check ?? undefined,
      ),
    [`/playground/examples/${module}/${name}/`, code, determinism ?? null] as const,
  )
}

export const log = (page: Page) =>
  page.evaluate(() => (window as unknown as { frameLog: Message[] }).frameLog)

export async function waitFor(page: Page, type: string): Promise<Message> {
  await expect
    .poll(async () => (await log(page)).map((message) => message.type), { timeout: 20_000 })
    .toContain(type)
  return (await log(page)).find((message) => message.type === type) as Message
}
