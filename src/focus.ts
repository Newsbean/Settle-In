import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  Plane,
  Quaternion,
  Scene,
  TransformNode,
  Vector3,
  Viewport,
  type AbstractMesh,
  type UniversalCamera,
} from '@babylonjs/core'
import type { Input } from './input'
import type { Audio } from './audio'
import { glowMaterial } from './materials'
import { HIGHLIGHT, PALETTE } from './palette'

// ---------- easing ----------
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
export const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// ---------- camera framing ----------
export interface FocusPose {
  position: Vector3
  target: Vector3
}

export class CameraDirector {
  private cam: UniversalCamera
  private active = false
  private t = 0
  private dur = 0.85
  private fromPos = new Vector3()
  private toPos = new Vector3()
  private fromTarget = new Vector3()
  private toTarget = new Vector3()
  private onArrive?: () => void
  private curTarget = new Vector3()

  constructor(cam: UniversalCamera) {
    this.cam = cam
  }

  private currentTarget(): Vector3 {
    // Derive a look target a metre ahead of the camera from its rotation.
    const dir = this.cam.getForwardRay(1).direction
    return this.cam.position.add(dir)
  }

  moveTo(pose: FocusPose, onArrive?: () => void) {
    this.fromPos.copyFrom(this.cam.position)
    this.fromTarget.copyFrom(this.currentTarget())
    this.toPos.copyFrom(pose.position)
    this.toTarget.copyFrom(pose.target)
    this.t = 0
    this.active = true
    this.onArrive = onArrive
  }

  update(dt: number) {
    if (!this.active) return
    this.t = Math.min(1, this.t + dt / this.dur)
    const e = easeInOut(this.t)
    Vector3.LerpToRef(this.fromPos, this.toPos, e, this.cam.position)
    Vector3.LerpToRef(this.fromTarget, this.toTarget, e, this.curTarget)
    this.cam.setTarget(this.curTarget)
    if (this.t >= 1) {
      this.active = false
      this.onArrive?.()
      this.onArrive = undefined
    }
  }

  get busy() {
    return this.active
  }
}

// ---------- screen helpers ----------
function renderSize(scene: Scene) {
  const e = scene.getEngine()
  return { w: e.getRenderWidth(), h: e.getRenderHeight() }
}

// World point -> CSS pixel position on the canvas.
export function worldToCss(scene: Scene, canvas: HTMLCanvasElement, world: Vector3): { x: number; y: number } {
  const { w, h } = renderSize(scene)
  const p = Vector3.Project(world, Matrix.Identity(), scene.getTransformMatrix(), new Viewport(0, 0, w, h))
  return { x: (p.x * canvas.clientWidth) / w, y: (p.y * canvas.clientHeight) / h }
}

// Pointer (CSS px) -> world point on a plane through `planePoint` facing the camera.
export function pointerOnCameraPlane(
  scene: Scene,
  cam: UniversalCamera,
  px: number,
  py: number,
  planePoint: Vector3,
): Vector3 {
  const normal = cam.getForwardRay(1).direction.negate()
  const plane = Plane.FromPositionAndNormal(planePoint, normal)
  const ray = scene.createPickingRay(px, py, Matrix.Identity(), cam)
  const dist = ray.intersectsPlane(plane)
  if (dist === null) return planePoint.clone()
  return ray.origin.add(ray.direction.scale(dist))
}

// ---------- sparkle burst ----------
export function sparkle(scene: Scene, at: Vector3, count = 10) {
  const mat = glowMaterial(scene, 'sparkle', PALETTE.sparkle, 1.0)
  for (let i = 0; i < count; i++) {
    const s = MeshBuilder.CreateBox(`spk`, { size: 0.03 + Math.random() * 0.03 }, scene)
    s.material = mat
    s.position.copyFrom(at)
    const dir = new Vector3(Math.random() * 2 - 1, Math.random() * 1.4 + 0.2, Math.random() * 2 - 1).normalize()
    const speed = 0.6 + Math.random() * 0.9
    let life = 0
    const max = 0.5 + Math.random() * 0.3
    const spin = (Math.random() - 0.5) * 8
    // own clock: engine.getDeltaTime() only updates inside runRenderLoop
    let last = performance.now()
    const obs = scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      life += dt
      s.position.addInPlace(dir.scale(speed * dt))
      s.position.y -= 0.7 * life * dt
      s.rotation.y += spin * dt
      const k = Math.max(0, 1 - life / max)
      s.scaling.setAll(k)
      if (life >= max) {
        scene.onBeforeRenderObservable.remove(obs)
        s.dispose()
      }
    })
  }
}

