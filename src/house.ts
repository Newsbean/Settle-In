import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  PointLight,
  Scene,
  Vector3,
  type Mesh,
} from '@babylonjs/core'
import { PALETTE } from './palette'
import { flatMaterial } from './materials'
import { makeBathtub, makeToilet } from './props'

// Axis-aligned collider box the player is pushed out of (in world XZ).
export interface Collider {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface House {
  spawn: Vector3
  spawnYaw: number
  colliders: Collider[]
  // Warm-up handles: lights that brighten as rooms are completed.
  moodLights: PointLight[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  // Where delivered parcels land, just outside the front door.
  porchSpots: Vector3[]
  dispose(): void
}

const WALL_H = 3.0
const WALL_T = 0.18

// The floor plan (world units, metres):
//   Living room:  x[-5..1]   z[-4..4]
//   Kitchen nook: x[1..5]    z[-1.5..4]
//   Bedroom:      x[-5..0.9] z[4..9]   (door from the living room, x[-4.6..-3.4])
//   Bathroom:     x[0.9..5]  z[4..9]   (door from the kitchen, x[2.4..3.6])
export function buildHouse(scene: Scene): House {
  const disposables: Mesh[] = []
  const colliders: Collider[] = []
  const moodLights: PointLight[] = []

  const minX = -5
  const maxX = 5
  const minZ = -4
  const maxZ = 9

  // ---- Lighting: soft warm ambience ----
  const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene)
  hemi.intensity = 0.62
  hemi.diffuse = new Color3(1, 0.95, 0.86)
  hemi.groundColor = new Color3(0.55, 0.45, 0.42)

  const sun = new DirectionalLight('sun', new Vector3(-0.4, -0.9, 0.35), scene)
  sun.intensity = 0.55
  sun.diffuse = new Color3(1, 0.92, 0.78)

  // Two warm point lights (start dim; rooms warm them up on completion).
  const living = new PointLight('mood-living', new Vector3(-2, 2.4, 0), scene)
  living.diffuse = PALETTE.glowWarm
  living.intensity = 0.15
  living.range = 9
  const kitchen = new PointLight('mood-kitchen', new Vector3(3, 2.4, 1.5), scene)
  kitchen.diffuse = PALETTE.glowWarm
  kitchen.intensity = 0.12
  kitchen.range = 8
  const bedroom = new PointLight('mood-bedroom', new Vector3(-2.3, 2.4, 6.5), scene)
  bedroom.diffuse = PALETTE.glowWarm
  bedroom.intensity = 0.12
  bedroom.range = 8
  const bathroom = new PointLight('mood-bathroom', new Vector3(3, 2.4, 6.8), scene)
  bathroom.diffuse = PALETTE.glowWarm
  bathroom.intensity = 0.12
  bathroom.range = 7
  moodLights.push(living, kitchen, bedroom, bathroom)

  // ---- Materials ----
  const floorMat = flatMaterial(scene, 'floor', PALETTE.floorCream, { emissiveScale: 0.22, texture: 'skin_floor', uv: [6, 8] })
  const plankMat = flatMaterial(scene, 'plank', PALETTE.floorPlank, { emissiveScale: 0.2, texture: 'skin_floor', uv: [3, 4], tint: true })
  const wallMat = flatMaterial(scene, 'wall', PALETTE.wallRose, { emissiveScale: 0.3, texture: 'skin_wall' })
  const wallDeepMat = flatMaterial(scene, 'wall-deep', PALETTE.wallRoseDeep, { emissiveScale: 0.3, texture: 'skin_wall_deep' })
  const ceilMat = flatMaterial(scene, 'ceil', PALETTE.ceiling, { emissiveScale: 0.34, texture: 'skin_ceiling', uv: [4, 6] })
  const trimMat = flatMaterial(scene, 'trim', PALETTE.trim, { emissiveScale: 0.26, texture: 'skin_trim', uv: [3, 1] })

