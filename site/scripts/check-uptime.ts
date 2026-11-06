// QB.4b's uptime and certificate-expiry check (QB-d): the origin's `/` answers 200 within a timeout, and the certificate
// it presents has at least `--min-cert-days` days left (21 by default, so a failed automatic renewal is caught with
// weeks to spare). An external monitor runs this, or an equivalent check, against the live origin; docs/operations/alerts.md
// says which alerts watch what and who receives them. Until the Owner supplies the host, `--local` runs the status check
// against the build on serve-static.ts, which has no certificate to read.
//
//   node --import tsx scripts/check-uptime.ts <origin> [--min-cert-days 21]
//   node --import tsx scripts/check-uptime.ts --local [--build build]
import { connect } from 'node:tls'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { serveLocally } from './check-deployed'

const DAY_MS = 86_400_000
const DEFAULT_TIMEOUT_MS = 10_000
const isoDate = (date: Date) => date.toISOString().slice(0, 10)

export interface UptimeOptions {
  readonly minCertDays: number
  readonly now?: Date
  readonly timeoutMs?: number
  /** Whether a plain `http:` origin is acceptable (the local server); a live origin must be https. */
  readonly allowHttp?: boolean
  readonly fetch?: (url: string, init?: RequestInit) => Promise<Response>
  readonly certificate?: (origin: string) => Promise<{ validTo: Date }>
}

/** What is wrong with a certificate valid until `validTo`, checked at `now` against a `minDays` threshold. */
export function certificateProblems(validTo: Date, now: Date, minDays: number): string[] {
  const left = Math.floor((validTo.getTime() - now.getTime()) / DAY_MS)
  if (validTo.getTime() <= now.getTime()) return [`the certificate expired on ${isoDate(validTo)}`]
  if (left < minDays) return [`the certificate expires in ${left} days (${isoDate(validTo)}), under the ${minDays}-day threshold`]
  return []
}

/** The expiry of the leaf certificate `origin` presents, from one TLS handshake. Trust is not checked: only the date. */
export function peerCertificate(origin: string): Promise<{ validTo: Date }> {
  const url = new URL(origin)
  return new Promise((done, fail) => {
    const socket = connect({ host: url.hostname, port: Number(url.port || 443), servername: url.hostname, rejectUnauthorized: false }, () => {
      const certificate = socket.getPeerCertificate()
      socket.end()
      if (!certificate?.valid_to) fail(new Error(`${origin} presented no certificate`))
      else done({ validTo: new Date(certificate.valid_to) })
    })
    socket.setTimeout(DEFAULT_TIMEOUT_MS, () => socket.destroy(new Error(`no TLS handshake with ${origin} within ${DEFAULT_TIMEOUT_MS} ms`)))
    socket.on('error', fail)
  })
}

/** Every problem with `origin`'s uptime and certificate; empty when `/` answers 200 and the certificate is far from expiry. */
export async function checkUptime(origin: string, options: UptimeOptions): Promise<string[]> {
  const { now = new Date(), timeoutMs = DEFAULT_TIMEOUT_MS, fetch: get = fetch, certificate = peerCertificate } = options
  const problems: string[] = []
  const url = `${origin.replace(/\/$/, '')}/`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await get(url, { signal: controller.signal, redirect: 'manual' })
    if (response.status !== 200) problems.push(`${url} answered ${response.status}`)
  } catch (error) {
    problems.push(controller.signal.aborted ? `${url} did not answer within ${timeoutMs} ms` : `${url} did not answer: ${(error as Error).message}`)
  } finally {
    clearTimeout(timer)
  }
  const protocol = new URL(origin).protocol
  if (protocol === 'https:') {
    try {
      problems.push(...certificateProblems((await certificate(origin)).validTo, now, options.minCertDays))
    } catch (error) {
      problems.push(`the certificate could not be read: ${(error as Error).message}`)
    }
  } else if (!options.allowHttp) {
    problems.push(`${origin} is not served over https`)
  }
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { local: { type: 'boolean' }, build: { type: 'string', default: 'build' }, 'min-cert-days': { type: 'string', default: '21' } },
  })
  const minCertDays = Number(values['min-cert-days'])
  if (Boolean(values.local) === (positionals.length > 0) || positionals.length > 1 || !Number.isInteger(minCertDays) || minCertDays < 1) {
    console.error('Usage: check-uptime.ts <origin> [--min-cert-days 21] | --local [--build build]')
    process.exit(2)
  }
  const local = values.local ? await serveLocally(resolve(values.build)) : undefined
  const origin = local?.origin ?? positionals[0]!
  let problems: string[]
  try {
    problems = await checkUptime(origin, { minCertDays, allowHttp: Boolean(local) })
  } finally {
    local?.stop()
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  console.log(local
    ? `${origin}/ answered 200 (the local build; no certificate was checked).`
    : `${origin}/ answered 200 and its certificate has at least ${minCertDays} days left.`)
}
