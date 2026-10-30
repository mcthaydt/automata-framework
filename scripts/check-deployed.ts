// DX.12's served-file check (DX spec, D-DX-5): /llms.txt and /llms-full.txt are served from the origin as text, with the
// bytes the build wrote. The URL-based instructions for AI tools point at these two files (DX.10d), so they are the
// check that a deploy reached the origin. Until the Owner supplies the host, `--local` runs it against the build on
// serve-static.ts, so the check itself is exercised on every deploy run.
//
//   node --import tsx scripts/check-deployed.ts <origin> [--build build]
//   node --import tsx scripts/check-deployed.ts --local [--build build]
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const SERVED_FILES = ['/llms.txt', '/llms-full.txt'] as const

type Fetch = (url: string) => Promise<Response>

/** What is wrong with each served file, by its path; empty when both match the build. */
export async function checkServedFiles(origin: string, buildDir: string, fetchFile: Fetch = fetch): Promise<string[]> {
  const problems: string[] = []
  for (const path of SERVED_FILES) {
    const built = join(buildDir, path)
    if (!existsSync(built)) {
      problems.push(`${path}: the build has no such file (${built})`)
      continue
    }
    let response: Response
    try {
      response = await fetchFile(new URL(path, origin).href)
    } catch (error) {
      problems.push(`${path}: ${(error as Error).message}`)
      continue
    }
    const type = (response.headers.get('content-type') ?? 'none').split(';')[0]!.trim()
    if (response.status !== 200) problems.push(`${path}: status ${response.status}, expected 200`)
    else if (type !== 'text/plain') problems.push(`${path}: content-type ${type}, expected text/plain`)
    else if (!Buffer.from(await response.arrayBuffer()).equals(readFileSync(built))) problems.push(`${path}: the served bytes differ from the build`)
  }
  return problems
}

async function freePort(): Promise<number> {
  return new Promise(resolvePort => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => resolvePort(port))
    })
  })
}

/** How long serve-static may take to say it is serving before the check gives up. */
const SERVE_TIMEOUT_MS = 15_000

/** Serves the build with serve-static.ts on a free port; resolves with its origin and a stop function. */
async function serveLocally(buildDir: string): Promise<{ origin: string; stop: () => void }> {
  const port = await freePort()
  const script = fileURLToPath(new URL('./serve-static.ts', import.meta.url))
  const server = spawn(process.execPath, ['--import', 'tsx', script, buildDir, String(port)], { stdio: ['ignore', 'pipe', 'inherit'] })
  try {
    await new Promise<void>((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`serve-static did not start within ${SERVE_TIMEOUT_MS} ms`)), SERVE_TIMEOUT_MS)
      server.stdout.on('data', chunk => { if (String(chunk).includes('Serving')) { clearTimeout(timer); done() } })
      server.on('exit', code => { clearTimeout(timer); fail(new Error(`serve-static exited with ${code}`)) })
    })
  } catch (error) {
    server.kill()
    throw error
  }
  return { origin: `http://127.0.0.1:${port}`, stop: () => server.kill() }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { local: { type: 'boolean' }, build: { type: 'string', default: 'build' } },
  })
  const buildDir = resolve(values.build)
  // Exactly one of an origin and --local: an origin given with --local would otherwise go unchecked unnoticed.
  if (Boolean(values.local) === (positionals.length > 0) || positionals.length > 1) {
    console.error('Usage: check-deployed.ts <origin> | --local [--build build]')
    process.exit(2)
  }
  const local = values.local ? await serveLocally(buildDir) : undefined
  const origin = local?.origin ?? positionals[0]!
  let problems: string[]
  try {
    problems = await checkServedFiles(origin, buildDir)
  } finally {
    local?.stop()
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  console.log(`${SERVED_FILES.join(' and ')} are served from ${origin} as built.`)
}
