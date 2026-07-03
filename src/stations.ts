import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { flatMaterial, glowMaterial } from './materials'
import { PALETTE } from './palette'
import { modelInstance } from './models'
import {
  ArrangePuzzle,
  BoltPuzzle,
  BoxCutterPuzzle,
  DragPuzzle,
  RotatePuzzle,
  StackPuzzle,
  ghostMesh,
  popOut,
  type FocusPose,
  type Puzzle,
  type PuzzleCtx,
} from './focus'
import {
  makeBackCushion,
  makeBasin,
  makeBedRail,
  makeBedSlat,
  makeBolt,
  makeBook,
  makeChairBack,
  makeChairLeg,
  makeChairSeat,
  makeDeskApron,
  makeDeskLamp,
  makeDeskLeg,
  makeDeskTop,
  makeDiningPedestal,
  makeDiningTop,
  makeDuvet,
  makeFaucet,
  makeFootboard,
  makeHeadboard,
  makeKettle,
  makeLampBase,
  makeLampBulb,
  makeLampPole,
  makeLampShade,
  makeMattress,
  makeMirror,
  makeMug,
  makePicture,
  makePillow,
  makePlant,
  makePlate,
  makeSeatCushion,
  makeShelfBackPanel,
  makeShelfBoard,
  makeShelfBracket,
  makeShelfSide,
  makeSofaArm,
  makeSpiceJar,
  makeSofaBack,
  makeSofaBase,
  makeStool,
  makeTableLeg,
  makeTableShelf,
  makeTableTop,
  makeTapedBox,
  makeTowelRail,
  makeVanityBody,
  makeVanityTop,
  makeWardrobeBack,
  makeWardrobeDoor,
  makeWardrobePlank,
  makeWardrobeRail,
  makeWardrobeSide,
  type Prop,
  type TapedBox,
} from './props'
import type { House } from './house'

export interface Station {
  id: string
  title: string
  approach: Vector3
  focus: FocusPose
  requires?: string
  moodLight: number
  // True for tasks with no parcel (e.g. the crooked picture): they skip the
  // order-online → porch → carry-in loop and are available from the start.
  noBox?: boolean
  available: boolean
  done: boolean
  marker: Mesh
  showPending(): void
  // Each phase is a thunk so later phases (e.g. bolts) only build their meshes
  // once the previous phase is solved.
  createPhases(ctx: PuzzleCtx): Array<() => Puzzle>
  finish(): void
}

function marker(scene: Scene, at: Vector3): Mesh {
  const m = MeshBuilder.CreateTorus(`marker-${at.x}`, { diameter: 0.7, thickness: 0.05, tessellation: 24 }, scene)
  m.material = glowMaterial(scene, 'marker', PALETTE.gold, 0.7, 0.85)
  m.position.copyFrom(at)
  m.position.y = 0.04
  m.rotation.x = Math.PI / 2
  m.isPickable = false
  // gentle bob + spin
  scene.onBeforeRenderObservable.add(() => {
    if (!m.isEnabled()) return
    const t = performance.now() / 1000
    m.position.y = 0.05 + Math.sin(t * 2) * 0.03
    m.rotation.y = t * 0.8
  })
  return m
}

function ghostBox(scene: Scene, w: number, h: number, d: number, pos: Vector3): Mesh {
  const g = MeshBuilder.CreateBox('ghost', { width: w, height: h, depth: d }, scene)
  g.position.copyFrom(pos)
  return ghostMesh(scene, g)
}

// A canvas dust sheet laid flat on the floor of the work area — thin and soft,
// like movers spread before unpacking. Tidied away (hideMat) once the station
// is finished. The y of `pos` is ignored; the sheet always hugs the floor.
function stagingMat(scene: Scene, pos: Vector3, w = 1.7, d = 0.8): TransformNode {
  const glb = modelInstance(scene, 'kit_dust_sheet', 'mat', { w, h: 0.05, d, texture: 'fabric_cream' })
  if (glb) {
    // show/hideMat toggle meshes named 'mat' — brand every cloned mesh.
    glb.pick.forEach((m) => {
      m.name = 'mat'
      m.isPickable = false
      m.setEnabled(false)
    })
    glb.root.position.set(pos.x, 0.04, pos.z)
    return glb.root
  }
  const mat = MeshBuilder.CreateBox('mat', { width: w, height: 0.015, depth: d }, scene)
  mat.material = flatMaterial(scene, 'dust-sheet', PALETTE.wallCream, { emissiveScale: 0.32 })
  mat.position.set(pos.x, 0.045, pos.z)
  mat.isPickable = false
  // Stays out of sight until the box is opened and parts spread onto it —
  // a bare sheet under an unopened box just reads as a weird plate.
  mat.setEnabled(false)
  return mat
}

// The dust sheet unrolls (appears) the moment parts land on it.
function showMat(group: TransformNode | null) {
  if (!group) return
  group.getChildMeshes(false).forEach((m) => {
    if (m.name === 'mat') m.setEnabled(true)
  })
}

// A set of flat-pack parts that pop out of the box onto staged homes. Later
// phases can own their own stager (e.g. cushions arrive after the frame).
interface StagedPart {
  prop: Prop
  home: Vector3
  rot?: Vector3 // staged rotation (long rails lie sideways); the snap tween spins to zero
}

class PartStager {
  private revealed = false
  constructor(
    private scene: Scene,
    private box: TapedBox,
    readonly parts: StagedPart[],
  ) {}

  // Lays the parts out (pop-out on first call, plain placement after).
  // Returns true on the first reveal so the puzzle can delay grabbing.
  reveal(): boolean {
    const first = !this.revealed
    showMat(this.parts[0]?.prop.root.parent as TransformNode | null)
    this.parts.forEach(({ prop, home, rot }, i) => {
      prop.root.rotationQuaternion = null // tweens set quaternions, which mute .rotation
      prop.root.scaling.setAll(1)
      if (rot) prop.root.rotation.copyFrom(rot)
      else prop.root.rotation.set(0, 0, 0)
      if (first) {
        prop.root.setEnabled(true)
        popOut(this.scene, prop.root, this.box.root.position.add(new Vector3(0, 0.4, 0)), home, i * 0.12)
      } else {
        prop.root.position.copyFrom(home)
        prop.root.setEnabled(true)
      }
    })
    this.revealed = true
    return first
  }
}

// Once a station is finished the work mat has served its purpose — tidy it away.
function hideMat(group: TransformNode) {
  group.getChildMeshes(false).forEach((m) => {
    if (m.name === 'mat') m.setEnabled(false)
  })
}

// A reusable bolt-tightening phase. Bolts left over from an aborted attempt are
// cleared when the phase restarts.
function boltRun(
  scene: Scene,
  group: TransformNode,
  positions: Vector3[],
  hint = 'Drag back and forth across each bolt to tighten it.',
) {
  let bolts: ReturnType<typeof makeBolt>[] = []
  return (ctx: PuzzleCtx) => () => {
    bolts.forEach((b) => b.root.dispose())
    bolts = positions.map((_, i) => makeBolt(scene, `blt-${group.name}-${i}`))
    bolts.forEach((b, i) => {
      b.root.parent = group
      b.root.position.copyFrom(positions[i])
    })
    const rings = positions.map((p) => {
      const r = MeshBuilder.CreateTorus('ring', { diameter: 0.16, thickness: 0.02, tessellation: 20 }, scene)
      r.material = glowMaterial(scene, 'ring', PALETTE.gold, 0.7)
      r.position.set(p.x, p.y + 0.045, p.z)
      r.scaling.setAll(0.2)
      r.isPickable = false
      return r
    })
    return new BoltPuzzle(ctx, bolts.map((b, i) => ({ node: b.root, pick: b.pick[0], ring: rings[i] })), hint)
  }
}

// ============ Station factories ============

