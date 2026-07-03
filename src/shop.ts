// Ordering & delivery: every boxed station starts as a catalog item on the
// laptop by the front door. Order it online → the box lands on the porch →
// carry it in and set it down at its spot → the station unlocks for assembly.
import { MeshBuilder, TransformNode, Vector3, type Mesh, type Scene } from '@babylonjs/core'
import { flatMaterial, glowMaterial } from './materials'
import { PALETTE } from './palette'
import { makeTapedBox, type TapedBox } from './props'
import type { Audio } from './audio'
import type { House } from './house'
import type { Player } from './player'
import type { Station } from './stations'

export type OrderStatus =
  | 'locked' // its `requires` station isn't built yet
  | 'orderable'
  | 'shipping'
  | 'porch'
  | 'carrying'
  | 'placed'

// Friendly parcel names — the box label, not the task title.
const BOX_NAMES: Record<string, string> = {
  shelf: 'Bookshelf kit',
  books: 'Box of books',
  kitchen: 'Kitchenware set',
  spices: 'Spice jar set',
  plates: 'Plate set',
  sofa: 'Sofa (flat-packed)',
  lamp: 'Floor lamp',
  table: 'Coffee table kit',
  desk: 'Writing desk kit',
  bed: 'Bed frame kit',
  bedding: 'Bedding bundle',
  wardrobe: 'Wardrobe kit',
  vanity: 'Bathroom vanity kit',
  dining: 'Dining nook set',
}

const DELIVERY_BASE = 5 // seconds until the van "arrives"
const DELIVERY_STAGGER = 2 // extra per parcel already on the way

interface Order {
  station: Station
  status: OrderStatus
  timer: number
  box: TapedBox | null
  spotIndex: number
}

export class Shop {
  // Where the laptop crate sits (inside, beside the front door).
  readonly deskPos = new Vector3(-4.3, 0, 3.35)
  carrying: string | null = null
  onArrival: (name: string) => void = () => {}
  onStateChange: () => void = () => {}

  private orders = new Map<string, Order>()
  private stationsById = new Map<string, Station>()
  private carryYawOffset = 0

  constructor(
    private scene: Scene,
    private house: House,
    private audio: Audio,
    stations: Station[],
  ) {
    stations.forEach((s) => {
      this.stationsById.set(s.id, s)
      if (!s.noBox) {
        this.orders.set(s.id, { station: s, status: 'orderable', timer: 0, box: null, spotIndex: -1 })
      }
    })
    this.buildDesk()
  }

  // --- the laptop-on-a-crate order point ---
  private buildDesk() {
    const root = new TransformNode('order-desk', this.scene)
    const crate = MeshBuilder.CreateBox('order-crate', { width: 0.62, height: 0.52, depth: 0.5 }, this.scene)
    crate.material = flatMaterial(this.scene, 'order-crate', PALETTE.cardboard, { emissiveScale: 0.22, texture: 'skin_cardboard' })
    crate.position.set(0, 0.26, 0)
    crate.parent = root

    const base = MeshBuilder.CreateBox('laptop-base', { width: 0.34, height: 0.02, depth: 0.24 }, this.scene)
    base.material = flatMaterial(this.scene, 'laptop-body', PALETTE.plum, { emissiveScale: 0.28 })
    base.position.set(0, 0.535, 0.02)
    base.parent = root

    const lid = MeshBuilder.CreateBox('laptop-lid', { width: 0.34, height: 0.23, depth: 0.018 }, this.scene)
    lid.material = base.material
    lid.rotation.x = 0.32 // leaned back, screen facing the room
    lid.position.set(0, 0.63, -0.135)
    lid.parent = root

    const screen = MeshBuilder.CreatePlane('laptop-screen', { width: 0.3, height: 0.19 }, this.scene)
    const screenMat = glowMaterial(this.scene, 'laptop-screen', PALETTE.sky, 0.85, 0.9)
    screenMat.backFaceCulling = false // the glow invites from every approach
    screen.material = screenMat
    screen.rotation.x = 0.32
    screen.position.set(0, 0.632, -0.1235)
    screen.parent = root

    root.position.copyFrom(this.deskPos)
    root.rotation.y = 0.9 // angled toward the room
    root.getChildMeshes().forEach((m) => (m.isPickable = false))
    this.house.colliders.push({
      minX: this.deskPos.x - 0.36,
      maxX: this.deskPos.x + 0.36,
      minZ: this.deskPos.z - 0.36,
      maxZ: this.deskPos.z + 0.36,
    })
  }

  boxName(id: string) {
    return BOX_NAMES[id] ?? this.stationsById.get(id)?.title ?? id
  }

  statusOf(id: string): OrderStatus | null {
    const o = this.orders.get(id)
    if (!o) return null
    if (o.status === 'orderable') {
      const req = o.station.requires ? this.stationsById.get(o.station.requires) : null
      if (req && !req.done) return 'locked'
    }
    return o.status
  }

