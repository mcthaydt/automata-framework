// The packed `automata editor` in the consumer project: it starts on a folder, prints its address, and serves the 2D
// editor's page there. This is the proof that the editor really is inside the published `-tools` package.
import { spawn } from 'node:child_process'

/** Starts `automata editor <folder> --port 0`, fetches the page it serves, stops it, and says what it saw. */
export function fetchEditorPage(automataBin: string, folder: string): Promise<string> {
  const child = spawn(automataBin, ['editor', folder, '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] })
  return new Promise((done, fail) => {
    let output = ''
    let settled = false
    const finish = (settle: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      settle()
    }
    const timer = setTimeout(
      () => finish(() => fail(new Error(`no address within 20 s:\n${output}`))),
      20_000,
    )
    const read = (chunk: Buffer) => {
      output += chunk.toString()
      const url = /This computer: (http:\/\/127\.0\.0\.1:\d+)/.exec(output)?.[1]
      if (url === undefined) return
      fetch(`${url}/`).then(
        async (page) => {
          const html = await page.text()
          finish(() =>
            page.status === 200 && html.includes('<html')
              ? done(`served the page at ${url}`)
              : fail(new Error(`the page was ${page.status}:\n${html.slice(0, 200)}`)),
          )
        },
        (error: unknown) => finish(() => fail(error instanceof Error ? error : new Error(String(error)))),
      )
    }
    child.stdout.on('data', read)
    child.stderr.on('data', read)
    child.on('exit', (code) => finish(() => fail(new Error(`exited ${code} before serving:\n${output}`))))
  })
}
