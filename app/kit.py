"""Printable kit manifest, bill of materials, and ZIP packaging."""

import io
import json
import zipfile
from pathlib import Path

from config import all_specs, spec_name, components, foam_cuts, kit_parts, panel_lid_counts
from geometry import stl

BUILD_INSTRUCTIONS = Path(__file__).with_name('resources') / 'BUILD.txt'


def package(cfg):
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for part, width, height, edge in all_specs(cfg):
            archive.write(
                stl(part, width, height, edge, cfg),
                f'stl/{spec_name(part, width, height, edge)}.stl',
            )
        archive.writestr('configuration.json', json.dumps(manifest(cfg), indent=2))
        archive.writestr('BUILD.txt', BUILD_INSTRUCTIONS.read_text())
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
    return {
        '120_mm_fans': cfg['fan_count'],
        'fan_mount_fasteners': 4 * cfg['fan_count'],
        'M3_louver_screws': cfg['louver_screws'],
        'M3_panel_lid_screws': 4 * sum(panel_lid_counts(cfg).values()),
        'cover_magnets': 2 * cfg['fan_count'] if cfg['fan_covers'] else 0,
        'cover_steel_washers': 2 * cfg['fan_count'] if cfg['fan_covers'] else 0,
        'M3_strike_washer_screws': 2 * cfg['fan_count'] if cfg['fan_covers'] else 0,
        'sash_gasket_tape_mm': 3 * cfg['usable_width'] if cfg['rail'] else 0,
        'M3_controller_lid_screws': 4 if cfg['controller'] != 'none' else 0,
    }
