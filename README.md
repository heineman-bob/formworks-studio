# Formworks Studio

A parametric design studio for made-to-measure 3D-print kits. The first design is a modular window fan array with an interactive 3D preview, part quantities, fit coupons, foam cuts, and a ZIP of printable STLs.

## Run locally

```bash
docker compose up --build
# http://localhost:8080
```

The container builds the React frontend, serves the API, and runs OpenSCAD. For native development, install Node.js 22, Python 3.12, and OpenSCAD, then run `python -m pip install -r requirements-dev.txt`, `npm ci --prefix studio`, and `make serve`. `make check` runs tests, syntax checks, formatting, and the frontend build.

## Repository map

| Path | Purpose |
| --- | --- |
| `studio/src/` | React catalog, workspace, walkthrough, and design registry |
| `app/static/` | Three.js window fan designer and pure preview planning module; currently embedded in the studio |
| `app/config.py` | Validation, layout planning, and quantity calculations |
| `app/geometry.py` | OpenSCAD rendering and per-part mesh cache |
| `app/kit.py` | ZIP packaging, manifest, and hardware list |
| `app/server.py` | HTTP API and static delivery |
| `models/window_fan.scad` | Printable geometry |
| `tests/` | Configuration and API contract tests |

The window fan designer is still a separate Three.js module embedded in the React workspace. The catalog has one working design. Saved projects, accounts, and other generators are not implemented.

## Documentation

- [Window fan configuration and assembly](docs/window-fan.md)
- [Architecture and API](docs/architecture.md)
- [Development and deployment](docs/development.md)

GitHub Pages can display static files, but [cannot run Python](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site). The full preview and ZIP export require the containerized backend.

No open-source license has been selected. Public visibility does not grant reuse or redistribution rights.
