import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileHeaders } from '@ruken/manifest'
import { Effect } from 'effect'
import { FileError, type ProcessError } from '../../../node/errors.ts'
import { Files } from '../../../node/files.ts'
import { ProcessRunner } from '../../../node/process-runner.ts'
import { buildIdFor } from '../../deploy/build-id.ts'
import { DeployFailed, type ManifestInvalid } from '../../errors.ts'
import { checkManifest } from './check-manifest.ts'

// `ship deploy-dev`: sends a prepared build to the standalone dev host, where the host's
// `deploy` script installs it at /builds/<buildId>/. The tarball carries the build folder as client/, a
// build.json naming it, and headers.json: the headers Ruken would serve this build with (@ruken/manifest's
// compileHeaders), so a build that breaks under Ruken's CSP breaks on the dev host too. The host is reached
// only through `ssh <target> deploy`, whose forced command (deploy/bin/ssh-deploy) can do nothing else.

/**
 * What `deployDev` sends and where: a prepared build folder, the commit it came from, the dev host's ssh
 * target and URL, and whether the build becomes the one `/` redirects to.
 */
export interface DeployDevInput {
  /** A build folder `ship prepare` has written `ruken.toml` into. */
  readonly distDir: string
  readonly commit: { readonly sha: string; readonly time: Date }
  readonly tag: string | undefined
  readonly branch: string | undefined
  /** The ssh destination, e.g. `deploy@af-dev.example.com`. */
  readonly target: string
  /** The dev host's URL, e.g. `https://af-dev.example.com`. It is also the page allowed to frame the game. */
  readonly siteUrl: string
  /** Also make this build the one `/` redirects to. */
  readonly activate: boolean
  /** The deploy key, when it is not in ~/.ssh (CI writes it to the runner's temp folder and removes it). */
  readonly sshKeyFile?: string | undefined
  /** The dev host's known_hosts line, beside the key. */
  readonly knownHostsFile?: string | undefined
}

/** ssh options: batch mode, plus only the given key and known hosts when CI passes them. */
function sshOptions(input: DeployDevInput): string[] {
  const options = ['-o', 'BatchMode=yes']
  if (input.sshKeyFile !== undefined) options.push('-i', input.sshKeyFile, '-o', 'IdentitiesOnly=yes')
  if (input.knownHostsFile !== undefined) options.push('-o', `UserKnownHostsFile=${input.knownHostsFile}`)
  return options
}

export type DeployDevError = DeployFailed | ManifestInvalid | FileError | ProcessError

/**
 * Sends a prepared build to the dev host and returns its build ID and the URL it is served at. Fails with
 * `ManifestInvalid` for a bad `ruken.toml` in the build, `DeployFailed` when `tar` or `ssh` exits non-zero,
 * or a `FileError` or `ProcessError`. The temporary staging copy is removed either way.
 */
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
        [...sshOptions(input), input.target, input.activate ? 'deploy --activate' : 'deploy'],
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
