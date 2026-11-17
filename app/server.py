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

from config import validated, resolve, kit_parts, all_specs, spec_name, components, foam_cuts, panel_lid_counts

ROOT = Path(__file__).resolve().parents[1]
SCAD = ROOT / 'models' / 'window_fan.scad'
CACHE = Path('/tmp/window-fan-cache')
CACHE.mkdir(parents=True, exist_ok=True)
CACHE_MAX_BYTES = int(os.environ.get('MESH_CACHE_MAX_MB', '1024')) * 1024 * 1024
OPENSCAD = os.environ.get('OPENSCAD_BIN', 'openscad')
STATIC = ROOT / 'app' / 'static'
STUDIO = ROOT / 'studio' / 'dist'
locks = {}
locks_guard = threading.Lock()
PARTS = {'fan', 'grill', 'left_cap', 'right_cap', 'controller',
         'controller_lid', 'controller_blank', 'spacer', 'filler', 'top_rail', 'louver',
         'panel_lid', 'fan_cover', 'fan_cover_lid', 'magnet_spacer', 'test_dovetail_male',
         'test_dovetail_female', 'test_pin_male', 'test_pin_female'}

# Only dimensions that alter a part's actual triangles belong in its cache key.
# Opening size, fan count, and insulation choices change the assembly/quantities,
# but generally do not change a reusable part mesh.
MESH_DEPENDENCIES = {
    'fan': ('depth', 'dovetail_clearance', 'pin_clearance', 'louvers',
            'strike_d', 'strike_h', 'cleat_clearance'),
    'grill': (), 'louver': (), 'panel_lid': (),
    'fan_cover': ('cover_depth',),
    'fan_cover_lid': ('magnet_d', 'magnet_clearance', 'gasket_thickness'),
    'magnet_spacer': ('magnet_d', 'magnet_h', 'magnet_clearance', 'gasket_thickness'),
    'controller_lid': ('depth',),
    'test_dovetail_male': (),
    'test_dovetail_female': ('dovetail_clearance',),
    'test_pin_male': ('depth',),
    'test_pin_female': ('depth', 'pin_clearance'),
    'left_cap': ('depth', 'pin_clearance'),
    'right_cap': ('depth', 'dovetail_clearance', 'pin_clearance'),
    'top_rail': ('depth', 'dovetail_clearance', 'pin_clearance',
                 'sash_slot_w', 'sash_engagement'),
}
for body_part in ('controller', 'controller_blank', 'spacer', 'filler'):
    MESH_DEPENDENCIES[body_part] = ('depth', 'dovetail_clearance', 'pin_clearance')


def mesh_key(part, width=0, height=0, edge='middle', cfg=None):
    cfg = cfg or validated({})
    values = [SCAD.stat().st_mtime_ns, part, width, height, edge]
    values.extend(cfg[name] for name in MESH_DEPENDENCIES[part])
    return hashlib.sha256(repr(values).encode()).hexdigest()[:20]


def prune_cache(limit_bytes=CACHE_MAX_BYTES):
    """Bound the persistent STL cache on startup; oldest mesh files go first."""
    files = sorted(CACHE.glob('*.stl'), key=lambda path: path.stat().st_mtime)
    total = sum(path.stat().st_size for path in files)
    for path in files:
        if total <= limit_bytes:
            break
        size = path.stat().st_size
        path.unlink(missing_ok=True)
        total -= size
    return total


