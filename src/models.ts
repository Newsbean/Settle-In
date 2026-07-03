import {
  AbstractMesh,
  Color3,
  LoadAssetContainerAsync,
  Mesh,
  PBRMaterial,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import type { AssetContainer } from '@babylonjs/core'
import { surfaceTexture, type TexKey } from './textures'

// GLB prop library (generated via the rezona-pgc pipeline; see PLAN_ASSETS.md).
// Everything loads up-front into asset containers; factories in props.ts ask for
// normalized instances and fall back to their primitive builds when a model is
// missing or failed to load — the game must always boot assetless.

// The GLBs live in the parent repo's asset manifest directory; Vite resolves
// files outside the settle-in root both in dev (/@fs/) and at build. The URLs
// must be static literals — a dynamic template makes Vite glob-emit the whole
// models directory (including the unrelated Shelf Reset prototype's GLBs).
// Retired 2026-07-04: the user pivoted the art direction away from generated
// 3D meshes entirely — everything is now hand-built primitives wrapped in
// painted "skin" textures (Minecraft-style face wrapping; see textures.ts and
// GAME_BIBLE §6). FILES stays empty so every factory takes its primitive path.
// The generated GLBs remain on disk at the repo root (src/assets/models/,
// first-gen + `-flat` second-gen slugs) if a future direction wants them; see
// PLAN_ASSETS.md for the full history of both generation passes.
const FILES: Record<string, string> = {}

const containers = new Map<string, AssetContainer>()

export async function preloadModels(scene: Scene): Promise<void> {
  await Promise.all(
    Object.entries(FILES).map(async ([key, url]) => {
      try {
        const container = await LoadAssetContainerAsync(url, scene)
        // Matte-force once on the template materials: the aesthetic bible bans
        // gloss, and every instance shares these unless it asks for a tint.
        for (const mat of container.materials) {
          if (mat instanceof PBRMaterial) {
            mat.metallic = 0
            mat.roughness = 1
            mat.specularIntensity = 0
          } else if (mat instanceof StandardMaterial) {
            mat.specularColor = Color3.Black()
          }
        }
        containers.set(key, container)
      } catch (e) {
        console.warn(`[models] failed to load ${key} — primitive fallback stays`, e)
      }
    }),
  )
}

export function hasModel(key: string): boolean {
  return containers.has(key)
}

export interface InstanceOpts {
  // Target bounding size in world units; the instance is per-axis scaled to fit
  // exactly, matching the primitive it replaces (slots/colliders assume it).
  w: number
  h: number
  d: number
  // 'bottom': root sits at the base center (floor-standing furniture).
  // 'center': root at the bounding-box center (wall-hung pieces, bolts).
  anchor?: 'bottom' | 'center'
  // Pre-rotation (radians, around y) applied before measuring, for models whose
  // long axis doesn't match the slot's (e.g. rails long in x vs. slots long in z).
  yaw?: number
  // Multiplies the albedo (book color variants). Clones the materials.
  tint?: Color3
  // Wrap a hand-painted surface texture onto this instance (wood grain, fabric,
  // ceramic…). Applied per-instance — the same shared GLB kit part can be wood on
  // a shelf cheek and fabric on a sofa arm. Combines with `tint` (texture × tint).
  texture?: TexKey
}

export interface ModelInstance {
  root: TransformNode
  pick: Mesh[]
}

// Clone a loaded model, normalize its size and anchor, and hand back a
// drag-ready group. Returns null when the model isn't available.
export function modelInstance(scene: Scene, key: string, name: string, opts: InstanceOpts): ModelInstance | null {
  const container = containers.get(key)
  if (!container) return null

  const inst = container.instantiateModelsToScene((n) => `${name}-${n}`, false, { doNotInstantiate: true })
  const root = new TransformNode(name, scene)
  const inner = new TransformNode(`${name}-inner`, scene)
  inner.parent = root
  for (const rn of inst.rootNodes) rn.parent = inner
  if (opts.yaw) inner.rotation = new Vector3(0, opts.yaw, 0)

  // Measure in wrapper space (wrapper is at origin, so world == local here).
  inner.computeWorldMatrix(true)
  const { min, max } = root.getHierarchyBoundingVectors(true)
  const size = max.subtract(min)
  const sx = opts.w / Math.max(size.x, 1e-4)
  const sy = opts.h / Math.max(size.y, 1e-4)
  const sz = opts.d / Math.max(size.z, 1e-4)
  inner.scaling = new Vector3(inner.scaling.x * sx, inner.scaling.y * sy, inner.scaling.z * sz)
  // Recenter: bbox center to x/z origin; y per anchor.
  const cx = ((min.x + max.x) / 2) * sx
  const cz = ((min.z + max.z) / 2) * sz
  const anchor = opts.anchor ?? 'bottom'
  const y = anchor === 'bottom' ? -min.y * sy : -((min.y + max.y) / 2) * sy
  inner.position = new Vector3(-cx, y, -cz)

  const pick: Mesh[] = []
  for (const m of inst.rootNodes.flatMap((rn) => [rn, ...rn.getChildMeshes(false)])) {
    if (m instanceof Mesh && m.getTotalVertices() > 0) {
      m.isPickable = true
      pick.push(m)
    }
  }

  if (opts.tint || opts.texture) {
    const tex = opts.texture ? surfaceTexture(scene, opts.texture) : null
    for (const m of pick) {
      const mat = (m as AbstractMesh).material
      if (mat instanceof PBRMaterial) {
        const clone = mat.clone(`${name}-mat`)
        if (tex) clone.albedoTexture = tex
        // Explicit tint wins; otherwise a texture supplies its own colour (white
        // base) so the painted swatch reads true instead of being multiplied down.
        if (opts.tint) clone.albedoColor = opts.tint
        else if (tex) clone.albedoColor = Color3.White()
        m.material = clone
      }
    }
  }

  return { root, pick }
}
