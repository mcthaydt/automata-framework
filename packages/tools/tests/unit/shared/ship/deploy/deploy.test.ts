import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// Runs the host's `deploy` script for real (bash, tar, node) against a temporary SHIP_ROOT, with a stub
// `caddy` that records its arguments and fails `validate` when CADDY_FAIL_VALIDATE=1, or, with
// CADDY_FAIL_RELOAD=1 fails `reload`, and with CADDY_REQUIRE_SITE=1 fails when the Caddyfile's {$AF_DEV_SITE} would be empty (as real Caddy rejects it).

const deployScript = join(import.meta.dirname, '../../../../../deploy/bin/deploy')

// Every temporary folder a test makes, removed when the file's tests are done.
const temporary: string[] = []
function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  temporary.push(dir)
  return dir
}
afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true })
})

interface TarballOptions {
  // Changes the source folder before it is packed (adds links, odd modes).
  readonly prepare?: (dir: string) => void
  // Extra tar arguments, before the member list (--owner, -P; a member rename is spelled per tar flavor).
  readonly tarArgs?: readonly string[]
  // Members to pack instead of `.`.
  readonly members?: readonly string[]
}

// GNU tar and bsdtar (macOS `tar`) spell a member rename differently; `-P` works on both. The deploy script runs
// on the VM's GNU tar, but this suite also runs on a developer's macOS, whose `tar` is bsdtar.
const GNU_TAR: boolean = execFileSync('tar', ['--version'], { encoding: 'utf8' }).includes('GNU tar')

/** Rename a packed member to `to`: GNU tar `--transform`, bsdtar `-s`. */
const renameMember = (from: string, to: string): string[] =>
  GNU_TAR ? ['--transform', `s|${from}|${to}|`] : ['-s', `|${from}|${to}|`]

function tarball(files: Record<string, string>, options: TarballOptions = {}): string {
  const dir = temp('ship-deploy-src-')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  options.prepare?.(dir)
  const out = join(temp('ship-deploy-tgz-'), 'build.tgz')
  execFileSync('tar', ['-czf', out, ...(options.tarArgs ?? []), '-C', dir, ...(options.members ?? ['.'])])
  return out
}

const buildFiles = (id: string, title = 'Placeholder'): Record<string, string> => ({
  'build.json': JSON.stringify({ buildId: id, commit: id.slice(13), tag: null, branch: 'main' }),
  'headers.json': JSON.stringify({ headers: { 'X-Content-Type-Options': 'nosniff' }, entry: 'index.html' }),
  'client/index.html': `<title>${title}</title>`,
})

const goodBuild = (id: string, title = 'Placeholder') => tarball(buildFiles(id, title))