// ---------- pop-out: a prop rises from an opened box and arcs to its spot ----------
export function popOut(scene: Scene, node: TransformNode, from: Vector3, to: Vector3, delay = 0) {
  node.position.copyFrom(from)
  node.scaling.setAll(0.01)
  node.setEnabled(true)
  let t = -delay
  const dur = 0.45
  // own clock: engine.getDeltaTime() only updates inside runRenderLoop
  let last = performance.now()
  const obs = scene.onBeforeRenderObservable.add(() => {
    const now = performance.now()
    t += Math.min((now - last) / 1000, 0.05)
    last = now
    if (t <= 0) return
    const k = Math.min(1, t / dur)
    Vector3.LerpToRef(from, to, easeInOut(k), node.position)
    node.position.y += Math.sin(k * Math.PI) * 0.4
    node.scaling.setAll(Math.max(0.01, Math.min(1.15, easeOutBack(k))))
    if (k >= 1) {
      node.position.copyFrom(to)
      node.scaling.setAll(1)
      scene.onBeforeRenderObservable.remove(obs)
    }
  })
}

// ---------- tween registry attached to a node ----------
interface Tween {
  node: TransformNode
  fromPos: Vector3
  toPos: Vector3
  fromRot: Quaternion
  toRot: Quaternion
  t: number
  dur: number
  ease: (t: number) => number
  pulse: boolean
  onDone?: () => void
}

class Tweener {
  private tweens: Tween[] = []

  to(
    node: TransformNode,
    toPos: Vector3,
    toRotEuler: Vector3,
    dur = 0.28,
    ease = easeOutBack,
    pulse = false,
    onDone?: () => void,
  ) {
    node.rotationQuaternion ??= Quaternion.FromEulerVector(node.rotation)
    this.tweens = this.tweens.filter((t) => t.node !== node)
    this.tweens.push({
      node,
      fromPos: node.position.clone(),
      toPos: toPos.clone(),
      fromRot: node.rotationQuaternion.clone(),
      toRot: Quaternion.FromEulerVector(toRotEuler),
      t: 0,
      dur,
      ease,
      pulse,
      onDone,
    })
  }

  update(dt: number) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]
      tw.t = Math.min(1, tw.t + dt / tw.dur)
      const e = tw.ease(tw.t)
      Vector3.LerpToRef(tw.fromPos, tw.toPos, e, tw.node.position)
      Quaternion.SlerpToRef(tw.fromRot, tw.toRot, Math.min(1, tw.t), tw.node.rotationQuaternion!)
      if (tw.pulse) {
        const p = 1 + 0.18 * Math.sin(Math.min(1, tw.t) * Math.PI)
        tw.node.scaling.setAll(p)
      }
      if (tw.t >= 1) {
        if (tw.pulse) tw.node.scaling.setAll(1)
        tw.onDone?.()
        this.tweens.splice(i, 1)
      }
    }
  }

  cancel(node: TransformNode) {
    this.tweens = this.tweens.filter((t) => t.node !== node)
  }

  // Jump every active tween (and any tweens chained via onDone) to its end state.
  finishAll() {
    while (this.tweens.length) {
      const batch = this.tweens
      this.tweens = []
      for (const tw of batch) {
        tw.node.position.copyFrom(tw.toPos)
        tw.node.rotationQuaternion!.copyFrom(tw.toRot)
        if (tw.pulse) tw.node.scaling.setAll(1)
        tw.onDone?.() // may queue a chained tween; the while loop finishes it too
      }
    }
  }

  get idle() {
    return this.tweens.length === 0
  }
}

// ---------- shared puzzle context ----------
export interface PuzzleCtx {
  scene: Scene
  cam: UniversalCamera
  canvas: HTMLCanvasElement
  input: Input
  audio: Audio
  setHint: (text: string) => void
}

export interface Puzzle {
  update(dt: number): void
  dispose(): void
  readonly solved: boolean
  onSolved?: () => void
  hint(): string
}

// ---------- DragPuzzle: drag pieces into their correct slots ----------
export interface DragPieceDef {
  root: TransformNode
  pick: AbstractMesh[] // meshes hit-tested for grabbing
  slotId: string | string[] // a list means any of those slots (identical parts)
  home?: Vector3 // rest position (defaults to the root's position at construction)
  homeRot?: Vector3 // staged rotation (e.g. long rails lying sideways); snap still lands at zero
  sound?: 'wood' | 'ceramic'
  wrongHint?: string
}
export interface DragSlotDef {
  id: string
  pos: Vector3
  ghost?: Mesh
}

