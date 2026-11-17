"""OpenSCAD rendering and bounded mesh cache."""

from pathlib import Path
from functools import lru_cache
import hashlib
import os
import subprocess
import threading

from config import validated

ROOT = Path(__file__).resolve().parents[1]
SCAD = ROOT / 'models' / 'window_fan.scad'
CACHE = Path(os.environ.get('MESH_CACHE_DIR', '/tmp/window-fan-cache'))
CACHE.mkdir(parents=True, exist_ok=True)
CACHE_MAX_BYTES = int(os.environ.get('MESH_CACHE_MAX_MB', '1024')) * 1024 * 1024
OPENSCAD = os.environ.get('OPENSCAD_BIN', 'openscad')
locks = {}
locks_guard = threading.Lock()
render_slots = threading.BoundedSemaphore(int(os.environ.get('OPENSCAD_CONCURRENCY', '2')))
PARTS = {
    'fan',
    'grill',
    'left_cap',
    'right_cap',
    'controller',
    'controller_lid',
    'controller_blank',
    'spacer',
    'filler',
    'top_rail',
    'louver',
    'panel_lid',
    'fan_cover',
    'fan_cover_lid',
    'magnet_spacer',
    'test_dovetail_male',
    'test_dovetail_female',
    'test_pin_male',
    'test_pin_female',
}

# Only dimensions that alter a part's actual triangles belong in its cache key.
# Opening size, fan count, and insulation choices change the assembly/quantities,
# but generally do not change a reusable part mesh.
MESH_DEPENDENCIES = {
    'fan': (
        'depth',
        'dovetail_clearance',
        'pin_clearance',
        'louvers',
        'strike_d',
        'strike_h',
        'cleat_clearance',
    ),
    'grill': (),
    'louver': (),
    'panel_lid': (),
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
    'top_rail': ('depth', 'dovetail_clearance', 'pin_clearance', 'sash_slot_w', 'sash_engagement'),
}
for body_part in ('controller', 'controller_blank', 'spacer', 'filler'):
    MESH_DEPENDENCIES[body_part] = ('depth', 'dovetail_clearance', 'pin_clearance')


@lru_cache(maxsize=4)
def source_digest(mtime_ns, size):
    """Keep cache keys stable across deployments of identical model source."""
    return hashlib.sha256(SCAD.read_bytes()).hexdigest()


def mesh_key(part, width=0, height=0, edge='middle', cfg=None):
    cfg = cfg or validated({})
    stat = SCAD.stat()
    values = [source_digest(stat.st_mtime_ns, stat.st_size), part, width, height, edge]
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
            cmd = [
                OPENSCAD,
                '--export-format',
                'binstl',
                '-o',
                str(tmp),
                '-D',
                f'part="{part}"',
                '-D',
                f'filler_w={width or 60}',
                '-D',
                f'panel_w={width or 140}',
                '-D',
                f'trim_h={height or 12}',
                '-D',
                f'rail_edge="{edge}"',
                '-D',
                f'frame_depth={depth}',
                '-D',
                f'sash_slot_w={sash_slot_w}',
                '-D',
                f'sash_engagement={sash_engagement}',
                '-D',
                f'cover_depth={cover_depth}',
                '-D',
                f'dovetail_clearance={dovetail_clearance}',
                '-D',
                f'pin_clearance={pin_clearance}',
                '-D',
                f'magnet_d={magnet_d}',
                '-D',
                f'magnet_h={magnet_h}',
                '-D',
                f'strike_d={strike_d}',
                '-D',
                f'strike_h={strike_h}',
                '-D',
                f'magnet_clearance={magnet_clearance}',
                '-D',
                f'cleat_clearance={cleat_clearance}',
                '-D',
                f'gasket_thickness={gasket_thickness}',
                '-D',
                f'louver_mounts={str(louvers).lower()}',
                str(SCAD),
            ]
            try:
                with render_slots:
                    run = subprocess.run(
                        cmd, capture_output=True, text=True, timeout=180, env=os.environ.copy()
                    )
            except subprocess.TimeoutExpired as exc:
                tmp.unlink(missing_ok=True)
                raise RuntimeError(f'OpenSCAD timed out exporting {part}') from exc
            if run.returncode != 0 or not tmp.exists() or tmp.stat().st_size < 84:
                tmp.unlink(missing_ok=True)
                raise RuntimeError(f'OpenSCAD export failed: {run.stderr[-1800:]}')
            tmp.replace(filename)
    return filename
