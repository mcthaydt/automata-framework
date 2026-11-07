import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  findSecretsInBuild,
  parseEnvFile,
  readEnvValues,
  scanTextForSecrets,
} from '#src/shared/ship/prepare/secret-scan.ts'

// Fake keys, built from pieces so this file never holds a whole key that a repository scanner (QB.1's gitleaks)
// would report.
const STRIPE = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_')
const KEYS: readonly (readonly [string, string])[] = [
  ['stripe-access-token', STRIPE],
  ['stripe-access-token', ['rk', 'test', 'Z9yX8wV7uT6sR5qP4oN3'].join('_')],
  ['aws-access-token', `AKIA${'IOSFODNN7EXAMPLE'}`],
  ['github-pat', `ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}`],
  ['github-fine-grained-pat', `github_pat_${'A1b2C3d4E5'.repeat(8)}xy`],
  ['github-app-token', `ghs_${'Q1w2E3r4T5y6U7i8O9p0A1s2D3f4G5h6J7k8'}`],
  ['npm-access-token', `npm_${'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8'}`],
  ['private-key', `-----BEGIN RSA ${'PRIVATE'} KEY-----`],
  ['slack-bot-token', `xoxb-${'123456789012-abcdefABCDEF'}`],
  ['slack-user-token', `xoxp-${'123456789012-123456789012-abcdefABCDEF'}`],
  ['slack-legacy-token', `xoxs-${'1234567890-1234567890-abcdef'}`],
  ['slack-legacy-workspace-token', `xoxa-${'2-abcdefABCDEF12'}`],
  ['slack-legacy-workspace-token', `xoxr-${'abcdefABCDEF1234'}`],
  ['gcp-api-key', `AIza${'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'}`],
  ['anthropic-api-key', `sk-ant-api03-${'a1B2c3D4e5F6g7H8i9J0k1L2'}`],
  ['openai-api-key', `sk-proj-${'a1B2c3D4e5F6g7H8i9J0k1L2'}`],
]

describe('scanTextForSecrets', () => {
  it('finds a planted sk_live_ key with its byte offset, line and column, and never prints it', () => {
    const text = `const a=1;\nconst key="${STRIPE}";`
    const found = scanTextForSecrets('assets/main.js', text, [])
    expect(found).toEqual([
      {
        file: 'assets/main.js',
        offset: text.indexOf(STRIPE),
        line: 2,
        col: 12,
        rule: 'stripe-access-token',
        detail: `a Stripe key (sk_l…, ${STRIPE.length} characters)`,
      },
    ])
    expect(JSON.stringify(found)).not.toContain(STRIPE)
  })

  it.each(KEYS)('finds a %s', (rule, key) => {
    expect(scanTextForSecrets('a.js', `x("${key}")`, []).map((found) => found.rule)).toEqual([rule])
  })

  it('finds an .env value and names the variable, not the value', () => {
    const env = [{ file: '.env', name: 'PAYMENT_SECRET', value: 'hunter2-is-not-secret' }]
    const found = scanTextForSecrets('index.html', '<p>hunter2-is-not-secret</p>', env)
    expect(found).toEqual([
      {
        file: 'index.html',
        offset: 3,
        line: 1,
        col: 4,
        rule: 'env-value',
        detail: 'the value of PAYMENT_SECRET from .env',
      },
    ])
  })

  it('ignores .env values shorter than 8 characters, which would match by chance', () => {
    const env = [{ file: '.env', name: 'DEBUG', value: 'true' }]
    expect(scanTextForSecrets('a.js', 'const debug = true', env)).toEqual([])
  })

  it('skips VITE_ variables, which Vite puts into the bundle on purpose, but still finds a key format in one', () => {
    const env = [
      { file: '.env', name: 'VITE_API_ORIGIN', value: 'https://api.example.test' },
      { file: '.env', name: 'VITE_STRIPE', value: STRIPE },
    ]
    const text = `fetch("https://api.example.test"); key("${STRIPE}")`
    expect(scanTextForSecrets('a.js', text, env).map((found) => found.rule)).toEqual(['stripe-access-token'])
  })

  it('finds a random high-entropy string in quotes', () => {
    const found = scanTextForSecrets('a.js', `const t='Xk3j9Lq2Pz8Rt5Wv7Yb1Nm4Hc6Gd0Fs'`, [])
    expect(found.map((f) => [f.rule, f.offset])).toEqual([['high-entropy', 9]])
  })

  it.each([
    ['a GL constant', '"COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR"'],
    ['a hashed asset path', '"./GpuStencilModesToPixi-tk3N8fvn.js"'],
    ['a font file name', '"/pixelify-sans-latin-400-normal-DLrIX9QE"'],
    ['an SRI hash', '"sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"'],
    [
      'a data URI',
      `"data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'}"`,
    ],
    ['an identifier', '"_didLocalTransformChangeId"'],
    ['a long base64 blob', `"${'AGFzbQEAAAABBgFgAX8BfwMCAQAHBwEDZm9vAAAKBgEEACAACw'.repeat(5)}"`],
  ])('does not flag %s', (_what, literal) => {
    expect(scanTextForSecrets('a.js', `x(${literal})`, [])).toEqual([])
  })

  it('reads binary files for keys and .env values, but not for entropy', () => {
    const random = '"Xk3j9Lq2Pz8Rt5Wv7Yb1Nm4Hc6Gd0Fs"'
    expect(scanTextForSecrets('font.woff2', random, [])).toEqual([])
    expect(scanTextForSecrets('font.woff2', `\u0000${STRIPE}\u0000`, []).map((f) => f.rule)).toEqual([
      'stripe-access-token',
    ])
  })
})