export class DragPuzzle implements Puzzle {
  solved = false
  onSolved?: () => void
  private ctx: PuzzleCtx
  private pieces: (DragPieceDef & { home: Vector3; placed: boolean })[]
  private slots: (DragSlotDef & { filled: boolean })[]
  private tw = new Tweener()
  private snapPx: number
  private hintText: string
  private grabDelay: number

  private dragging: (typeof this.pieces)[number] | null = null
  private grabOffset = new Vector3()
  private grabDepth = new Vector3()

  constructor(
    ctx: PuzzleCtx,
    pieces: DragPieceDef[],
    slots: DragSlotDef[],
    opts: { snapPx?: number; hint: string; grabDelay?: number } = { hint: '' },
  ) {
    this.ctx = ctx
    this.snapPx = opts.snapPx ?? 70
    this.hintText = opts.hint
    this.grabDelay = opts.grabDelay ?? 0
    this.pieces = pieces.map((p) => ({ ...p, home: (p.home ?? p.root.position).clone(), placed: false }))
    this.slots = slots.map((s) => ({ ...s, filled: false }))
  }

  hint() {
    return this.hintText
  }

  private pickPiece(px: number, py: number) {
    const hit = this.ctx.scene.pick(px, py, (m) => this.pieces.some((p) => !p.placed && p.pick.includes(m as AbstractMesh)))
    if (!hit?.pickedMesh) return null
    return this.pieces.find((p) => p.pick.includes(hit.pickedMesh as AbstractMesh)) ?? null
  }

  update(dt: number) {
    const { input, scene, cam, audio } = this.ctx
    if (this.grabDelay > 0) this.grabDelay -= dt

    if (input.pointerWentDown && !this.dragging && this.grabDelay <= 0) {
      const piece = this.pickPiece(input.px, input.py)
      if (piece) {
        this.dragging = piece
        this.tw.cancel(piece.root) // a mid-flight return tween must not fight the drag
        this.grabDepth.copyFrom(piece.root.position)
        const onPlane = pointerOnCameraPlane(scene, cam, input.px, input.py, this.grabDepth)
        this.grabOffset.copyFrom(piece.root.position).subtractInPlace(onPlane)
        audio.lift()
      }
    }

    if (this.dragging) {
      const onPlane = pointerOnCameraPlane(scene, cam, input.px, input.py, this.grabDepth)
      this.dragging.root.position.copyFrom(onPlane.add(this.grabOffset))
      if (input.pointerWentUp) this.release()
    }

    this.tw.update(dt)
    // Wait for the final snap tween to land before declaring victory — solving
    // disposes this puzzle, and a killed tween would freeze the piece mid-air.
    if (!this.solved && this.tw.idle && this.pieces.every((p) => p.placed)) {
      this.solved = true
      this.onSolved?.()
    }
  }

  private release() {
    const piece = this.dragging!
    this.dragging = null
    const { audio } = this.ctx

    // Nearest unfilled slot in screen space.
    let best: (typeof this.slots)[number] | null = null
    let bestD = Infinity
    const pcss = worldToCss(this.ctx.scene, this.ctx.canvas, piece.root.position)
    for (const s of this.slots) {
      if (s.filled) continue
      const scss = worldToCss(this.ctx.scene, this.ctx.canvas, s.pos)
      const d = Math.hypot(pcss.x - scss.x, pcss.y - scss.y)
      if (d < bestD) {
        bestD = d
        best = s
      }
    }

    const accepts =
      best !== null &&
      (Array.isArray(piece.slotId) ? piece.slotId.includes(best.id) : best.id === piece.slotId)
    if (best && bestD < this.snapPx && accepts) {
      // Correct!
      best.filled = true
      piece.placed = true
      this.tw.to(piece.root, best.pos, Vector3.Zero(), 0.26, easeOutBack, true)
      best.ghost?.dispose()
      audio[piece.sound === 'ceramic' ? 'ceramic' : 'woodPlace']()
      audio.snap()
      sparkle(this.ctx.scene, best.pos, 8)
    } else if (best && bestD < this.snapPx) {
      // Right place feeling, wrong piece — gentle tilt then slide home.
      audio.reject()
      this.ctx.setHint(piece.wrongHint ?? this.hintText)
      const rest = piece.homeRot ?? new Vector3(0, piece.root.rotation.y, 0)
      const tilt = rest.add(new Vector3(0, 0, 0.35))
      this.tw.to(piece.root, piece.root.position.clone(), tilt, 0.12, easeInOut, false, () => {
        this.tw.to(piece.root, piece.home, rest, 0.34, easeInOut)
      })
    } else {
      // Dropped in open space — quietly return home.
      const rest = piece.homeRot ?? new Vector3(0, piece.root.rotation.y, 0)
      this.tw.to(piece.root, piece.home, rest, 0.3, easeInOut)
    }
  }