// A) Assemble the bookshelf — a real flat-pack: two back boards, two side
// cheeks, a darker base plank, the shelf plank and two support brackets,
// then tighten four bolts.
function stationShelf(scene: Scene): Station {
  // Wall inner face is at z = -4.0; the shelf sits flush against it.
  const wallZ = -3.88
  const x = -2.6
  const sideY = 0.87 // side cheeks centre (spans 0.62..1.12)
  const baseY = 0.595 // base plank centre; the cheeks stand on its top face
  const boardY = 1.145 // shelf plank centre, resting on the cheeks
  const supY = 0.495 // bracket centre; its arm meets the base plank's underside
  const group = new TransformNode('shelf-group', scene)

  // flat-pack pieces — hidden inside the box until it's sliced open
  const cheekL = makeShelfSide(scene, 'chk-l')
  const cheekR = makeShelfSide(scene, 'chk-r')
  const basePlank = makeShelfBoard(scene, 'base', { color: PALETTE.woodDeep, edgeColor: PALETTE.woodWarm })
  const board = makeShelfBoard(scene, 'board')
  const supL = makeShelfBracket(scene, 'sup-l')
  const supR = makeShelfBracket(scene, 'sup-r')
  const backL = makeShelfBackPanel(scene, 'back-l')
  const backR = makeShelfBackPanel(scene, 'back-r')
  // pop-out order: small parts first, the tall back boards last so the box has
  // already vanished from their landing row by the time they arrive.
  const parts = [cheekL, cheekR, basePlank, board, supL, supR, backL, backR]
  parts.forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'shelf-box', 1.2, 0.5, 0.5)
  boxPack.root.parent = group
  let bolts: ReturnType<typeof makeBolt>[] = []
  let shown = false
  let revealed = false

  // Where the parts rest on the mat, waiting to be dragged onto the wall:
  // cheeks on the left, planks on the right, brackets in the middle,
  // back boards standing along the rear edge.
  const partHomes = [
    new Vector3(x - 0.78, 0.28, -2.5), // cheek L (centre-rooted, so 0.28 = on the sheet)
    new Vector3(x - 0.52, 0.28, -2.5), // cheek R
    new Vector3(x + 0.42, 0.06, -2.72), // base plank
    new Vector3(x + 0.42, 0.06, -2.44), // shelf plank
    new Vector3(x - 0.24, 0.09, -2.42), // bracket
    new Vector3(x - 0.24, 0.09, -2.66), // bracket
    new Vector3(x - 0.85, 0.3, -2.95), // back board (centre-rooted)
    new Vector3(x + 0.85, 0.3, -2.95), // back board
  ]

  const revealParts = () => {
    showMat(group)
    parts.forEach((p, i) => {
      p.root.rotationQuaternion = null // tweens set quaternions, which mute .rotation
      p.root.scaling.setAll(1)
      p.root.rotation.set(0, 0, 0)
      if (revealed) {
        // re-entering the station: just lay the parts back out
        p.root.position.copyFrom(partHomes[i])
        p.root.setEnabled(true)
      } else {
        // first open: parts rise out of the box mouth and arc onto the mat
        popOut(scene, p.root, boxPack.root.position.add(new Vector3(0, 0.45, 0)), partHomes[i], i * 0.12)
      }
    })
    revealed = true
  }

  const st: Station = {
    id: 'shelf',
    title: 'Build the bookshelf',
    approach: new Vector3(x, 0, -2.55),
    focus: { position: new Vector3(x, 1.62, -1.0), target: new Vector3(x, 0.78, wallZ) },
    moodLight: 0,
    available: false, // unlocked when its parcel is carried in and set down
    done: false,
    marker: marker(scene, new Vector3(x, 0, -2.55)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(x, 0.44, -2.68), 2.15, 1.0).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(x, 0, -2.85)
    },
    createPhases(ctx) {
      // Slots that assemble the shelf on the wall.
      const slotL = new Vector3(x - 0.48, sideY, wallZ)
      const slotR = new Vector3(x + 0.48, sideY, wallZ)
      const slotBase = new Vector3(x, baseY, wallZ)
      const slotBoard = new Vector3(x, boardY, wallZ)
      const slotSupL = new Vector3(x - 0.4, supY, -3.92)
      const slotSupR = new Vector3(x + 0.4, supY, -3.92)
      const slotBackL = new Vector3(x - 0.225, sideY, -3.975)
      const slotBackR = new Vector3(x + 0.225, sideY, -3.975)

      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Drag the box cutter along the tape to slice the box open.')

      const placePhase = () => {
        const firstReveal = !revealed
        revealParts()
        const cheekHint = 'The side panels stand upright at the ends.'
        const supHint = 'The little brackets tuck in under the base plank.'
        const backHint = 'The back boards fill the frame between the planks.'
        return new DragPuzzle(
          ctx,
          [
            { root: cheekL.root, pick: cheekL.pick, slotId: ['L', 'R'], home: partHomes[0], sound: 'wood', wrongHint: cheekHint },
            { root: cheekR.root, pick: cheekR.pick, slotId: ['L', 'R'], home: partHomes[1], sound: 'wood', wrongHint: cheekHint },
            { root: basePlank.root, pick: basePlank.pick, slotId: 'BASE', home: partHomes[2], sound: 'wood', wrongHint: 'The darker base plank sits low, under the side panels.' },
            { root: board.root, pick: board.pick, slotId: 'BOARD', home: partHomes[3], sound: 'wood', wrongHint: 'The lighter shelf plank lies flat across the top.' },
            { root: supL.root, pick: supL.pick, slotId: ['SUPL', 'SUPR'], home: partHomes[4], sound: 'wood', wrongHint: supHint },
            { root: supR.root, pick: supR.pick, slotId: ['SUPL', 'SUPR'], home: partHomes[5], sound: 'wood', wrongHint: supHint },
            { root: backL.root, pick: backL.pick, slotId: ['BACKL', 'BACKR'], home: partHomes[6], sound: 'wood', wrongHint: backHint },
            { root: backR.root, pick: backR.pick, slotId: ['BACKL', 'BACKR'], home: partHomes[7], sound: 'wood', wrongHint: backHint },
          ],
          [
            { id: 'L', pos: slotL, ghost: ghostBox(scene, 0.09, 0.52, 0.26, slotL) },
            { id: 'R', pos: slotR, ghost: ghostBox(scene, 0.09, 0.52, 0.26, slotR) },
            { id: 'BASE', pos: slotBase, ghost: ghostBox(scene, 1.06, 0.09, 0.28, slotBase) },
            { id: 'BOARD', pos: slotBoard, ghost: ghostBox(scene, 1.06, 0.09, 0.28, slotBoard) },
            { id: 'SUPL', pos: slotSupL, ghost: ghostBox(scene, 0.08, 0.17, 0.2, new Vector3(slotSupL.x, 0.5, slotSupL.z)) },
            { id: 'SUPR', pos: slotSupR, ghost: ghostBox(scene, 0.08, 0.17, 0.2, new Vector3(slotSupR.x, 0.5, slotSupR.z)) },
            { id: 'BACKL', pos: slotBackL, ghost: ghostBox(scene, 0.46, 0.52, 0.05, slotBackL) },
            { id: 'BACKR', pos: slotBackR, ghost: ghostBox(scene, 0.46, 0.52, 0.05, slotBackR) },
          ],
          { hint: 'Drag each flat-pack piece onto its glowing outline.', snapPx: 60, grabDelay: firstReveal ? 1.2 : 0 },
        )
      }

      const boltPhase = () => {
        bolts.forEach((b) => b.root.dispose()) // clear leftovers from an aborted attempt
        // Vertical bolts: down through the shelf plank into each side cheek,
        // and down through the base plank into the support brackets.
        const bp: Vector3[] = [
          new Vector3(x - 0.48, boardY + 0.005, wallZ + 0.04),
          new Vector3(x + 0.48, boardY + 0.005, wallZ + 0.04),
          new Vector3(x - 0.36, baseY + 0.005, wallZ + 0.04),
          new Vector3(x + 0.36, baseY + 0.005, wallZ + 0.04),
        ]
        bolts = bp.map((_, i) => makeBolt(scene, `blt-${i}`))
        bolts.forEach((b, i) => {
          b.root.parent = group
          b.root.position.copyFrom(bp[i])
        })
        const rings = bp.map((p) => {
          const r = MeshBuilder.CreateTorus('ring', { diameter: 0.16, thickness: 0.02, tessellation: 20 }, scene)
          r.material = glowMaterial(scene, 'ring', PALETTE.gold, 0.7)
          r.position.set(p.x, p.y + 0.045, p.z)
          r.scaling.setAll(0.2)
          r.isPickable = false
          return r
        })
        return new BoltPuzzle(
          ctx,
          bolts.map((b, i) => ({ node: b.root, pick: b.pick[0], ring: rings[i] })),
          'Drag back and forth across each bolt to tighten it.',
        )
      }

      return [boxPhase, placePhase, boltPhase]
    },
    finish() {
      this.done = true
      hideMat(group) // placed panels + bolts remain as the finished shelf
    },
  }
  return st
}

// B) Shelve the books by height (needs the shelf built first).
function stationBooks(scene: Scene): Station {
  const wallZ = -3.88 // centred on the shelf plank
  const x = -2.6
  const boardY = 1.17 // top surface of the shelf plank
  const group = new TransformNode('books-group', scene)
  const heights = [0.34, 0.3, 0.26, 0.22, 0.18]
  const colors = [PALETTE.book1, PALETTE.book2, PALETTE.book3, PALETTE.book4, PALETTE.book5]
  const books = heights.map((h, i) => makeBook(scene, `book-${i}`, h, colors[i]))
  books.forEach((b) => {
    b.root.parent = group
    b.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'books-box', 1.0, 0.42, 0.5)
  boxPack.root.parent = group
  let shown = false
  let revealed = false

  // Staged out of height order — a pre-sorted row would solve the puzzle for you.
  const homeOrder = [2, 0, 4, 1, 3]
  const bookHomes = homeOrder.map((k) => new Vector3(x + (k - 2) * 0.25, 0.05, -2.8))

  const revealBooks = () => {
    showMat(group)
    books.forEach((b, i) => {
      b.root.rotationQuaternion = null
      b.root.scaling.setAll(1)
      b.root.rotation.set(0, (Math.random() - 0.5) * 0.6, 0)
      if (revealed) {
        b.root.position.copyFrom(bookHomes[i])
        b.root.setEnabled(true)
      } else {
        popOut(scene, b.root, boxPack.root.position.add(new Vector3(0, 0.38, 0)), bookHomes[i], i * 0.1)
      }
    })
    revealed = true
  }

  const st: Station = {
    id: 'books',
    title: 'Shelve the books',
    approach: new Vector3(x, 0, -2.55),
    focus: { position: new Vector3(x, 1.64, -1.0), target: new Vector3(x, 0.98, wallZ) },
    requires: 'shelf',
    moodLight: 0,
    available: false,
    done: false,
    marker: marker(scene, new Vector3(x + 0.02, 0, -2.4)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(x, 0.44, -2.72)).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(x, 0, -2.85)
    },
    createPhases(ctx) {
      // Slots ordered tallest -> shortest, left to right (kept clear of the bolts
      // at the plank's ends).
      const xs = [-0.34, -0.17, 0, 0.17, 0.34]
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the tape to open the box of books.')
      const sortPhase = () => {
        const firstReveal = !revealed
        revealBooks()
        // Uniform outlines: the row says "books go here", never which book.
        // The arrangement itself is what gets judged — either direction works.
        const slots = xs.map((dx) => ({
          pos: new Vector3(x + dx, boardY, wallZ),
          ghost: ghostBox(scene, 0.16, 0.3, 0.2, new Vector3(x + dx, boardY + 0.15, wallZ)),
        }))
        const items = books.map((b, i) => ({
          root: b.root,
          pick: b.pick,
          value: heights[i],
          home: bookHomes[i],
          sound: 'wood' as const,
        }))
        return new ArrangePuzzle(ctx, items, slots, {
          hint: 'Shelve the books so they step evenly — either way round.',
          wrongHint: 'Nearly — they want to make even steps. Swap a couple.',
          snapPx: 60,
          grabDelay: firstReveal ? 1.0 : 0,
        })
      }
      return [boxPhase, sortPhase]
    },
    finish() {
      this.done = true
      hideMat(group)
    },
  }
  return st
}

// C) Straighten the crooked picture (grab & rotate).
function stationPicture(scene: Scene): Station {
  const wallZ = -3.96 // hanging on the wall face (inner face at z = -4.0)
  const x = 0.5
  const y = 1.72
  const pic = makePicture(scene, 'pic', PALETTE.sky)
  pic.root.position.set(x, y, wallZ)
  let shown = false

  const st: Station = {
    id: 'picture',
    title: 'Straighten the picture',
    approach: new Vector3(x, 0, -2.6),
    focus: { position: new Vector3(x, 1.68, -2.4), target: new Vector3(x, y, wallZ) },
    moodLight: 0,
    noBox: true, // it's already hanging there — nothing to order
    available: true,
    done: false,
    marker: marker(scene, new Vector3(x, 0, -2.6)),
    showPending() {
      if (shown) return
      shown = true
      pic.root.rotation.z = 0.34 // hangs crooked
    },
    createPhases(ctx) {
      return [
        () =>
          new RotatePuzzle(ctx, pic.root, pic.pick, {
            startAngle: pic.root.rotation.z,
            tolerance: 0.05,
            hint: 'Grab the frame and drag sideways until it hangs level.',
          }),
      ]
    },
    finish() {
      this.done = true
    },
  }
  return st
}