describe('parseEnvFile', () => {
  it('reads KEY=value lines with export, quotes and comments', () => {
    const text = [
      '# a comment',
      'PLAIN=plain-value-1',
      'export EXPORTED=exported-value',
      'DOUBLE="double quoted"',
      "SINGLE='single quoted'",
      'TRAILING=value-before # a comment',
      '',
      'not a variable',
    ].join('\n')
    expect(parseEnvFile('.env.local', text)).toEqual([
      { file: '.env.local', name: 'PLAIN', value: 'plain-value-1' },
      { file: '.env.local', name: 'EXPORTED', value: 'exported-value' },
      { file: '.env.local', name: 'DOUBLE', value: 'double quoted' },
      { file: '.env.local', name: 'SINGLE', value: 'single quoted' },
      { file: '.env.local', name: 'TRAILING', value: 'value-before' },
    ])
  })
})

describe('on disk', () => {
  it('readEnvValues reads every top-level .env* file; findSecretsInBuild walks the build', () => {
    const game = mkdtempSync(join(tmpdir(), 'ship-secrets-'))
    writeFileSync(join(game, '.env'), 'A_SECRET=from-dot-env-1\n')
    writeFileSync(join(game, '.env.production.local'), 'B_SECRET=from-production-local\n')
    writeFileSync(join(game, 'env.txt'), 'NOT_ENV=not-an-env-file\n')
    const env = readEnvValues(game)
    expect(env.map((value) => `${value.file}:${value.name}`)).toEqual([
      '.env:A_SECRET',
      '.env.production.local:B_SECRET',
    ])

    const dist = join(game, 'dist')
    mkdirSync(join(dist, 'assets'), { recursive: true })
    writeFileSync(join(dist, 'index.html'), '<script src="./assets/main.js"></script>')
    writeFileSync(join(dist, 'assets/main.js'), `é;fetch("x",{h:"from-production-local"})`)
    const found = findSecretsInBuild(dist, env)
    // é is two bytes in UTF-8: the offset counts bytes.
    expect(found.map((f) => [f.file, f.offset, f.rule, f.detail])).toEqual([
      ['assets/main.js', 17, 'env-value', 'the value of B_SECRET from .env.production.local'],
    ])
  })

  it('readEnvValues finds nothing in a folder without .env files or that does not exist', () => {
    expect(readEnvValues(mkdtempSync(join(tmpdir(), 'ship-secrets-')))).toEqual([])
    expect(readEnvValues(join(tmpdir(), 'ship-secrets-no-such-dir'))).toEqual([])
  })
})