  dispose() {
    // Aborting mid-drag or mid-tween must leave every piece somewhere sane.
    if (this.dragging && !this.dragging.placed) {
      this.dragging.root.position.copyFrom(this.dragging.home)
      this.dragging = null
    }
    this.tw.finishAll()
    this.slots.forEach((s) => s.ghost?.dispose())
  }
}

// ---------- ArrangePuzzle: free placement judged as a whole arrangement ----------
// The A-Little-to-the-Left organizing mold: every piece fits every slot, placed
// pieces can be picked back up (or bumped out by dropping another piece on
// them), and nothing is judged until the row is full. Then the arrangement is
// read against a rule — by default monotone in `value`, either direction, so
// there is no one correct way. Right: a left-to-right rising chime-and-pulse
// wave. Wrong: the offending neighbours wiggle and the hint answers.
export interface ArrangeItemDef {
  root: TransformNode
  pick: AbstractMesh[]
  value: number // the sortable quantity (height, size, hue position…)
  home?: Vector3
  sound?: 'wood' | 'ceramic'
}
export interface ArrangeSlotDef {
  pos: Vector3
  ghost?: Mesh
}

export class ArrangePuzzle implements Puzzle {
  solved = false
  onSolved?: () => void
  private ctx: PuzzleCtx
  private items: (ArrangeItemDef & { home: Vector3; slot: number | null })[]
  private slots: ArrangeSlotDef[]
  private tw = new Tweener()
  private snapPx: number
  private hintText: string
  private wrongHint: string
  private order: 'either' | 'ascending' | 'descending'
  private grabDelay: number
  private judged = false
  private celebrating = false
  private celebT = 0
  private celebFired = 0

  private dragging: (typeof this.items)[number] | null = null
  private grabOffset = new Vector3()
  private grabDepth = new Vector3()

  constructor(
    ctx: PuzzleCtx,
    items: ArrangeItemDef[],
    slots: ArrangeSlotDef[],
    opts: {
      snapPx?: number
      hint: string
      wrongHint?: string
      grabDelay?: number
      order?: 'either' | 'ascending' | 'descending'
    },
  ) {
    this.ctx = ctx
    this.snapPx = opts.snapPx ?? 65
    this.hintText = opts.hint
    this.wrongHint = opts.wrongHint ?? opts.hint
    this.order = opts.order ?? 'either'
    this.grabDelay = opts.grabDelay ?? 0
    this.items = items.map((it) => ({ ...it, home: (it.home ?? it.root.position).clone(), slot: null }))
    this.slots = slots
  }

  hint() {
    return this.hintText
  }

  private occupant(slotIdx: number) {
    return this.items.find((it) => it.slot === slotIdx) ?? null
  }

  update(dt: number) {
    const { input, scene, cam, audio } = this.ctx
    this.tw.update(dt)

    if (this.celebrating) {
      // fire the pulse wave left to right, then hand the phase over
      this.celebT += dt
      const step = 0.14
      while (this.celebFired < this.slots.length && this.celebT >= this.celebFired * step) {
        const it = this.occupant(this.celebFired)
        if (it) {
          this.tw.to(it.root, this.slots[this.celebFired].pos, Vector3.Zero(), 0.24, easeOutBack, true)
          audio.chime(this.celebFired)
          sparkle(scene, this.slots[this.celebFired].pos.add(new Vector3(0, 0.12, 0)), 5)
        }
        this.celebFired++
      }
      if (this.celebFired >= this.slots.length && this.celebT >= this.slots.length * 0.14 + 0.3 && this.tw.idle && !this.solved) {
        this.solved = true
        this.onSolved?.()
      }
      return
    }

    if (this.grabDelay > 0) this.grabDelay -= dt

    if (input.pointerWentDown && !this.dragging && this.grabDelay <= 0) {
      const hit = scene.pick(input.px, input.py, (m) => this.items.some((it) => it.pick.includes(m as AbstractMesh)))
      const piece = hit?.pickedMesh
        ? this.items.find((it) => it.pick.includes(hit.pickedMesh as AbstractMesh)) ?? null
        : null
      if (piece) {
        this.dragging = piece
        this.judged = false // any touch reopens the judgement
        this.tw.cancel(piece.root)
        if (piece.slot !== null) {
          this.slots[piece.slot].ghost?.setEnabled(true)
          piece.slot = null
        }
        this.grabDepth.copyFrom(piece.root.position)
        const onPlane = pointerOnCameraPlane(scene, cam, input.px, input.py, this.grabDepth)
        this.grabOffset.copyFrom(piece.root.position).subtractInPlace(onPlane)
        audio.lift()
      }
    }

    if (this.dragging) {
      const onPlane = pointerOnCameraPlane(scene, cam, input.px, input.py, this.grabDepth)
      this.dragging.root.position.copyFrom(onPlane.add(this.grabOffset))
      if (input.pointerWentUp) this.release()
    }

    // Judge once everything has settled into a full row.
    if (!this.judged && !this.dragging && this.tw.idle && this.items.every((it) => it.slot !== null)) {
      this.judge()
    }
  }