// D) Set the kitchen counter (place ceramics into silhouettes).
function stationKitchen(scene: Scene): Station {
  const wallZ = -3.7 // cabinet centre; its back touches the wall face at z = -4.0
  const cx = 3.0
  const topY = 0.88 // countertop surface
  const group = new TransformNode('kitchen-group', scene)

  // persistent kitchen cabinet: kick plate, body, countertop, doors, handles
  const cabinet = new TransformNode('counter', scene)
  const kick = MeshBuilder.CreateBox('counter-kick', { width: 1.86, height: 0.1, depth: 0.5 }, scene)
  kick.material = flatMaterial(scene, 'counter-kick', PALETTE.plum, { emissiveScale: 0.18 })
  kick.parent = cabinet
  kick.position.set(cx, 0.05, wallZ - 0.02)
  const body = MeshBuilder.CreateBox('counter-body', { width: 2.0, height: 0.72, depth: 0.55 }, scene)
  body.material = flatMaterial(scene, 'counter', PALETTE.woodWarm, { emissiveScale: 0.2, texture: 'skin_wood_plank' })
  body.parent = cabinet
  body.position.set(cx, 0.46, wallZ)
  const slab = MeshBuilder.CreateBox('counter-top', { width: 2.12, height: 0.06, depth: 0.62 }, scene)
  slab.material = flatMaterial(scene, 'countertop', PALETTE.woodDeep, { emissiveScale: 0.2, texture: 'skin_wood_deep' })
  slab.parent = cabinet
  slab.position.set(cx, 0.85, wallZ + 0.02)
  for (const side of [-1, 1]) {
    const door = MeshBuilder.CreateBox(`counter-door${side}`, { width: 0.88, height: 0.56, depth: 0.025 }, scene)
    door.material = flatMaterial(scene, 'counter-door', PALETTE.floorPlank, { emissiveScale: 0.24, texture: 'skin_vanity_door' })
    door.parent = cabinet
    door.position.set(cx + side * 0.49, 0.44, wallZ + 0.285)
    const knob = MeshBuilder.CreateBox(`counter-knob${side}`, { width: 0.025, height: 0.11, depth: 0.03 }, scene)
    knob.material = flatMaterial(scene, 'counter-knob', PALETTE.bolt, { emissiveScale: 0.2 })
    knob.parent = cabinet
    knob.position.set(cx + side * 0.08, 0.46, wallZ + 0.3)
  }

  const mug = makeMug(scene, 'mug', PALETTE.mug)
  const plant = makePlant(scene, 'kplant')
  const kettle = makeKettle(scene, 'kettle')
  const items = [mug, plant, kettle]
  items.forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'kitchen-box', 1.4, 0.42, 0.5)
  boxPack.root.parent = group
  let shown = false
  let revealed = false

  // Items rest on the sheet behind the box (the box sits nearer the camera).
  const itemHomes = [
    new Vector3(cx - 0.5, 0.03, -2.72),
    new Vector3(cx, 0.03, -2.68),
    new Vector3(cx + 0.5, 0.03, -2.72),
  ]

  const revealItems = () => {
    showMat(group)
    items.forEach((p, i) => {
      p.root.rotationQuaternion = null
      p.root.scaling.setAll(1)
      p.root.rotation.set(0, 0, 0)
      if (revealed) {
        p.root.position.copyFrom(itemHomes[i])
        p.root.setEnabled(true)
      } else {
        popOut(scene, p.root, boxPack.root.position.add(new Vector3(0, 0.38, 0)), itemHomes[i], i * 0.12)
      }
    })
    revealed = true
  }

  const st: Station = {
    id: 'kitchen',
    title: 'Set the counter',
    approach: new Vector3(cx, 0, -2.5),
    focus: { position: new Vector3(cx, 1.55, -1.35), target: new Vector3(cx, 0.82, wallZ) },
    moodLight: 1,
    available: false, // unlocked when its parcel is carried in and set down
    done: false,
    marker: marker(scene, new Vector3(cx, 0, -2.5)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(cx, 0.44, -2.62)).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(cx, 0, -2.38)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the tape to unbox the kitchen things.')
      const placePhase = () => {
        const firstReveal = !revealed
        revealItems()
        const slots = [
            { id: 'mug', pos: new Vector3(cx - 0.55, topY, wallZ), ghost: ghostBox(scene, 0.12, 0.13, 0.12, new Vector3(cx - 0.55, topY + 0.065, wallZ)) },
            { id: 'plant', pos: new Vector3(cx, topY, wallZ - 0.02), ghost: ghostBox(scene, 0.24, 0.38, 0.24, new Vector3(cx, topY + 0.19, wallZ - 0.02)) },
            { id: 'kettle', pos: new Vector3(cx + 0.55, topY, wallZ), ghost: ghostBox(scene, 0.24, 0.28, 0.24, new Vector3(cx + 0.55, topY + 0.14, wallZ)) },
          ]
          const pieces = [
            { root: mug.root, pick: mug.pick, slotId: 'mug', home: itemHomes[0], sound: 'ceramic' as const, wrongHint: 'Each piece has its own spot on the counter.' },
            { root: plant.root, pick: plant.pick, slotId: 'plant', home: itemHomes[1], sound: 'ceramic' as const, wrongHint: 'The plant goes in the middle.' },
            { root: kettle.root, pick: kettle.pick, slotId: 'kettle', home: itemHomes[2], sound: 'ceramic' as const, wrongHint: 'Each piece has its own spot on the counter.' },
          ]
        return new DragPuzzle(ctx, pieces, slots, {
          hint: 'Place each piece onto its outline on the counter.',
          snapPx: 66,
          grabDelay: firstReveal ? 0.9 : 0,
        })
      }
      return [boxPhase, placePhase]
    },
    finish() {
      this.done = true
      hideMat(group)
    },
  }
  return st
}

// D2) Arrange the spice shelf — jars onto a little wall shelf, stepping evenly
// in height, either direction (a true ALTTL organizing rule; needs the counter).
function stationSpice(scene: Scene): Station {
  const cx = 3.0
  const shelfY = 1.3 // wall shelf centre, above the counter
  const wallZ = -3.93
  const topY = 0.88 // countertop surface — jars stage along its front edge
  const group = new TransformNode('spice-group', scene)

  // The little wall shelf the jars will live on (appears with the task).
  const plank = MeshBuilder.CreateBox('spice-shelf', { width: 1.1, height: 0.045, depth: 0.16 }, scene)
  plank.material = flatMaterial(scene, 'spice-shelf', PALETTE.woodWarm, { emissiveScale: 0.24, texture: 'skin_wood_plank' })
  plank.parent = group
  plank.position.set(cx, shelfY, wallZ)
  plank.isPickable = false
  plank.setEnabled(false)
  const brackets = [-1, 1].map((side) => {
    const b = MeshBuilder.CreateBox(`spice-brk${side}`, { width: 0.04, height: 0.1, depth: 0.12 }, scene)
    b.material = flatMaterial(scene, 'spice-brk', PALETTE.woodDeep, { emissiveScale: 0.2, texture: 'skin_wood_deep' })
    b.parent = group
    b.position.set(cx + side * 0.42, shelfY - 0.07, wallZ)
    b.isPickable = false
    b.setEnabled(false)
    return b
  })

  const jarHeights = [0.26, 0.22, 0.19, 0.16, 0.13]
  const jarColors = [PALETTE.book1, PALETTE.book2, PALETTE.book5, PALETTE.sky, PALETTE.book4]
  const jars = jarHeights.map((h, i) => makeSpiceJar(scene, `jar-${i}`, h, jarColors[i]))
  jars.forEach((j) => {
    j.root.parent = group
    j.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'spice-box', 0.9, 0.4, 0.45)
  boxPack.root.parent = group

  // Jars pop out of the floor box up onto the counter's front edge, out of
  // height order so the row doesn't arrive pre-solved.
  const jarXs = [0, -0.44, 0.44, -0.22, 0.22]
  const stager = new PartStager(
    scene,
    boxPack,
    jars.map((j, i) => ({ prop: j, home: new Vector3(cx + jarXs[i], topY, -3.45) })),
  )
  let shown = false

  const st: Station = {
    id: 'spices',
    title: 'Arrange the spice shelf',
    approach: new Vector3(3.4, 0, -2.35),
    focus: { position: new Vector3(cx, 1.52, -1.7), target: new Vector3(cx, 1.08, -3.8) },
    requires: 'kitchen',
    moodLight: 1,
    available: false,
    done: false,
    marker: marker(scene, new Vector3(3.4, 0, -2.35)),
    showPending() {
      if (shown) return
      shown = true
      plank.setEnabled(true)
      brackets.forEach((b) => b.setEnabled(true))
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(3.45, 0, -2.6)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the tape — the spice jars are packed inside.')
      const arrangePhase = () => {
        const first = stager.reveal()
        const xs = [-0.4, -0.2, 0, 0.2, 0.4]
        const slots = xs.map((dx) => ({
          pos: new Vector3(cx + dx, shelfY + 0.0225, wallZ),
          ghost: ghostBox(scene, 0.11, 0.2, 0.11, new Vector3(cx + dx, shelfY + 0.1225, wallZ)),
        }))
        const items = jars.map((j, i) => ({
          root: j.root,
          pick: j.pick,
          value: jarHeights[i],
          home: stager.parts[i].home,
          sound: 'ceramic' as const,
        }))
        return new ArrangePuzzle(ctx, items, slots, {
          hint: 'Line the jars up on the shelf so they step evenly.',
          wrongHint: 'Nearly — the jars want an even stair. Swap a couple.',
          snapPx: 55,
          grabDelay: first ? 1.0 : 0,
        })
      }
      return [boxPhase, arrangePhase]
    },
    finish() {
      this.done = true
    },
  }
  return st
}

// D3) Stack the plates — biggest first onto one spot on the counter; the order
// itself is the puzzle (needs the counter).
function stationPlates(scene: Scene): Station {
  const sx = 2.12 // stack point on the counter's left end
  const sz = -3.62
  const topY = 0.88
  const group = new TransformNode('plates-group', scene)

  const sizes = [0.34, 0.285, 0.235, 0.185]
  const plateColors = [PALETTE.appliance, PALETTE.sky, PALETTE.appliance, PALETTE.sky]
  const plates = sizes.map((d, i) => makePlate(scene, `plate-${i}`, d, plateColors[i]))
  plates.forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'plates-box', 0.9, 0.35, 0.45)
  boxPack.root.parent = group

  // Scattered on the dust sheet, out of size order.
  const stager = new PartStager(scene, boxPack, [
    { prop: plates[0], home: new Vector3(2.55, 0.055, -2.85) },
    { prop: plates[1], home: new Vector3(1.68, 0.055, -2.9) },
    { prop: plates[2], home: new Vector3(2.3, 0.055, -3.08) },
    { prop: plates[3], home: new Vector3(1.95, 0.055, -3.05) },
  ])
  let shown = false

  const st: Station = {
    id: 'plates',
    title: 'Stack the plates',
    approach: new Vector3(2.1, 0, -2.35),
    focus: { position: new Vector3(sx, 1.55, -1.35), target: new Vector3(sx, 0.72, -3.55) },
    requires: 'kitchen',
    moodLight: 1,
    available: false,
    done: false,
    marker: marker(scene, new Vector3(2.05, 0, -2.3)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(2.1, 0.44, -2.8), 1.6, 0.8).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(2.1, 0, -2.25)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the box open — the good plates are in there.')
      const stackPhase = () => {
        const first = stager.reveal()
        const base = new Vector3(sx, topY, sz)
        const items = plates.map((p, i) => ({
          root: p.root,
          pick: p.pick,
          value: sizes[i],
          height: 0.036,
          home: stager.parts[i].home,
          sound: 'ceramic' as const,
        }))
        return new StackPuzzle(ctx, items, base, {
          hint: 'Stack the plates on the counter — biggest first.',
          wrongHint: 'A bigger plate is still waiting below.',
          snapPx: 75,
          grabDelay: first ? 1.0 : 0,
          ghost: ghostBox(scene, 0.36, 0.04, 0.36, new Vector3(sx, topY + 0.02, sz)),
        })
      }
      return [boxPhase, stackPhase]
    },
    finish() {
      this.done = true
      hideMat(group)
    },
  }
  return st
}