  // ---- Floor ----
  const floor = MeshBuilder.CreateBox('floor', { width: maxX - minX, height: 0.12, depth: maxZ - minZ }, scene)
  floor.position.set((minX + maxX) / 2, -0.06, (minZ + maxZ) / 2)
  floor.material = floorMat
  disposables.push(floor)

  // A soft rug in the living room to anchor the cozy feel.
  const rug = MeshBuilder.CreateBox('rug', { width: 3.4, height: 0.03, depth: 3.0 }, scene)
  rug.position.set(-2, 0.02, 0.2)
  rug.material = flatMaterial(scene, 'rug', PALETTE.book3, { emissiveScale: 0.24, texture: 'skin_rug', uv: [2, 2], tint: true })
  disposables.push(rug)

  // Kitchen floor patch (planks) to differentiate the nook.
  const kfloor = MeshBuilder.CreateBox('kfloor', { width: 3.9, height: 0.05, depth: 5.4 }, scene)
  kfloor.position.set(3.0, 0.0, 1.2)
  kfloor.material = plankMat
  disposables.push(kfloor)

  // Bedroom rug — soft cream, beside where the bed lands.
  const brug = MeshBuilder.CreateBox('bedroom-rug', { width: 3.0, height: 0.03, depth: 2.0 }, scene)
  brug.position.set(-2.4, 0.02, 6.0)
  brug.material = flatMaterial(scene, 'bedroom-rug', PALETTE.wallCream, { emissiveScale: 0.28, texture: 'skin_rug', uv: [2, 1], tint: true })
  disposables.push(brug)

  // Bathroom tile patch — pale blue so the room reads wet-room at a glance.
  const tile = MeshBuilder.CreateBox('bathroom-tile', { width: 3.9, height: 0.05, depth: 4.8 }, scene)
  tile.position.set(3.0, 0.0, 6.55)
  tile.material = flatMaterial(scene, 'tile', PALETTE.sky, { emissiveScale: 0.26 })
  disposables.push(tile)

  // ---- Ceiling ----
  const ceil = MeshBuilder.CreateBox('ceil', { width: maxX - minX, height: 0.12, depth: maxZ - minZ }, scene)
  ceil.position.set((minX + maxX) / 2, WALL_H, (minZ + maxZ) / 2)
  ceil.material = ceilMat
  disposables.push(ceil)

  // ---- Wall helper ----
  const addWall = (
    id: string,
    cx: number,
    cz: number,
    w: number,
    d: number,
    mat = wallMat,
    collide = true,
  ) => {
    const wall = MeshBuilder.CreateBox(id, { width: w, height: WALL_H, depth: d }, scene)
    wall.position.set(cx, WALL_H / 2, cz)
    wall.material = mat
    disposables.push(wall)
    if (collide) {
      colliders.push({
        minX: cx - w / 2,
        maxX: cx + w / 2,
        minZ: cz - d / 2,
        maxZ: cz + d / 2,
      })
    }
    return wall
  }

  // Perimeter walls
  addWall('w-north', 0, minZ - WALL_T / 2, maxX - minX + WALL_T, WALL_T, wallDeepMat) // back wall (organizing wall)
  addWall('w-south', 0, maxZ + WALL_T / 2, maxX - minX + WALL_T, WALL_T, wallMat)
  // West wall carries the front door: a gap z[2.15..3.15] out to the porch.
  const doorLo = 2.15
  const doorHi = 3.15
  addWall('w-west-a', minX - WALL_T / 2, (minZ - WALL_T + doorLo) / 2, WALL_T, doorLo - (minZ - WALL_T), wallMat)
  addWall('w-west-b', minX - WALL_T / 2, (doorHi + maxZ + WALL_T) / 2, WALL_T, maxZ + WALL_T - doorHi, wallMat)
  addWall('w-east', maxX + WALL_T / 2, (minZ + maxZ) / 2, WALL_T, maxZ - minZ + WALL_T, wallMat)

