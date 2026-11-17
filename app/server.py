"""HTTP transport for the Formworks Studio and window fan generator."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
from pathlib import Path
import json
import os

from config import validated, resolve, kit_parts, all_specs, components, foam_cuts
from geometry import prune_cache, stl
from kit import package, manifest, hardware

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / 'app' / 'static'
STUDIO = ROOT / 'studio' / 'dist'


class Handler(BaseHTTPRequestHandler):
    def respond(self, body, ctype='application/octet-stream', status=200, filename=None):
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        is_asset = urlsplit(self.path).path.startswith('/assets/')
        self.send_header(
            'Cache-Control', 'public, max-age=31536000, immutable' if is_asset else 'no-store'
        )
        self.send_header('X-Content-Type-Options', 'nosniff')
        if filename:
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            # Clients can abandon an expensive preview when configuration changes.
            pass

    def do_GET(self):
        path = urlsplit(self.path)
        query = {
            key: values[0] for key, values in parse_qs(path.query, keep_blank_values=True).items()
        }
        try:
            if path.path.startswith('/api/'):
                if path.path == '/api/health':
                    self.respond(b'{"status":"ok"}', 'application/json')
                    return
                if path.path == '/api/resolve':
                    cfg, normalized, adjusted = resolve(query)
                    self.respond(
                        json.dumps(
                            {
                                'ok': True,
                                'config': cfg,
                                'normalized': normalized,
                                'adjusted': adjusted,
                                'components': components(cfg),
                                'quantities': kit_parts(cfg),
                                'foam_cuts': foam_cuts(cfg),
                                'hardware': hardware(cfg),
                            }
                        ).encode(),
                        'application/json',
                    )
                    return
                if path.path not in (
                    '/api/validate',
                    '/api/config',
                    '/api/export',
                ) and not path.path.startswith('/api/model/'):
                    self.respond(b'{"error":"Not found"}', 'application/json', 404)
                    return
                cfg = validated(query)
                if path.path == '/api/validate':
                    self.respond(
                        json.dumps(
                            {
                                'ok': True,
                                'config': cfg,
                                'components': components(cfg),
                                'quantities': kit_parts(cfg),
                                'foam_cuts': foam_cuts(cfg),
                                'hardware': hardware(cfg),
                            }
                        ).encode(),
                        'application/json',
                    )
                elif path.path == '/api/config':
                    self.respond(
                        json.dumps(manifest(cfg), indent=2).encode(),
                        'application/json',
                        filename=f'window_fans_{cfg["width"]}x{cfg["height"]}.json',
                    )
                elif path.path.startswith('/api/model/'):
                    part = path.path.split('/')[-1]
                    requested = (
                        part,
                        int(query.get('panel_w', '0')),
                        int(query.get('rail_h', '0')),
                        query.get('rail_edge', 'middle'),
                    )
                    if requested not in all_specs(cfg):
                        raise ValueError('This part is not in the current layout.')
                    self.respond(stl(*requested, cfg=cfg).read_bytes(), 'model/stl')
                elif path.path == '/api/export':
                    self.respond(
                        package(cfg),
                        'application/zip',
                        filename=f'window_fans_{cfg["width"]}x{cfg["height"]}.zip',
                    )
                else:
                    self.respond(b'{"error":"Not found"}', 'application/json', 404)
            else:
                relative = path.path.lstrip('/')
                if path.path in ('/', '/index.html'):
                    self.respond((STUDIO / 'index.html').read_bytes(), 'text/html; charset=utf-8')
                elif path.path == '/legacy/window-fan':
                    self.respond((STATIC / 'index.html').read_bytes(), 'text/html; charset=utf-8')
                elif relative in ('app.js', 'planning.mjs', 'style.css'):
                    mime = (
                        'text/css; charset=utf-8'
                        if relative.endswith('.css')
                        else 'text/javascript; charset=utf-8'
                    )
                    self.respond((STATIC / relative).read_bytes(), mime)
                elif relative.startswith('assets/') and '..' not in relative.split('/'):
                    asset = STUDIO / relative
                    if not asset.is_file():
                        self.respond(b'Not found', 'text/plain', 404)
                        return
                    mime = (
                        'text/javascript; charset=utf-8'
                        if asset.suffix == '.js'
                        else 'text/css; charset=utf-8'
                    )
                    self.respond(asset.read_bytes(), mime)
                else:
                    self.respond(b'Not found', 'text/plain', 404)
        except ValueError as exc:
            self.respond(
                json.dumps({'ok': False, 'error': str(exc)}).encode(), 'application/json', 400
            )
        except (RuntimeError, OSError) as exc:
            self.respond(json.dumps({'error': str(exc)}).encode(), 'application/json', 500)


if __name__ == '__main__':
    prune_cache()
    port = int(os.environ.get('PORT', '8080'))
    print(f'WindowFan Studio listening on http://0.0.0.0:{port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
