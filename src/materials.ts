import { Color3, Scene, StandardMaterial } from '@babylonjs/core'
import { surfaceTexture, type TexKey } from './textures'

// Flat, matte, hand-drawn-feeling materials. No specular highlights, a touch of
// self-illumination so shadowed sides stay warm rather than muddy. This is what
// keeps the whole scene reading as soft gouache rather than glossy 3D.

const cache = new Map<string, StandardMaterial>()

export interface MatOptions {
  emissiveScale?: number // 0..1 fraction of diffuse mixed into emissive (warmth lift)
  alpha?: number
  // A hand-painted surface texture to wrap onto the mesh (wood grain, fabric…).
  texture?: TexKey
  // How many times the texture tiles across the mesh's UVs (default 1×1).
  uv?: [u: number, v: number]
  // When true, the texture is multiplied by `color` (use for a light fabric weave
  // tinted per-item). When false/omitted, the texture supplies its own colour and
  // `color` only feeds the warmth lift — right for wood/cardboard/ceramic whose
  // painted swatch already carries the intended tone.
  tint?: boolean
}

export function flatMaterial(
  scene: Scene,
  name: string,
  color: Color3,
  opts: MatOptions = {},
): StandardMaterial {
  const emissiveScale = opts.emissiveScale ?? 0.28
  const alpha = opts.alpha ?? 1
  const tex = opts.texture
  const [u, v] = opts.uv ?? [1, 1]
  const tint = opts.tint ?? false
  const key = `${name}:${color.toHexString()}:${emissiveScale}:${alpha}:${tex ?? ''}:${u}x${v}:${tint}`
  const existing = cache.get(key)
  if (existing) return existing

  const mat = new StandardMaterial(key, scene)
  mat.specularColor = new Color3(0, 0, 0)
  mat.alpha = alpha
  if (alpha < 1) mat.needDepthPrePass = true

  if (tex) {
    const t = surfaceTexture(scene, tex, u, v)
    // The painted swatch carries the surface colour; tint mode multiplies it by
    // `color` (fabric variants), replace mode lets it show as-is (diffuse=white).
    const base = tint ? color : Color3.White()
    mat.diffuseTexture = t
    mat.diffuseColor = base
    // Keep the warmth lift, textured, so shadowed sides stay soft — not muddy.
    // Babylon ADDS emissiveTexture × level on top of emissiveColor (it does not
    // multiply them), so the lift must live in the texture's `level` — a full-
    // strength emissive add washes every textured surface toward white and
    // erases tints entirely.
    const et = t.clone()
    et.level = emissiveScale
    mat.emissiveTexture = et
    mat.emissiveColor = Color3.Black()
  } else {
    mat.diffuseColor = color
    mat.emissiveColor = color.scale(emissiveScale)
  }
  cache.set(key, mat)
  return mat
}

// A brighter, glowing variant used for highlights / ghost targets.
export function glowMaterial(
  scene: Scene,
  name: string,
  color: Color3,
  intensity = 0.6,
  alpha = 1,
): StandardMaterial {
  const mat = new StandardMaterial(`glow:${name}`, scene)
  mat.diffuseColor = color
  mat.specularColor = new Color3(0, 0, 0)
  mat.emissiveColor = color.scale(intensity)
  mat.alpha = alpha
  if (alpha < 1) mat.needDepthPrePass = true
  return mat
}

export function disposeMaterialCache(): void {
  cache.clear()
}
