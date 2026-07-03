import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { flatMaterial } from './materials'
import { PALETTE } from './palette'
import { modelInstance } from './models'

// Small library of cozy, toy-like props. Everything is a parented group under a
// TransformNode so the puzzle engine can drag/rotate a single handle.

export interface Prop {
  root: TransformNode
  pick: Mesh[] // meshes used for pointer hit-testing
}

export function makeBook(scene: Scene, name: string, height: number, color: Color3): Prop {
  const glb = modelInstance(scene, 'prop_book', name, { w: 0.16, h: height, d: 0.21, tint: color })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const cover = MeshBuilder.CreateBox(`${name}-cov`, { width: 0.16, height, depth: 0.21 }, scene)
  cover.material = flatMaterial(scene, `${name}-mat`, color, { emissiveScale: 0.26, texture: 'skin_book_cover', tint: true })
  cover.parent = root
  cover.position.y = height / 2
  // cream page block peeking at the top edge
  const pages = MeshBuilder.CreateBox(`${name}-pg`, { width: 0.13, height: 0.012, depth: 0.18 }, scene)
  pages.material = flatMaterial(scene, 'pages', PALETTE.ceiling, { emissiveScale: 0.32 })
  pages.parent = root
  pages.position.set(0, height - 0.002, -0.008)
  // title band wrapping the spine
  const band = MeshBuilder.CreateBox(`${name}-bd`, { width: 0.168, height: 0.045, depth: 0.012 }, scene)
  band.material = flatMaterial(scene, 'bookband', PALETTE.ceiling, { emissiveScale: 0.34 })
  band.parent = root
  band.position.set(0, height * 0.74, 0.102)
  return { root, pick: [cover, pages, band] }
}

export function makeBolt(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_bolt', name, { w: 0.08, h: 0.1, d: 0.08, anchor: 'center' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const shaft = MeshBuilder.CreateCylinder(`${name}-s`, { height: 0.09, diameter: 0.045 }, scene)
  shaft.material = flatMaterial(scene, 'bolt', PALETTE.bolt, { emissiveScale: 0.2 })
  shaft.parent = root
  const head = MeshBuilder.CreateCylinder(`${name}-h`, { height: 0.03, diameter: 0.08, tessellation: 6 }, scene)
  head.material = shaft.material
  head.parent = root
  head.position.y = 0.05
  return { root, pick: [head, shaft] }
}