// E) Build the sofa — frame against the mid wall, bolt the arms, then cushions.
function stationSofa(scene: Scene, house: House): Station {
  const cx = -2
  const backZ = 3.58 // sofa centre; its back touches the mid wall at z = 4.0
  const group = new TransformNode('sofa-group', scene)

  const base = makeSofaBase(scene, 'sofa-base')
  const armL = makeSofaArm(scene, 'sofa-arm-l')
  const armR = makeSofaArm(scene, 'sofa-arm-r')
  const back = makeSofaBack(scene, 'sofa-back')
  const seatL = makeSeatCushion(scene, 'sofa-seat-l')
  const seatR = makeSeatCushion(scene, 'sofa-seat-r')
  const cushL = makeBackCushion(scene, 'sofa-cush-l')
  const cushR = makeBackCushion(scene, 'sofa-cush-r')
  ;[base, armL, armR, back, seatL, seatR, cushL, cushR].forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'sofa-box', 1.4, 0.5, 0.5)
  boxPack.root.parent = group

  // Bulky slabs rest on the floor beside the mat so they never hide a slot.
  const frameStager = new PartStager(scene, boxPack, [
    { prop: armL, home: new Vector3(cx - 0.75, 0.06, 2.5) },
    { prop: armR, home: new Vector3(cx + 0.75, 0.06, 2.5) },
    { prop: base, home: new Vector3(-3.95, 0.03, 3.2) },
    // the backrest leans on the east side so it stays inside the focus frame
    { prop: back, home: new Vector3(-0.2, 0.03, 2.9) },
  ])
  // Flat-lying back cushions up front, taller seat cushions behind them, so
  // nothing on the mat hides anything else from the focus camera.
  // One row: seats inboard, flat-lying back cushions outboard — everything
  // low, everything inside the frame.
  const cushionStager = new PartStager(scene, boxPack, [
    { prop: seatL, home: new Vector3(cx - 0.45, 0.06, 2.75) },
    { prop: seatR, home: new Vector3(cx + 0.45, 0.06, 2.75) },
    { prop: cushL, home: new Vector3(cx - 1.25, 0.1, 2.75), rot: new Vector3(-Math.PI / 2, 0, 0) },
    { prop: cushR, home: new Vector3(cx + 1.25, 0.1, 2.75), rot: new Vector3(-Math.PI / 2, 0, 0) },
  ])
  const boltP = boltRun(scene, group, [
    new Vector3(cx - 0.93, 0.565, 3.45),
    new Vector3(cx + 0.93, 0.565, 3.45),
  ])
  let shown = false

  const st: Station = {
    id: 'sofa',
    title: 'Build the sofa',
    approach: new Vector3(cx, 0, 2.0),
    focus: { position: new Vector3(cx, 1.82, 0.35), target: new Vector3(cx, 0.55, 3.35) },
    moodLight: 0,
    available: false, // unlocked when its parcel is carried in and set down
    done: false,
    marker: marker(scene, new Vector3(cx, 0, 2.0)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(cx, 0.44, 2.5), 2.2, 1.1).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(cx, 0, 1.9)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the box open — the whole sofa is in there.')
      const framePhase = () => {
        const first = frameStager.reveal()
        const armHint = 'The armrests stand at the two ends of the base.'
        return new DragPuzzle(
          ctx,
          [
            { root: armL.root, pick: armL.pick, slotId: ['AL', 'AR'], home: frameStager.parts[0].home, sound: 'wood', wrongHint: armHint },
            { root: armR.root, pick: armR.pick, slotId: ['AL', 'AR'], home: frameStager.parts[1].home, sound: 'wood', wrongHint: armHint },
            { root: base.root, pick: base.pick, slotId: 'BASE', home: frameStager.parts[2].home, sound: 'wood', wrongHint: 'The wide base sits flat on the floor first.' },
            { root: back.root, pick: back.pick, slotId: 'BACK', home: frameStager.parts[3].home, homeRot: frameStager.parts[3].rot, sound: 'wood', wrongHint: 'The backrest stands along the rear edge of the base.' },
          ],
          [
            { id: 'AL', pos: new Vector3(cx - 0.93, 0, backZ), ghost: ghostBox(scene, 0.28, 0.58, 0.82, new Vector3(cx - 0.93, 0.29, backZ)) },
            { id: 'AR', pos: new Vector3(cx + 0.93, 0, backZ), ghost: ghostBox(scene, 0.28, 0.58, 0.82, new Vector3(cx + 0.93, 0.29, backZ)) },
            { id: 'BASE', pos: new Vector3(cx, 0, backZ), ghost: ghostBox(scene, 1.66, 0.44, 0.8, new Vector3(cx, 0.22, backZ)) },
            { id: 'BACK', pos: new Vector3(cx, 0.42, 3.84), ghost: ghostBox(scene, 1.62, 0.62, 0.22, new Vector3(cx, 0.73, 3.84)) },
          ],
          { hint: 'Drag the frame pieces onto their glowing outlines.', snapPx: 60, grabDelay: first ? 1.2 : 0 },
        )
      }
      const cushionPhase = () => {
        const first = cushionStager.reveal()
        const seatHint = 'The flat cushions lie on the seat.'
        const backHint = 'The upright cushions lean against the backrest.'
        return new DragPuzzle(
          ctx,
          [
            { root: seatL.root, pick: seatL.pick, slotId: ['SL', 'SR'], home: cushionStager.parts[0].home, sound: 'ceramic', wrongHint: seatHint },
            { root: seatR.root, pick: seatR.pick, slotId: ['SL', 'SR'], home: cushionStager.parts[1].home, sound: 'ceramic', wrongHint: seatHint },
            { root: cushL.root, pick: cushL.pick, slotId: ['CL', 'CR'], home: cushionStager.parts[2].home, homeRot: cushionStager.parts[2].rot, sound: 'ceramic', wrongHint: backHint },
            { root: cushR.root, pick: cushR.pick, slotId: ['CL', 'CR'], home: cushionStager.parts[3].home, homeRot: cushionStager.parts[3].rot, sound: 'ceramic', wrongHint: backHint },
          ],
          [
            { id: 'SL', pos: new Vector3(cx - 0.39, 0.42, 3.5), ghost: ghostBox(scene, 0.78, 0.24, 0.68, new Vector3(cx - 0.39, 0.54, 3.5)) },
            { id: 'SR', pos: new Vector3(cx + 0.39, 0.42, 3.5), ghost: ghostBox(scene, 0.78, 0.24, 0.68, new Vector3(cx + 0.39, 0.54, 3.5)) },
            { id: 'CL', pos: new Vector3(cx - 0.39, 0.62, 3.78), ghost: ghostBox(scene, 0.76, 0.46, 0.2, new Vector3(cx - 0.39, 0.85, 3.78)) },
            { id: 'CR', pos: new Vector3(cx + 0.39, 0.62, 3.78), ghost: ghostBox(scene, 0.76, 0.46, 0.2, new Vector3(cx + 0.39, 0.85, 3.78)) },
          ],
          { hint: 'Plump the cushions into place.', snapPx: 55, grabDelay: first ? 1.0 : 0 },
        )
      }
      return [boxPhase, framePhase, boltP(ctx), cushionPhase]
    },
    finish() {
      this.done = true
      hideMat(group)
      house.colliders.push({ minX: cx - 1.07, maxX: cx + 1.07, minZ: 3.15, maxZ: 4 })
    },
  }
  return st
}

// F) Assemble the coffee table on the rug — legs, lower shelf, top, four bolts.
function stationTable(scene: Scene, house: House): Station {
  const cx = -2
  const cz = 1.35
  const group = new TransformNode('table-group', scene)

  const top = makeTableTop(scene, 'table-top')
  const shelf = makeTableShelf(scene, 'table-shelf')
  const legs = [0, 1, 2, 3].map((i) => makeTableLeg(scene, `table-leg-${i}`))
  ;[top, shelf, ...legs].forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'table-box', 1.3, 0.42, 0.5)
  boxPack.root.parent = group

  const stager = new PartStager(scene, boxPack, [
    { prop: legs[0], home: new Vector3(cx - 0.9, 0.06, 0.7) },
    { prop: legs[1], home: new Vector3(cx - 0.45, 0.06, 0.62) },
    { prop: legs[2], home: new Vector3(cx + 0.45, 0.06, 0.62) },
    { prop: legs[3], home: new Vector3(cx + 0.9, 0.06, 0.7) },
    // The two planks wait on the rug either side of the mat, clear of the
    // sight lines to the leg and shelf outlines.
    { prop: shelf, home: new Vector3(cx - 1.3, 0.03, 0.9) },
    { prop: top, home: new Vector3(cx + 1.3, 0.03, 0.9) },
  ])
  const legIds = ['L1', 'L2', 'L3', 'L4']
  const legPos = [
    new Vector3(cx - 0.46, 0, cz - 0.22),
    new Vector3(cx + 0.46, 0, cz - 0.22),
    new Vector3(cx - 0.46, 0, cz + 0.22),
    new Vector3(cx + 0.46, 0, cz + 0.22),
  ]
  const boltP = boltRun(scene, group, legPos.map((p) => new Vector3(p.x, 0.505, p.z)))
  let shown = false

  const st: Station = {
    id: 'table',
    title: 'Assemble the coffee table',
    approach: new Vector3(cx, 0, 0.4),
    focus: { position: new Vector3(cx, 1.75, -0.35), target: new Vector3(cx, 0.35, 1.4) },
    moodLight: 0,
    available: false, // unlocked when its parcel is carried in and set down
    done: false,
    marker: marker(scene, new Vector3(cx, 0, 0.4)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(cx, 0.44, 0.6), 2.4, 1.0).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(cx, 0, 0.25)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the tape — the coffee table is flat-packed inside.')
      const placePhase = () => {
        const first = stager.reveal()
        const legHint = 'A leg stands at each corner.'
        const pieces = legs.map((leg, i) => ({
          root: leg.root,
          pick: leg.pick,
          slotId: legIds,
          home: stager.parts[i].home,
          sound: 'wood' as const,
          wrongHint: legHint,
        }))
        pieces.push(
          { root: shelf.root, pick: shelf.pick, slotId: ['SH'], home: stager.parts[4].home, sound: 'wood' as const, wrongHint: 'The small shelf slides in low, between the legs.' },
          { root: top.root, pick: top.pick, slotId: ['TP'], home: stager.parts[5].home, sound: 'wood' as const, wrongHint: 'The big top lies flat across the legs.' },
        )
        return new DragPuzzle(
          ctx,
          pieces,
          [
            ...legPos.map((p, i) => ({ id: legIds[i], pos: p, ghost: ghostBox(scene, 0.09, 0.46, 0.09, new Vector3(p.x, 0.23, p.z)) })),
            { id: 'SH', pos: new Vector3(cx, 0.12, cz), ghost: ghostBox(scene, 0.94, 0.06, 0.52, new Vector3(cx, 0.15, cz)) },
            { id: 'TP', pos: new Vector3(cx, 0.44, cz), ghost: ghostBox(scene, 1.12, 0.08, 0.64, new Vector3(cx, 0.47, cz)) },
          ],
          { hint: 'Drag each piece onto its glowing outline.', snapPx: 55, grabDelay: first ? 1.2 : 0 },
        )
      }
      return [boxPhase, placePhase, boltP(ctx)]
    },
    finish() {
      this.done = true
      hideMat(group)
      house.colliders.push({ minX: cx - 0.62, maxX: cx + 0.62, minZ: cz - 0.38, maxZ: cz + 0.38 })
    },
  }
  return st
}