  // What the checklist appends after the title.
  note(id: string): string | null {
    switch (this.statusOf(id)) {
      case 'locked':
        return '(later)'
      case 'orderable':
        return '(order online)'
      case 'shipping':
        return '(on its way)'
      case 'porch':
        return '(on the porch)'
      case 'carrying':
        return '(in your arms)'
      default:
        return null
    }
  }

  orderableCount() {
    let n = 0
    this.orders.forEach((_, id) => {
      if (this.statusOf(id) === 'orderable') n++
    })
    return n
  }

  catalogItems() {
    const items: Array<{ id: string; name: string; status: OrderStatus; lockNote?: string }> = []
    this.orders.forEach((o, id) => {
      const status = this.statusOf(id)!
      let lockNote: string | undefined
      if (status === 'locked' && o.station.requires) {
        const req = this.stationsById.get(o.station.requires)
        lockNote = req ? `after “${req.title}”` : undefined
      }
      items.push({ id, name: this.boxName(id), status, lockNote })
    })
    return items
  }

  order(id: string): boolean {
    if (this.statusOf(id) !== 'orderable') return false
    const o = this.orders.get(id)!
    let ahead = 0
    this.orders.forEach((other) => {
      if (other.status === 'shipping') ahead++
    })
    o.status = 'shipping'
    o.timer = DELIVERY_BASE + DELIVERY_STAGGER * ahead
    this.onStateChange()
    return true
  }

  // Boxes waiting on the porch, nearest first.
  nearestPorchBox(pos: Vector3): { id: string; dist: number } | null {
    let best: { id: string; dist: number } | null = null
    this.orders.forEach((o, id) => {
      if (o.status !== 'porch' || !o.box) return
      const p = o.box.root.position
      const d = Math.hypot(p.x - pos.x, p.z - pos.z)
      if (!best || d < best.dist) best = { id, dist: d }
    })
    return best
  }

  porchBoxPos(id: string): Vector3 | null {
    const o = this.orders.get(id)
    return o?.status === 'porch' && o.box ? o.box.root.position : null
  }

  pickUp(id: string) {
    const o = this.orders.get(id)
    if (!o || o.status !== 'porch' || !o.box) return
    o.status = 'carrying'
    this.carrying = id
    this.carryYawOffset = 0
    this.audio.lift()
    this.onStateChange()
  }

  // Set the carried box down at its station: the parcel becomes the station's
  // own staged box (showPending), and the task unlocks.
  setDown(): Station | null {
    if (!this.carrying) return null
    const o = this.orders.get(this.carrying)!
    o.status = 'placed'
    o.box?.root.setEnabled(false)
    this.carrying = null
    this.audio.thud()
    const st = o.station
    st.available = true
    st.showPending()
    this.onStateChange()
    return st
  }

  update(dt: number, player: Player) {
    // Delivery vans
    this.orders.forEach((o, id) => {
      if (o.status !== 'shipping') return
      o.timer -= dt
      if (o.timer > 0) return
      o.spotIndex = this.freeSpot()
      const spot = this.house.porchSpots[o.spotIndex % this.house.porchSpots.length]
      const stack = Math.floor(o.spotIndex / this.house.porchSpots.length)
      o.box = makeTapedBox(this.scene, `parcel-${id}`, 1.05, 0.48, 0.55)
      o.box.root.setEnabled(true)
      o.box.pick.forEach((m: Mesh) => (m.isPickable = false))
      o.box.root.position.set(spot.x, stack * 0.5, spot.z)
      o.box.root.rotation.y = Math.PI / 2 + (o.spotIndex % 3) * 0.22 - 0.22
      o.status = 'porch'
      // The van pulls up, then the bell rings a beat later.
      this.audio.van()
      window.setTimeout(() => this.audio.doorbell(), 700)
      this.onArrival(this.boxName(id))
      this.onStateChange()
    })

    // The carried box rides just ahead of you, hugged at chest height.
    if (this.carrying) {
      const o = this.orders.get(this.carrying)!
      if (o.box) {
        const fwd = player.forward()
        const t = performance.now() / 1000
        o.box.root.position.set(
          player.position.x + fwd.x * 0.82,
          0.98 + Math.sin(t * 5.2) * 0.012,
          player.position.z + fwd.z * 0.82,
        )
        this.carryYawOffset += (player.yaw - this.carryYawOffset) * Math.min(1, dt * 10)
        o.box.root.rotation.y = this.carryYawOffset + Math.PI / 2
      }
    }
  }

  private freeSpot(): number {
    const used = new Set<number>()
    this.orders.forEach((o) => {
      if ((o.status === 'porch' || o.status === 'carrying') && o.spotIndex >= 0) used.add(o.spotIndex)
    })
    let i = 0
    while (used.has(i)) i++
    return i
  }

  // --- debug/verification ---
  debugDeliverNow(id?: string) {
    this.orders.forEach((o, oid) => {
      if (o.status === 'shipping' && (!id || oid === id)) o.timer = 0
    })
  }
  debugState() {
    const out: Record<string, OrderStatus> = {}
    this.orders.forEach((_, id) => (out[id] = this.statusOf(id)!))
    return { carrying: this.carrying, orders: out }
  }
}
