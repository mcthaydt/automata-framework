import { defineJourneys } from '@mcthaydt/playwright-preset'

// The design board's screenshots: `pnpm design:board`. One Vite dev server (the board is served in development only),
// on its own port; the four sizes every editor layout is checked at, phone first. Chromium only: this is for looking
// at, and the layout tests prove the rules in every engine.
const port = Number(process.env.AF_DESIGN_PORT ?? 4760)
const sizes = {
  phone: { width: 390, height: 844 },
  compact: { width: 780, height: 270 },
  'ipad-landscape': { width: 1194, height: 834 },
  'ipad-portrait': { width: 834, height: 1194 },
  desktop: { width: 1440, height: 900 },
}

export default defineJourneys({
  testDir: 'tests/e2e',
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: Object.entries(sizes).map(([name, viewport]) => ({
    name,
    use: { browserName: 'chromium' as const, viewport, deviceScaleFactor: 2 },
  })),
  webServer: {
    command: `vite --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}/design.html`,
    reuseExistingServer: false,
  },
})