// G) Build the bed — boards, rails and slats, then bolt the rails to the posts.
function stationBed(scene: Scene, house: House): Station {
  const cx = -2.3
  const group = new TransformNode('bed-group', scene)

  const head = makeHeadboard(scene, 'bed-head')
  const foot = makeFootboard(scene, 'bed-foot')
  const railL = makeBedRail(scene, 'bed-rail-l')
  const railR = makeBedRail(scene, 'bed-rail-r')
  const slats = [0, 1, 2].map((i) => makeBedSlat(scene, `bed-slat-${i}`))
  ;[head, foot, railL, railR, ...slats].forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'bed-box', 1.4, 0.5, 0.5)
  boxPack.root.parent = group

  const sideways = new Vector3(0, Math.PI / 2, 0) // rails lie across the sheet, spin into place
  const stager = new PartStager(scene, boxPack, [
    { prop: railL, home: new Vector3(cx, 0.06, 6.2), rot: sideways },
    { prop: railR, home: new Vector3(cx, 0.06, 6.42), rot: sideways },
    { prop: slats[0], home: new Vector3(cx, 0.05, 6.68) },
    { prop: slats[1], home: new Vector3(cx, 0.05, 6.9) },
    { prop: slats[2], home: new Vector3(cx, 0.05, 7.12) },
    { prop: head, home: new Vector3(-4.1, 0.03, 6.9) },
    { prop: foot, home: new Vector3(-4.0, 0.03, 6.6) },
  ])
  const boltP = boltRun(scene, group, [
    new Vector3(cx - 0.77, 0.32, 7.55),
    new Vector3(cx - 0.77, 0.32, 8.75),
    new Vector3(cx + 0.77, 0.32, 7.55),
    new Vector3(cx + 0.77, 0.32, 8.75),
  ])
  let shown = false

  const st: Station = {
    id: 'bed',
    title: 'Build the bed',
    approach: new Vector3(cx, 0, 6.1),
    focus: { position: new Vector3(cx, 1.95, 4.85), target: new Vector3(cx, 0.55, 8.1) },
    moodLight: 2,
    available: false, // unlocked when its parcel is carried in and set down
    done: false,
    marker: marker(scene, new Vector3(cx, 0, 6.1)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(cx, 0.44, 6.55), 2.2, 1.4).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(cx, 0, 5.85)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the box open — bed frame, rails and slats.')
      const placePhase = () => {
        const first = stager.reveal()
        const railHint = 'The long rails run down the two sides.'
        const slatHint = 'The slats lie flat across the rails.'
        const slatIds = ['S1', 'S2', 'S3']
        return new DragPuzzle(
          ctx,
          [
            { root: railL.root, pick: railL.pick, slotId: ['RL', 'RR'], home: stager.parts[0].home, homeRot: sideways, sound: 'wood', wrongHint: railHint },
            { root: railR.root, pick: railR.pick, slotId: ['RL', 'RR'], home: stager.parts[1].home, homeRot: sideways, sound: 'wood', wrongHint: railHint },
            ...slats.map((s, i) => ({ root: s.root, pick: s.pick, slotId: slatIds, home: stager.parts[2 + i].home, sound: 'wood' as const, wrongHint: slatHint })),
            { root: head.root, pick: head.pick, slotId: 'HEAD', home: stager.parts[5].home, sound: 'wood', wrongHint: 'The tall headboard stands against the wall.' },
            { root: foot.root, pick: foot.pick, slotId: 'FOOT', home: stager.parts[6].home, sound: 'wood', wrongHint: 'The low footboard closes the near end.' },
          ],
          [
            { id: 'RL', pos: new Vector3(cx - 0.77, 0.18, 8.11), ghost: ghostBox(scene, 0.07, 0.18, 1.58, new Vector3(cx - 0.77, 0.27, 8.11)) },
            { id: 'RR', pos: new Vector3(cx + 0.77, 0.18, 8.11), ghost: ghostBox(scene, 0.07, 0.18, 1.58, new Vector3(cx + 0.77, 0.27, 8.11)) },
            { id: 'S1', pos: new Vector3(cx, 0.34, 7.6), ghost: ghostBox(scene, 1.42, 0.06, 0.24, new Vector3(cx, 0.37, 7.6)) },
            { id: 'S2', pos: new Vector3(cx, 0.34, 8.1), ghost: ghostBox(scene, 1.42, 0.06, 0.24, new Vector3(cx, 0.37, 8.1)) },
            { id: 'S3', pos: new Vector3(cx, 0.34, 8.6), ghost: ghostBox(scene, 1.42, 0.06, 0.24, new Vector3(cx, 0.37, 8.6)) },
            { id: 'HEAD', pos: new Vector3(cx, 0, 8.93), ghost: ghostBox(scene, 1.56, 0.97, 0.12, new Vector3(cx, 0.48, 8.93)) },
            { id: 'FOOT', pos: new Vector3(cx, 0, 7.3), ghost: ghostBox(scene, 1.56, 0.52, 0.12, new Vector3(cx, 0.26, 7.3)) },
          ],
          { hint: 'Drag each frame piece onto its glowing outline.', snapPx: 55, grabDelay: first ? 1.2 : 0 },
        )
      }
      return [boxPhase, placePhase, boltP(ctx)]
    },
    finish() {
      this.done = true
      hideMat(group)
      house.colliders.push({ minX: cx - 0.85, maxX: cx + 0.85, minZ: 7.2, maxZ: 9 })
    },
  }
  return st
}

// H) Make the bed — mattress first, then duvet and pillows (needs the frame).
function stationBedding(scene: Scene, house: House): Station {
  void house
  const cx = -2.3
  const group = new TransformNode('bedding-group', scene)

  const mattress = makeMattress(scene, 'mattress')
  const duvet = makeDuvet(scene, 'duvet')
  const pillowL = makePillow(scene, 'pillow-l')
  const pillowR = makePillow(scene, 'pillow-r')
  ;[mattress, duvet, pillowL, pillowR].forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'bedding-box', 1.2, 0.45, 0.5)
  boxPack.root.parent = group

  const mattressStager = new PartStager(scene, boxPack, [
    { prop: mattress, home: new Vector3(-4.1, 0.03, 6.6) },
  ])
  const dressStager = new PartStager(scene, boxPack, [
    { prop: duvet, home: new Vector3(-0.55, 0.03, 6.5) },
    { prop: pillowL, home: new Vector3(cx - 0.45, 0.06, 6.35) },
    { prop: pillowR, home: new Vector3(cx + 0.45, 0.06, 6.35) },
  ])
  let shown = false

  const st: Station = {
    id: 'bedding',
    title: 'Make the bed',
    approach: new Vector3(cx, 0, 6.1),
    focus: { position: new Vector3(cx, 2.0, 4.9), target: new Vector3(cx, 0.7, 8.1) },
    requires: 'bed',
    moodLight: 2,
    available: false,
    done: false,
    marker: marker(scene, new Vector3(cx + 0.05, 0, 5.9)),
    showPending() {
      if (shown) return
      shown = true
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(cx, 0, 5.85)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the box of soft things open.')
      const mattressPhase = () => {
        const first = mattressStager.reveal()
        return new DragPuzzle(
          ctx,
          [{ root: mattress.root, pick: mattress.pick, slotId: 'M', home: mattressStager.parts[0].home, sound: 'ceramic', wrongHint: 'The mattress lies flat on the slats.' }],
          [{ id: 'M', pos: new Vector3(cx, 0.36, 8.11), ghost: ghostBox(scene, 1.46, 0.28, 1.74, new Vector3(cx, 0.5, 8.11)) }],
          { hint: 'Heave the mattress onto the slats.', snapPx: 80, grabDelay: first ? 1.0 : 0 },
        )
      }
      const dressPhase = () => {
        const first = dressStager.reveal()
        const pillowHint = 'The pillows sit side by side at the head.'
        return new DragPuzzle(
          ctx,
          [
            { root: duvet.root, pick: duvet.pick, slotId: 'D', home: dressStager.parts[0].home, sound: 'ceramic', wrongHint: 'The duvet covers the foot of the mattress.' },
            { root: pillowL.root, pick: pillowL.pick, slotId: ['P1', 'P2'], home: dressStager.parts[1].home, sound: 'ceramic', wrongHint: pillowHint },
            { root: pillowR.root, pick: pillowR.pick, slotId: ['P1', 'P2'], home: dressStager.parts[2].home, sound: 'ceramic', wrongHint: pillowHint },
          ],
          [
            { id: 'D', pos: new Vector3(cx, 0.6, 7.9), ghost: ghostBox(scene, 1.52, 0.16, 1.24, new Vector3(cx, 0.68, 7.9)) },
            { id: 'P1', pos: new Vector3(cx - 0.42, 0.6, 8.65), ghost: ghostBox(scene, 0.58, 0.18, 0.38, new Vector3(cx - 0.42, 0.69, 8.65)) },
            { id: 'P2', pos: new Vector3(cx + 0.42, 0.6, 8.65), ghost: ghostBox(scene, 0.58, 0.18, 0.38, new Vector3(cx + 0.42, 0.69, 8.65)) },
          ],
          { hint: 'Duvet over the foot, pillows at the head.', snapPx: 60, grabDelay: first ? 1.0 : 0 },
        )
      }
      return [boxPhase, mattressPhase, dressPhase]
    },
    finish() {
      this.done = true
    },
  }
  return st
}

// I) Fit out the bathroom vanity — cabinet, top, basin, fittings, two bolts.
function stationVanity(scene: Scene, house: House): Station {
  const cx = 3.1
  const wallZ = 8.96 // south wall inner face at z = 9
  const group = new TransformNode('vanity-group', scene)

  const body = makeVanityBody(scene, 'vanity-body')
  const top = makeVanityTop(scene, 'vanity-top')
  const basin = makeBasin(scene, 'vanity-basin')
  const faucet = makeFaucet(scene, 'vanity-faucet')
  const mirror = makeMirror(scene, 'vanity-mirror')
  const towel = makeTowelRail(scene, 'vanity-towel')
  const plant = makePlant(scene, 'vanity-plant')
  const cup = makeMug(scene, 'vanity-cup', PALETTE.sky)
  ;[body, top, basin, faucet, mirror, towel, plant, cup].forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'vanity-box', 1.2, 0.45, 0.5)
  boxPack.root.parent = group

  // The bulky cabinet waits on the floor by the tub; the box pops it out last.
  const stager = new PartStager(scene, boxPack, [
    { prop: basin, home: new Vector3(2.7, 0.04, 6.9) },
    { prop: faucet, home: new Vector3(3.15, 0.12, 7.05) },
    { prop: plant, home: new Vector3(2.2, 0.03, 6.95) },
    { prop: cup, home: new Vector3(3.35, 0.03, 7.32) },
    { prop: top, home: new Vector3(2.55, 0.05, 7.42) },
    { prop: mirror, home: new Vector3(2.15, 0.36, 7.62) },
    { prop: towel, home: new Vector3(3.6, 0.42, 7.55) },
    { prop: body, home: new Vector3(4.35, 0.03, 7.35) },
  ])
  const boltP = boltRun(scene, group, [
    new Vector3(cx - 0.38, 0.65, 8.5),
    new Vector3(cx + 0.38, 0.65, 8.5),
  ])
  let shown = false

  const st: Station = {
    id: 'vanity',
    title: 'Fit the bathroom vanity',
    approach: new Vector3(cx, 0, 6.5),
    focus: { position: new Vector3(cx, 2.0, 5.35), target: new Vector3(cx, 0.85, 8.85) },
    moodLight: 3,
    available: false, // unlocked when its parcel is carried in and set down
    done: false,
    marker: marker(scene, new Vector3(cx, 0, 6.5)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(cx, 0.44, 7.2), 2.3, 1.0).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(3.9, 0, 7.0)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the tape to unpack the vanity.')
      const placePhase = () => {
        const first = stager.reveal()
        return new DragPuzzle(
          ctx,
          [
            { root: basin.root, pick: basin.pick, slotId: 'BASIN', home: stager.parts[0].home, sound: 'ceramic', wrongHint: 'The basin sits in the middle of the countertop.' },
            { root: faucet.root, pick: faucet.pick, slotId: 'FAUCET', home: stager.parts[1].home, sound: 'ceramic', wrongHint: 'The faucet mounts on the wall, over the basin.' },
            { root: plant.root, pick: plant.pick, slotId: 'PLANT', home: stager.parts[2].home, sound: 'ceramic', wrongHint: 'The plant takes the left end of the counter.' },
            { root: cup.root, pick: cup.pick, slotId: 'CUP', home: stager.parts[3].home, sound: 'ceramic', wrongHint: 'The toothbrush cup goes on the right.' },
            { root: top.root, pick: top.pick, slotId: 'TOP', home: stager.parts[4].home, sound: 'wood', wrongHint: 'The countertop lies across the cabinet.' },
            { root: mirror.root, pick: mirror.pick, slotId: 'MIRROR', home: stager.parts[5].home, sound: 'wood', wrongHint: 'The mirror hangs high on the wall.' },
            { root: towel.root, pick: towel.pick, slotId: 'TOWEL', home: stager.parts[6].home, sound: 'wood', wrongHint: 'The towel rail mounts beside the vanity.' },
            { root: body.root, pick: body.pick, slotId: 'BODY', home: stager.parts[7].home, sound: 'wood', wrongHint: 'The cabinet backs against the wall.' },
          ],
          [
            { id: 'BODY', pos: new Vector3(cx, 0, 8.72), ghost: ghostBox(scene, 0.98, 0.68, 0.5, new Vector3(cx, 0.34, 8.72)) },
            { id: 'TOP', pos: new Vector3(cx, 0.62, 8.7), ghost: ghostBox(scene, 1.06, 0.09, 0.58, new Vector3(cx, 0.645, 8.7)) },
            { id: 'BASIN', pos: new Vector3(cx, 0.67, 8.68), ghost: ghostBox(scene, 0.38, 0.16, 0.38, new Vector3(cx, 0.75, 8.68)) },
            { id: 'FAUCET', pos: new Vector3(cx, 1.02, wallZ), ghost: ghostBox(scene, 0.18, 0.2, 0.2, new Vector3(cx, 1.02, 8.9)) },
            { id: 'MIRROR', pos: new Vector3(cx, 1.55, wallZ), ghost: ghostBox(scene, 0.54, 0.68, 0.08, new Vector3(cx, 1.55, wallZ)) },
            { id: 'TOWEL', pos: new Vector3(4.15, 1.08, wallZ), ghost: ghostBox(scene, 0.52, 0.52, 0.1, new Vector3(4.15, 0.95, 8.93)) },
            { id: 'PLANT', pos: new Vector3(cx - 0.4, 0.67, 8.7), ghost: ghostBox(scene, 0.24, 0.38, 0.24, new Vector3(cx - 0.4, 0.86, 8.7)) },
            { id: 'CUP', pos: new Vector3(cx + 0.4, 0.67, 8.7), ghost: ghostBox(scene, 0.12, 0.13, 0.12, new Vector3(cx + 0.4, 0.735, 8.7)) },
          ],
          { hint: 'Drag each piece onto its glowing outline.', snapPx: 55, grabDelay: first ? 1.2 : 0 },
        )
      }
      return [boxPhase, placePhase, boltP(ctx)]
    },
    finish() {
      this.done = true
      hideMat(group)
      house.colliders.push({ minX: 2.55, maxX: 3.65, minZ: 8.4, maxZ: 9 })
    },
  }
  return st
}

