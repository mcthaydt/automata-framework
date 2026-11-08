/** The browser engines every parity, golden and journey test runs in. Node is the fourth engine of AGENTS.md's law 3. */
export const BROWSER_ENGINES = ['chromium', 'webkit', 'firefox'] as const

export type Engine = (typeof BROWSER_ENGINES)[number]