  private release() {
    const piece = this.dragging!
    this.dragging = null
    const { audio, scene, canvas } = this.ctx

    // Nearest slot in screen space — occupied ones included: dropping onto a
    // full spot bumps the sitter back to the mat (rearranging must stay cheap).
    let best = -1
    let bestD = Infinity
    const pcss = worldToCss(scene, canvas, piece.root.position)
    this.slots.forEach((s, i) => {
      const scss = worldToCss(scene, canvas, s.pos)
      const d = Math.hypot(pcss.x - scss.x, pcss.y - scss.y)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })

    if (best >= 0 && bestD < this.snapPx) {
      const sitting = this.occupant(best)
      if (sitting) {
        sitting.slot = null
        this.tw.to(sitting.root, sitting.home, Vector3.Zero(), 0.32, easeInOut)
      }
      piece.slot = best
      this.slots[best].ghost?.setEnabled(false)
      this.tw.to(piece.root, this.slots[best].pos, Vector3.Zero(), 0.26, easeOutBack, true)
      // settling is neutral-positive foley; the chime is reserved for the
      // arrangement coming out right
      audio[piece.sound === 'ceramic' ? 'ceramic' : 'woodPlace']()
    } else {
      this.tw.to(piece.root, piece.home, Vector3.Zero(), 0.3, easeInOut)
    }
  }

  private judge() {
    this.judged = true
    const vals = this.slots.map((_, i) => this.occupant(i)!.value)
    const asc = vals.every((v, i) => i === 0 || vals[i - 1] <= v)
    const desc = vals.every((v, i) => i === 0 || vals[i - 1] >= v)
    const ok = this.order === 'ascending' ? asc : this.order === 'descending' ? desc : asc || desc
    if (ok) {
      this.celebrating = true
      this.celebT = 0
      this.celebFired = 0
      return
    }
    // Wrong — wiggle the neighbours that break the closer-to-right direction.
    const invAsc: number[] = []
    const invDesc: number[] = []
    for (let i = 0; i + 1 < vals.length; i++) {
      if (vals[i] > vals[i + 1]) invAsc.push(i)
      if (vals[i] < vals[i + 1]) invDesc.push(i)
    }
    let bad: number[]
    if (this.order === 'ascending') bad = invAsc
    else if (this.order === 'descending') bad = invDesc
    else bad = invAsc.length <= invDesc.length ? invAsc : invDesc
    const wiggled = new Set<number>()
    bad.forEach((i) => {
      wiggled.add(i)
      wiggled.add(i + 1)
    })
    this.ctx.audio.reject()
    this.ctx.setHint(this.wrongHint)
    wiggled.forEach((i) => this.wiggle(this.occupant(i)!, this.slots[i].pos))
  }

  private wiggle(it: (typeof this.items)[number], at: Vector3) {
    this.tw.to(it.root, at, new Vector3(0, 0, 0.15), 0.1, easeInOut, false, () => {
      this.tw.to(it.root, at, new Vector3(0, 0, -0.11), 0.12, easeInOut, false, () => {
        this.tw.to(it.root, at, Vector3.Zero(), 0.12, easeInOut)
      })
    })
  }

  dispose() {
    if (this.dragging) {
      this.dragging.root.position.copyFrom(this.dragging.home)
      this.dragging = null
    }
    this.tw.finishAll()
    this.slots.forEach((s) => s.ghost?.dispose())
  }
}

// ---------- StackPuzzle: pile pieces onto one spot in size order ----------
// The order IS the puzzle: only the largest still-waiting piece may land on
// the stack. A too-small piece answers with a tilt + hint and slides home.
export interface StackItemDef {
  root: TransformNode
  pick: AbstractMesh[]
  value: number // larger stacks first
  height: number // how much this piece raises the stack
  home?: Vector3
  sound?: 'wood' | 'ceramic'
}

