"""Window fan configurator — local OpenSCAD export service."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
from pathlib import Path
import hashlib
import io
import json
import os
import subprocess
import threading
import zipfile

from config import validated, resolve, kit_parts, all_specs, spec_name, components

ROOT = Path(__file__).resolve().parents[1]
SCAD = ROOT / 'models' / 'window_fan.scad'
CACHE = Path('/tmp/window-fan-cache')
CACHE.mkdir(parents=True, exist_ok=True)
OPENSCAD = os.environ.get('OPENSCAD_BIN', 'openscad')
STATIC = ROOT / 'app' / 'static'
locks = {}
locks_guard = threading.Lock()
PARTS = {'fan', 'grill', 'left_cap', 'right_cap', 'controller',
         'controller_lid', 'controller_blank', 'spacer', 'filler', 'top_rail'}


def stl(part, width=0, height=0, edge='middle'):
    if part not in PARTS or edge not in ('left', 'middle', 'right'):
        raise ValueError('Unknown part or rail edge.')
    if part == 'filler' and not 22 <= width <= 220:
        raise ValueError('Filler width must be 22–220 mm.')
    if part == 'top_rail' and (not 12 <= width <= 220 or not 7 <= height <= 100):
        raise ValueError('Top rail size is outside the supported range.')
    key = hashlib.sha256(f'{SCAD.stat().st_mtime_ns}|{part}|{width}|{height}|{edge}'.encode()).hexdigest()[:20]
    filename = CACHE / f'{part}_{key}.stl'
    with locks_guard:
        lock = locks.setdefault(key, threading.Lock())
    with lock:
        if not filename.exists():
            tmp = CACHE / f'{part}_{key}.tmp.stl'
            cmd = [OPENSCAD, '--export-format', 'binstl', '-o', str(tmp),
                   '-D', f'part="{part}"', '-D', f'filler_w={width or 60}',
                   '-D', f'panel_w={width or 140}', '-D', f'trim_h={height or 12}',
                   '-D', f'rail_edge="{edge}"', str(SCAD)]
            try:
                run = subprocess.run(cmd, capture_output=True, text=True, timeout=180, env=os.environ.copy())
            except subprocess.TimeoutExpired as exc:
                tmp.unlink(missing_ok=True)
                raise RuntimeError(f'OpenSCAD timed out exporting {part}') from exc
            if run.returncode != 0 or not tmp.exists() or tmp.stat().st_size < 84:
                tmp.unlink(missing_ok=True)
                raise RuntimeError(f'OpenSCAD export failed: {run.stderr[-1800:]}')
            tmp.replace(filename)
    return filename


def package(cfg):
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for part, width, height, edge in all_specs(cfg):
            archive.write(stl(part, width, height, edge), f'stl/{spec_name(part, width, height, edge)}.stl')
        archive.writestr('configuration.json', json.dumps(manifest(cfg), indent=2))
        archive.writestr('BUILD.txt', 'Print each STL according to configuration.json quantities. Assemble columns left to right, then stack rows from bottom to top. Top rail sections follow the same column order.\nAlignment studs are not retention clips. Secure the assembly in the window.\n')
    return memory.getvalue()


def manifest(cfg):
    result = {key: value for key, value in cfg.items() if key != 'columns'}
    result['columns'] = [{'type': kind, 'width': width} for kind, width in cfg['columns']]
    result['components'] = components(cfg)
    result['quantities'] = kit_parts(cfg)
    return result


class Handler(BaseHTTPRequestHandler):
    def respond(self, body, ctype='application/octet-stream', status=200, filename=None):
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if filename:
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path)
        query = {key: values[0] for key, values in parse_qs(path.query, keep_blank_values=True).items()}
        try:
            if path.path.startswith('/api/'):
                if path.path == '/api/resolve':
                    cfg, normalized, adjusted = resolve(query)
                    self.respond(json.dumps({'ok': True, 'config': cfg, 'normalized': normalized,
                                             'adjusted': adjusted, 'components': components(cfg),
                                             'quantities': kit_parts(cfg)}).encode(), 'application/json')
                    return
                cfg = validated(query)
                if path.path == '/api/validate':
                    self.respond(json.dumps({'ok': True, 'config': cfg, 'components': components(cfg),
                                             'quantities': kit_parts(cfg)}).encode(), 'application/json')
                elif path.path == '/api/config':
                    self.respond(json.dumps(manifest(cfg), indent=2).encode(), 'application/json',
                                 filename=f'window_fans_{cfg["width"]}x{cfg["height"]}.json')
                elif path.path.startswith('/api/model/'):
                    part = path.path.split('/')[-1]
                    requested = (part, int(query.get('panel_w', '0')), int(query.get('rail_h', '0')), query.get('rail_edge', 'middle'))
                    if requested not in all_specs(cfg):
                        raise ValueError('This part is not in the current layout.')
                    self.respond(stl(*requested).read_bytes(), 'model/stl')
                elif path.path == '/api/export':
                    self.respond(package(cfg), 'application/zip', filename=f'window_fans_{cfg["width"]}x{cfg["height"]}.zip')
                else:
                    self.respond(b'{"error":"Not found"}', 'application/json', 404)
            else:
                relative = path.path.lstrip('/') or 'index.html'
                if relative not in ('index.html', 'app.js', 'style.css'):
                    self.respond(b'Not found', 'text/plain', 404)
                    return
                mime = {'index.html': 'text/html; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8',
                        'style.css': 'text/css; charset=utf-8'}[relative]
                self.respond((STATIC / relative).read_bytes(), mime)
        except ValueError as exc:
            self.respond(json.dumps({'ok': False, 'error': str(exc)}).encode(), 'application/json', 400)
        except (RuntimeError, OSError) as exc:
            self.respond(json.dumps({'error': str(exc)}).encode(), 'application/json', 500)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8080'))
    print(f'WindowFan Studio listening on http://0.0.0.0:{port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
