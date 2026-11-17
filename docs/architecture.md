# Architecture

## Request flow

1. The React studio reads the design registry in `studio/src/designs.js` and opens the window fan designer at `/legacy/window-fan?embedded=1`.
2. The designer sends its draft to `/api/resolve`. `app/config.py` normalizes values into a printable layout and returns part specifications, quantities, foam cuts, and hardware counts.
3. The viewer requests only visible part STLs from `/api/model/{part}`. `app/geometry.py` caches each distinct binary STL under a key derived from the OpenSCAD source and the dimensions that change that part.
4. `/api/export` assembles the exact validated kit in memory, including one STL per distinct part, `configuration.json`, and `BUILD.txt`.

`app/static/planning.mjs` holds the browser's pure part list and mesh key calculations. The Python `config.py` contract is authoritative for print quantities and validation; the browser module is exercised with Node tests so preview requests remain aligned.

The browser shows coarse placeholders while new OpenSCAD meshes render, then swaps in precise STLs without changing the camera. The exploded matrix loads remaining part types on demand.

## Boundaries

- `config.py` is pure layout logic. Keep geometry and HTTP concerns out of it.
- `geometry.py` owns model validation for requested parts, OpenSCAD execution, render concurrency, and disk caching.
- `kit.py` owns the ZIP contract and bill of materials. `app/resources/BUILD.txt` is the included assembly guide.
- `server.py` maps HTTP requests to those services. It should not contain design equations.
- `studio/src/designs.js` advertises only implemented generators. A new design needs a working route and export contract before appearing in the catalog.

## Cache behavior

`MESH_CACHE_DIR` defaults to `/tmp/window-fan-cache`; Docker mounts that path as a named volume. `MESH_CACHE_MAX_MB` defaults to 1024 and prunes oldest STLs when the server starts. `OPENSCAD_CONCURRENCY` defaults to 2 simultaneous renders. `make warm-cache` is an optional bounded precomputation step. A database is unnecessary for immutable, content-addressed STL blobs.

The cache stores **parts**, not full user kits. Opening width and fan count often change quantities and filler widths while reusing the same fan housing, grille, and other fixed geometry. The source digest invalidates affected cache entries when the OpenSCAD file changes.

## API

| Route | Response |
| --- | --- |
| `GET /api/health` | Lightweight health JSON |
| `GET /api/resolve?...` | Normalized configuration and complete print plan |
| `GET /api/validate?...` | Strict validation of a complete configuration |
| `GET /api/model/{part}?...` | Binary STL for a part in that layout |
| `GET /api/config?...` | Configuration manifest JSON |
| `GET /api/export?...` | Printable ZIP |

The Python API currently serves the frontend on the same origin. There is no authentication, persistence of user projects, or remote job queue. Do not present it as a multi-tenant production service without adding those controls.