export class StackPuzzle implements Puzzle {
  solved = false
  onSolved?: () => void
  private ctx: PuzzleCtx
  private items: (StackItemDef & { home: Vector3; placed: boolean })[]
  private base: Vector3
  private ghost?: Mesh
  private tw = new Tweener()
  private snapPx: number
  private hintText: string
  private wrongHint: string
  private grabDelay: number
  private stackedH = 0
  private placedCount = 0

  private dragging: (typeof this.items)[number] | null = null
  private grabOffset = new Vector3()
  private grabDepth = new Vector3()

  constructor(
    ctx: PuzzleCtx,
    items: StackItemDef[],
    base: Vector3,
    opts: { snapPx?: number; hint: string; wrongHint?: string; grabDelay?: number; ghost?: Mesh },
  ) {
    this.ctx = ctx
    this.base = base.clone()
    this.ghost = opts.ghost
    this.snapPx = opts.snapPx ?? 70
    this.hintText = opts.hint
    this.wrongHint = opts.wrongHint ?? opts.hint
    this.grabDelay = opts.grabDelay ?? 0
    this.items = items.map((it) => ({ ...it, home: (it.home ?? it.root.position).clone(), placed: false }))
  }

  hint() {
    return this.hintText
  }

  update(dt: number) {
    const { input, scene, cam, audio } = this.ctx
    this.tw.update(dt)
    if (this.grabDelay > 0) this.grabDelay -= dt

    if (input.pointerWentDown && !this.dragging && this.grabDelay <= 0) {
      const hit = scene.pick(input.px, input.py, (m) =>
        this.items.some((it) => !it.placed && it.pick.includes(m as AbstractMesh)),
      )
      const piece = hit?.pickedMesh
        ? this.items.find((it) => !it.placed && it.pick.includes(hit.pickedMesh as AbstractMesh)) ?? null
        : null
      if (piece) {
        this.dragging = piece
        this.tw.cancel(piece.root)
        this.grabDepth.copyFrom(piece.root.position)
        const onPlane = pointerOnCameraPlane(scene, cam, input.px, input.py, this.grabDepth)
        this.grabOffset.copyFrom(piece.root.position).subtractInPlace(onPlane)
        audio.lift()
      }
    }

    if (this.dragging) {
      const onPlane = pointerOnCameraPlane(scene, cam, input.px, input.py, this.grabDepth)
      this.dragging.root.position.copyFrom(onPlane.add(this.grabOffset))
      if (input.pointerWentUp) this.release()
    }

    if (!this.solved && this.tw.idle && this.items.every((it) => it.placed)) {
      this.solved = true
      this.onSolved?.()
    }
  }

  private release() {
    const piece = this.dragging!
    this.dragging = null
    const { audio, scene, canvas } = this.ctx

    const top = new Vector3(this.base.x, this.base.y + this.stackedH, this.base.z)
    const pcss = worldToCss(scene, canvas, piece.root.position)
    const tcss = worldToCss(scene, canvas, top)
    const near = Math.hypot(pcss.x - tcss.x, pcss.y - tcss.y) < this.snapPx

    if (near) {
      const maxWaiting = Math.max(...this.items.filter((it) => !it.placed).map((it) => it.value))
      if (piece.value >= maxWaiting) {
        // Largest remaining — it lands on top of the pile.
        piece.placed = true
        this.tw.to(piece.root, top, Vector3.Zero(), 0.26, easeOutBack, true)
        this.stackedH += piece.height
        this.placedCount++
        this.ghost?.setEnabled(false)
        audio[piece.sound === 'wood' ? 'woodPlace' : 'ceramic']()
        audio.chime(this.placedCount - 1)
        sparkle(scene, top.add(new Vector3(0, 0.08, 0)), 6)
      } else {
        // A bigger one is still waiting — tilt, answer, slide home.
        audio.reject()
        this.ctx.setHint(this.wrongHint)
        this.tw.to(piece.root, piece.root.position.clone(), new Vector3(0, 0, 0.3), 0.12, easeInOut, false, () => {
          this.tw.to(piece.root, piece.home, Vector3.Zero(), 0.34, easeInOut)
        })
      }
    } else {
      this.tw.to(piece.root, piece.home, Vector3.Zero(), 0.3, easeInOut)
    }
  }

  dispose() {
    if (this.dragging && !this.dragging.placed) {
      this.dragging.root.position.copyFrom(this.dragging.home)
      this.dragging = null
    }
    this.tw.finishAll()
    this.ghost?.dispose()
  }
}

