import { Vector3, type PointLight, type Scene, type UniversalCamera } from '@babylonjs/core'
import type { Audio } from './audio'
import type { House } from './house'
import type { Input } from './input'
import { CameraDirector, type Puzzle, type PuzzleCtx } from './focus'
import type { Player } from './player'
import type { Shop } from './shop'
import type { Station } from './stations'
import type { Overlay } from './ui/overlay'

type State = 'walk' | 'entering' | 'focus' | 'exiting'

interface LightTween {
  light: PointLight
  from: number
  to: number
  t: number
  dur: number
}

const APPROACH_R = 1.9

function signedAngle(rad: number) {
  return Math.atan2(Math.sin(rad), Math.cos(rad))
}

export class TaskManager {
  private state: State = 'walk'
  private director: CameraDirector
  private ctx: PuzzleCtx
  private focusStation: Station | null = null
  private current: Station | null = null
  private phases: Array<() => Puzzle> = []
  private phaseIndex = 0
  // Solved phases survive leaving a station — re-entering resumes where you left
  // off (e.g. a sliced-open box never asks to be cut again).
  private progressById = new Map<string, number>()
  private puzzle: Puzzle | null = null
  private standingHint = ''
  private walkPose = { position: new Vector3(), target: new Vector3() }
  private lightTweens: LightTween[] = []
  private onAllDone?: () => void
  private guideStationId: string | null = null
  // What E / tapping the prompt does this frame (enter a station, pick up a
  // parcel, open the shop, set a box down).
  private hotAction: (() => void) | null = null

  constructor(
    private scene: Scene,
    private canvas: HTMLCanvasElement,
    private player: Player,
    private input: Input,
    private audio: Audio,
    private overlay: Overlay,
    private house: House,
    private stations: Station[],
    private shop: Shop,
    onAllDone?: () => void,
  ) {
    this.director = new CameraDirector(player.camera)
    this.onAllDone = onAllDone
    this.ctx = {
      scene,
      cam: player.camera as UniversalCamera,
      canvas,
      input,
      audio,
      setHint: (t: string) => this.overlay.flashFocusHint(t, this.standingHint),
    }

    // Only box-less tasks start staged; everything else waits in the catalog.
    stations.forEach((s) => {
      if (s.available && s.noBox) s.showPending()
    })
    overlay.buildTaskList(this.taskItems())
    overlay.onBack = () => this.abort()
    overlay.onHint = () => this.overlay.showHintCard(this.standingHint)
    overlay.onOrder = (id) => {
      if (this.shop.order(id)) {
        this.audio.snap()
        this.overlay.toast(`${this.shop.boxName(id)} — ordered. It'll land on the porch.`)
      }
    }
    overlay.onShopClose = () => this.input.requestLock()
    this.shop.onArrival = (name) => this.overlay.toast(`Ding-dong — ${name} is on the porch 📦`)
    this.shop.onStateChange = () => {
      this.syncTaskList()
      if (this.overlay.shopOpen) this.overlay.refreshShop(this.shop.catalogItems())
    }
  }

