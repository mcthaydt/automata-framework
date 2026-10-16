import { demoPort } from '@mcthaydt/examples-runner/host/ports'

// This demo's preview build: slot 4 of the feature demos (tooling/examples-runner/host/ports.ts).
export const port: number = demoPort(4)
export const url = `http://localhost:${port}/`
export const GAME_ID = 'demo-runtime-boot-and-flow'
