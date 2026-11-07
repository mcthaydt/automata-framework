// 16-bit PCM WAV files: what the render stage writes and the checks read back.

/**
 * A decoded WAV file: its sample rate and one array of samples between -1 and 1 for each channel.
 */
export interface Wav {
  readonly sampleRate: number
  readonly channels: Float32Array[]
}

/** Encodes `channels` (equal length, -1..1; anything outside is clamped) as a 16-bit PCM WAV. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const count = channels.length
  const frames = channels[0]?.length ?? 0
  const bytes = frames * count * 2
  const out = new Uint8Array(44 + bytes)
  const view = new DataView(out.buffer)
  const text = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i)
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, count, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * count * 2, true)
  view.setUint16(32, count * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, bytes, true)
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < count; c++) {
      const v = Math.max(-1, Math.min(1, (channels[c] as Float32Array)[i] as number))
      view.setInt16(44 + (i * count + c) * 2, Math.round(v < 0 ? v * 32768 : v * 32767), true)
    }
  }
  return out
}

/** Decodes a 16-bit PCM WAV. Throws on anything else: the pipeline writes only this. */
export function decodeWav(bytes: Uint8Array): Wav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (at: number): string => String.fromCharCode(...bytes.subarray(at, at + 4))
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file')
  let at = 12
  let sampleRate = 0
  let count = 0
  let bits = 0
  while (at + 8 <= bytes.length) {
    const id = tag(at)
    const size = view.getUint32(at + 4, true)
    const body = at + 8
    if (id === 'fmt ') {
      count = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
    }
    if (id === 'data') {
      if (bits !== 16) throw new Error(`${bits}-bit WAV; the pipeline writes 16-bit`)
      const frames = Math.floor(size / (2 * count))
      const channels = Array.from({ length: count }, () => new Float32Array(frames))
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < count; c++) {
          const v = view.getInt16(body + (i * count + c) * 2, true)
          ;(channels[c] as Float32Array)[i] = v < 0 ? v / 32768 : v / 32767
        }
      }
      return { sampleRate, channels }
    }
    at = body + size + (size & 1)
  }
  throw new Error('no data chunk')
}
