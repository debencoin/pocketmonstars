# Covo MVP integration
This full source snapshot includes dist/Covo_rigged.glb, the custom skin and palm sockets, and dist/covo-rig.js. The original battle simulation and move definitions remain unchanged. The renderer adds procedural running and casting poses, palm glows and 3D traveling projectiles. Transformation lighting is preliminary; full form meshes, teleport/vanish-specific 3D effects and visual skin deformation validation are not complete.

Run with Node 22.13+: npm ci, npm run build, npm start. Render uses the included Dockerfile and render.yaml. Merge into the existing repository rather than deleting existing art or configuration. The supplied original source archive excludes dist/art; retain the existing live repository's artwork for other characters and UI. Three.js is loaded from esm.sh and requires network access. Do not commit secrets or overwrite production environment variables.

Validation: changed JavaScript files pass syntax checks; game-mechanics mock tests pass. Full server tests could not run without installed dependencies. Browser/iPhone and visual rig tests not performed. This package is not a live deployment.

## Repository notes (v73)
- Three.js 0.170 is bundled into dist/covo-rig.js by `npm run build` (src/covo-rig.js), not loaded from esm.sh.
- The 3D COVO is drawn at the same body size as every other character (see the draw call in dist/pixel-arena.js).
- The pick screen and market card use a front render of the model (dist/art/hd/covo*.png, dist/art/nft/covo.png).
- Merged the other session's standalone Covo 3D lab (dist/app/covo-3d.html, dist/covo-arena-3d.js); the arena uses the GLB rig first and that procedural model only as a fallback (its CDN loader is not included in index.html).
