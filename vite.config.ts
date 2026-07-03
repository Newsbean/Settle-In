import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// Self-contained: root is this folder. Deps (@babylonjs/core, vite) resolve
// upward into the parent repo's node_modules, so no separate install is needed.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  server: {
    host: '0.0.0.0',
    // Honor a harness-assigned port (preview tooling) before the pinned default.
    port: Number(process.env.PORT) || 5188,
    // GLB props live in the parent repo's src/assets/models; without an explicit
    // allow, some launch contexts pick settle-in as the workspace root and 403 them.
    fs: {
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