def stl(part, width=0, height=0, edge='middle', cfg=None):
    if part not in PARTS or edge not in ('left', 'middle', 'right'):
        raise ValueError('Unknown part or rail edge.')
    if part == 'filler' and not 22 <= width <= 220:
        raise ValueError('Filler width must be 22–220 mm.')
    if part == 'panel_lid' and not 40 <= width <= 220:
        raise ValueError('Insulation back skin width must be 40–220 mm.')
    if part == 'top_rail' and (not 12 <= width <= 220 or not 7 <= height <= 100):
        raise ValueError('Top rail size is outside the supported range.')
    depth = cfg['depth'] if cfg else 55
    sash_slot_w = cfg['sash_slot_w'] if cfg else 22
    sash_engagement = cfg['sash_engagement'] if cfg else 10
    louvers = cfg['louvers'] if cfg else True
    cover_depth = cfg['cover_depth'] if cfg else 45
    dovetail_clearance = cfg['dovetail_clearance'] if cfg else 0.30
    pin_clearance = cfg['pin_clearance'] if cfg else 0.30
    magnet_d = cfg['magnet_d'] if cfg else 6
    magnet_h = cfg['magnet_h'] if cfg else 2
    strike_d = cfg['strike_d'] if cfg else 9
    strike_h = cfg['strike_h'] if cfg else 1
    magnet_clearance = cfg['magnet_clearance'] if cfg else 0.20
    cleat_clearance = cfg['cleat_clearance'] if cfg else 0.30
    gasket_thickness = cfg['gasket_thickness'] if cfg else 1.2
    key = mesh_key(part, width, height, edge, cfg)
    filename = CACHE / f'{part}_{key}.stl'
    with locks_guard:
        lock = locks.setdefault(key, threading.Lock())
    with lock:
        if not filename.exists():
            tmp = CACHE / f'{part}_{key}.tmp.stl'
            cmd = [OPENSCAD, '--export-format', 'binstl', '-o', str(tmp),
                   '-D', f'part="{part}"', '-D', f'filler_w={width or 60}',
                   '-D', f'panel_w={width or 140}', '-D', f'trim_h={height or 12}',
                   '-D', f'rail_edge="{edge}"', '-D', f'frame_depth={depth}',
                   '-D', f'sash_slot_w={sash_slot_w}', '-D', f'sash_engagement={sash_engagement}',
                   '-D', f'cover_depth={cover_depth}',
                   '-D', f'dovetail_clearance={dovetail_clearance}',
                   '-D', f'pin_clearance={pin_clearance}',
                   '-D', f'magnet_d={magnet_d}', '-D', f'magnet_h={magnet_h}',
                   '-D', f'strike_d={strike_d}', '-D', f'strike_h={strike_h}',
                   '-D', f'magnet_clearance={magnet_clearance}',
                   '-D', f'cleat_clearance={cleat_clearance}',
                   '-D', f'gasket_thickness={gasket_thickness}',
                   '-D', f'louver_mounts={str(louvers).lower()}', str(SCAD)]
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
            archive.write(stl(part, width, height, edge, cfg), f'stl/{spec_name(part, width, height, edge)}.stl')
        archive.writestr('configuration.json', json.dumps(manifest(cfg), indent=2))
        archive.writestr('BUILD.txt', 'Print the four small fit coupons first: male and female dovetail, then male and female pin. Tune dovetail_clearance and pin_clearance for your printer before printing full modules. Clearances are radial, in millimeters. Standard-width modules use four top pins in a two-by-two pattern.\nPrint remaining STLs according to configuration.json quantities. Assemble columns left to right, then stack rows from bottom to top. Top rail sections follow the same column order. For a double-hung sash, install continuous compressible gasket tape along the channel bottom and both side walls. Measure the actual lower sash thickness; the sash must lower into the printed channel and compress the gasket without bottoming out on hard plastic. The hardware list gives a three-run tape length allowance. A rail height of 0 does not provide a sash seal.\nEvery wide solid or filler cell has a closing back skin. If foam is selected, cut rigid closed-cell foam to the foam_cuts dimensions and fit it into each cassette before fastening its back skin. Seal every back-skin perimeter seam. For each fan cover, insert two magnets into the bottom pockets from the shell side, push the printed magnet spacers behind them, and bond the shell to the back skin to trap the magnets mechanically. Fasten two sized countersunk steel strike discs into the fan housing bottom recesses with countersunk M3 screws. Apply compressed-thickness gasket tape to the cover perimeter, keeping the magnet contact pads clear. Lift the cover about 5 mm, insert the two top hooks into their keyhole openings, lower it, and let the bottom magnets catch. Pull the bottom edge to remove; remove covers before running fans.\nInstall each 120 mm fan from the exterior through the unobstructed square housing pocket, then secure its four standard mounting holes from the room side through the front grille. Four M3 screws fasten each output louver into separate pilot holes in the solid rear outer corners. Select screw lengths for the actual prints.\nSeal room-side module joints and use compressible perimeter weatherstripping where the kit meets the window. Route any cable through a properly sealed gland; the controller lid is solid. Keep exterior water draining outward. Alignment studs are not retention clips. Secure the assembly in the window.\n')
    return memory.getvalue()


