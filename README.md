# Geometry Preview

Write C++ geometry code against the FLM3Geo SDK and see the result in a live 3D preview. The app interprets the code up to the cursor line and draws the geometry it produces. It also shows variables, the API call trace and parameters. Everything runs in the browser; there is no backend.

Live version: <https://kienmai160598.github.io/3d/>

## Run locally

Requires Node.js 24 (see `.nvmrc`) and npm.

```sh
nvm use
make install   # or: npm ci
make dev       # or: npm run dev
```

Then open <http://localhost:5173>.

Run `make` to list the other commands: build, test, lint, format and validate.

More detail: [docs/](docs/) describes the app's behavior.

## OBJ import and export

Use **Import OBJ** in the header to preview a local `.obj` file. Import replaces
only the preview; your C++ code is preserved. **Return to code** restores the live
code preview. Imported meshes do not become editable C++ parameters. Files are
processed locally in the browser and are not uploaded.

**Export OBJ** downloads the active model. In code mode this includes generated
meshes and shown connector previews, regardless of debug overlays or API focus.
In OBJ mode it exports the imported model. Coordinates retain their original
units and axis orientation. Export writes triangles and vertex normals.

Import supports polygon faces (including concave polygons), positive and negative
indices, object/group names, vertex normals, and texture-coordinate references.
Materials, textures, vertex colors, smoothing groups, lines, and free-form curves
are not imported; unsupported records are reported. Without supplied normals,
face normals are generated. Use simple planar polygons for reliable triangulation.
The import limit is 20 MB, 200,000 triangles, and 4,096 corners per face.
