import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

// A bare repository served over git's smart HTTP from this process, through `git http-backend`: what GitHub looks
// like to the engine, with no network and no account.

export interface GitServer {
  /** The address to clone from. */
  readonly url: string
  /** The bare repository on disk, for the test to read with `git`. */
  readonly bare: string
  stop(): Promise<void>
  /** Runs `git` inside the bare repository and gives its output. */
  git(...args: string[]): string
}

const IDENTITY = ['-c', 'user.name=Seed', '-c', 'user.email=seed@example.com']

export function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', [...IDENTITY, ...args], { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`)
  return result.stdout.trim()
}

/** A bare repository whose `main` holds `files`, served over HTTP. */
export async function startGitServer(files: Readonly<Record<string, string>>): Promise<GitServer> {
  const root = mkdtempSync(join(tmpdir(), 'af-git-server-'))
  const bare = join(root, 'game.git')
  const seed = join(root, 'seed')
  mkdirSync(seed, { recursive: true })
  git(root, 'init', '--bare', '-b', 'main', bare)
  git(bare, 'config', 'http.receivepack', 'true')
  git(seed, 'init', '-b', 'main')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(seed, path)), { recursive: true })
    writeFileSync(join(seed, path), text)
  }
  git(seed, 'add', '-A')
  git(seed, 'commit', '-m', 'Start')
  git(seed, 'push', bare, 'main')

  const server: Server = createServer((request, response) => {
    const [path, query = ''] = (request.url ?? '/').split('?')
    const child = spawn('git', ['http-backend'], {
      env: {
        PATH: process.env.PATH ?? '',
        GIT_PROJECT_ROOT: root,
        GIT_HTTP_EXPORT_ALL: '1',
        REQUEST_METHOD: request.method ?? 'GET',
        PATH_INFO: path ?? '/',
        QUERY_STRING: query,
        CONTENT_TYPE: request.headers['content-type'] ?? '',
        CONTENT_LENGTH: request.headers['content-length'] ?? '',
        HTTP_CONTENT_ENCODING: request.headers['content-encoding'] ?? '',
        REMOTE_USER: 'test',
        REMOTE_ADDR: '127.0.0.1',
      },
    })
    request.pipe(child.stdin)
    const chunks: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.on('close', () => {
      const output = Buffer.concat(chunks)
      const split = output.indexOf('\r\n\r\n')
      const head = output.subarray(0, split).toString('utf8').split('\r\n')
      let status = 200
      for (const line of head) {
        const colon = line.indexOf(':')
        const name = line.slice(0, colon)
        const value = line.slice(colon + 1).trim()
        if (name.toLowerCase() === 'status') status = Number.parseInt(value, 10)
        else response.setHeader(name, value)
      }
      response.writeHead(status)
      response.end(output.subarray(split + 4))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}/game.git`,
    bare,
    git: (...args) => git(bare, ...args),
    stop: () =>
      new Promise<void>((resolve) => {
        if (!server.listening) return resolve()
        server.closeAllConnections()
        server.close(() => {
          rmSync(root, { recursive: true, force: true })
          resolve()
        })
      }),
  }
}