  // Door frame: two jambs + a lintel over the gap (the lintel sits above head
  // height, so it must NOT push a floor collider — plain meshes only).
  const jambA = MeshBuilder.CreateBox('jamb-a', { width: WALL_T + 0.08, height: 2.25, depth: 0.09 }, scene)
  jambA.position.set(minX - WALL_T / 2, 1.125, doorLo - 0.045)
  jambA.material = trimMat
  disposables.push(jambA)
  const jambB = MeshBuilder.CreateBox('jamb-b', { width: WALL_T + 0.08, height: 2.25, depth: 0.09 }, scene)
  jambB.position.set(minX - WALL_T / 2, 1.125, doorHi + 0.045)
  jambB.material = trimMat
  disposables.push(jambB)
  const lintel = MeshBuilder.CreateBox('lintel', { width: WALL_T + 0.08, height: WALL_H - 2.25, depth: doorHi - doorLo + 0.18 }, scene)
  lintel.position.set(minX - WALL_T / 2, (WALL_H + 2.25) / 2, (doorLo + doorHi) / 2)
  lintel.material = wallMat
  disposables.push(lintel)

  // ---- The outside: a soft yard strip along the west side ----
  const yardMinX = -8.6
  const yard = MeshBuilder.CreateBox('yard', { width: minX - yardMinX + 0.4, height: 0.1, depth: maxZ - minZ + 1.2 }, scene)
  yard.position.set((yardMinX + minX) / 2 - 0.2, -0.05, (minZ + maxZ) / 2)
  yard.material = flatMaterial(scene, 'yard-grass', PALETTE.grass, { emissiveScale: 0.24, texture: 'skin_grass', uv: [5, 5] })
  disposables.push(yard)

  // Porch slab right outside the door — where parcels get dropped.
  const porch = MeshBuilder.CreateBox('porch', { width: 1.8, height: 0.07, depth: 2.6 }, scene)
  porch.position.set(minX - 0.9, 0.005, (doorLo + doorHi) / 2)
  porch.material = flatMaterial(scene, 'porch-plank', PALETTE.floorPlank, { emissiveScale: 0.22, texture: 'skin_floor', uv: [2, 3], tint: true })
  disposables.push(porch)

  // A worn stone path wandering off the porch.
  const path1 = MeshBuilder.CreateBox('path-1', { width: 1.4, height: 0.05, depth: 0.9 }, scene)
  path1.position.set(minX - 2.5, -0.005, 2.5)
  path1.material = flatMaterial(scene, 'yard-path', PALETTE.path, { emissiveScale: 0.24 })
  disposables.push(path1)
  const path2 = MeshBuilder.CreateBox('path-2', { width: 1.1, height: 0.05, depth: 0.8 }, scene)
  path2.position.set(minX - 3.6, -0.005, 2.15)
  path2.material = path1.material
  disposables.push(path2)

  // Low hedges hem the yard in (visual walls; the bounds clamp does the physics).
  const hedgeMat = flatMaterial(scene, 'hedge', PALETTE.hedge, { emissiveScale: 0.2 })
  const hedgeW = MeshBuilder.CreateBox('hedge-w', { width: 0.5, height: 0.85, depth: maxZ - minZ + 1.2 }, scene)
  hedgeW.position.set(yardMinX - 0.05, 0.42, (minZ + maxZ) / 2)
  hedgeW.material = hedgeMat
  disposables.push(hedgeW)
  const hedgeN = MeshBuilder.CreateBox('hedge-n', { width: minX - yardMinX + 0.4, height: 0.85, depth: 0.5 }, scene)
  hedgeN.position.set((yardMinX + minX) / 2 - 0.2, 0.42, minZ - 0.35)
  hedgeN.material = hedgeMat
  disposables.push(hedgeN)
  const hedgeS = MeshBuilder.CreateBox('hedge-s', { width: minX - yardMinX + 0.4, height: 0.85, depth: 0.5 }, scene)
  hedgeS.position.set((yardMinX + minX) / 2 - 0.2, 0.42, maxZ + 0.35)
  hedgeS.material = hedgeMat
  disposables.push(hedgeS)
  colliders.push(
    { minX: yardMinX - 0.3, maxX: yardMinX + 0.2, minZ: minZ - 0.6, maxZ: maxZ + 0.6 },
    { minX: yardMinX - 0.4, maxX: minX, minZ: minZ - 0.6, maxZ: minZ - 0.1 },
    { minX: yardMinX - 0.4, maxX: minX, minZ: maxZ + 0.1, maxZ: maxZ + 0.6 },
  )

