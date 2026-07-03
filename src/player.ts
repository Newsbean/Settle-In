import { UniversalCamera, Vector3, type Scene } from '@babylonjs/core'
import type { Collider, House } from './house'
import type { Input } from './input'

const EYE_H = 1.62
const RADIUS = 0.32
const WALK_SPEED = 2.6
const RUN_SPEED = 4.4
const LOOK_SENS = 0.0022
const PITCH_LIMIT = Math.PI / 2 - 0.05

export class Player {
  readonly camera: UniversalCamera
  yaw = 0
  pitch = 0
  private pos: Vector3
  private house: House
  active = true // false while a focus minigame runs

  constructor(scene: Scene, house: House) {
    this.house = house
    this.pos = house.spawn.clone()
    this.pos.y = EYE_H
    this.camera = new UniversalCamera('player-cam', this.pos.clone(), scene)
    this.camera.minZ = 0.08
    this.camera.fov = 1.15 // ~66°, comfortable (HF-style modest FOV)
    this.camera.inputs.clear() // we drive it entirely by hand
    this.yaw = house.spawnYaw
    this.applyRotation()
  }

  private applyRotation() {
    this.camera.rotation.set(this.pitch, this.yaw, 0)
  }

  private resolveCollisions(x: number, z: number): { x: number; z: number } {
    // Circle vs AABB push-out for each collider.
    for (const c of this.house.colliders) {
      const nearestX = Math.max(c.minX, Math.min(x, c.maxX))
      const nearestZ = Math.max(c.minZ, Math.min(z, c.maxZ))
      let dx = x - nearestX
      let dz = z - nearestZ
      const d2 = dx * dx + dz * dz
      if (d2 < RADIUS * RADIUS) {
        const d = Math.sqrt(d2) || 0.0001
        // Push out along the nearest-normal; if inside (d~0), pick the shallowest axis.
        if (d2 < 1e-6) {
          const toLeft = Math.abs(x - c.minX)
          const toRight = Math.abs(c.maxX - x)
          const toBack = Math.abs(z - c.minZ)
          const toFront = Math.abs(c.maxZ - z)
          const m = Math.min(toLeft, toRight, toBack, toFront)
          if (m === toLeft) x = c.minX - RADIUS
          else if (m === toRight) x = c.maxX + RADIUS
          else if (m === toBack) z = c.minZ - RADIUS
          else z = c.maxZ + RADIUS
        } else {
          const push = (RADIUS - d) / d
          x += dx * push
          z += dz * push
        }
      }
    }
    // Clamp to house outer bounds with a margin.
    const b = this.house.bounds
    x = Math.max(b.minX + RADIUS, Math.min(b.maxX - RADIUS, x))
    z = Math.max(b.minZ + RADIUS, Math.min(b.maxZ - RADIUS, z))
    return { x, z }
  }

  update(input: Input, dt: number) {
    if (!this.active) return

    // Look
    this.yaw += input.lookDX * LOOK_SENS
    this.pitch += input.lookDY * LOOK_SENS
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch))
    this.applyRotation()

    // Move (relative to yaw, ignore pitch)
    const speed = input.run ? RUN_SPEED : WALK_SPEED
    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    const fwdX = sin
    const fwdZ = cos
    const rightX = cos
    const rightZ = -sin
    let nx = this.pos.x + (fwdX * input.moveZ + rightX * input.moveX) * speed * dt
    let nz = this.pos.z + (fwdZ * input.moveZ + rightZ * input.moveX) * speed * dt
    const resolved = this.resolveCollisions(nx, nz)
    this.pos.x = resolved.x
    this.pos.z = resolved.z
    this.pos.y = EYE_H
    this.camera.position.copyFrom(this.pos)
  }

  get position(): Vector3 {
    return this.pos
  }

  // Horizontal forward vector (for hotspot facing checks).
  forward(): Vector3 {
    return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
  }

  setActive(active: boolean) {
    this.active = active
  }
}