function host() {
  const root = temp('ship-deploy-root-')
  const bin = temp('ship-deploy-bin-')
  const caddy = join(bin, 'caddy')
  writeFileSync(
    caddy,
    [
      '#!/usr/bin/env bash',
      'echo "$*" >> "$CADDY_LOG"',
      'if [[ "$1" == validate && "${CADDY_FAIL_VALIDATE:-0}" == 1 ]]; then exit 1; fi',
      'if [[ "$1" == reload && "${CADDY_FAIL_RELOAD:-0}" == 1 ]]; then exit 1; fi',
      'if [[ "${CADDY_REQUIRE_SITE:-0}" == 1 ]]; then',
      '  [[ -n "${AF_DEV_SITE:-}" && -n "${AF_ACME_EMAIL:-}" ]] || { echo "empty site" >&2; exit 1; }',
      '  echo "site=$AF_DEV_SITE" >> "$CADDY_LOG"',
      'fi',
      '',
    ].join('\n'),
  )
  chmodSync(caddy, 0o755)
  const log = join(bin, 'caddy.log')
  const deploy = (args: string[], env: Record<string, string> = {}) =>
    spawnSync('bash', [deployScript, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`,
        SHIP_ROOT: root,
        SHIP_BASE_URL: 'https://af-dev.example.org',
        CADDY: caddy,
        CADDYFILE: '/etc/caddy/Caddyfile',
        CADDY_LOG: log,
        SHIP_CADDY_ENV: join(root, 'no-caddy.env'),
        // The script waits 120 s for another deploy's lock by default; a test never expects one, so a stray lock
        // fails within the test's time instead of hanging it.
        SHIP_DEPLOY_LOCK_WAIT: '5',
        ...env,
      },
    })
  const caddyCalls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [])
  return { root, bin, deploy, caddyCalls }
}

const ID = '202610111205-abcdef0'

// Each deploy is real processes: bash, three tar runs and two Node starts. Alone that is well under a second,
// but on the af-linux runner it shares the CPU with every other package's tests (turbo runs them in parallel)
// and a test that deploys twice took 10.3 s there (PR #7). vitest's 5 s default would fail it, so the
// describes below that run the script get room for that load.
const DEPLOY_TIMEOUT_MS = 30_000

describe('deploy (dev host)', { timeout: DEPLOY_TIMEOUT_MS }, () => {
  it('installs a build at builds/<id>/ with its headers snippet, lists it and reloads Caddy', () => {
    const { root, deploy, caddyCalls } = host()
    const result = deploy([goodBuild(ID)])
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(readFileSync(join(root, 'builds', ID, 'client/index.html'), 'utf8')).toBe(
      '<title>Placeholder</title>',
    )
    expect(readFileSync(join(root, 'builds', ID, 'headers.caddy'), 'utf8')).toContain(
      'X-Content-Type-Options "nosniff"',
    )
    const index = JSON.parse(readFileSync(join(root, 'builds-index.json'), 'utf8'))
    expect(index.map((build: { buildId: string }) => build.buildId)).toEqual([ID])
    expect(caddyCalls()).toEqual([
      'validate --config /etc/caddy/Caddyfile --adapter caddyfile',
      'reload --config /etc/caddy/Caddyfile --adapter caddyfile',
    ])
    expect(readFileSync(join(root, 'live.d', 'live.caddy'), 'utf8')).toBe('') // nothing is live until --activate
    expect(execFileSync('ls', ['-A', join(root, 'builds')], { encoding: 'utf8' })).toBe(`${ID}\n`)
  })

  it('reads the tarball from stdin when given -', () => {
    const { root } = host()
    const result = spawnSync('bash', ['-c', `bash ${deployScript} - < ${goodBuild(ID)}`], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`,
        SHIP_ROOT: root,
        CADDY: 'true',
        SHIP_BASE_URL: 'https://x',
        SHIP_CADDY_ENV: join(root, 'no-caddy.env'),
      },
    })
    expect(result.status).toBe(0)
    expect(existsSync(join(root, 'builds', ID, 'client/index.html'))).toBe(true)
  })

  it('makes the build live with --activate: / redirects to it', () => {
    const { root, deploy } = host()
    expect(deploy([goodBuild(ID), '--activate']).status).toBe(0)
    expect(readFileSync(join(root, 'live.d', 'live.caddy'), 'utf8')).toBe(`redir / /builds/${ID}/ 302\n`)
    expect(readFileSync(join(root, 'live'), 'utf8').trim()).toBe(ID)
  })

  it('refuses a build ID that is already installed and leaves the first one intact', () => {
    const { root, deploy } = host()
    expect(deploy([goodBuild(ID, 'First')]).status).toBe(0)
    const again = deploy([goodBuild(ID, 'Second')])
    expect(again.status).toBe(3)
    expect(again.stderr).toContain('already installed')
    expect(readFileSync(join(root, 'builds', ID, 'client/index.html'), 'utf8')).toBe('<title>First</title>')
  })

  it('refuses a tarball that is not a build and leaves nothing behind', () => {
    const { root, deploy } = host()
    const result = deploy([
      tarball({ 'build.json': JSON.stringify({ buildId: '../../etc' }), 'client/x': '' }),
    ])
    expect(result.status).toBe(2)
    expect(
      existsSync(join(root, 'builds'))
        ? execFileSync('ls', ['-A', join(root, 'builds')], { encoding: 'utf8' })
        : '',
    ).toBe('')
  })

  it('removes the new build and keeps the old live build when Caddy rejects the config', () => {
    const { root, deploy } = host()
    expect(deploy([goodBuild('202610100900-aaaaaaa'), '--activate']).status).toBe(0)
    const result = deploy([goodBuild(ID), '--activate'], { CADDY_FAIL_VALIDATE: '1' })
    expect(result.status).toBe(4)
    expect(existsSync(join(root, 'builds', ID))).toBe(false)
    expect(readFileSync(join(root, 'live.d', 'live.caddy'), 'utf8')).toBe(
      'redir / /builds/202610100900-aaaaaaa/ 302\n',
    )
  })

  it('rolls back to the previous live build and exits 6 when Caddy fails to reload', () => {
    const { root, deploy, caddyCalls } = host()
    const old = '202610100900-aaaaaaa'
    expect(deploy([goodBuild(old), '--activate']).status).toBe(0)
    const result = deploy([goodBuild(ID), '--activate'], { CADDY_FAIL_RELOAD: '1' })
    expect(result.status).toBe(6)
    expect(result.stderr).toContain('reload')
    expect(existsSync(join(root, 'builds', ID))).toBe(false)
    expect(readFileSync(join(root, 'live.d', 'live.caddy'), 'utf8')).toBe(`redir / /builds/${old}/ 302\n`)
    expect(readFileSync(join(root, 'live'), 'utf8').trim()).toBe(old)
    // A second reload puts the old config back in the running Caddy.
    expect(caddyCalls().filter((call) => call.startsWith('reload'))).toHaveLength(3)
  })
})