def manifest(cfg):
    result = {key: value for key, value in cfg.items() if key != 'columns'}
    result['columns'] = [{'type': kind, 'width': width} for kind, width in cfg['columns']]
    result['components'] = components(cfg)
    result['quantities'] = kit_parts(cfg)
    result['foam_cuts'] = foam_cuts(cfg)
    result['hardware'] = hardware(cfg)
    return result


def hardware(cfg):
    return {'120_mm_fans': cfg['fan_count'],
            'fan_mount_fasteners': 4 * cfg['fan_count'],
            'M3_louver_screws': cfg['louver_screws'],
            'M3_panel_lid_screws': 4 * sum(panel_lid_counts(cfg).values()),
            'cover_magnets': 2 * cfg['fan_count'] if cfg['fan_covers'] else 0,
            'cover_steel_washers': 2 * cfg['fan_count'] if cfg['fan_covers'] else 0,
            'M3_strike_washer_screws': 2 * cfg['fan_count'] if cfg['fan_covers'] else 0,
            'sash_gasket_tape_mm': 3 * cfg['usable_width'] if cfg['rail'] else 0,
            'M3_controller_lid_screws': 4 if cfg['controller'] != 'none' else 0}


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
                                             'quantities': kit_parts(cfg), 'foam_cuts': foam_cuts(cfg),
                                             'hardware': hardware(cfg)}).encode(), 'application/json')
                    return
                cfg = validated(query)
                if path.path == '/api/validate':
                    self.respond(json.dumps({'ok': True, 'config': cfg, 'components': components(cfg),
                                             'quantities': kit_parts(cfg), 'foam_cuts': foam_cuts(cfg),
                                             'hardware': hardware(cfg)}).encode(), 'application/json')
                elif path.path == '/api/config':
                    self.respond(json.dumps(manifest(cfg), indent=2).encode(), 'application/json',
                                 filename=f'window_fans_{cfg["width"]}x{cfg["height"]}.json')
                elif path.path.startswith('/api/model/'):
                    part = path.path.split('/')[-1]
                    requested = (part, int(query.get('panel_w', '0')), int(query.get('rail_h', '0')), query.get('rail_edge', 'middle'))
                    if requested not in all_specs(cfg):
                        raise ValueError('This part is not in the current layout.')
                    self.respond(stl(*requested, cfg=cfg).read_bytes(), 'model/stl')
                elif path.path == '/api/export':
                    self.respond(package(cfg), 'application/zip', filename=f'window_fans_{cfg["width"]}x{cfg["height"]}.zip')
                else:
                    self.respond(b'{"error":"Not found"}', 'application/json', 404)
            else:
                relative = path.path.lstrip('/')
                if path.path in ('/', '/index.html'):
                    self.respond((STUDIO / 'index.html').read_bytes(), 'text/html; charset=utf-8')
                elif path.path == '/legacy/window-fan':
                    self.respond((STATIC / 'index.html').read_bytes(), 'text/html; charset=utf-8')
                elif relative in ('app.js', 'style.css'):
                    mime = 'text/javascript; charset=utf-8' if relative.endswith('.js') else 'text/css; charset=utf-8'
                    self.respond((STATIC / relative).read_bytes(), mime)
                elif relative.startswith('assets/') and '..' not in relative.split('/'):
                    asset = STUDIO / relative
                    if not asset.is_file():
                        self.respond(b'Not found', 'text/plain', 404)
                        return
                    mime = 'text/javascript; charset=utf-8' if asset.suffix == '.js' else 'text/css; charset=utf-8'
                    self.respond(asset.read_bytes(), mime)
                else:
                    self.respond(b'Not found', 'text/plain', 404)
        except ValueError as exc:
            self.respond(json.dumps({'ok': False, 'error': str(exc)}).encode(), 'application/json', 400)
        except (RuntimeError, OSError) as exc:
            self.respond(json.dumps({'error': str(exc)}).encode(), 'application/json', 500)


if __name__ == '__main__':
    prune_cache()
    port = int(os.environ.get('PORT', '8080'))
    print(f'WindowFan Studio listening on http://0.0.0.0:{port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