// J) Assemble the wardrobe — the biggest flat-pack in the house: carcass,
// bolts, interior fit-out (shelf + rail), more bolts, then hang the two doors.
function stationWardrobe(scene: Scene, house: House): Station {
  const cx = -0.7
  const wallZ = 4.38 // carcass centre; its back touches the mid wall's bedroom face
  const group = new TransformNode('wardrobe-group', scene)

  const sideL = makeWardrobeSide(scene, 'wrd-side-l')
  const sideR = makeWardrobeSide(scene, 'wrd-side-r')
  const basePlank = makeWardrobePlank(scene, 'wrd-base', PALETTE.woodDeep)
  const crown = makeWardrobePlank(scene, 'wrd-crown')
  const backL = makeWardrobeBack(scene, 'wrd-back-l')
  const backR = makeWardrobeBack(scene, 'wrd-back-r')
  const shelf = makeWardrobePlank(scene, 'wrd-shelf')
  const rail = makeWardrobeRail(scene, 'wrd-rail')
  const doorL = makeWardrobeDoor(scene, 'wrd-door-l', -1)
  const doorR = makeWardrobeDoor(scene, 'wrd-door-r', 1)
  ;[sideL, sideR, basePlank, crown, backL, backR, shelf, rail, doorL, doorR].forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'wardrobe-box', 1.5, 0.55, 0.55)
  boxPack.root.parent = group

  const flat = new Vector3(-Math.PI / 2, 0, 0) // tall boards lie flat on the sheet
  // Sides stand left of the sightline; planks stack right; back boards and
  // doors lie flat so nothing hides the carcass from the focus camera.
  const carcassStager = new PartStager(scene, boxPack, [
    { prop: sideL, home: new Vector3(-1.55, 0, 5.2) },
    { prop: sideR, home: new Vector3(-1.3, 0, 5.2) },
    { prop: basePlank, home: new Vector3(0.1, 0, 5.15) },
    { prop: crown, home: new Vector3(0.1, 0, 5.5) },
    { prop: backL, home: new Vector3(-0.75, 0.05, 5.75), rot: flat },
    { prop: backR, home: new Vector3(-0.2, 0.05, 5.75), rot: flat },
  ])
  const interiorStager = new PartStager(scene, boxPack, [
    { prop: shelf, home: new Vector3(0.1, 0, 5.3) },
    { prop: rail, home: new Vector3(-1.4, 0.05, 5.6) },
  ])
  const doorStager = new PartStager(scene, boxPack, [
    { prop: doorL, home: new Vector3(-1.6, 0.05, 5.15), rot: flat },
    { prop: doorR, home: new Vector3(0.25, 0.05, 5.15), rot: flat },
  ])
  // Carcass bolts: down through the crown into the sides, and through the base.
  const carcassBolts = boltRun(scene, group, [
    new Vector3(cx - 0.44, 1.915, 4.5),
    new Vector3(cx + 0.44, 1.915, 4.5),
    new Vector3(cx - 0.44, 0.065, 4.5),
    new Vector3(cx + 0.44, 0.065, 4.5),
  ])
  // Interior bolts: down through the top shelf into each side.
  const shelfBolts = boltRun(scene, group, [
    new Vector3(cx - 0.44, 1.515, 4.5),
    new Vector3(cx + 0.44, 1.515, 4.5),
  ])
  let shown = false

  const st: Station = {
    id: 'wardrobe',
    title: 'Assemble the wardrobe',
    approach: new Vector3(cx, 0, 5.9),
    focus: { position: new Vector3(cx, 1.85, 6.75), target: new Vector3(cx, 0.95, 4.4) },
    moodLight: 2,
    available: false, // unlocked when its parcel is carried in and set down
    done: false,
    marker: marker(scene, new Vector3(cx, 0, 5.9)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(-0.55, 0.44, 5.5), 2.1, 0.95).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(-0.55, 0, 6.2)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the tape — the whole wardrobe is flat-packed in there.')
      const carcassPhase = () => {
        const first = carcassStager.reveal()
        const sideHint = 'The tall side panels stand at the two ends.'
        const backHint = 'The back boards fill the frame against the wall.'
        return new DragPuzzle(
          ctx,
          [
            { root: sideL.root, pick: sideL.pick, slotId: ['WL', 'WR'], home: carcassStager.parts[0].home, sound: 'wood', wrongHint: sideHint },
            { root: sideR.root, pick: sideR.pick, slotId: ['WL', 'WR'], home: carcassStager.parts[1].home, sound: 'wood', wrongHint: sideHint },
            { root: basePlank.root, pick: basePlank.pick, slotId: 'WBASE', home: carcassStager.parts[2].home, sound: 'wood', wrongHint: 'The darker base plank sits on the floor between the sides.' },
            { root: crown.root, pick: crown.pick, slotId: 'CROWN', home: carcassStager.parts[3].home, sound: 'wood', wrongHint: 'The crown plank caps the very top.' },
            { root: backL.root, pick: backL.pick, slotId: ['BKL', 'BKR'], home: carcassStager.parts[4].home, homeRot: flat, sound: 'wood', wrongHint: backHint },
            { root: backR.root, pick: backR.pick, slotId: ['BKL', 'BKR'], home: carcassStager.parts[5].home, homeRot: flat, sound: 'wood', wrongHint: backHint },
          ],
          [
            { id: 'WL', pos: new Vector3(cx - 0.56, 0, wallZ), ghost: ghostBox(scene, 0.1, 1.9, 0.58, new Vector3(cx - 0.56, 0.93, wallZ)) },
            { id: 'WR', pos: new Vector3(cx + 0.56, 0, wallZ), ghost: ghostBox(scene, 0.1, 1.9, 0.58, new Vector3(cx + 0.56, 0.93, wallZ)) },
            { id: 'WBASE', pos: new Vector3(cx, 0, wallZ), ghost: ghostBox(scene, 1.08, 0.1, 0.58, new Vector3(cx, 0.05, wallZ)) },
            { id: 'CROWN', pos: new Vector3(cx, 1.85, wallZ), ghost: ghostBox(scene, 1.08, 0.1, 0.58, new Vector3(cx, 1.9, wallZ)) },
            { id: 'BKL', pos: new Vector3(cx - 0.265, 0, 4.13), ghost: ghostBox(scene, 0.54, 1.8, 0.06, new Vector3(cx - 0.265, 0.9, 4.13)) },
            { id: 'BKR', pos: new Vector3(cx + 0.265, 0, 4.13), ghost: ghostBox(scene, 0.54, 1.8, 0.06, new Vector3(cx + 0.265, 0.9, 4.13)) },
          ],
          { hint: 'Drag the carcass pieces onto their glowing outlines.', snapPx: 60, grabDelay: first ? 1.2 : 0 },
        )
      }
      const interiorPhase = () => {
        const first = interiorStager.reveal()
        return new DragPuzzle(
          ctx,
          [
            { root: shelf.root, pick: shelf.pick, slotId: 'WSHELF', home: interiorStager.parts[0].home, sound: 'wood', wrongHint: 'The shelf slides in up top.' },
            { root: rail.root, pick: rail.pick, slotId: 'WRAIL', home: interiorStager.parts[1].home, sound: 'wood', wrongHint: 'The hanging rail spans the middle, under the shelf.' },
          ],
          [
            { id: 'WSHELF', pos: new Vector3(cx, 1.45, wallZ), ghost: ghostBox(scene, 1.08, 0.1, 0.58, new Vector3(cx, 1.5, wallZ)) },
            { id: 'WRAIL', pos: new Vector3(cx, 1.25, wallZ), ghost: ghostBox(scene, 1.04, 0.12, 0.12, new Vector3(cx, 1.25, wallZ)) },
          ],
          { hint: 'Fit the shelf and the hanging rail inside.', snapPx: 60, grabDelay: first ? 1.0 : 0 },
        )
      }
      const doorPhase = () => {
        const first = doorStager.reveal()
        return new DragPuzzle(
          ctx,
          [
            { root: doorL.root, pick: doorL.pick, slotId: 'DL', home: doorStager.parts[0].home, homeRot: flat, sound: 'wood', wrongHint: 'Swap them — the knobs want to meet in the middle.' },
            { root: doorR.root, pick: doorR.pick, slotId: 'DR', home: doorStager.parts[1].home, homeRot: flat, sound: 'wood', wrongHint: 'Swap them — the knobs want to meet in the middle.' },
          ],
          [
            { id: 'DL', pos: new Vector3(cx - 0.265, 0.07, 4.68), ghost: ghostBox(scene, 0.53, 1.7, 0.06, new Vector3(cx - 0.265, 0.92, 4.68)) },
            { id: 'DR', pos: new Vector3(cx + 0.265, 0.07, 4.68), ghost: ghostBox(scene, 0.53, 1.7, 0.06, new Vector3(cx + 0.265, 0.92, 4.68)) },
          ],
          { hint: 'Hang the doors — knobs meet in the middle.', snapPx: 60, grabDelay: first ? 1.0 : 0 },
        )
      }
      return [boxPhase, carcassPhase, carcassBolts(ctx), interiorPhase, shelfBolts(ctx), doorPhase]
    },
    finish() {
      this.done = true
      hideMat(group)
      house.colliders.push({ minX: cx - 0.62, maxX: cx + 0.62, minZ: 4.05, maxZ: 4.75 })
    },
  }
  return st
}