describe('deploy refuses unsafe tarballs (Caddy would serve whatever they point at)', {
  timeout: DEPLOY_TIMEOUT_MS,
}, () => {
  const refused = (tgz: string) => {
    const { root, deploy } = host()
    const result = deploy([tgz])
    const left = execFileSync('ls', ['-A', join(root, 'builds')], { encoding: 'utf8' })
    return { result, left }
  }

  it('refuses a symlink, even one inside the build', () => {
    for (const target of ['/etc/passwd', '/etc', 'index.html']) {
      const { result, left } = refused(
        tarball(buildFiles(ID), { prepare: (dir) => symlinkSync(target, join(dir, 'client/leak.txt')) }),
      )
      expect(result.status).toBe(2)
      expect(result.stderr).toContain('only regular files and folders')
      expect(left).toBe('')
    }
  })

  it('refuses a hard link', () => {
    const { result, left } = refused(
      tarball(buildFiles(ID), {
        prepare: (dir) => linkSync(join(dir, 'client/index.html'), join(dir, 'client/again.html')),
      }),
    )
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('only regular files and folders')
    expect(left).toBe('')
  })

  it('refuses a member outside the build folder (.. or an absolute path)', () => {
    const dotdot = tarball(buildFiles(ID), { tarArgs: renameMember('^\\./client/index.html$', '../evil') })
    // -P keeps the leading / of a member named by its absolute path.
    const withAbsolute = join(temp('ship-deploy-tgz-'), 'absolute.tgz')
    const source = temp('ship-deploy-src-')
    writeFileSync(join(source, 'evil'), 'x')
    execFileSync('tar', ['-czPf', withAbsolute, join(source, 'evil')])
    for (const tgz of [dotdot, withAbsolute]) {
      const { result, left } = refused(tgz)
      expect(result.status).toBe(2)
      expect(result.stderr).toContain('outside the build')
      expect(left).toBe('')
    }
  })

  it('refuses a tarball that is not gzip tar at all', () => {
    const junk = join(temp('ship-deploy-tgz-'), 'junk.tgz')
    writeFileSync(junk, 'not a tarball')
    const { result, left } = refused(junk)
    expect(result.status).toBe(2)
    expect(left).toBe('')
  })

  it("ignores the tarball's owners and modes: files belong to the deploy user and are readable, never setuid", () => {
    const { root, deploy } = host()
    const tgz = tarball(buildFiles(ID), {
      prepare: (dir) => {
        chmodSync(join(dir, 'client/index.html'), 0o4777)
        chmodSync(join(dir, 'client'), 0o700)
      },
      tarArgs: ['--owner=4242', '--group=4242'],
    })
    const result = deploy([tgz])
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    const file = statSync(join(root, 'builds', ID, 'client/index.html'))
    const folder = statSync(join(root, 'builds', ID, 'client'))
    expect(file.uid).toBe(process.getuid?.())
    expect(file.mode & 0o7777).toBe(0o644)
    expect(folder.mode & 0o7777).toBe(0o755)
  })
})

