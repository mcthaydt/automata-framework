import { createGameSim } from './sim/index.ts'

export interface GameApp {
  start(): Promise<void>
  stop(): Promise<void>
}

export function createGameApp(container: HTMLElement, hostName: string): GameApp {
  const _sim = createGameSim()
  return {
    async start() {
      container.textContent = `Build running on ${hostName}`
    },
    async stop() {
      container.textContent = ''
    },
  }
}