// K) Build the writing desk — legs, apron and top against the west wall, bolt
// it square, assemble the chair from parts, then dress the desktop.
function stationDesk(scene: Scene, house: House): Station {
  const dx = -4.6 // desk centre; its back edge meets the west wall
  const cz = -1.2 // centred under the window
  const chx = -3.85 // chair centre, pulled up in front
  const group = new TransformNode('desk-group', scene)

  const deskLegs = [0, 1, 2, 3].map((i) => makeDeskLeg(scene, `desk-leg-${i}`))
  const apron = makeDeskApron(scene, 'desk-apron')
  const top = makeDeskTop(scene, 'desk-top')
  const chairLegs = [0, 1, 2, 3].map((i) => makeChairLeg(scene, `chair-leg-${i}`))
  const seat = makeChairSeat(scene, 'chair-seat')
  const chairBack = makeChairBack(scene, 'chair-back')
  const lamp = makeDeskLamp(scene, 'desk-lamp')
  const plant = makePlant(scene, 'desk-plant')
  const mug = makeMug(scene, 'desk-mug', PALETTE.book2)
  ;[...deskLegs, apron, top, ...chairLegs, seat, chairBack, lamp, plant, mug].forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'desk-box', 1.3, 0.45, 0.5)
  boxPack.root.parent = group

  const frameStager = new PartStager(scene, boxPack, [
    { prop: deskLegs[0], home: new Vector3(-4.1, 0, -1.2) },
    { prop: deskLegs[1], home: new Vector3(-3.8, 0, -1.25) },
    { prop: deskLegs[2], home: new Vector3(-3.5, 0, -1.2) },
    { prop: deskLegs[3], home: new Vector3(-3.2, 0, -1.25) },
    { prop: apron, home: new Vector3(-2.8, 0.16, -0.9) },
    { prop: top, home: new Vector3(-3.7, 0, -0.55) },
  ])
  const chairStager = new PartStager(scene, boxPack, [
    { prop: chairLegs[0], home: new Vector3(-4.05, 0, -0.75) },
    { prop: chairLegs[1], home: new Vector3(-3.75, 0, -0.7) },
    { prop: chairLegs[2], home: new Vector3(-3.45, 0, -0.75) },
    { prop: chairLegs[3], home: new Vector3(-3.15, 0, -0.7) },
    { prop: seat, home: new Vector3(-2.85, 0, -1.15) },
    { prop: chairBack, home: new Vector3(-2.75, 0, -0.75) },
  ])
  const dressStager = new PartStager(scene, boxPack, [
    { prop: lamp, home: new Vector3(-3.9, 0, -0.85) },
    { prop: plant, home: new Vector3(-3.45, 0, -0.9) },
    { prop: mug, home: new Vector3(-3.0, 0, -1.0) },
  ])
  const deskLegIds = ['DK1', 'DK2', 'DK3', 'DK4']
  const deskLegPos = [
    new Vector3(dx - 0.2, 0, cz - 0.5),
    new Vector3(dx + 0.2, 0, cz - 0.5),
    new Vector3(dx - 0.2, 0, cz + 0.5),
    new Vector3(dx + 0.2, 0, cz + 0.5),
  ]
  const boltP = boltRun(scene, group, deskLegPos.map((p) => new Vector3(p.x, 0.725, p.z)))
  let shown = false

  const st: Station = {
    id: 'desk',
    title: 'Build the writing desk',
    approach: new Vector3(-3.4, 0, -1.2),
    focus: { position: new Vector3(-2.85, 1.55, -1.2), target: new Vector3(-4.45, 0.5, -1.2) },
    moodLight: 0,
    available: false, // unlocked when its parcel is carried in and set down
    done: false,
    marker: marker(scene, new Vector3(-3.4, 0, -1.2)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(-3.4, 0.44, -0.9), 1.7, 0.85).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(-3.6, 0, -0.35)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the tape — desk, chair and all, in one box.')
      const deskPhase = () => {
        const first = frameStager.reveal()
        const legHint = 'A leg stands at each corner of the desk.'
        const pieces = deskLegs.map((leg, i) => ({
          root: leg.root,
          pick: leg.pick,
          slotId: deskLegIds,
          home: frameStager.parts[i].home,
          sound: 'wood' as const,
          wrongHint: legHint,
        }))
        pieces.push(
          { root: apron.root, pick: apron.pick, slotId: ['APRON'], home: frameStager.parts[4].home, sound: 'wood' as const, wrongHint: 'The thin panel stiffens the back, between the rear legs.' },
          { root: top.root, pick: top.pick, slotId: ['DTOP'], home: frameStager.parts[5].home, sound: 'wood' as const, wrongHint: 'The long top lies flat across the legs.' },
        )
        return new DragPuzzle(
          ctx,
          pieces,
          [
            ...deskLegPos.map((p, i) => ({ id: deskLegIds[i], pos: p, ghost: ghostBox(scene, 0.08, 0.68, 0.08, new Vector3(p.x, 0.34, p.z)) })),
            { id: 'APRON', pos: new Vector3(dx - 0.18, 0.47, cz), ghost: ghostBox(scene, 0.06, 0.34, 1.08, new Vector3(dx - 0.18, 0.47, cz)) },
            { id: 'DTOP', pos: new Vector3(dx, 0.66, cz), ghost: ghostBox(scene, 0.64, 0.1, 1.3, new Vector3(dx, 0.71, cz)) },
          ],
          { hint: 'Drag the desk pieces onto their glowing outlines.', snapPx: 55, grabDelay: first ? 1.2 : 0 },
        )
      }
      const chairPhase = () => {
        const first = chairStager.reveal()
        const chairLegIds = ['CH1', 'CH2', 'CH3', 'CH4']
        const chairLegPos = [
          new Vector3(chx - 0.15, 0, cz - 0.15),
          new Vector3(chx + 0.15, 0, cz - 0.15),
          new Vector3(chx - 0.15, 0, cz + 0.15),
          new Vector3(chx + 0.15, 0, cz + 0.15),
        ]
        const legHint = 'The slim chair legs gather under the seat.'
        const pieces = chairLegs.map((leg, i) => ({
          root: leg.root,
          pick: leg.pick,
          slotId: chairLegIds,
          home: chairStager.parts[i].home,
          sound: 'wood' as const,
          wrongHint: legHint,
        }))
        pieces.push(
          { root: seat.root, pick: seat.pick, slotId: ['SEAT'], home: chairStager.parts[4].home, sound: 'wood' as const, wrongHint: 'The padded seat rests on the four legs.' },
          { root: chairBack.root, pick: chairBack.pick, slotId: ['CBACK'], home: chairStager.parts[5].home, sound: 'wood' as const, wrongHint: 'The backrest stands up behind the seat.' },
        )
        return new DragPuzzle(
          ctx,
          pieces,
          [
            ...chairLegPos.map((p, i) => ({ id: chairLegIds[i], pos: p, ghost: ghostBox(scene, 0.07, 0.44, 0.07, new Vector3(p.x, 0.21, p.z)) })),
            { id: 'SEAT', pos: new Vector3(chx, 0.42, cz), ghost: ghostBox(scene, 0.46, 0.1, 0.46, new Vector3(chx, 0.47, cz)) },
            { id: 'CBACK', pos: new Vector3(chx + 0.17, 0.47, cz), ghost: ghostBox(scene, 0.1, 0.52, 0.46, new Vector3(chx + 0.17, 0.73, cz)) },
          ],
          { hint: 'Now the chair — legs, seat, then the backrest.', snapPx: 55, grabDelay: first ? 1.0 : 0 },
        )
      }
      const dressPhase = () => {
        const first = dressStager.reveal()
        return new DragPuzzle(
          ctx,
          [
            { root: lamp.root, pick: lamp.pick, slotId: 'DLAMP', home: dressStager.parts[0].home, sound: 'ceramic', wrongHint: 'The lamp lights the far end of the desk.' },
            { root: plant.root, pick: plant.pick, slotId: 'DPLANT', home: dressStager.parts[1].home, sound: 'ceramic', wrongHint: 'The plant takes the near end.' },
            { root: mug.root, pick: mug.pick, slotId: 'DMUG', home: dressStager.parts[2].home, sound: 'ceramic', wrongHint: 'The mug sits within reach, by the front edge.' },
          ],
          [
            { id: 'DLAMP', pos: new Vector3(dx, 0.72, cz - 0.42), ghost: ghostBox(scene, 0.16, 0.36, 0.16, new Vector3(dx, 0.9, cz - 0.42)) },
            { id: 'DPLANT', pos: new Vector3(dx, 0.72, cz + 0.42), ghost: ghostBox(scene, 0.24, 0.38, 0.24, new Vector3(dx, 0.91, cz + 0.42)) },
            { id: 'DMUG', pos: new Vector3(dx + 0.12, 0.72, cz + 0.1), ghost: ghostBox(scene, 0.12, 0.13, 0.12, new Vector3(dx + 0.12, 0.785, cz + 0.1)) },
          ],
          { hint: 'Dress the desktop — lamp, plant and a fresh mug.', snapPx: 60, grabDelay: first ? 0.9 : 0 },
        )
      }
      return [boxPhase, deskPhase, boltP(ctx), chairPhase, dressPhase]
    },
    finish() {
      this.done = true
      hideMat(group)
      house.colliders.push({ minX: -4.92, maxX: -4.28, minZ: cz - 0.66, maxZ: cz + 0.66 })
      house.colliders.push({ minX: chx - 0.22, maxX: chx + 0.22, minZ: cz - 0.22, maxZ: cz + 0.22 })
    },
  }
  return st
}