describe('deploy under sudo', { timeout: DEPLOY_TIMEOUT_MS }, () => {
  it("reads Caddy's site settings from caddy.env, because sudo drops the caller's environment", () => {
    const { root, bin, deploy, caddyCalls } = host()
    const caddyEnv = join(bin, 'caddy.env')
    writeFileSync(
      caddyEnv,
      `AF_DEV_SITE=af-dev.example.org\nAF_ACME_EMAIL=ops@example.org\nSHIP_ROOT=${root}\n`,
    )
    const env = { CADDY_REQUIRE_SITE: '1', AF_DEV_SITE: '', AF_ACME_EMAIL: '' }

    const withoutFile = deploy([goodBuild(ID)], env)
    expect(withoutFile.status).toBe(4)

    const result = deploy([goodBuild(ID)], { ...env, SHIP_CADDY_ENV: caddyEnv })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(caddyCalls()).toContain('site=af-dev.example.org')
  })

  it('refuses to run when caddy.env and the dev host settings name different game folders', () => {
    const { root, bin, deploy } = host()
    const caddyEnv = join(bin, 'caddy.env')
    writeFileSync(caddyEnv, 'SHIP_ROOT=/srv/automata/other\n')
    const result = deploy([goodBuild(ID)], { SHIP_CADDY_ENV: caddyEnv })
    expect(result.status).toBe(7)
    expect(result.stderr).toContain('SHIP_ROOT')
    expect(existsSync(join(root, 'builds', ID))).toBe(false)
  })

  it('waits for a deploy that is already running, then gives up with exit 5', () => {
    const { root, deploy } = host()
    mkdirSync(root, { recursive: true })
    const lock = join(root, '.deploy.lock')
    // The holder gets its own process group so the whole group (flock and its sleep) can be killed at the end;
    // killing flock alone leaves the sleep holding the lock as an orphan.
    const holder = spawn('flock', [lock, 'sleep', '60'], { stdio: 'ignore', detached: true })
    try {
      // Wait until the holder really has the lock (a non-blocking flock then fails) rather than for a fixed time,
      // which a loaded runner can overrun.
      const deadline = Date.now() + 10_000
      while (spawnSync('flock', ['-n', lock, 'true']).status === 0) {
        if (Date.now() > deadline) throw new Error('the holder never took the deploy lock')
        spawnSync('sleep', ['0.05'])
      }
      const result = deploy([goodBuild(ID)], { SHIP_DEPLOY_LOCK_WAIT: '1' })
      expect(result.status).toBe(5)
      expect(result.stderr).toContain('another deploy')
      expect(existsSync(join(root, 'builds', ID))).toBe(false)
    } finally {
      if (holder.pid !== undefined) process.kill(-holder.pid, 'SIGKILL')
    }
  })
})

describe("ssh-deploy (the deploy key's forced command)", () => {
  const sshDeploy = join(import.meta.dirname, '../../../../../deploy/bin/ssh-deploy')

  function run(original: string | undefined) {
    const bin = temp('ship-ssh-bin-')
    writeFileSync(join(bin, 'sudo'), '#!/usr/bin/env bash\necho "sudo $*"\n')
    chmodSync(join(bin, 'sudo'), 0o755)
    const env: Record<string, string> = { PATH: `${bin}:${process.env.PATH ?? ''}`, SHIP_DEPLOY: '/x/deploy' }
    if (original !== undefined) env.SSH_ORIGINAL_COMMAND = original
    return spawnSync('bash', [sshDeploy], { encoding: 'utf8', env })
  }

  it('runs deploy on stdin, with --activate only when asked', () => {
    expect(run('deploy').stdout).toBe('sudo -n /x/deploy -\n')
    expect(run('deploy --activate').stdout).toBe('sudo -n /x/deploy - --activate\n')
  })

  it('refuses every other command', () => {
    for (const original of [undefined, 'bash', 'deploy; rm -rf /', 'deploy --activate --force']) {
      const result = run(original)
      expect(result.status).toBe(2)
      expect(result.stdout).toBe('')
    }
  })
})

describe('Caddyfile (shared with FloorFifty on the VM)', () => {
  const caddyfile = readFileSync(join(import.meta.dirname, '../../../../../deploy/caddy/Caddyfile'), 'utf8')

  it('imports only through globs, so a missing file before the first deploy cannot break the shared Caddy', () => {
    // Caddy refuses an import of a missing file but accepts a glob that matches nothing, even in a missing
    // folder (checked with Caddy 2.10.2, which allows one `*` and no other wildcard in a glob). live.d holds
    // only deploy's live.caddy, so a stray live-old.caddy beside it is never imported.
    const imports = [...caddyfile.matchAll(/^\s*import\s+(\S+)/gm)].map((match) => match[1] ?? '')
    expect(imports).toEqual(['{$SHIP_ROOT}/builds/*/headers.caddy', '{$SHIP_ROOT}/live.d/*.caddy'])
    for (const path of imports) expect(path.split('*')).toHaveLength(2)
  })
})
