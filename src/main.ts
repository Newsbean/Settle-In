import { Engine, Scene } from '@babylonjs/core'
import { CLEAR_COLOR } from './palette'
import { buildHouse } from './house'
import { Player } from './player'
import { Input } from './input'
import { Audio } from './audio'
import { Overlay } from './ui/overlay'
import { buildStations } from './stations'
import { Shop } from './shop'
import { TaskManager } from './taskmanager'
import { worldToCss } from './focus'
import { preloadModels } from './models'
import { ASSETS } from './assets'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const uiRoot = document.getElementById('ui-root') as HTMLDivElement

const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: false,
  adaptToDeviceRatio: true,
})

const scene = new Scene(engine)
scene.clearColor = CLEAR_COLOR

const house = buildHouse(scene)
const input = new Input(canvas)
const audio = new Audio()
audio.registerAssets(ASSETS) // enable the BGM + ambience + event-cue sample layer
const player = new Player(scene, house)
scene.activeCamera = player.camera

const overlay = new Overlay(uiRoot)
// GLB props load before stations build; on failure the factories fall back to
// their primitive builds, so a broken/missing asset can never block boot.
await preloadModels(scene)
const stations = buildStations(scene, house)
const shop = new Shop(scene, house, audio, stations)
const manager = new TaskManager(scene, canvas, player, input, audio, overlay, house, stations, shop)
overlay.onPrompt = () => manager.tryEnter()

// --- Start curtain ---
const curtain = document.createElement('div')
curtain.className = 'curtain'
curtain.innerHTML = `
  <div class="card">
    <h1>Settle In</h1>
    <p>You're finally back — and the rooms are bare. Order what the house
       needs on the laptop by the door, carry each box in from the porch,
       and make it feel like home again.</p>
    <button class="go">Step inside</button>
    <div class="controls">WASD to walk · click-drag to look around · <b>E</b> or tap a prompt to work · Esc to step back</div>
  </div>`
uiRoot.appendChild(curtain)
curtain.querySelector('.go')!.addEventListener('click', () => {
  curtain.classList.add('hide')
  window.setTimeout(() => curtain.remove(), 650)
  audio.unlock()
  input.requestLock()
})

// --- Loop ---
let last = performance.now()
function loop() {
  const now = performance.now()
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now

  input.pollKeyboardMove()
  player.update(input, dt)
  manager.update(dt)
  // Fade the garden ambience in when the player steps out the west door.
  audio.setOutdoor(player.position.x < -5)
  input.endFrame()

  scene.render()
}
engine.runRenderLoop(loop)

window.addEventListener('resize', () => engine.resize())
// Some embeddings (preview panels, iframes) don't fire window 'resize'; observe the
// canvas directly and size the engine to it.
const ro = new ResizeObserver(() => engine.resize())
ro.observe(canvas)
engine.resize()

// Debug/verification hooks. pause() stops the render loop so screenshot tools can
// capture a still (a continuous rAF loop otherwise keeps the page from going idle).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).__settleIn = {
  scene,
  engine,
  house,
  player,
  input,
  manager,
  stations,
  shop,
  project: (v: any) => worldToCss(scene, canvas, v),
  tick: (n = 1, dt = 0.02) => {
    for (let i = 0; i < n; i++) {
      input.pollKeyboardMove()
      player.update(input, dt)
      manager.update(dt)
      input.endFrame()
      scene.render()
    }
  },
  pause: () => {
    engine.stopRenderLoop()
    scene.render()
  },
  resume: () => engine.runRenderLoop(loop),
}