// ---------- RotatePuzzle: drag left/right to level a crooked object ----------
export class RotatePuzzle implements Puzzle {
  solved = false
  onSolved?: () => void
  private ctx: PuzzleCtx
  private node: TransformNode
  private pick: AbstractMesh[]
  private tolerance: number
  private hintText: string
  private dragging = false
  private lastX = 0
  private settleT = 0

  constructor(
    ctx: PuzzleCtx,
    node: TransformNode,
    pick: AbstractMesh[],
    opts: { startAngle: number; tolerance?: number; hint: string },
  ) {
    this.ctx = ctx
    this.node = node
    this.pick = pick
    this.tolerance = opts.tolerance ?? 0.06
    this.hintText = opts.hint
    this.node.rotation.z = opts.startAngle
  }

  hint() {
    return this.hintText
  }

  update(dt: number) {
    const { input, scene, audio } = this.ctx
    if (this.solved) return

    if (input.pointerWentDown) {
      const hit = scene.pick(input.px, input.py, (m) => this.pick.includes(m as AbstractMesh))
      if (hit?.pickedMesh) {
        this.dragging = true
        this.lastX = input.px
        audio.lift()
      }
    }
    if (this.dragging) {
      const dx = input.px - this.lastX
      this.lastX = input.px
      this.node.rotation.z += dx * 0.006
      if (input.pointerWentUp) this.dragging = false
    }

    // Settle check: within tolerance of level and released.
    if (!this.dragging && Math.abs(this.node.rotation.z) < this.tolerance) {
      this.settleT += dt
      if (this.settleT > 0.35) {
        this.node.rotation.z = 0
        this.solved = true
        audio.snap()
        sparkle(scene, this.node.getAbsolutePosition(), 8)
        this.onSolved?.()
      }
    } else {
      this.settleT = 0
    }
  }

  dispose() {}
}

// ---------- BoltPuzzle: drag across each bolt to tighten it ----------
export interface BoltDef {
  node: TransformNode // the bolt mesh (rotates as it tightens)
  pick: AbstractMesh
  ring?: Mesh // optional progress ring (scales with progress)
}

export class BoltPuzzle implements Puzzle {
  solved = false
  onSolved?: () => void
  private ctx: PuzzleCtx
  private bolts: (BoltDef & { progress: number; done: boolean; baseY: number })[]
  private hintText: string
  private lastPx = 0
  private lastPy = 0
  private down = false
  // How far a bolt is driven down as it tightens — enough to sink the head
  // (top face at local y +0.065) flush with the surface, leaving nothing exposed.
  private static readonly SINK = 0.07

  constructor(ctx: PuzzleCtx, bolts: BoltDef[], hint: string) {
    this.ctx = ctx
    // Remember each bolt's starting height so it can be driven flush as it tightens.
    this.bolts = bolts.map((b) => ({ ...b, progress: 0, done: false, baseY: b.node.position.y }))
    this.hintText = hint
  }

  hint() {
    return this.hintText
  }

  update(_dt: number) {
    const { input, audio, scene, canvas } = this.ctx
    if (this.solved) return

    if (input.pointerWentDown) {
      this.down = true
      this.lastPx = input.px
      this.lastPy = input.py
    }
    if (input.pointerWentUp) this.down = false

    if (this.down && input.pointerDown) {
      const moved = Math.hypot(input.px - this.lastPx, input.py - this.lastPy)
      this.lastPx = input.px
      this.lastPy = input.py
      if (moved > 0.5) {
        for (const b of this.bolts) {
          if (b.done) continue
          const bp = worldToCss(scene, canvas, b.node.getAbsolutePosition())
          const near = Math.hypot(input.px - bp.x, input.py - bp.y)
          if (near < 46) {
            b.progress = Math.min(1, b.progress + moved * 0.012)
            b.node.rotation.y += moved * 0.05
            b.node.position.y = b.baseY - b.progress * BoltPuzzle.SINK // screw sinks in as it tightens
            if (b.ring) b.ring.scaling.setAll(0.2 + b.progress * 0.8)
            if (Math.random() < 0.3) audio.tick()
            if (b.progress >= 1) {
              b.done = true
              b.ring?.dispose()
              audio.ding()
              sparkle(scene, b.node.getAbsolutePosition(), 6)
            }
          }
        }
      }
    }

    if (this.bolts.every((b) => b.done)) {
      this.solved = true
      this.onSolved?.()
    }
  }

  dispose() {
    this.bolts.forEach((b) => b.ring?.dispose())
  }
}

// ---------- BoxCutterPuzzle: slice the tape seam, flaps pop open ----------
import type { TapedBox } from './props'

