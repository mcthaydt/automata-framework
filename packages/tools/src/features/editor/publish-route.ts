// The editor server's Publish routes: making the game's zip, handing it over as a download, and putting it in a place
// (itch.io first). One closure holds the zip the last good Publish made, so a place can only ever receive that file.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename } from 'node:path'
import { type Place, placeInfo } from './places/place.ts'
import type { PublishOutcome } from './publish-game.ts'

const MAX_ANSWERS_BYTES = 64 * 1024

const reply = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function jsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const part = chunk as Buffer
    size += part.length
    if (size > MAX_ANSWERS_BYTES) return {}
    chunks.push(part)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Only strings count as answers: whatever else a page sends is dropped before a place sees it. */
function answersOf(body: Record<string, unknown>): Record<string, string> {
  const given = body.answers
  if (typeof given !== 'object' || given === null) return {}
  return Object.fromEntries(
    Object.entries(given).filter((pair): pair is [string, string] => typeof pair[1] === 'string'),
  )
}

/**
 * `/api/publish`: a POST makes the zip, one at a time, and answers what came of it; a GET of `/api/publish/file` hands
 * over the zip the last good Publish made, as a download. Only that file: the route takes no path.
 * `/api/places`: a GET lists where the zip can go; a POST to `/api/places/<id>` puts the zip made there with the
 * person's answers, and `/api/places/<id>/sign-in` signs them in on this computer.
 */
export function publishRoute(
  publish: () => Promise<PublishOutcome>,
  root: string,
  places: readonly Place[],
): (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void> {
  let running = false
  let made: string | undefined
  const madeZip = async (): Promise<string | undefined> => {
    const info = made === undefined ? undefined : await stat(made).catch(() => undefined)
    return info?.isFile() === true ? made : undefined
  }
  return async (req, res, url) => {
    if (url.pathname === '/api/publish/file' && req.method === 'GET') {
      const zip = await madeZip()
      const info = zip === undefined ? undefined : await stat(zip)
      if (zip === undefined || info === undefined)
        return reply(res, 404, {
          message: 'No zip has been made yet. Open Publish and press Make my zip.',
        })
      res.writeHead(200, {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${basename(zip)}"`,
        'content-length': String(info.size),
        'cache-control': 'no-store',
      })
      createReadStream(zip).pipe(res)
      return
    }
    if (url.pathname === '/api/places' && req.method === 'GET') return reply(res, 200, places.map(placeInfo))
    const placeRoute = /^\/api\/places\/([^/]+)(\/sign-in)?$/.exec(url.pathname)
    if (placeRoute !== null && req.method === 'POST') {
      const place = places.find((candidate) => candidate.id === decodeURIComponent(placeRoute[1] ?? ''))
      if (place === undefined) return reply(res, 404, { message: 'no such place' })
      if (placeRoute[2] !== undefined) {
        if (place.signIn === undefined) return reply(res, 404, { message: 'no sign-in here' })
        return reply(res, 200, await place.signIn())
      }
      const zip = await madeZip()
      if (zip === undefined)
        return reply(res, 409, { message: 'Make the zip first. Open Publish and press Make my zip.' })
      return reply(res, 200, await place.put(root, zip, answersOf(await jsonBody(req))))
    }
    if (url.pathname !== '/api/publish' || req.method !== 'POST')
      return reply(res, 404, { message: 'no such route' })
    if (running)
      return reply(res, 409, { message: 'Your game’s zip is already being made. Wait for it to finish.' })
    running = true
    try {
      const outcome = await publish()
      made = outcome.ok ? outcome.file : undefined
      return reply(res, 200, outcome.ok ? { ok: true, name: basename(outcome.file) } : outcome)
    } finally {
      running = false
    }
  }
}
