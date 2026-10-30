// Spike S7's build and server, shared by measure.ts (part 1) and e2e/gpu.e2e.ts (part 2, the GPU runner): builds the
// pages with Vite and serves a build with the headers Ruken would send (`compileHeaders` from the vendored
// @ruken/manifest on ./ruken.toml: Ruken's CSP with no 'unsafe-eval').
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, resolve } from 'node:path'
import { compileHeaders, parseManifest } from '@ruken/manifest'

const here = import.meta.dirname

export interface Build {
  readonly name: string
  readonly dir: string
}

/** A production build of every page into `<outRoot>/build-<name>`; `variant` sets S7_VARIANT (vite.config.ts). */
export function viteBuild(outRoot: string, name: string, variant?: string): Build {
  const dir = join(outRoot, `build-${name}`)
  execFileSync(join(here, 'node_modules/.bin/vite'), ['build', '--logLevel', 'warn'], {
    cwd: here,
    stdio: 'inherit',
    env: { ...process.env, S7_OUT: dir, ...(variant ? { S7_VARIANT: variant } : {}) },
  })
  return { name, dir }
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
}

/** Serves `build` on a free localhost port with Ruken's headers for that origin. */
export async function serve(build: Build): Promise<{ server: Server; origin: string; csp: string }> {
  const parsed = parseManifest(readFileSync(join(here, 'ruken.toml'), 'utf8'))
  if (!parsed.ok) throw new Error(`ruken.toml: ${JSON.stringify(parsed.errors)}`)
  let headers: Record<string, string> = {}
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname)).replace(
      /^\/+/,
      '',
    )
    const file = resolve(build.dir, path === '' ? 'index.html' : path)
    if (!file.startsWith(build.dir) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      ...headers,
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    })
    response.end(readFileSync(file))
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  headers = compileHeaders(parsed.manifest, { hostOrigins: [origin] })
  return { server, origin, csp: headers['Content-Security-Policy'] ?? '' }
}