// A shelf side cheek: upright board, deep enough to carry the shelf plank,
// with a lighter front edge so the silhouette reads at a glance.
export function makeShelfSide(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_side_panel', name, { w: 0.06, h: 0.5, d: 0.24, anchor: 'center', texture: 'wood_warm' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const board = MeshBuilder.CreateBox(name, { width: 0.05, height: 0.5, depth: 0.24 }, scene)
  board.material = flatMaterial(scene, 'shelfwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  board.parent = root
  const edge = MeshBuilder.CreateBox(`${name}-e`, { width: 0.054, height: 0.5, depth: 0.02 }, scene)
  edge.material = flatMaterial(scene, 'shelfedge', PALETTE.floorPlank, { emissiveScale: 0.28 })
  edge.parent = root
  edge.position.z = 0.115
  return { root, pick: [board, edge] }
}

// A shelf plank: a horizontal slab. The default is the warm top shelf; the
// darker base plank passes its own colors so the two read apart at a glance.
export function makeShelfBoard(
  scene: Scene,
  name: string,
  opts: { width?: number; color?: Color3; edgeColor?: Color3 } = {},
): Prop {
  const width = opts.width ?? 1.04
  const color = opts.color ?? PALETTE.woodWarm
  const edgeColor = opts.edgeColor ?? PALETTE.floorPlank
  const glb = modelInstance(scene, 'kit_plank', name, {
    w: width, h: 0.055, d: 0.26, anchor: 'center',
    tint: opts.color, // the darker base plank keeps its contrast
    texture: 'wood_warm',
  })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const board = MeshBuilder.CreateBox(name, { width, height: 0.05, depth: 0.26 }, scene)
  // Custom-coloured planks (the darker base) tint the skin; default shows it as painted.
  board.material = flatMaterial(scene, 'shelfwood', color, { emissiveScale: 0.24, texture: 'skin_wood_plank', tint: !!opts.color })
  board.parent = root
  const edge = MeshBuilder.CreateBox(`${name}-e`, { width, height: 0.054, depth: 0.02 }, scene)
  edge.material = flatMaterial(scene, 'shelfedge', edgeColor, { emissiveScale: 0.28 })
  edge.parent = root
  edge.position.z = 0.125
  return { root, pick: [board, edge] }
}

// One half of the slatted back panel — a thin board with a lighter routed
// inset so it reads as panelling, not a plain slab. Faces +z (into the room).
export function makeShelfBackPanel(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_back_panel', name, { w: 0.44, h: 0.5, d: 0.04, anchor: 'center', texture: 'wood_warm' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const panel = MeshBuilder.CreateBox(name, { width: 0.44, height: 0.5, depth: 0.035 }, scene)
  panel.material = flatMaterial(scene, 'shelfback', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  panel.parent = root
  const inset = MeshBuilder.CreateBox(`${name}-i`, { width: 0.34, height: 0.4, depth: 0.014 }, scene)
  inset.material = flatMaterial(scene, 'shelfbackin', PALETTE.woodWarm, { emissiveScale: 0.26, texture: 'skin_wood_plank' })
  inset.parent = root
  inset.position.z = 0.014
  return { root, pick: [panel, inset] }
}

// A little L-shaped support bracket that tucks under the base plank: a
// horizontal arm beneath the plank and a stem down the wall (-z).
export function makeShelfBracket(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_bracket', name, { w: 0.06, h: 0.17, d: 0.2, anchor: 'center', texture: 'wood_warm' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const mat = flatMaterial(scene, 'bracket', PALETTE.trim, { emissiveScale: 0.26 })
  const arm = MeshBuilder.CreateBox(`${name}-a`, { width: 0.06, height: 0.04, depth: 0.16 }, scene)
  arm.material = mat
  arm.parent = root
  arm.position.set(0, 0.055, 0.01)
  const stem = MeshBuilder.CreateBox(`${name}-s`, { width: 0.06, height: 0.15, depth: 0.04 }, scene)
  stem.material = mat
  stem.parent = root
  stem.position.set(0, 0, -0.06)
  return { root, pick: [arm, stem] }
}

// A corked spice jar — the coloured fill and cork read the height at a glance.
export function makeSpiceJar(scene: Scene, name: string, height: number, color: Color3): Prop {
  const root = new TransformNode(name, scene)
  const body = MeshBuilder.CreateCylinder(
    `${name}-b`,
    { height: height - 0.035, diameter: 0.11, tessellation: 16 },
    scene,
  )
  body.material = flatMaterial(scene, `${name}-m`, color, { emissiveScale: 0.26, texture: 'ceramic', tint: true })
  body.parent = root
  body.position.y = (height - 0.035) / 2
  // paper label band low on the jar
  const label = MeshBuilder.CreateCylinder(`${name}-l`, { height: 0.045, diameter: 0.114, tessellation: 16 }, scene)
  label.material = flatMaterial(scene, 'jar-label', PALETTE.ceiling, { emissiveScale: 0.32 })
  label.parent = root
  label.position.y = Math.min(0.07, height * 0.35)
  const cork = MeshBuilder.CreateCylinder(
    `${name}-c`,
    { height: 0.035, diameterTop: 0.08, diameterBottom: 0.09, tessellation: 14 },
    scene,
  )
  cork.material = flatMaterial(scene, 'jar-cork', PALETTE.cardboard, { emissiveScale: 0.26, texture: 'cardboard' })
  cork.parent = root
  cork.position.y = height - 0.0175
  return { root, pick: [body, label, cork] }
}

// A dinner plate — wide shallow cylinder with a lighter well; size varies.
export function makePlate(scene: Scene, name: string, diameter: number, color: Color3): Prop {
  const root = new TransformNode(name, scene)
  const base = MeshBuilder.CreateCylinder(
    `${name}-b`,
    { height: 0.03, diameterTop: diameter, diameterBottom: diameter * 0.62, tessellation: 24 },
    scene,
  )
  base.material = flatMaterial(scene, `${name}-m`, color, { emissiveScale: 0.26, texture: 'ceramic', tint: true })
  base.parent = root
  base.position.y = 0.015
  const well = MeshBuilder.CreateCylinder(`${name}-w`, { height: 0.008, diameter: diameter * 0.58, tessellation: 24 }, scene)
  well.material = flatMaterial(scene, 'plate-well', PALETTE.ceiling, { emissiveScale: 0.3 })
  well.parent = root
  well.position.y = 0.032
  return { root, pick: [base, well] }
}

export function makeMug(scene: Scene, name: string, color: Color3): Prop {
  // yaw π/2: the -flat GLB's handle points +z (away from the player); turn it
  // sideways so the mug silhouette reads. Carries its own coral glaze.
  const glb = modelInstance(scene, 'prop_mug', name, { w: 0.15, h: 0.13, d: 0.11, yaw: Math.PI / 2 })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const cup = MeshBuilder.CreateCylinder(
    `${name}-c`,
    { height: 0.12, diameterTop: 0.1, diameterBottom: 0.082, tessellation: 20 },
    scene,
  )
  cup.material = flatMaterial(scene, `${name}-m`, color, { emissiveScale: 0.24 })
  cup.parent = root
  cup.position.y = 0.06
  // coffee surface just below the rim
  const coffee = MeshBuilder.CreateCylinder(`${name}-cf`, { height: 0.008, diameter: 0.08 }, scene)
  coffee.material = flatMaterial(scene, 'coffee', PALETTE.plum, { emissiveScale: 0.2 })
  coffee.parent = root
  coffee.position.y = 0.118
  const handle = MeshBuilder.CreateTorus(`${name}-h`, { diameter: 0.075, thickness: 0.016, tessellation: 16 }, scene)
  handle.material = cup.material
  handle.parent = root
  handle.position.set(0.056, 0.062, 0)
  handle.rotation.x = Math.PI / 2
  return { root, pick: [cup, handle] }
}

// A stovetop kettle: squat enamel body, tilted spout, lid + knob, arc handle.
export function makeKettle(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'prop_kettle', name, { w: 0.26, h: 0.26, d: 0.22 }) // -flat GLB carries its own blue enamel
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const enamel = flatMaterial(scene, 'kettle', PALETTE.appliance, { emissiveScale: 0.26 })
  const accent = flatMaterial(scene, 'kettle-acc', PALETTE.plum, { emissiveScale: 0.2 })

  const body = MeshBuilder.CreateSphere(`${name}-b`, { diameter: 0.22, segments: 12 }, scene)
  body.material = enamel
  body.parent = root
  body.position.y = 0.105
  body.scaling.y = 0.82

  const base = MeshBuilder.CreateCylinder(`${name}-ba`, { height: 0.024, diameter: 0.15 }, scene)
  base.material = accent
  base.parent = root
  base.position.y = 0.012

  const spout = MeshBuilder.CreateCylinder(
    `${name}-sp`,
    { height: 0.13, diameterTop: 0.026, diameterBottom: 0.05, tessellation: 10 },
    scene,
  )
  spout.material = enamel
  spout.parent = root
  spout.position.set(0.1, 0.135, 0)
  spout.rotation.z = -0.95

  const lid = MeshBuilder.CreateCylinder(`${name}-l`, { height: 0.022, diameter: 0.1 }, scene)
  lid.material = accent
  lid.parent = root
  lid.position.y = 0.192

  const knob = MeshBuilder.CreateSphere(`${name}-k`, { diameter: 0.035, segments: 8 }, scene)
  knob.material = accent
  knob.parent = root
  knob.position.y = 0.21

  const handle = MeshBuilder.CreateTorus(`${name}-h`, { diameter: 0.13, thickness: 0.015, tessellation: 18 }, scene)
  handle.material = accent
  handle.parent = root
  handle.position.y = 0.19
  handle.rotation.x = Math.PI / 2 // vertical arc over the lid

  return { root, pick: [body, spout, lid, handle] }
}

export function makePlant(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'prop_plant', name, { w: 0.2, h: 0.38, d: 0.2 })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const pot = MeshBuilder.CreateCylinder(
    `${name}-p`,
    { height: 0.13, diameterTop: 0.14, diameterBottom: 0.1, tessellation: 14 },
    scene,
  )
  pot.material = flatMaterial(scene, 'pot', PALETTE.plantPot, { emissiveScale: 0.24 })
  pot.parent = root
  pot.position.y = 0.065
  const rim = MeshBuilder.CreateCylinder(`${name}-r`, { height: 0.028, diameter: 0.155, tessellation: 14 }, scene)
  rim.material = flatMaterial(scene, 'potrim', PALETTE.wallRoseDeep, { emissiveScale: 0.24 })
  rim.parent = root
  rim.position.y = 0.135
  const soil = MeshBuilder.CreateCylinder(`${name}-s`, { height: 0.012, diameter: 0.125 }, scene)
  soil.material = flatMaterial(scene, 'soil', PALETTE.plum, { emissiveScale: 0.18 })
  soil.parent = root
  soil.position.y = 0.15
  const trunk = MeshBuilder.CreateCylinder(`${name}-t`, { height: 0.09, diameter: 0.025 }, scene)
  trunk.material = flatMaterial(scene, 'trunk', PALETTE.woodDeep, { emissiveScale: 0.2 })
  trunk.parent = root
  trunk.position.y = 0.19
  // layered foliage — three blobs, one darker for depth
  const leafA = MeshBuilder.CreateSphere(`${name}-l1`, { diameter: 0.18, segments: 7 }, scene)
  leafA.material = flatMaterial(scene, 'leaf', PALETTE.plant, { emissiveScale: 0.22 })
  leafA.parent = root
  leafA.position.set(0, 0.29, 0)
  const leafB = MeshBuilder.CreateSphere(`${name}-l2`, { diameter: 0.13, segments: 7 }, scene)
  leafB.material = leafA.material
  leafB.parent = root
  leafB.position.set(0.07, 0.24, 0.02)
  const leafC = MeshBuilder.CreateSphere(`${name}-l3`, { diameter: 0.12, segments: 7 }, scene)
  leafC.material = flatMaterial(scene, 'leafdark', PALETTE.plant.scale(0.82), { emissiveScale: 0.2 })
  leafC.parent = root
  leafC.position.set(-0.06, 0.25, -0.02)
  return { root, pick: [pot, leafA, leafB, leafC] }
}

