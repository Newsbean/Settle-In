// Unified input for both movement (walk mode) and puzzle dragging (focus mode).
// Desktop: pointer-lock mouse-look + WASD; click to interact. Touch: left half is
// a virtual move-joystick, right half looks; in focus mode a single drag moves pieces.

export type InputMode = 'walk' | 'focus'

interface TouchPoint {
  id: number
  startX: number
  startY: number
  x: number
  y: number
  side: 'left' | 'right'
}

export class Input {
  mode: InputMode = 'walk'

  // walk
  readonly keys = new Set<string>()
  moveX = 0 // -1..1 strafe
  moveZ = 0 // -1..1 forward
  lookDX = 0 // yaw delta (radians-ish, scaled later), consumed per frame
  lookDY = 0 // pitch delta
  run = false
  interactPressed = false // edge, consumed per frame
  escPressed = false

  // focus (puzzle) — pointer in CSS px relative to canvas
  px = 0
  py = 0
  pointerDown = false
  pointerWentDown = false
  pointerWentUp = false

  pointerLocked = false

  private canvas: HTMLCanvasElement
  private touches = new Map<number, TouchPoint>()
  private moveTouchId: number | null = null
  private lookTouchId: number | null = null
  // Mouse drag-look fallback for when pointer lock is unavailable (iframes, etc.)
  private lookDragging = false
  private lastLookX = 0
  private lastLookY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.bind()
  }

  private bind() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    document.addEventListener('pointerlockchange', this.onLockChange)
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    document.removeEventListener('pointerlockchange', this.onLockChange)
  }

  requestLock() {
    if (this.mode === 'walk' && !this.isTouch()) {
      // May reject (iframes, unsupported docs) — that's fine, drag-look covers it.
      const p = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined
      p?.catch?.(() => {})
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock?.()
  }

  setMode(mode: InputMode) {
    if (this.mode === mode) return
    this.mode = mode
    this.moveX = 0
    this.moveZ = 0
    this.touches.clear()
    this.moveTouchId = null
    this.lookTouchId = null
    if (mode === 'focus') this.exitLock()
  }

  private isTouch() {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false
  }

  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    this.keys.add(k)
    if (k === 'shift') this.run = true
    if (k === 'e') this.interactPressed = true
    if (k === 'escape') this.escPressed = true
    if (['w', 'a', 's', 'd', ' '].includes(k)) e.preventDefault()
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    this.keys.delete(k)
    if (k === 'shift') this.run = false
  }

  private canvasXY(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private onPointerDown = (e: PointerEvent) => {
    const { x, y } = this.canvasXY(e)
    if (this.mode === 'focus') {
      this.px = x
      this.py = y
      this.pointerDown = true
      this.pointerWentDown = true
      return
    }
    // walk mode
    if (e.pointerType === 'touch') {
      const side: 'left' | 'right' = x < this.canvas.clientWidth / 2 ? 'left' : 'right'
      const tp: TouchPoint = { id: e.pointerId, startX: x, startY: y, x, y, side }
      this.touches.set(e.pointerId, tp)
      if (side === 'left' && this.moveTouchId === null) this.moveTouchId = e.pointerId
      else if (this.lookTouchId === null) this.lookTouchId = e.pointerId
    } else {
      // mouse: start drag-look, and try pointer lock as an enhancement
      this.lookDragging = true
      this.lastLookX = e.clientX
      this.lastLookY = e.clientY
      this.requestLock()
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.mode === 'focus') {
      const { x, y } = this.canvasXY(e)
      this.px = x
      this.py = y
      return
    }
    // walk mode
    if (e.pointerType === 'touch') {
      const tp = this.touches.get(e.pointerId)
      if (!tp) return
      const { x, y } = this.canvasXY(e)
      if (e.pointerId === this.moveTouchId) {
        const dx = x - tp.startX
        const dy = y - tp.startY
        const max = 60
        this.moveX = Math.max(-1, Math.min(1, dx / max))
        this.moveZ = Math.max(-1, Math.min(1, -dy / max))
        this.run = Math.hypot(dx, dy) > max * 0.85
      } else if (e.pointerId === this.lookTouchId) {
        this.lookDX += (x - tp.x) * 0.5
        this.lookDY += (y - tp.y) * 0.5
      }
      tp.x = x
      tp.y = y
    } else if (this.pointerLocked) {
      this.lookDX += e.movementX
      this.lookDY += e.movementY
    } else if (this.lookDragging) {
      // drag-look fallback (no pointer lock)
      this.lookDX += e.clientX - this.lastLookX
      this.lookDY += e.clientY - this.lastLookY
      this.lastLookX = e.clientX
      this.lastLookY = e.clientY
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    if (this.mode === 'focus') {
      this.pointerDown = false
      this.pointerWentUp = true
      return
    }
    this.lookDragging = false
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId)
      if (e.pointerId === this.moveTouchId) {
        this.moveTouchId = null
        this.moveX = 0
        this.moveZ = 0
        this.run = false
      }
      if (e.pointerId === this.lookTouchId) this.lookTouchId = null
    }
  }

  // Read WASD into moveX/moveZ (keyboard path); call each frame before player update.
  pollKeyboardMove() {
    if (this.mode !== 'walk') return
    if (this.moveTouchId !== null) return // touch joystick owns movement
    let x = 0
    let z = 0
    if (this.keys.has('w')) z += 1
    if (this.keys.has('s')) z -= 1
    if (this.keys.has('a')) x -= 1
    if (this.keys.has('d')) x += 1
    const len = Math.hypot(x, z)
    if (len > 0) {
      x /= len
      z /= len
    }
    this.moveX = x
    this.moveZ = z
  }

  // Clear per-frame edges and consumed deltas.
  endFrame() {
    this.lookDX = 0
    this.lookDY = 0
    this.interactPressed = false
    this.escPressed = false
    this.pointerWentDown = false
    this.pointerWentUp = false
  }
}
