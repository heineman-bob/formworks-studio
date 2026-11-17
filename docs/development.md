# Development and deployment

## Local checks

```bash
python -m pip install -r requirements-dev.txt
npm ci --prefix studio
make check
make serve
```

`make check` runs Python unit and API contract tests, JavaScript syntax checking, frontend formatting checks, and the Vite build. `make serve` builds the studio and starts the Python server on port 8080. The Three.js designer currently imports Three.js from jsDelivr, so its 3D view needs browser internet access.

For frontend iteration, run the Python server and `npm run dev --prefix studio`; Vite proxies API and legacy designer paths to `http://127.0.0.1:8080`.

`make parts` generates standalone OpenSCAD templates into ignored `dist/stl/`. The web export is authoritative for mixed patterns and quantities. `make warm-cache` optionally renders up to 24 common meshes ahead of use.

## Container

```bash
docker compose up --build
# http://localhost:8080/api/health
```

The final image runs as an unprivileged user and includes a health check. The named volume persists STL cache files between container restarts. For a Docker cache warmup:

```bash
docker compose exec configurator python app/prewarm.py --max-meshes=24
```

Set `PORT`, `OPENSCAD_BIN`, `MESH_CACHE_DIR`, `MESH_CACHE_MAX_MB`, and `OPENSCAD_CONCURRENCY` only when the deployment requires different defaults.

## Public hosting

Deploy the Docker image to a container host with persistent storage and HTTPS. GitHub Pages alone cannot run the OpenSCAD/Python API, so publishing only the static frontend would leave STL previews and ZIP exports broken. A separate static frontend deployment would require a public backend, an API base URL, and CORS configuration.

## Adding a design

1. Add the design metadata and route to `studio/src/designs.js`.
2. Implement the actual configurator and a deterministic print/export contract.
3. Add tests for normalization, quantities, and ZIP contents.
4. Verify the complete flow through the built container before advertising it in the catalog.
