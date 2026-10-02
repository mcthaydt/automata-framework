import { inject } from 'vitest'

declare module 'vitest' {
  export interface ProvidedContext {
    engine: 'node' | 'chromium' | 'webkit' | 'firefox'
  }
}

/** Detects the JS engine actually running this code (independent of what the config claims). */
export function detectEngine(): string {
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) return 'node'
  const ua = navigator.userAgent
  if (ua.includes('Firefox/')) return 'firefox'
  if (ua.includes('Chrome/')) return 'chromium'
  if (ua.includes('AppleWebKit/')) return 'webkit'
  return `unknown:${ua}`
}

export function expectedEngine(): string {
  return inject('engine')
}
