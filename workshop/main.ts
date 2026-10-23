import '../../automata-framework/games/emberwick/src/no-eval'
import '../../automata-framework/games/emberwick/style.css'
import { ROOM } from '../../automata-framework/games/emberwick/src/content/room'
import { playRoom } from '../../automata-framework/games/emberwick/src/play-room'
import { withStart } from './spawn'
import { createBaseSim } from '../../automata-framework/games/emberwick/src/base-sim'
import { AirJump } from './air-jump.component'
import { doubleJumpPlugin } from './double-jump.plugin'
import { isolateControlKeys } from './controls'
import './style.css'

const game = document.querySelector<HTMLElement>('#game')!
const status = document.querySelector<HTMLElement>('#status')!
const original = document.querySelector<HTMLButtonElement>('#original')!
const changed = document.querySelector<HTMLButtonElement>('#changed')!
const column = document.querySelector<HTMLInputElement>('#column')!
const value = document.querySelector<HTMLOutputElement>('#value')!
const jumpMode = document.querySelector<HTMLInputElement>('#double-jump')!
const jumpStatus = document.querySelector<HTMLElement>('#jump-status')!

async function start() {
  let enhanced = true
  const play = await playRoom(game, {
    room: withStart(ROOM, 18),
    createSim: room => createBaseSim({ room, plugins: enhanced ? [doubleJumpPlugin] : [] }),
    onStep(_result, sim) {
      const [player] = sim.query(AirJump)
      const available = player?.get(AirJump).available ?? false
      const text = enhanced ? available ? 'Air jump ready · press jump again in the air' : 'Air jump used · land to recharge' : 'Original · one jump'
      if (jumpStatus.textContent !== text) jumpStatus.textContent = text
      game.dataset.airJump = enhanced ? String(available) : 'off'
    },
  })
  let revision = 0
  const releaseControlKeys = isolateControlKeys(document.querySelector<HTMLElement>('#controls')!)
  play.start()
  document.documentElement.dataset.state = 'ready'
  status.textContent = 'Move with arrows or A/D. Jump with Space, release, then press again in the air. On touch, tap jump twice.'
  async function apply(at: number, isOriginal = false) {
    const version = ++revision
    try {
      const room = isOriginal ? ROOM : withStart(ROOM, at)
      await play.restart(room)
      if (version !== revision) return
      play.start()
      original.setAttribute('aria-pressed', String(isOriginal))
      changed.setAttribute('aria-pressed', String(!isOriginal))
      column.value = String(at)
      value.value = String(at)
      game.dataset.startColumn = String(at)
      status.textContent = isOriginal ? 'Original room: player starts at column 6.' : `Changed room: player starts at column ${at}. Movement rules are unchanged.`
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'The room could not restart.'
    }
  }
  game.dataset.startColumn = '18'
  original.onclick = () => { void apply(6, true) }
  changed.onclick = () => { void apply(18) }
  column.oninput = () => { value.value = column.value }
  column.onchange = () => { void apply(Number(column.value)) }
  jumpMode.onchange = async () => {
    enhanced = jumpMode.checked
    try {
      await play.restart()
      play.start()
      status.textContent = enhanced ? 'Double jump on. Release and press jump again before landing.' : 'Original movement. Try the same jump, then turn double jump back on.'
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'The game could not restart.'
    }
  }
  window.addEventListener('pagehide', () => { releaseControlKeys(); play.destroy() }, { once: true })
}
start().catch(error => {
  document.documentElement.dataset.state = 'failed'
  status.textContent = error instanceof Error ? error.message : 'The example could not start.'
})