  private taskItems() {
    return this.stations.map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
      available: s.available,
      current: s.id === this.guideStationId,
      note: s.noBox ? (s.available ? null : '(later)') : this.shop.note(s.id),
    }))
  }

  private syncTaskList() {
    this.overlay.updateTaskList(this.taskItems())
  }

  tryEnter() {
    if (this.state === 'walk') this.hotAction?.()
  }

  private enterFocus(st: Station) {
    this.state = 'entering'
    this.current = st
    // remember where to return to
    this.walkPose.position.copyFrom(this.player.position)
    this.walkPose.target.copyFrom(this.player.position.add(this.player.forward()))
    this.player.setActive(false)
    this.input.setMode('focus')
    this.overlay.setFocusMode(true)
    this.overlay.showGuide(null)
    this.overlay.showPrompt(null)
    this.stations.forEach((s) => s.marker.setEnabled(false))
    this.audio.unlock()
    this.director.moveTo(st.focus, () => {
      this.phases = st.createPhases(this.ctx)
      this.phaseIndex = Math.min(this.progressById.get(st.id) ?? 0, this.phases.length - 1)
      this.startCurrentPhase()
      this.state = 'focus'
    })
  }

  private startCurrentPhase() {
    this.puzzle = this.phases[this.phaseIndex]()
    this.standingHint = this.puzzle.hint()
    this.overlay.clearFlash()
    this.overlay.setFocusHint(this.standingHint)
    this.puzzle.onSolved = () => this.onPhaseSolved()
  }

  private onPhaseSolved() {
    this.puzzle?.dispose()
    this.puzzle = null
    this.phaseIndex += 1
    if (this.current) this.progressById.set(this.current.id, this.phaseIndex)
    if (this.phaseIndex < this.phases.length) {
      this.audio.ding()
      this.startCurrentPhase()
    } else {
      this.completeStation()
    }
  }

  private completeStation() {
    const st = this.current!
    st.finish()
    this.guideStationId = null
    this.audio.solved()
    this.audio.warm()
    this.overlay.toast(`${st.title} — done`)
    // warm the room
    const light = this.house.moodLights[st.moodLight]
    if (light) this.lightTweens.push({ light, from: light.intensity, to: 0.95, t: 0, dur: 1.1 })
    // unlock any stations whose requirement is now met — box-less ones stage
    // straight away; boxed ones become orderable in the shop.
    this.stations.forEach((s) => {
      if (!s.available && s.requires === st.id) {
        if (s.noBox) {
          s.available = true
          s.showPending()
        } else {
          window.setTimeout(
            () => this.overlay.toast(`New in the shop: ${this.shop.boxName(s.id)}`),
            2400,
          )
        }
      }
    })
    this.syncTaskList()
    this.exitFocus()
    if (this.stations.every((s) => s.done)) {
      window.setTimeout(() => {
        this.overlay.toast('Welcome home 🕯', 5200)
        this.onAllDone?.()
      }, 1400)
    }
  }

  private exitFocus() {
    this.state = 'exiting'
    this.overlay.setFocusMode(false)
    this.director.moveTo(this.walkPose, () => {
      this.player.setActive(true)
      this.input.setMode('walk')
      this.input.requestLock()
      this.state = 'walk'
      this.current = null
    })
  }

  private abort() {
    if (this.state !== 'focus') return
    this.puzzle?.dispose()
    this.puzzle = null
    this.exitFocus()
  }

  // --- debug/verification helpers ---
  debugState() {
    return { state: this.state, phase: this.phaseIndex, phases: this.phases.length, focus: this.focusStation?.id ?? null, puzzleSolved: this.puzzle?.solved ?? null }
  }
  debugForceSolve() {
    if (this.state === 'focus' && this.puzzle) this.puzzle.onSolved?.()
  }

  update(dt: number) {
    this.director.update(dt)
    // Delivery vans keep driving even while you're mid-assembly.
    this.shop.update(dt, this.player)

    // light warm-ups
    for (let i = this.lightTweens.length - 1; i >= 0; i--) {
      const lt = this.lightTweens[i]
      lt.t = Math.min(1, lt.t + dt / lt.dur)
      lt.light.intensity = lt.from + (lt.to - lt.from) * lt.t
      if (lt.t >= 1) this.lightTweens.splice(i, 1)
    }

    if (this.state === 'walk') {
      this.updateWalk()
    } else if (this.state === 'focus' && this.puzzle) {
      this.puzzle.update(dt)
      if (this.input.escPressed) this.abort()
    }
  }

  private updateWalk() {
    // markers on for available, undone stations
    this.stations.forEach((s) => s.marker.setEnabled(s.available && !s.done))

    const p = this.player.position
    const distTo = (v: Vector3) => Math.hypot(v.x - p.x, v.z - p.z)
    this.hotAction = null
    this.focusStation = null

    // The catalog is open on the laptop — mute the world until it closes.
    if (this.overlay.shopOpen) {
      this.overlay.setCrosshairHot(false)
      this.overlay.showPrompt(null)
      this.overlay.showGuide(null)
      if (this.input.escPressed) {
        this.overlay.closeShop()
        this.input.requestLock()
      }
      return
    }

    // Arms full: the only verb is carrying the parcel to its spot.
    if (this.shop.carrying) {
      const st = this.stations.find((s) => s.id === this.shop.carrying)!
      const d = distTo(st.approach)
      this.setGuideStation(st.id)
      if (d < APPROACH_R + 0.5) {
        this.hotAction = () => this.placeCarriedBox()
        this.overlay.setCrosshairHot(true)
        this.overlay.showPrompt(`<span class="key">E</span>Set the box down`)
        this.overlay.showGuide(null)
      } else {
        this.overlay.setCrosshairHot(false)
        this.overlay.showPrompt(null)
        this.showGuideTo(st.title, st.approach, d)
      }
      if (this.input.interactPressed) this.tryEnter()
      return
    }

    // Points of interest: workable stations, parcels on the porch, the laptop.
    interface POI {
      d: number
      hotR: number
      title: string
      at: Vector3
      stationId: string | null
      act: () => void
    }
    const pois: POI[] = []
    for (const s of this.stations) {
      if (!s.available || s.done) continue
      pois.push({
        d: distTo(s.approach),
        hotR: APPROACH_R,
        title: s.title,
        at: s.approach,
        stationId: s.id,
        act: () => this.enterFocus(s),
      })
    }
    const porch = this.shop.nearestPorchBox(p)
    if (porch) {
      const at = this.shop.porchBoxPos(porch.id)!
      pois.push({
        d: porch.dist,
        hotR: 1.7,
        title: `Pick up: ${this.shop.boxName(porch.id)}`,
        at,
        stationId: this.stations.find((s) => s.id === porch.id) ? porch.id : null,
        act: () => {
          this.shop.pickUp(porch.id)
          this.syncTaskList()
        },
      })
    }
    if (this.shop.orderableCount() > 0 || pois.length === 0) {
      pois.push({
        d: distTo(this.shop.deskPos),
        hotR: 1.8,
        title: 'Order furniture online',
        at: this.shop.deskPos,
        stationId: null,
        act: () => {
          this.input.exitLock()
          this.overlay.openShop(this.shop.catalogItems())
        },
      })
    }

    let best: POI | null = null
    for (const poi of pois) {
      if (!best || poi.d < best.d) best = poi
    }

    this.setGuideStation(best?.stationId ?? null)

    if (best && best.d < best.hotR) {
      this.hotAction = best.act
      this.focusStation = null
      this.overlay.setCrosshairHot(true)
      this.overlay.showPrompt(`<span class="key">E</span>${best.title}`)
      this.overlay.showGuide(null)
    } else {
      this.overlay.setCrosshairHot(false)
      this.overlay.showPrompt(null)
      if (best) this.showGuideTo(best.title, best.at, best.d)
      else this.overlay.showGuide(null)
    }

    if (this.input.interactPressed) this.tryEnter()
  }

  private setGuideStation(id: string | null) {
    if (id !== this.guideStationId) {
      this.guideStationId = id
      this.syncTaskList()
    }
  }

  private showGuideTo(title: string, at: Vector3, distance: number) {
    const p = this.player.position
    const targetYaw = Math.atan2(at.x - p.x, at.z - p.z)
    this.overlay.showGuide({
      title,
      distance,
      angle: signedAngle(targetYaw - this.player.yaw),
    })
  }

  private placeCarriedBox() {
    const st = this.shop.setDown()
    if (!st) return
    st.marker.setEnabled(true)
    this.syncTaskList()
    this.overlay.toast(`${st.title} — the box is in place`)
  }
}