// L) Raise the floor lamp beside the sofa — base and poles, screw the bulb in,
// hood it with the shade, then straighten the shade (it always slips).
function stationLamp(scene: Scene, house: House): Station {
  const cx = -0.5
  const cz = 3.45
  const group = new TransformNode('lamp-group', scene)

  const base = makeLampBase(scene, 'lamp-base')
  const poleL = makeLampPole(scene, 'lamp-pole-l', 0.055)
  const poleU = makeLampPole(scene, 'lamp-pole-u', 0.04)
  const shade = makeLampShade(scene, 'lamp-shade')
  ;[base, poleL, poleU, shade].forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'lamp-box', 0.9, 0.4, 0.45)
  boxPack.root.parent = group

  const poleStager = new PartStager(scene, boxPack, [
    { prop: base, home: new Vector3(-1.0, 0, 2.95) },
    { prop: poleL, home: new Vector3(-0.55, 0, 2.9) },
    { prop: poleU, home: new Vector3(-0.2, 0, 2.95) },
  ])
  const shadeStager = new PartStager(scene, boxPack, [
    { prop: shade, home: new Vector3(-0.95, 0, 2.9) },
  ])
  let bulb: Prop | null = null
  let shown = false

  const st: Station = {
    id: 'lamp',
    title: 'Raise the floor lamp',
    approach: new Vector3(cx, 0, 2.6),
    focus: { position: new Vector3(cx, 1.5, 1.25), target: new Vector3(cx, 0.9, cz) },
    requires: 'sofa',
    moodLight: 0,
    available: false,
    done: false,
    marker: marker(scene, new Vector3(cx, 0, 2.6)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(-0.6, 0.44, 2.95), 1.4, 0.7).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(-0.5, 0, 2.2)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the box — the floor lamp comes in pieces.')
      const polePhase = () => {
        const first = poleStager.reveal()
        return new DragPuzzle(
          ctx,
          [
            { root: base.root, pick: base.pick, slotId: 'LBASE', home: poleStager.parts[0].home, sound: 'wood', wrongHint: 'The heavy disc base sits on the floor first.' },
            { root: poleL.root, pick: poleL.pick, slotId: 'LPL', home: poleStager.parts[1].home, sound: 'wood', wrongHint: 'The fatter pole goes at the bottom.' },
            { root: poleU.root, pick: poleU.pick, slotId: 'LPU', home: poleStager.parts[2].home, sound: 'wood', wrongHint: 'The slimmer pole stacks on top.' },
          ],
          [
            { id: 'LBASE', pos: new Vector3(cx, 0, cz), ghost: ghostBox(scene, 0.4, 0.14, 0.4, new Vector3(cx, 0.07, cz)) },
            { id: 'LPL', pos: new Vector3(cx, 0.1, cz), ghost: ghostBox(scene, 0.1, 0.66, 0.1, new Vector3(cx, 0.43, cz)) },
            { id: 'LPU', pos: new Vector3(cx, 0.72, cz), ghost: ghostBox(scene, 0.09, 0.66, 0.09, new Vector3(cx, 1.05, cz)) },
          ],
          { hint: 'Base first, then stack the poles — fat one below.', snapPx: 55, grabDelay: first ? 1.0 : 0 },
        )
      }
      const bulbPhase = () => {
        bulb?.root.dispose() // clear a leftover from an aborted attempt
        bulb = makeLampBulb(scene, 'lamp-bulb')
        bulb.root.parent = group
        bulb.root.position.set(cx, 1.415, cz)
        const ring = MeshBuilder.CreateTorus('ring', { diameter: 0.16, thickness: 0.02, tessellation: 20 }, scene)
        ring.material = glowMaterial(scene, 'ring', PALETTE.gold, 0.7)
        ring.position.set(cx, 1.46, cz)
        ring.scaling.setAll(0.2)
        ring.isPickable = false
        return new BoltPuzzle(
          ctx,
          [{ node: bulb.root, pick: bulb.pick[0], ring }],
          'Drag back and forth across the bulb to screw it in.',
        )
      }
      const shadePhase = () => {
        const first = shadeStager.reveal()
        return new DragPuzzle(
          ctx,
          [{ root: shade.root, pick: shade.pick, slotId: 'SHADE', home: shadeStager.parts[0].home, sound: 'ceramic', wrongHint: 'The shade hoods the bulb at the very top.' }],
          [{ id: 'SHADE', pos: new Vector3(cx, 1.36, cz), ghost: ghostBox(scene, 0.36, 0.32, 0.36, new Vector3(cx, 1.52, cz)) }],
          { hint: 'Crown the lamp with its shade.', snapPx: 70, grabDelay: first ? 0.9 : 0 },
        )
      }
      const straightenPhase = () => {
        // The shade slipped while you were fiddling — level it, like the picture.
        shade.root.rotationQuaternion = null
        return new RotatePuzzle(ctx, shade.root, shade.pick, {
          startAngle: 0.35,
          tolerance: 0.05,
          hint: 'The shade sits crooked — drag sideways until it sits level.',
        })
      }
      return [boxPhase, polePhase, bulbPhase, shadePhase, straightenPhase]
    },
    finish() {
      this.done = true
      hideMat(group)
      house.colliders.push({ minX: cx - 0.22, maxX: cx + 0.22, minZ: cz - 0.22, maxZ: cz + 0.22 })
    },
  }
  return st
}

// M) Set up the dining nook — pedestal table and stools in the kitchen corner,
// bolt the top down, then lay two place settings.
function stationDining(scene: Scene, house: House): Station {
  const tx = 3.7
  const tz = 1.6
  const group = new TransformNode('dining-group', scene)

  const pedestal = makeDiningPedestal(scene, 'din-pedestal')
  const top = makeDiningTop(scene, 'din-top')
  const stools = [0, 1].map((i) => makeStool(scene, `din-stool-${i}`))
  const plates = [0, 1].map((i) => makePlate(scene, `din-plate-${i}`, 0.26, i ? PALETTE.sky : PALETTE.appliance))
  const mugs = [makeMug(scene, 'din-mug-0', PALETTE.mug), makeMug(scene, 'din-mug-1', PALETTE.book2)]
  ;[pedestal, top, ...stools, ...plates, ...mugs].forEach((p) => {
    p.root.parent = group
    p.root.setEnabled(false)
  })
  const boxPack = makeTapedBox(scene, 'dining-box', 1.2, 0.45, 0.5)
  boxPack.root.parent = group

  const frameStager = new PartStager(scene, boxPack, [
    { prop: pedestal, home: new Vector3(2.2, 0, 1.7) },
    { prop: top, home: new Vector3(2.65, 0, 1.95) },
    { prop: stools[0], home: new Vector3(2.05, 0, 1.3) },
    { prop: stools[1], home: new Vector3(2.3, 0, 2.15) },
  ])
  const settingStager = new PartStager(scene, boxPack, [
    { prop: plates[0], home: new Vector3(2.5, 0.05, 1.4) },
    { prop: plates[1], home: new Vector3(2.9, 0.05, 1.7) },
    { prop: mugs[0], home: new Vector3(2.2, 0, 1.8) },
    { prop: mugs[1], home: new Vector3(2.75, 0, 2.1) },
  ])
  const boltP = boltRun(scene, group, [
    new Vector3(tx - 0.16, 0.705, tz),
    new Vector3(tx + 0.16, 0.705, tz),
  ])
  let shown = false

  const st: Station = {
    id: 'dining',
    title: 'Set up the dining nook',
    approach: new Vector3(3.3, 0, 0.55),
    focus: { position: new Vector3(tx, 1.62, -0.35), target: new Vector3(tx, 0.5, 1.7) },
    requires: 'kitchen',
    moodLight: 1,
    available: false,
    done: false,
    marker: marker(scene, new Vector3(3.3, 0, 0.55)),
    showPending() {
      if (shown) return
      shown = true
      stagingMat(scene, new Vector3(2.5, 0.44, 1.7), 1.5, 0.8).parent = group
      boxPack.root.setEnabled(true)
      boxPack.root.position.set(2.6, 0, 0.85)
    },
    createPhases(ctx) {
      const boxPhase = () =>
        new BoxCutterPuzzle(ctx, boxPack, 'Slice the tape — a little table for two.')
      const framePhase = () => {
        const first = frameStager.reveal()
        const stoolHint = 'A stool tucks in at each side.'
        return new DragPuzzle(
          ctx,
          [
            { root: pedestal.root, pick: pedestal.pick, slotId: 'PED', home: frameStager.parts[0].home, sound: 'wood', wrongHint: 'The pedestal stands in the middle first.' },
            { root: top.root, pick: top.pick, slotId: 'DTOP2', home: frameStager.parts[1].home, sound: 'wood', wrongHint: 'The round top rests on the pedestal.' },
            { root: stools[0].root, pick: stools[0].pick, slotId: ['ST1', 'ST2'], home: frameStager.parts[2].home, sound: 'wood', wrongHint: stoolHint },
            { root: stools[1].root, pick: stools[1].pick, slotId: ['ST1', 'ST2'], home: frameStager.parts[3].home, sound: 'wood', wrongHint: stoolHint },
          ],
          [
            { id: 'PED', pos: new Vector3(tx, 0, tz), ghost: ghostBox(scene, 0.52, 0.68, 0.52, new Vector3(tx, 0.34, tz)) },
            { id: 'DTOP2', pos: new Vector3(tx, 0.65, tz), ghost: ghostBox(scene, 0.94, 0.09, 0.94, new Vector3(tx, 0.695, tz)) },
            { id: 'ST1', pos: new Vector3(tx - 0.72, 0, tz), ghost: ghostBox(scene, 0.36, 0.54, 0.36, new Vector3(tx - 0.72, 0.27, tz)) },
            { id: 'ST2', pos: new Vector3(tx + 0.72, 0, tz), ghost: ghostBox(scene, 0.36, 0.54, 0.36, new Vector3(tx + 0.72, 0.27, tz)) },
          ],
          { hint: 'Pedestal, top, then a stool at each side.', snapPx: 60, grabDelay: first ? 1.2 : 0 },
        )
      }
      const settingPhase = () => {
        const first = settingStager.reveal()
        const plateHint = 'One plate for each place.'
        const mugHint = 'Each mug sits beside its plate.'
        return new DragPuzzle(
          ctx,
          [
            { root: plates[0].root, pick: plates[0].pick, slotId: ['P1', 'P2'], home: settingStager.parts[0].home, sound: 'ceramic', wrongHint: plateHint },
            { root: plates[1].root, pick: plates[1].pick, slotId: ['P1', 'P2'], home: settingStager.parts[1].home, sound: 'ceramic', wrongHint: plateHint },
            { root: mugs[0].root, pick: mugs[0].pick, slotId: ['M1', 'M2'], home: settingStager.parts[2].home, sound: 'ceramic', wrongHint: mugHint },
            { root: mugs[1].root, pick: mugs[1].pick, slotId: ['M1', 'M2'], home: settingStager.parts[3].home, sound: 'ceramic', wrongHint: mugHint },
          ],
          [
            { id: 'P1', pos: new Vector3(tx - 0.24, 0.7, tz), ghost: ghostBox(scene, 0.28, 0.06, 0.28, new Vector3(tx - 0.24, 0.73, tz)) },
            { id: 'P2', pos: new Vector3(tx + 0.24, 0.7, tz), ghost: ghostBox(scene, 0.28, 0.06, 0.28, new Vector3(tx + 0.24, 0.73, tz)) },
            { id: 'M1', pos: new Vector3(tx - 0.24, 0.7, tz + 0.27), ghost: ghostBox(scene, 0.12, 0.13, 0.12, new Vector3(tx - 0.24, 0.765, tz + 0.27)) },
            { id: 'M2', pos: new Vector3(tx + 0.24, 0.7, tz - 0.27), ghost: ghostBox(scene, 0.12, 0.13, 0.12, new Vector3(tx + 0.24, 0.765, tz - 0.27)) },
          ],
          { hint: 'Lay two settings — plates across from each other, mugs beside.', snapPx: 60, grabDelay: first ? 1.0 : 0 },
        )
      }
      return [boxPhase, framePhase, boltP(ctx), settingPhase]
    },
    finish() {
      this.done = true
      hideMat(group)
      house.colliders.push({ minX: 3.24, maxX: 4.16, minZ: 1.14, maxZ: 2.06 })
      house.colliders.push({ minX: 2.8, maxX: 3.16, minZ: 1.42, maxZ: 1.78 })
      house.colliders.push({ minX: 4.24, maxX: 4.6, minZ: 1.42, maxZ: 1.78 })
    },
  }
  return st
}

export function buildStations(scene: Scene, house: House): Station[] {
  return [
    stationShelf(scene),
    stationBooks(scene),
    stationPicture(scene),
    stationKitchen(scene),
    stationSpice(scene),
    stationPlates(scene),
    stationSofa(scene, house),
    stationLamp(scene, house),
    stationTable(scene, house),
    stationDesk(scene, house),
    stationBed(scene, house),
    stationBedding(scene, house),
    stationWardrobe(scene, house),
    stationVanity(scene, house),
    stationDining(scene, house),
  ]
}
