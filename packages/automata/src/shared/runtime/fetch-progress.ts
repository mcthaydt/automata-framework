export interface ReadProgress {
  readonly received: number
  readonly total: number | undefined
}

/**
 * Reads a response stream chunk-by-chunk into a Blob, reporting byte progress
 * for each chunk. If the response has no body, reports once with 0 bytes.
 */
export async function readBlob(
  response: Response,
  type: string,
  onReceived?: (progress: ReadProgress) => void,
): Promise<Blob> {
  const header = response.headers?.get?.('content-length')
  const total = header ? Number.parseInt(header, 10) : undefined

  if (!response.body) {
    onReceived?.({ received: 0, total })
    return new Blob([], { type })
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.length
      onReceived?.({ received, total })
    }
  }

  return new Blob(chunks as BlobPart[], { type })
}
