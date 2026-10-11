import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileError, Files, type ProcessError, ProcessRunner } from '@mcthaydt/automata-node'
import { compileHeaders } from '@ruken/manifest'
import { Effect } from 'effect'
import { DeployFailed, type ManifestInvalid } from '../errors.ts'
import { checkManifest } from '../manifest/check-manifest.ts'
import { buildIdFor } from './build-id.ts'

// `ship deploy-dev` (ship spec §3.5, D-4): sends a prepared build to the standalone dev host, where the host's
// `deploy` script installs it at /builds/<buildId>/. The tarball carries the build folder as client/, a
// build.json naming it, and headers.json: the headers Ruken would serve this build with (@ruken/manifest's
// compileHeaders), so a build that breaks under Ruken's CSP breaks on the dev host too. The host is reached
// only through `ssh <target> deploy`, whose forced command (deploy/bin/ssh-deploy) can do nothing else.

export interface DeployDevInput {
  /** A build folder `ship prepare` has written `ruken.toml` into. */
  readonly distDir: string
  readonly commit: { readonly sha: string; readonly time: Date }
  readonly tag: string | undefined
  readonly branch: string | undefined
  /** The ssh destination, e.g. `deploy@af-dev.floorfifty.duckdns.org`. */
  readonly target: string
  /** The dev host's URL, e.g. `https://af-dev.floorfifty.duckdns.org`. It is also the page allowed to frame the game. */
  readonly siteUrl: string
  /** Also make this build the one `/` redirects to. */
  readonly activate: boolean
}

export type DeployDevError = DeployFailed | ManifestInvalid | FileError | ProcessError

export function deployDev(
  input: DeployDevInput,
): Effect.Effect<{ buildId: string; url: string }, DeployDevError, Files | ProcessRunner> {
  return Effect.gen(function* () {
    const files = yield* Files
    const runner = yield* ProcessRunner
    const manifest = yield* checkManifest(yield* files.readText(join(input.distDir, 'ruken.toml')))
    const buildId = buildIdFor(input.commit)
    const siteUrl = input.siteUrl.replace(/\/+$/, '')

    const work = yield* Effect.try({
      try: () => mkdtempSync(join(tmpdir(), 'ship-deploy-dev-')),
      catch: (cause) => new FileError({ path: tmpdir(), cause }),
    })
    const staging = join(work, 'build')
    const tarball = join(work, 'build.tgz')

    const send = Effect.gen(function* () {
      yield* Effect.try({
        try: () => cpSync(input.distDir, join(staging, 'client'), { recursive: true }),
        catch: (cause) => new FileError({ path: input.distDir, cause }),
      })
      const build = {
        buildId,
        commit: input.commit.sha,
        tag: input.tag ?? null,
        branch: input.branch ?? null,
        version: manifest.game.version,
      }
      yield* files.writeText(join(staging, 'build.json'), `${JSON.stringify(build, null, 2)}\n`)
      const headers = {
        headers: compileHeaders(manifest, { hostOrigins: [siteUrl] }),
        entry: manifest.game.entry,
      }
      yield* files.writeText(join(staging, 'headers.json'), `${JSON.stringify(headers, null, 2)}\n`)

      const tar = yield* runner.run('tar', ['-czf', tarball, '-C', staging, '.'])
      if (tar.exitCode !== 0) {
        return yield* new DeployFailed({ step: 'tar', exitCode: tar.exitCode, output: tar.stderr })
      }
      const bytes = yield* Effect.try({
        try: () => new Uint8Array(readFileSync(tarball)),
        catch: (cause) => new FileError({ path: tarball, cause }),
      })
      const ssh = yield* runner.run(
        'ssh',
        ['-o', 'BatchMode=yes', input.target, input.activate ? 'deploy --activate' : 'deploy'],
        { stdin: bytes, echo: true },
      )
      if (ssh.exitCode !== 0) {
        return yield* new DeployFailed({
          step: 'ssh',
          exitCode: ssh.exitCode,
          output: ssh.stderr || ssh.stdout,
        })
      }
      return { buildId, url: `${siteUrl}/builds/${buildId}/` }
    })
    // The staging copy is removed whether the deploy worked or not.
    return yield* Effect.ensuring(send, Effect.orDie(files.remove(work)))
  })
}
