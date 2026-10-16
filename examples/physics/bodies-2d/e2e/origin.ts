import { demoPort } from '@mcthaydt/examples-runner/host/ports'

// This demo's preview build: slot 3 of the feature demos (tooling/examples-runner/host/ports.ts).
export const port: number = demoPort(3)
export const url = `http://localhost:${port}/`
export const GAME_ID = 'demo-physics-bodies-2d'
