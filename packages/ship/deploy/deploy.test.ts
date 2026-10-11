import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Runs the host's `deploy` script for real (bash, tar, node) against a temporary SHIP_ROOT, with a stub
// `caddy` that records its arguments and fails `validate` when CADDY_FAIL_VALIDATE=1, or, with
// CADDY_REQUIRE_SITE=1, when the Caddyfile's {$AF_DEV_SITE} would be empty (as real Caddy rejects it).

const deployScript = join(dirname(fileURLToPath(import.meta.url)), 'bin/deploy')

function tarball(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ship-deploy-src-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  const out = join(mkdtempSync(join(tmpdir(), 'ship-deploy-tgz-')), 'build.tgz')
  execFileSync('tar', ['-czf', out, '-C', dir, '.'])
  return out
}

const goodBuild = (id: string, title = 'Placeholder') =>
  tarball({
    'build.json': JSON.stringify({ buildId: id, commit: id.slice(13), tag: null, branch: 'main' }),
    'headers.json': JSON.stringify({ headers: { 'X-Content-Type-Options': 'nosniff' }, entry: 'index.html' }),
    'client/index.html': `<title>${title}</title>`,
  })

function host() {
  const root = mkdtempSync(join(tmpdir(), 'ship-deploy-root-'))
  const bin = mkdtempSync(join(tmpdir(), 'ship-deploy-bin-'))
  const caddy = join(bin, 'caddy')
  writeFileSync(
    caddy,
    [
      '#!/usr/bin/env bash',
      'echo "$*" >> "$CADDY_LOG"',
      'if [[ "$1" == validate && "${CADDY_FAIL_VALIDATE:-0}" == 1 ]]; then exit 1; fi',
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
        ...env,
      },
    })
  const caddyCalls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [])
  return { root, bin, deploy, caddyCalls }
}

const ID = '202610111205-abcdef0'

describe('deploy (dev host)', () => {
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
    expect(readFileSync(join(root, 'live.caddy'), 'utf8')).toBe('') // nothing is live until --activate
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
      },
    })
    expect(result.status).toBe(0)
    expect(existsSync(join(root, 'builds', ID, 'client/index.html'))).toBe(true)
  })

  it('makes the build live with --activate: / redirects to it', () => {
    const { root, deploy } = host()
    expect(deploy([goodBuild(ID), '--activate']).status).toBe(0)
    expect(readFileSync(join(root, 'live.caddy'), 'utf8')).toBe(`redir / /builds/${ID}/ 302\n`)
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
    expect(readFileSync(join(root, 'live.caddy'), 'utf8')).toBe('redir / /builds/202610100900-aaaaaaa/ 302\n')
  })
})

describe('deploy under sudo', () => {
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

  it('waits for a deploy that is already running, then gives up with exit 5', () => {
    const { root, deploy } = host()
    mkdirSync(root, { recursive: true })
    const holder = spawn('flock', [join(root, '.deploy.lock'), 'sleep', '3'], { stdio: 'ignore' })
    try {
      spawnSync('sleep', ['0.3'])
      const result = deploy([goodBuild(ID)], { SHIP_DEPLOY_LOCK_WAIT: '1' })
      expect(result.status).toBe(5)
      expect(result.stderr).toContain('another deploy')
      expect(existsSync(join(root, 'builds', ID))).toBe(false)
    } finally {
      holder.kill()
    }
  })
})

describe("ssh-deploy (the deploy key's forced command)", () => {
  const sshDeploy = join(dirname(fileURLToPath(import.meta.url)), 'bin/ssh-deploy')

  function run(original: string | undefined) {
    const bin = mkdtempSync(join(tmpdir(), 'ship-ssh-bin-'))
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