  // Parcel landing spots on and around the porch, door-side first.
  const porchSpots = [
    new Vector3(minX - 0.95, 0, 1.85),
    new Vector3(minX - 0.95, 0, 3.45),
    new Vector3(minX - 2.05, 0, 1.5),
    new Vector3(minX - 2.05, 0, 3.05),
    new Vector3(minX - 2.05, 0, 4.5),
    new Vector3(minX - 0.95, 0, 4.9),
  ]

  // Partial divider between living room and kitchen (leaves a doorway z in [0.6..2.8]).
  addWall('divider-a', 1, -2.2, WALL_T, 3.6, wallDeepMat) // from north to z=-0.4
  addWall('divider-b', 1, 3.6, WALL_T, 0.8, wallDeepMat) // small stub near south

  // Wall between the front rooms and the bedroom/bathroom (z = 4), with a
  // doorway into the bedroom (x[-4.6..-3.4]) and one into the bathroom (x[2.4..3.6]).
  addWall('w-mid-a', -4.8, 4 + WALL_T / 2, 0.4, WALL_T, wallMat)
  addWall('w-mid-b', -0.5, 4 + WALL_T / 2, 5.8, WALL_T, wallMat)
  addWall('w-mid-c', 4.3, 4 + WALL_T / 2, 1.4, WALL_T, wallMat)

  // Divider between bedroom and bathroom.
  addWall('divider-s', 0.9, 6.5, WALL_T, 5, wallDeepMat)

  // Bathroom fixtures: tub along the east wall, toilet in the far corner.
  const tub = makeBathtub(scene, 'tub')
  tub.position.set(4.4, 0, 5.25)
  colliders.push({ minX: 3.87, maxX: 4.93, minZ: 4.37, maxZ: 6.13 })
  const toilet = makeToilet(scene, 'toilet')
  toilet.position.set(1.5, 0, 8.66)
  colliders.push({ minX: 1.25, maxX: 1.75, minZ: 8.3, maxZ: 9 })

  // Baseboard trim strip along the back wall for warmth (non-colliding).
  const base = MeshBuilder.CreateBox('baseboard', { width: maxX - minX, height: 0.18, depth: 0.06 }, scene)
  base.position.set(0, 0.09, minZ + 0.06)
  base.material = trimMat
  disposables.push(base)

  // Windows on the west wall — bright warm rectangles so the rooms feel sunlit.
  const winMat = flatMaterial(scene, 'window', new Color3(1, 0.96, 0.82), { emissiveScale: 0.9 })
  const window = MeshBuilder.CreatePlane('window', { width: 2.4, height: 1.4 }, scene)
  window.position.set(minX + 0.11, 1.6, -1.2)
  window.rotation.y = Math.PI / 2
  window.material = winMat
  disposables.push(window)
  const bwindow = MeshBuilder.CreatePlane('window-bed', { width: 1.8, height: 1.2 }, scene)
  bwindow.position.set(minX + 0.11, 1.6, 6.2)
  bwindow.rotation.y = Math.PI / 2
  bwindow.material = winMat
  disposables.push(bwindow)

  return {
    // Start just inside the living room, looking across the space rather than
    // straight into the mid wall or inside a task radius.
    spawn: new Vector3(-4.15, 0, 1.15),
    spawnYaw: 2.28,
    colliders,
    moodLights,
    // The walkable world now includes the yard strip west of the house.
    bounds: { minX: yardMinX, maxX, minZ, maxZ },
    porchSpots,
    dispose() {
      disposables.forEach((m) => m.dispose())
      hemi.dispose()
      sun.dispose()
      moodLights.forEach((l) => l.dispose())
    },
  }
}
