import { demoPort } from '@mcthaydt/examples-runner/host/ports'

export const port: number = demoPort(5)
export const url = `http://localhost:${port}/`
export const GAME_ID = 'demo-renderer-2d'