export class BoxCutterPuzzle implements Puzzle {
  solved = false
  onSolved?: () => void
  private ctx: PuzzleCtx
  private box: TapedBox
  private hintText: string
  private progress = 0
  private cutting = false
  private opening = false
  private openT = 0
  private lastPx = 0
  private sliceCd = 0
  private blade: Mesh
  private tapeFull: number
  private tapeLeftLocal: number
  private tapeY: number
  private tapeZ: number

  constructor(ctx: PuzzleCtx, box: TapedBox, hint: string) {
    this.ctx = ctx
    this.box = box
    this.hintText = hint
    const ext = box.tape.getBoundingInfo().boundingBox.extendSize
    this.tapeFull = ext.x * 2
    this.tapeLeftLocal = box.tape.position.x - this.tapeFull / 2
    this.tapeY = box.tape.position.y
    this.tapeZ = box.tape.position.z
    this.blade = MeshBuilder.CreateBox('blade', { width: 0.05, height: 0.14, depth: 0.02 }, ctx.scene)
    this.blade.material = glowMaterial(ctx.scene, 'blade', new Color3(0.36, 0.23, 0.28), 0.3)
    this.blade.parent = box.root
    this.blade.setEnabled(false)
  }

  hint() {
    return this.hintText
  }

  private overBox(): boolean {
    const { scene, input, canvas } = this.ctx
    const hit = scene.pick(input.px, input.py, (mesh) => this.box.pick.includes(mesh as Mesh))
    if (hit?.pickedMesh) return true
    // forgiving fallback: near the box on screen
    const c = worldToCss(scene, canvas, this.box.body.getAbsolutePosition())
    return Math.hypot(input.px - c.x, input.py - c.y) < 140
  }

  update(dt: number) {
    const { input, audio } = this.ctx

    if (this.opening) {
      this.openT = Math.min(1, this.openT + dt / 0.4)
      const e = easeOutBack(this.openT)
      this.box.pivotF.rotation.x = -2.3 * e
      this.box.pivotB.rotation.x = 2.3 * e
      if (this.openT >= 1 && !this.solved) {
        this.solved = true
        audio.pop()
        sparkle(this.ctx.scene, this.box.tape.getAbsolutePosition().add(new Vector3(0, 0.1, 0)), 10)
        this.vanishBox()
        this.onSolved?.()
      }
      return
    }

    if (input.pointerWentDown && this.overBox()) {
      this.cutting = true
      this.lastPx = input.px
      this.blade.setEnabled(true)
    }
    if (input.pointerWentUp) {
      this.cutting = false
      this.blade.setEnabled(false)
    }

    if (this.sliceCd > 0) this.sliceCd -= dt

    if (this.cutting && input.pointerDown) {
      const dx = Math.abs(input.px - this.lastPx)
      this.lastPx = input.px
      if (dx > 0.3) {
        this.progress = Math.min(1, this.progress + dx * 0.006)
        // recede the tape, pinned at its left end
        const w = this.tapeFull * (1 - this.progress)
        this.box.tape.scaling.x = Math.max(0.001, 1 - this.progress)
        this.box.tape.position.x = this.tapeLeftLocal + w / 2
        // blade rides the cut edge
        this.blade.position.set(this.tapeLeftLocal + w, this.tapeY + 0.05, this.tapeZ)
        if (this.sliceCd <= 0) {
          audio.slice()
          this.sliceCd = 0.08
        }
        if (this.progress >= 1) {
          this.opening = true
          this.cutting = false
          this.blade.setEnabled(false)
          this.box.tape.setEnabled(false)
        }
      }
    }
  }

  // Once the contents have popped out, the empty box shrinks into the floor and
  // disappears. Runs on the scene observable so it outlives this puzzle object.
  private vanishBox() {
    const scene = this.ctx.scene
    const box = this.box
    let t = -0.55 // let the pop-out animation clear the box first
    let last = performance.now()
    const obs = scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      t += Math.min((now - last) / 1000, 0.05)
      last = now
      if (t <= 0) return
      const k = Math.min(1, t / 0.3)
      box.root.scaling.setAll(Math.max(0.001, 1 - easeInOut(k)))
      if (k >= 1) {
        box.root.setEnabled(false)
        scene.onBeforeRenderObservable.remove(obs)
      }
    })
  }

  dispose() {
    this.blade.dispose()
  }
}

// ghost/silhouette material helper for slots
export function ghostMesh(scene: Scene, mesh: Mesh): Mesh {
  mesh.material = glowMaterial(scene, 'ghost', new Color3(0.79, 0.66, 0.56), 0.12, 0.34)
  mesh.isPickable = false
  return mesh
}

export const HL = HIGHLIGHT
