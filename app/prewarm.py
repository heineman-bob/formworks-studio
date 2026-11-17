"""Opt-in, bounded precomputation of reusable OpenSCAD part meshes.

Reference widths are examples from manufacturer size charts, not measured
clear sash openings. They warm shared part geometry; every exported kit still
uses the user's actual measurements.
"""

import argparse
from config import validated, all_specs
from geometry import mesh_key, stl, prune_cache

REFERENCE_WIDTHS = (610, 762, 914, 800, 1000)


def candidates():
    for width in REFERENCE_WIDTHS:
        cfg = validated(
            {'width': str(width), 'height': '300', 'slots': '3', 'rows': '2', 'rail': '20'}
        )
        for part, part_width, height, edge in all_specs(cfg):
            yield part, part_width, height, edge, cfg


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--max-meshes',
        type=int,
        default=24,
        help='Maximum number of distinct meshes to warm (default: 24)',
    )
    args = parser.parse_args()
    if not 1 <= args.max_meshes <= 100:
        parser.error('--max-meshes must be 1–100')
    seen = set()
    for part, width, height, edge, cfg in candidates():
        key = mesh_key(part, width, height, edge, cfg)
        if key in seen:
            continue
        if len(seen) >= args.max_meshes:
            break
        seen.add(key)
        print(f'{len(seen):02}/{args.max_meshes} {part} {width or ""} {edge}', flush=True)
        stl(part, width, height, edge, cfg)
    print(f'Warmed {len(seen)} unique meshes. Cache size: {prune_cache() / 1024**2:.1f} MiB.')


if __name__ == '__main__':
    main()