export function makePicture(scene: Scene, name: string, color: Color3): Prop {
  const glb = modelInstance(scene, 'prop_picture_frame', name, { w: 0.54, h: 0.62, d: 0.06, anchor: 'center' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const frameMat = flatMaterial(scene, 'frame', PALETTE.woodDeep, { emissiveScale: 0.22 })
  // cream mat board behind the art
  const matboard = MeshBuilder.CreateBox(`${name}-mb`, { width: 0.46, height: 0.58, depth: 0.03 }, scene)
  matboard.material = flatMaterial(scene, 'picmat', PALETTE.ceiling, { emissiveScale: 0.34 })
  matboard.parent = root
  // the artwork, slightly proud of the mat
  const art = MeshBuilder.CreateBox(`${name}-a`, { width: 0.36, height: 0.46, depth: 0.045 }, scene)
  art.material = flatMaterial(scene, `${name}-art`, color, { emissiveScale: 0.4, texture: 'skin_picture_art' })
  art.parent = root
  // four frame sticks
  const mk = (id: string, w: number, h: number, x: number, y: number) => {
    const stick = MeshBuilder.CreateBox(`${name}-${id}`, { width: w, height: h, depth: 0.055 }, scene)
    stick.material = frameMat
    stick.parent = root
    stick.position.set(x, y, 0)
    return stick
  }
  const top = mk('ft', 0.54, 0.05, 0, 0.285)
  const bottom = mk('fb', 0.54, 0.05, 0, -0.285)
  const left = mk('fl', 0.05, 0.52, -0.245, 0)
  const right = mk('fr', 0.05, 0.52, 0.245, 0)
  return { root, pick: [matboard, art, top, bottom, left, right] }
}

// ---------- living room: sofa (front faces -z) ----------

// The sofa base: plinth + seat box + a lighter front panel. Root at floor level.
export function makeSofaBase(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_cushion', name, { w: 1.64, h: 0.42, d: 0.78, texture: 'fabric_rose' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const plinth = MeshBuilder.CreateBox(`${name}-p`, { width: 1.64, height: 0.1, depth: 0.78 }, scene)
  plinth.material = flatMaterial(scene, 'sofa-plinth', PALETTE.woodDeep, { emissiveScale: 0.2, texture: 'skin_wood_deep' })
  plinth.parent = root
  plinth.position.y = 0.05
  const body = MeshBuilder.CreateBox(`${name}-b`, { width: 1.6, height: 0.32, depth: 0.78 }, scene)
  body.material = flatMaterial(scene, 'sofa', PALETTE.wallRoseDeep, { emissiveScale: 0.24, texture: 'skin_fabric_rose' })
  body.parent = root
  body.position.y = 0.26
  const front = MeshBuilder.CreateBox(`${name}-f`, { width: 1.6, height: 0.3, depth: 0.02 }, scene)
  front.material = flatMaterial(scene, 'sofa-front', PALETTE.wallRose, { emissiveScale: 0.26, texture: 'skin_fabric_rose' })
  front.parent = root
  front.position.set(0, 0.26, -0.39)
  return { root, pick: [plinth, body, front] }
}

// A sofa armrest: upright slab with a rounded top roll. Root at floor level.
export function makeSofaArm(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_side_panel', name, { w: 0.26, h: 0.63, d: 0.8, yaw: Math.PI / 2, texture: 'fabric_rose' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const mat = flatMaterial(scene, 'sofa', PALETTE.wallRoseDeep, { emissiveScale: 0.24, texture: 'skin_fabric_rose' })
  const slab = MeshBuilder.CreateBox(`${name}-s`, { width: 0.26, height: 0.5, depth: 0.8 }, scene)
  slab.material = mat
  slab.parent = root
  slab.position.y = 0.25
  const roll = MeshBuilder.CreateCylinder(`${name}-r`, { height: 0.8, diameter: 0.26, tessellation: 14 }, scene)
  roll.material = mat
  roll.parent = root
  roll.rotation.x = Math.PI / 2
  roll.position.y = 0.5
  return { root, pick: [slab, roll] }
}

// The sofa backrest: wide slab with a top roll, sits on the base. Root at its bottom.
export function makeSofaBack(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_back_panel', name, { w: 1.6, h: 0.6, d: 0.2, texture: 'fabric_rose' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const mat = flatMaterial(scene, 'sofa', PALETTE.wallRoseDeep, { emissiveScale: 0.24, texture: 'skin_fabric_rose' })
  const slab = MeshBuilder.CreateBox(`${name}-s`, { width: 1.6, height: 0.5, depth: 0.2 }, scene)
  slab.material = mat
  slab.parent = root
  slab.position.y = 0.25
  const roll = MeshBuilder.CreateCylinder(`${name}-r`, { height: 1.6, diameter: 0.2, tessellation: 14 }, scene)
  roll.material = mat
  roll.parent = root
  roll.rotation.z = Math.PI / 2
  roll.position.y = 0.5
  return { root, pick: [slab, roll] }
}

// A seat cushion with contrast piping. Root at its underside.
export function makeSeatCushion(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_cushion', name, { w: 0.78, h: 0.2, d: 0.68, texture: 'fabric_cream' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const pad = MeshBuilder.CreateBox(`${name}-c`, { width: 0.76, height: 0.2, depth: 0.66 }, scene)
  pad.material = flatMaterial(scene, 'cushion', PALETTE.ceiling, { emissiveScale: 0.3, texture: 'skin_fabric_cream' })
  pad.parent = root
  pad.position.y = 0.1
  const piping = MeshBuilder.CreateBox(`${name}-p`, { width: 0.78, height: 0.03, depth: 0.68 }, scene)
  piping.material = flatMaterial(scene, 'piping', PALETTE.wallCream, { emissiveScale: 0.3 })
  piping.parent = root
  piping.position.y = 0.1
  return { root, pick: [pad, piping] }
}

// An upright back cushion. Root at its underside.
export function makeBackCushion(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_cushion', name, { w: 0.74, h: 0.44, d: 0.18, texture: 'fabric_cream' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const pad = MeshBuilder.CreateBox(`${name}-c`, { width: 0.74, height: 0.44, depth: 0.18 }, scene)
  pad.material = flatMaterial(scene, 'cushion-b', PALETTE.wallCream, { emissiveScale: 0.3, texture: 'skin_fabric_cream' })
  pad.parent = root
  pad.position.y = 0.22
  return { root, pick: [pad] }
}

// ---------- living room: coffee table ----------

export function makeTableTop(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_plank', name, { w: 1.1, h: 0.06, d: 0.62, texture: 'wood_warm' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const top = MeshBuilder.CreateBox(name, { width: 1.1, height: 0.06, depth: 0.62 }, scene)
  top.material = flatMaterial(scene, 'shelfwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  top.parent = root
  top.position.y = 0.03
  const band = MeshBuilder.CreateBox(`${name}-e`, { width: 1.1, height: 0.064, depth: 0.03 }, scene)
  band.material = flatMaterial(scene, 'shelfedge', PALETTE.floorPlank, { emissiveScale: 0.28 })
  band.parent = root
  band.position.set(0, 0.03, -0.3)
  return { root, pick: [top, band] }
}

export function makeTableLeg(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_leg', name, { w: 0.08, h: 0.44, d: 0.08, texture: 'wood_deep' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const leg = MeshBuilder.CreateBox(name, { width: 0.07, height: 0.44, depth: 0.07 }, scene)
  leg.material = flatMaterial(scene, 'tableleg', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  leg.parent = root
  leg.position.y = 0.22
  return { root, pick: [leg] }
}

export function makeTableShelf(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_plank', name, { w: 0.92, h: 0.04, d: 0.5, texture: 'wood_warm' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const shelf = MeshBuilder.CreateBox(name, { width: 0.92, height: 0.04, depth: 0.5 }, scene)
  shelf.material = flatMaterial(scene, 'shelfedge', PALETTE.floorPlank, { emissiveScale: 0.28 })
  shelf.parent = root
  shelf.position.y = 0.02
  return { root, pick: [shelf] }
}

// ---------- bedroom: bed frame (headboard faces -z) ----------

export function makeHeadboard(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_back_panel', name, { w: 1.54, h: 0.95, d: 0.09, texture: 'wood_warm' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const postMat = flatMaterial(scene, 'bedpost', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  const panel = MeshBuilder.CreateBox(name, { width: 1.45, height: 0.75, depth: 0.06 }, scene)
  panel.material = flatMaterial(scene, 'bedwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  panel.parent = root
  panel.position.y = 0.5
  const picks = [panel]
  for (const side of [-1, 1]) {
    const post = MeshBuilder.CreateBox(`${name}-p${side}`, { width: 0.09, height: 0.95, depth: 0.09 }, scene)
    post.material = postMat
    post.parent = root
    post.position.set(side * 0.725, 0.475, 0)
    picks.push(post)
  }
  return { root, pick: picks }
}

export function makeFootboard(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_side_panel', name, { w: 1.54, h: 0.5, d: 0.09, texture: 'wood_warm' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const postMat = flatMaterial(scene, 'bedpost', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  const panel = MeshBuilder.CreateBox(name, { width: 1.45, height: 0.38, depth: 0.06 }, scene)
  panel.material = flatMaterial(scene, 'bedwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  panel.parent = root
  panel.position.y = 0.31
  const picks = [panel]
  for (const side of [-1, 1]) {
    const post = MeshBuilder.CreateBox(`${name}-p${side}`, { width: 0.09, height: 0.5, depth: 0.09 }, scene)
    post.material = postMat
    post.parent = root
    post.position.set(side * 0.725, 0.25, 0)
    picks.push(post)
  }
  return { root, pick: picks }
}

// A side rail, long along z (bed length). Staged rotated 90° so it lies across the mat.
export function makeBedRail(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_rail', name, { w: 0.05, h: 0.16, d: 1.56, yaw: Math.PI / 2, texture: 'wood_deep' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const rail = MeshBuilder.CreateBox(name, { width: 0.05, height: 0.16, depth: 1.56 }, scene)
  rail.material = flatMaterial(scene, 'bedpost', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  rail.parent = root
  rail.position.y = 0.08
  return { root, pick: [rail] }
}

export function makeBedSlat(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_plank', name, { w: 1.4, h: 0.035, d: 0.22, texture: 'wood_warm' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const slat = MeshBuilder.CreateBox(name, { width: 1.4, height: 0.035, depth: 0.22 }, scene)
  slat.material = flatMaterial(scene, 'shelfedge', PALETTE.floorPlank, { emissiveScale: 0.28 })
  slat.parent = root
  slat.position.y = 0.0175
  return { root, pick: [slat] }
}

// ---------- bedroom: bedding ----------

export function makeMattress(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'prop_mattress', name, { w: 1.44, h: 0.26, d: 1.72, yaw: Math.PI / 2, texture: 'fabric_cream' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const pad = MeshBuilder.CreateBox(name, { width: 1.44, height: 0.24, depth: 1.72 }, scene)
  pad.material = flatMaterial(scene, 'mattress', PALETTE.appliance, { emissiveScale: 0.3, texture: 'skin_fabric_cream' })
  pad.parent = root
  pad.position.y = 0.12
  const seam = MeshBuilder.CreateBox(`${name}-s`, { width: 1.46, height: 0.02, depth: 1.74 }, scene)
  seam.material = flatMaterial(scene, 'seam', PALETTE.wallCream, { emissiveScale: 0.3 })
  seam.parent = root
  seam.position.y = 0.12
  return { root, pick: [pad, seam] }
}

// The duvet covers the foot end; a lighter fold band marks the turned-back edge.
export function makeDuvet(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'prop_duvet', name, { w: 1.5, h: 0.15, d: 1.2, texture: 'fabric_rose' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const quilt = MeshBuilder.CreateBox(name, { width: 1.5, height: 0.12, depth: 1.2 }, scene)
  quilt.material = flatMaterial(scene, 'duvet', PALETTE.book4, { emissiveScale: 0.26, texture: 'skin_fabric_rose' })
  quilt.parent = root
  quilt.position.y = 0.06
  const fold = MeshBuilder.CreateBox(`${name}-f`, { width: 1.52, height: 0.05, depth: 0.22 }, scene)
  fold.material = flatMaterial(scene, 'duvet-fold', PALETTE.wallCream, { emissiveScale: 0.3 })
  fold.parent = root
  fold.position.set(0, 0.11, 0.5)
  return { root, pick: [quilt, fold] }
}

export function makePillow(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_cushion', name, { w: 0.56, h: 0.16, d: 0.36, texture: 'fabric_cream' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const puff = MeshBuilder.CreateBox(name, { width: 0.56, height: 0.16, depth: 0.36 }, scene)
  puff.material = flatMaterial(scene, 'pillow', PALETTE.ceiling, { emissiveScale: 0.32, texture: 'skin_fabric_cream' })
  puff.parent = root
  puff.position.y = 0.08
  return { root, pick: [puff] }
}

// ---------- bathroom: vanity (front faces -z) ----------

export function makeVanityBody(scene: Scene, name: string): Prop {
  // yaw -π/2: the -flat GLB's doors face +x; rotate so they face -z (the room)
  const glb = modelInstance(scene, 'prop_vanity_body', name, { w: 0.96, h: 0.66, d: 0.48, yaw: -Math.PI / 2 })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const kick = MeshBuilder.CreateBox(`${name}-k`, { width: 0.9, height: 0.08, depth: 0.44 }, scene)
  kick.material = flatMaterial(scene, 'vanity-kick', PALETTE.plum, { emissiveScale: 0.18 })
  kick.parent = root
  kick.position.y = 0.04
  const body = MeshBuilder.CreateBox(name, { width: 0.96, height: 0.58, depth: 0.48 }, scene)
  body.material = flatMaterial(scene, 'vanity', PALETTE.woodWarm, { emissiveScale: 0.22, texture: 'skin_wood_plank' })
  body.parent = root
  body.position.y = 0.37
  const picks = [kick, body]
  for (const side of [-1, 1]) {
    const door = MeshBuilder.CreateBox(`${name}-d${side}`, { width: 0.42, height: 0.44, depth: 0.02 }, scene)
    door.material = flatMaterial(scene, 'vanity-door', PALETTE.floorPlank, { emissiveScale: 0.26, texture: 'skin_vanity_door' })
    door.parent = root
    door.position.set(side * 0.23, 0.36, -0.245)
    picks.push(door)
    const knob = MeshBuilder.CreateBox(`${name}-n${side}`, { width: 0.02, height: 0.08, depth: 0.025 }, scene)
    knob.material = flatMaterial(scene, 'vanity-knob', PALETTE.bolt, { emissiveScale: 0.2 })
    knob.parent = root
    knob.position.set(side * 0.05, 0.37, -0.258)
  }
  return { root, pick: picks }
}

export function makeVanityTop(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'kit_plank', name, { w: 1.04, h: 0.05, d: 0.56, texture: 'wood_deep' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const slab = MeshBuilder.CreateBox(name, { width: 1.04, height: 0.05, depth: 0.56 }, scene)
  slab.material = flatMaterial(scene, 'vanity-top', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  slab.parent = root
  slab.position.y = 0.025
  return { root, pick: [slab] }
}

export function makeBasin(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'prop_basin', name, { w: 0.36, h: 0.15, d: 0.36, texture: 'ceramic' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const bowl = MeshBuilder.CreateCylinder(name, { height: 0.14, diameterTop: 0.36, diameterBottom: 0.28, tessellation: 18 }, scene)
  bowl.material = flatMaterial(scene, 'porcelain', PALETTE.appliance, { emissiveScale: 0.3 })
  bowl.parent = root
  bowl.position.y = 0.07
  const inner = MeshBuilder.CreateCylinder(`${name}-i`, { height: 0.015, diameter: 0.28 }, scene)
  inner.material = flatMaterial(scene, 'basin-in', PALETTE.sky, { emissiveScale: 0.3 })
  inner.parent = root
  inner.position.y = 0.14
  return { root, pick: [bowl, inner] }
}

// A wall-mounted faucet: back plate + spout reaching out over the basin (-z).
export function makeFaucet(scene: Scene, name: string): Prop {
  const glb = modelInstance(scene, 'prop_faucet', name, { w: 0.16, h: 0.2, d: 0.2, anchor: 'center' })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const metal = flatMaterial(scene, 'faucet', PALETTE.bolt, { emissiveScale: 0.24 })
  const plate = MeshBuilder.CreateBox(`${name}-p`, { width: 0.16, height: 0.16, depth: 0.03 }, scene)
  plate.material = metal
  plate.parent = root
  const spout = MeshBuilder.CreateCylinder(`${name}-s`, { height: 0.18, diameter: 0.035, tessellation: 10 }, scene)
  spout.material = metal
  spout.parent = root
  spout.rotation.x = Math.PI / 2
  spout.position.set(0, -0.02, -0.09)
  const knob = MeshBuilder.CreateSphere(`${name}-k`, { diameter: 0.05, segments: 8 }, scene)
  knob.material = metal
  knob.parent = root
  knob.position.set(0, 0.06, -0.03)
  return { root, pick: [plate, spout, knob] }
}

// A small wall mirror (root at its centre, like the picture frame).
export function makeMirror(scene: Scene, name: string): Prop {
  // yaw -π/2: the -flat GLB's glass faces +x; pre-rotate so it faces -z (into
  // the room) BEFORE bbox normalization — else the thin axis gets stretched.
  const glb = modelInstance(scene, 'prop_mirror', name, { w: 0.52, h: 0.66, d: 0.05, anchor: 'center', yaw: -Math.PI / 2 })
  if (glb) return glb
  const root = new TransformNode(name, scene)
  const frameMat = flatMaterial(scene, 'frame', PALETTE.woodDeep, { emissiveScale: 0.22 })
  const glass = MeshBuilder.CreateBox(`${name}-g`, { width: 0.44, height: 0.58, depth: 0.03 }, scene)
  glass.material = flatMaterial(scene, 'mirror-glass', PALETTE.sky, { emissiveScale: 0.5 })
  glass.parent = root
  const mk = (id: string, w: number, h: number, x: number, y: number) => {
    const stick = MeshBuilder.CreateBox(`${name}-${id}`, { width: w, height: h, depth: 0.05 }, scene)
    stick.material = frameMat
    stick.parent = root
    stick.position.set(x, y, 0)
    return stick
  }
  const top = mk('ft', 0.52, 0.04, 0, 0.31)
  const bottom = mk('fb', 0.52, 0.04, 0, -0.31)
  const left = mk('fl', 0.04, 0.58, -0.24, 0)
  const right = mk('fr', 0.04, 0.58, 0.24, 0)
  return { root, pick: [glass, top, bottom, left, right] }
}

// A towel rail with a towel draped over it (root at the bar's centre).
export function makeTowelRail(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const metal = flatMaterial(scene, 'faucet', PALETTE.bolt, { emissiveScale: 0.24 })
  const bar = MeshBuilder.CreateCylinder(`${name}-b`, { height: 0.5, diameter: 0.03, tessellation: 10 }, scene)
  bar.material = metal
  bar.parent = root
  bar.rotation.z = Math.PI / 2
  const picks = [bar]
  for (const side of [-1, 1]) {
    const bracket = MeshBuilder.CreateBox(`${name}-k${side}`, { width: 0.03, height: 0.03, depth: 0.06 }, scene)
    bracket.material = metal
    bracket.parent = root
    bracket.position.set(side * 0.23, 0, 0.03)
    picks.push(bracket)
  }
  const towel = MeshBuilder.CreateBox(`${name}-t`, { width: 0.36, height: 0.4, depth: 0.05 }, scene)
  towel.material = flatMaterial(scene, 'towel', PALETTE.sky, { emissiveScale: 0.28 })
  towel.parent = root
  towel.position.set(0, -0.18, -0.01)
  picks.push(towel)
  return { root, pick: picks }
}

// ---------- bedroom: wardrobe (faces +z, backs against the mid wall) ----------

// A wardrobe side panel: tall upright board with a lighter front edge, same
// language as the shelf cheeks but floor-to-crown. Root at floor level.
export function makeWardrobeSide(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const board = MeshBuilder.CreateBox(name, { width: 0.06, height: 1.85, depth: 0.55 }, scene)
  board.material = flatMaterial(scene, 'shelfwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  board.parent = root
  board.position.y = 0.925
  const edge = MeshBuilder.CreateBox(`${name}-e`, { width: 0.064, height: 1.85, depth: 0.03 }, scene)
  edge.material = flatMaterial(scene, 'shelfedge', PALETTE.floorPlank, { emissiveScale: 0.28 })
  edge.parent = root
  edge.position.set(0, 0.925, 0.26)
  return { root, pick: [board, edge] }
}

// A wardrobe plank — base, crown and mid shelf share the cut; the darker base
// passes its own colour so the stack reads apart. Root at the underside.
export function makeWardrobePlank(scene: Scene, name: string, color: Color3 = PALETTE.woodWarm): Prop {
  const root = new TransformNode(name, scene)
  const board = MeshBuilder.CreateBox(name, { width: 1.06, height: 0.06, depth: 0.55 }, scene)
  board.material = flatMaterial(scene, 'wrd-plank', color, { emissiveScale: 0.24, texture: 'skin_wood_plank', tint: color !== PALETTE.woodWarm })
  board.parent = root
  board.position.y = 0.03
  const edge = MeshBuilder.CreateBox(`${name}-e`, { width: 1.06, height: 0.064, depth: 0.03 }, scene)
  edge.material = flatMaterial(scene, 'shelfedge', PALETTE.floorPlank, { emissiveScale: 0.28 })
  edge.parent = root
  edge.position.set(0, 0.03, 0.26)
  return { root, pick: [board, edge] }
}

// One half of the wardrobe back — thin tall board with a routed inset, like the
// shelf backs but full height. Faces +z (into the room). Root at floor level.
export function makeWardrobeBack(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const board = MeshBuilder.CreateBox(name, { width: 0.52, height: 1.78, depth: 0.035 }, scene)
  board.material = flatMaterial(scene, 'wrd-back', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  board.parent = root
  board.position.y = 0.89
  const inset = MeshBuilder.CreateBox(`${name}-i`, { width: 0.4, height: 1.6, depth: 0.012 }, scene)
  inset.material = flatMaterial(scene, 'wrd-inset', PALETTE.woodWarm, { emissiveScale: 0.26, texture: 'skin_wood_plank' })
  inset.parent = root
  inset.position.set(0, 0.89, 0.022)
  return { root, pick: [board, inset] }
}

// The hanging rail — a brass-ish bar with a mounting block at each end.
// Root at the bar's axis (centre anchored, like the towel rail).
export function makeWardrobeRail(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const metal = flatMaterial(scene, 'wrd-rail', PALETTE.gold, { emissiveScale: 0.26 })
  const bar = MeshBuilder.CreateCylinder(`${name}-b`, { height: 1.0, diameter: 0.045, tessellation: 12 }, scene)
  bar.material = metal
  bar.parent = root
  bar.rotation.z = Math.PI / 2
  const picks = [bar]
  for (const side of [-1, 1]) {
    const block = MeshBuilder.CreateBox(`${name}-k${side}`, { width: 0.04, height: 0.09, depth: 0.09 }, scene)
    block.material = flatMaterial(scene, 'wrd-railblock', PALETTE.woodDeep, { emissiveScale: 0.2, texture: 'skin_wood_deep' })
    block.parent = root
    block.position.set(side * 0.5, 0, 0)
    picks.push(block)
  }
  return { root, pick: picks }
}

// A wardrobe door: framed panel with a knob on the opening edge. `hinge` is
// which side the door hangs from (-1 = left door, knob on the right).
// Root at floor level so it shares the sides' slot convention.
export function makeWardrobeDoor(scene: Scene, name: string, hinge: -1 | 1): Prop {
  const root = new TransformNode(name, scene)
  const panel = MeshBuilder.CreateBox(name, { width: 0.51, height: 1.66, depth: 0.045 }, scene)
  panel.material = flatMaterial(scene, 'wrd-door', PALETTE.floorPlank, { emissiveScale: 0.24, texture: 'skin_vanity_door' })
  panel.parent = root
  panel.position.y = 0.92
  const inset = MeshBuilder.CreateBox(`${name}-i`, { width: 0.4, height: 1.5, depth: 0.014 }, scene)
  inset.material = flatMaterial(scene, 'wrd-doorinset', PALETTE.wallCream, { emissiveScale: 0.28 })
  inset.parent = root
  inset.position.set(0, 0.92, 0.026)
  const knob = MeshBuilder.CreateBox(`${name}-n`, { width: 0.025, height: 0.13, depth: 0.03 }, scene)
  knob.material = flatMaterial(scene, 'counter-knob', PALETTE.bolt, { emissiveScale: 0.2 })
  knob.parent = root
  knob.position.set(-hinge * 0.21, 0.95, 0.04)
  return { root, pick: [panel, inset, knob] }
}

// ---------- living room: writing desk + chair (desk backs against -x wall) ----------

// A desk leg — taller cousin of the coffee-table leg. Root at floor level.
export function makeDeskLeg(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const leg = MeshBuilder.CreateBox(name, { width: 0.06, height: 0.66, depth: 0.06 }, scene)
  leg.material = flatMaterial(scene, 'tableleg', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  leg.parent = root
  leg.position.y = 0.33
  return { root, pick: [leg] }
}

// The desk top — long axis runs in z (along the wall). Root at the underside.
export function makeDeskTop(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const top = MeshBuilder.CreateBox(name, { width: 0.6, height: 0.06, depth: 1.25 }, scene)
  top.material = flatMaterial(scene, 'shelfwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  top.parent = root
  top.position.y = 0.03
  const band = MeshBuilder.CreateBox(`${name}-e`, { width: 0.03, height: 0.064, depth: 1.25 }, scene)
  band.material = flatMaterial(scene, 'shelfedge', PALETTE.floorPlank, { emissiveScale: 0.28 })
  band.parent = root
  band.position.set(0.29, 0.03, 0)
  return { root, pick: [top, band] }
}

// The modesty panel that stiffens the desk frame at the back. Root at its centre
// (it mounts up between the rear legs, not on the floor).
export function makeDeskApron(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const panel = MeshBuilder.CreateBox(name, { width: 0.04, height: 0.3, depth: 1.05 }, scene)
  panel.material = flatMaterial(scene, 'wrd-back', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  panel.parent = root
  return { root, pick: [panel] }
}

// A little desk lamp: disc base, stem, warm shade. Root at floor of the base.
export function makeDeskLamp(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const base = MeshBuilder.CreateCylinder(`${name}-b`, { height: 0.03, diameter: 0.14, tessellation: 14 }, scene)
  base.material = flatMaterial(scene, 'lamp-metal', PALETTE.bolt, { emissiveScale: 0.22 })
  base.parent = root
  base.position.y = 0.015
  const stem = MeshBuilder.CreateCylinder(`${name}-s`, { height: 0.22, diameter: 0.025, tessellation: 10 }, scene)
  stem.material = base.material
  stem.parent = root
  stem.position.y = 0.14
  const shade = MeshBuilder.CreateCylinder(
    `${name}-h`,
    { height: 0.12, diameterTop: 0.09, diameterBottom: 0.15, tessellation: 14 },
    scene,
  )
  shade.material = flatMaterial(scene, 'lamp-shade', PALETTE.gold, { emissiveScale: 0.5 })
  shade.parent = root
  shade.position.y = 0.29
  return { root, pick: [base, stem, shade] }
}

// A chair leg — slimmer than the desk's. Root at floor level.
export function makeChairLeg(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const leg = MeshBuilder.CreateBox(name, { width: 0.05, height: 0.42, depth: 0.05 }, scene)
  leg.material = flatMaterial(scene, 'tableleg', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  leg.parent = root
  leg.position.y = 0.21
  return { root, pick: [leg] }
}

// The chair seat: a warm board with a cream pad. Root at the underside.
export function makeChairSeat(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const board = MeshBuilder.CreateBox(name, { width: 0.42, height: 0.05, depth: 0.42 }, scene)
  board.material = flatMaterial(scene, 'shelfwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  board.parent = root
  board.position.y = 0.025
  const pad = MeshBuilder.CreateBox(`${name}-p`, { width: 0.38, height: 0.035, depth: 0.38 }, scene)
  pad.material = flatMaterial(scene, 'cushion', PALETTE.ceiling, { emissiveScale: 0.3, texture: 'skin_fabric_cream' })
  pad.parent = root
  pad.position.y = 0.065
  return { root, pick: [board, pad] }
}

// The chair back: two uprights with a curved-feel top rail. Thin in x (the
// chair faces -x, toward the desk). Root at its bottom.
export function makeChairBack(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const wood = flatMaterial(scene, 'tableleg', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  const picks: Mesh[] = []
  for (const side of [-1, 1]) {
    const post = MeshBuilder.CreateBox(`${name}-p${side}`, { width: 0.05, height: 0.46, depth: 0.05 }, scene)
    post.material = wood
    post.parent = root
    post.position.set(0, 0.23, side * 0.17)
    picks.push(post)
  }
  const rail = MeshBuilder.CreateCylinder(`${name}-r`, { height: 0.42, diameter: 0.07, tessellation: 12 }, scene)
  rail.material = flatMaterial(scene, 'shelfwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  rail.parent = root
  rail.rotation.x = Math.PI / 2
  rail.position.y = 0.44
  picks.push(rail)
  const mid = MeshBuilder.CreateBox(`${name}-m`, { width: 0.035, height: 0.09, depth: 0.36 }, scene)
  mid.material = rail.material
  mid.parent = root
  mid.position.y = 0.3
  picks.push(mid)
  return { root, pick: picks }
}

// ---------- living room: floor lamp ----------

// The lamp base: a heavy disc with a socket stub the pole drops into.
export function makeLampBase(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const disc = MeshBuilder.CreateCylinder(`${name}-d`, { height: 0.05, diameter: 0.38, tessellation: 18 }, scene)
  disc.material = flatMaterial(scene, 'lamp-metal', PALETTE.bolt, { emissiveScale: 0.22 })
  disc.parent = root
  disc.position.y = 0.025
  const stub = MeshBuilder.CreateCylinder(`${name}-s`, { height: 0.07, diameter: 0.07, tessellation: 12 }, scene)
  stub.material = disc.material
  stub.parent = root
  stub.position.y = 0.085
  return { root, pick: [disc, stub] }
}

// A pole segment. The lower one is fatter than the upper so the two read apart
// on the mat. Root at the bottom.
export function makeLampPole(scene: Scene, name: string, diameter: number): Prop {
  const root = new TransformNode(name, scene)
  const pole = MeshBuilder.CreateCylinder(`${name}-p`, { height: 0.62, diameter, tessellation: 12 }, scene)
  pole.material = flatMaterial(scene, 'lamp-pole', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  pole.parent = root
  pole.position.y = 0.31
  const collar = MeshBuilder.CreateCylinder(`${name}-c`, { height: 0.03, diameter: diameter + 0.025, tessellation: 12 }, scene)
  collar.material = flatMaterial(scene, 'lamp-metal', PALETTE.bolt, { emissiveScale: 0.22 })
  collar.parent = root
  collar.position.y = 0.605
  return { root, pick: [pole, collar] }
}

// The drum shade — warm and glowing, like it can't wait to be switched on.
// Root at its bottom rim.
export function makeLampShade(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const drum = MeshBuilder.CreateCylinder(
    `${name}-d`,
    { height: 0.3, diameterTop: 0.26, diameterBottom: 0.34, tessellation: 18 },
    scene,
  )
  drum.material = flatMaterial(scene, 'lamp-drum', PALETTE.glowWarm, { emissiveScale: 0.5, texture: 'skin_fabric_cream', tint: true })
  drum.parent = root
  drum.position.y = 0.15
  const rim = MeshBuilder.CreateTorus(`${name}-r`, { diameter: 0.33, thickness: 0.015, tessellation: 18 }, scene)
  rim.material = flatMaterial(scene, 'lamp-metal', PALETTE.bolt, { emissiveScale: 0.22 })
  rim.parent = root
  rim.position.y = 0.02
  return { root, pick: [drum, rim] }
}

// The bulb that screws into the shade's socket. Root at the bulb's centre so the
// BoltPuzzle can spin and sink it like a (glass) bolt.
export function makeLampBulb(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const globe = MeshBuilder.CreateSphere(`${name}-g`, { diameter: 0.11, segments: 10 }, scene)
  globe.material = flatMaterial(scene, 'bulb', PALETTE.sparkle, { emissiveScale: 0.65 })
  globe.parent = root
  const screw = MeshBuilder.CreateCylinder(`${name}-s`, { height: 0.05, diameter: 0.045, tessellation: 10 }, scene)
  screw.material = flatMaterial(scene, 'lamp-metal', PALETTE.bolt, { emissiveScale: 0.22 })
  screw.parent = root
  screw.position.y = 0.06
  return { root, pick: [globe, screw] }
}

// ---------- kitchen: dining nook (round table + stools) ----------

// The pedestal: a column on a cross foot. Root at floor level.
export function makeDiningPedestal(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const wood = flatMaterial(scene, 'tableleg', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  const column = MeshBuilder.CreateCylinder(`${name}-c`, { height: 0.62, diameter: 0.09, tessellation: 12 }, scene)
  column.material = wood
  column.parent = root
  column.position.y = 0.34
  const picks = [column]
  for (const rot of [0, Math.PI / 2]) {
    const foot = MeshBuilder.CreateBox(`${name}-f${rot}`, { width: 0.5, height: 0.06, depth: 0.07 }, scene)
    foot.material = wood
    foot.parent = root
    foot.rotation.y = rot
    foot.position.y = 0.03
    picks.push(foot)
  }
  return { root, pick: picks }
}

// The round table top with a lighter rim band. Root at the underside.
export function makeDiningTop(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const top = MeshBuilder.CreateCylinder(`${name}-t`, { height: 0.05, diameter: 0.9, tessellation: 24 }, scene)
  top.material = flatMaterial(scene, 'shelfwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  top.parent = root
  top.position.y = 0.025
  const rim = MeshBuilder.CreateTorus(`${name}-r`, { diameter: 0.88, thickness: 0.025, tessellation: 24 }, scene)
  rim.material = flatMaterial(scene, 'shelfedge', PALETTE.floorPlank, { emissiveScale: 0.28 })
  rim.parent = root
  rim.position.y = 0.045
  return { root, pick: [top, rim] }
}

// A little round stool: padded seat on four splayed-ish legs. Root at floor level.
export function makeStool(scene: Scene, name: string): Prop {
  const root = new TransformNode(name, scene)
  const wood = flatMaterial(scene, 'tableleg', PALETTE.woodDeep, { emissiveScale: 0.22, texture: 'skin_wood_deep' })
  const picks: Mesh[] = []
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = MeshBuilder.CreateBox(`${name}-l${lx}${lz}`, { width: 0.045, height: 0.42, depth: 0.045 }, scene)
    leg.material = wood
    leg.parent = root
    leg.position.set(lx * 0.1, 0.21, lz * 0.1)
    picks.push(leg)
  }
  const seat = MeshBuilder.CreateCylinder(`${name}-s`, { height: 0.05, diameter: 0.34, tessellation: 16 }, scene)
  seat.material = flatMaterial(scene, 'shelfwood', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  seat.parent = root
  seat.position.y = 0.445
  picks.push(seat)
  const pad = MeshBuilder.CreateCylinder(`${name}-p`, { height: 0.035, diameter: 0.3, tessellation: 16 }, scene)
  pad.material = flatMaterial(scene, 'cushion', PALETTE.wallRoseDeep, { emissiveScale: 0.26, texture: 'skin_fabric_rose' })
  pad.parent = root
  pad.position.y = 0.485
  picks.push(pad)
  return { root, pick: picks }
}

// ---------- bathroom fixtures (decor, not interactive) ----------

export function makeBathtub(scene: Scene, name: string): TransformNode {
  const root = new TransformNode(name, scene)
  const shell = MeshBuilder.CreateBox(`${name}-s`, { width: 1.0, height: 0.55, depth: 1.7 }, scene)
  shell.material = flatMaterial(scene, 'porcelain', PALETTE.appliance, { emissiveScale: 0.3 })
  shell.parent = root
  shell.position.y = 0.275
  const rim = MeshBuilder.CreateBox(`${name}-r`, { width: 1.06, height: 0.06, depth: 1.76 }, scene)
  rim.material = flatMaterial(scene, 'tub-rim', PALETTE.wallCream, { emissiveScale: 0.3 })
  rim.parent = root
  rim.position.y = 0.55
  const floor = MeshBuilder.CreateBox(`${name}-f`, { width: 0.82, height: 0.04, depth: 1.52 }, scene)
  floor.material = flatMaterial(scene, 'tub-floor', PALETTE.floorCream, { emissiveScale: 0.26 })
  floor.parent = root
  floor.position.y = 0.6
  return root
}

export function makeToilet(scene: Scene, name: string): TransformNode {
  const root = new TransformNode(name, scene)
  const porcelain = flatMaterial(scene, 'porcelain', PALETTE.appliance, { emissiveScale: 0.3 })
  const bowl = MeshBuilder.CreateCylinder(`${name}-b`, { height: 0.35, diameterTop: 0.4, diameterBottom: 0.3, tessellation: 16 }, scene)
  bowl.material = porcelain
  bowl.parent = root
  bowl.position.set(0, 0.175, -0.1)
  const seat = MeshBuilder.CreateCylinder(`${name}-s`, { height: 0.05, diameter: 0.44, tessellation: 16 }, scene)
  seat.material = flatMaterial(scene, 'tub-rim', PALETTE.wallCream, { emissiveScale: 0.3 })
  seat.parent = root
  seat.position.set(0, 0.375, -0.1)
  const tank = MeshBuilder.CreateBox(`${name}-t`, { width: 0.42, height: 0.55, depth: 0.16 }, scene)
  tank.material = porcelain
  tank.parent = root
  tank.position.set(0, 0.45, 0.16)
  return root
}

// A taped, sealed cardboard box. Two top flaps hinge along the front/back edges
// and a bright tape strip runs along the centre seam (sliced with the box cutter).
export interface TapedBox {
  root: TransformNode
  body: Mesh
  tape: Mesh
  pivotF: TransformNode
  pivotB: TransformNode
  pick: Mesh[]
}

export function makeTapedBox(scene: Scene, name: string, w = 1.2, h = 0.5, d = 0.5): TapedBox {
  const root = new TransformNode(name, scene)
  const cardboard = flatMaterial(scene, 'boxcard', PALETTE.cardboard, { emissiveScale: 0.22, texture: 'skin_cardboard' })
  const lidMat = flatMaterial(scene, 'boxlid', PALETTE.trim, { emissiveScale: 0.22, texture: 'cardboard', tint: true })

  const body = MeshBuilder.CreateBox(`${name}-body`, { width: w, height: h, depth: d }, scene)
  body.material = cardboard
  body.parent = root
  body.position.y = h / 2

  const top = h
  const pivotF = new TransformNode(`${name}-pf`, scene)
  pivotF.parent = root
  pivotF.position.set(0, top, d / 2)
  const flapF = MeshBuilder.CreateBox(`${name}-ff`, { width: w - 0.02, height: 0.03, depth: d / 2 }, scene)
  flapF.material = lidMat
  flapF.parent = pivotF
  flapF.position.set(0, 0, -d / 4)

  const pivotB = new TransformNode(`${name}-pb`, scene)
  pivotB.parent = root
  pivotB.position.set(0, top, -d / 2)
  const flapB = MeshBuilder.CreateBox(`${name}-fb`, { width: w - 0.02, height: 0.03, depth: d / 2 }, scene)
  flapB.material = lidMat
  flapB.parent = pivotB
  flapB.position.set(0, 0, d / 4)

  const tape = MeshBuilder.CreateBox(`${name}-tape`, { width: w * 0.92, height: 0.02, depth: 0.09 }, scene)
  tape.material = flatMaterial(scene, 'tape', PALETTE.ceiling, { emissiveScale: 0.4 })
  tape.parent = root
  tape.position.set(0, top + 0.02, 0)

  // Hidden until revealed — station boxes appear via showPending() when their
  // parcel is set down; shop parcels enable themselves on delivery.
  root.setEnabled(false)

  return { root, body, tape, pivotF, pivotB, pick: [body, flapF, flapB, tape] }
}

// A moving box with a liftable lid (used as the first "open me" beat).
export function makeMovingBox(scene: Scene, name: string): { root: TransformNode; lid: Mesh; body: Mesh } {
  const root = new TransformNode(name, scene)
  const body = MeshBuilder.CreateBox(`${name}-b`, { width: 0.55, height: 0.45, depth: 0.5 }, scene)
  body.material = flatMaterial(scene, 'box', PALETTE.cardboard, { emissiveScale: 0.22, texture: 'skin_cardboard' })
  body.parent = root
  body.position.y = 0.225
  const lid = MeshBuilder.CreateBox(`${name}-l`, { width: 0.57, height: 0.06, depth: 0.52 }, scene)
  lid.material = flatMaterial(scene, 'lid', PALETTE.trim, { emissiveScale: 0.22, texture: 'cardboard', tint: true })
  lid.parent = root
  lid.position.y = 0.48
  return { root, lid, body }
}
