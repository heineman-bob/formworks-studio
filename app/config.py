"""Shared layout validation and printable part planning."""
from collections import Counter
from math import ceil


def split_panels(total):
    if not total:
        return []
    if total < 22:
        raise ValueError('A side panel must be at least 22 mm wide.')
    count = (total + 219) // 220
    base, extra = divmod(total, count)
    return [base + (i < extra) for i in range(count)]


def panel_list(value):
    if not value.strip():
        return []
    try:
        values = [int(item.strip()) for item in value.split(',')]
    except ValueError as exc:
        raise ValueError('Panel widths must be comma-separated whole millimeters.') from exc
    if len(values) > 20 or any(not 22 <= item <= 220 for item in values):
        raise ValueError('Each side panel must be 22–220 mm wide; use at most 20 per side.')
    return values


def validated(raw):
    try:
        width = int(raw.get('width', 664))
        height = int(raw.get('height', 280))
        slots = int(raw.get('slots', raw.get('fans', 3)))
        rows = int(raw.get('rows', 2))
        clearance_x = int(raw.get('clearance_x', 0))
        clearance_y = int(raw.get('clearance_y', 0))
        rail = int(raw.get('rail', 0))
        depth = int(raw.get('depth', 55))
        sash_slot_w = int(raw.get('sash_slot_w', 22))
        sash_engagement = int(raw.get('sash_engagement', 10))
        sash_thickness = float(raw.get('sash_thickness', 18))
        sash_gasket = float(raw.get('sash_gasket', 2))
        cover_depth = int(raw.get('cover_depth', 45))
        dovetail_clearance = float(raw.get('dovetail_clearance', 0.30))
        pin_clearance = float(raw.get('pin_clearance', 0.30))
        magnet_d = float(raw.get('magnet_d', 6))
        magnet_h = float(raw.get('magnet_h', 2))
        strike_d = float(raw.get('strike_d', 9))
        strike_h = float(raw.get('strike_h', 1))
        magnet_clearance = float(raw.get('magnet_clearance', 0.20))
        cleat_clearance = float(raw.get('cleat_clearance', 0.30))
        gasket_thickness = float(raw.get('gasket_thickness', 1.2))
    except (TypeError, ValueError) as exc:
        raise ValueError('Dimensions and counts must be whole millimeters.') from exc
    if not (200 <= width <= 4000 and 140 <= height <= 1200 and
            1 <= slots <= 20 and 1 <= rows <= 8 and
            0 <= clearance_x <= 20 and 0 <= clearance_y <= 20):
        raise ValueError('Opening: 200–4000 × 140–1200 mm; slots: 1–20; rows: 1–8; clearance: 0–20 mm.')
    if rail and not 10 <= rail <= 100:
        raise ValueError('Top rail height must be 0 or 10–100 mm to clear corner pin sockets.')
    if not (32 <= depth <= 250 and 6 <= sash_slot_w <= 50 and 3 <= sash_engagement <= 20):
        raise ValueError('Wall depth must be 32–250 mm; sash channel 6–50 mm; engagement 3–20 mm.')
    if not (4 <= sash_thickness <= 44 and 0.5 <= sash_gasket <= 3 and
            sash_slot_w == ceil(sash_thickness + 2 * sash_gasket) and
            sash_gasket < sash_engagement):
        raise ValueError('Measured sash must be 4–44 mm thick and fit the channel with 0.5–3 mm compressed gasket on each side and below.')
    if not 20 <= cover_depth <= 80:
        raise ValueError('Insulated fan cover depth must be 20–80 mm.')
    if not (0.10 <= dovetail_clearance <= 0.80 and 0.10 <= pin_clearance <= 0.80):
        raise ValueError('Dovetail and pin radial clearances must be 0.10–0.80 mm.')
    if not (4 <= magnet_d <= 8 and 1 <= magnet_h <= 3 and
            magnet_d <= strike_d <= 10 and 0.5 <= strike_h <= 1.5 and
            0.10 <= magnet_clearance <= 0.60 and 0.10 <= cleat_clearance <= 0.80 and
            0.5 <= gasket_thickness <= 2):
        raise ValueError('Magnet diameter 4–8 mm, thickness 1–3 mm; strike diameter must be at least the magnet diameter and at most 10 mm, thickness 0.5–1.5 mm; pocket clearance 0.10–0.60 mm, cleat clearance 0.10–0.80 mm, gasket 0.5–2 mm.')
    louvers = raw.get('louvers', '1')
    insulated = raw.get('insulated', '1')
    fan_covers = raw.get('fan_covers', '1')
    if any(value not in ('0', '1') for value in (louvers, insulated, fan_covers)):
        raise ValueError('Insulation and louver settings must be on or off.')
    louvers = louvers == '1'
    insulated = insulated == '1'
    fan_covers = fan_covers == '1'
    if louvers and depth < 50:
        raise ValueError('Bolt-on louvers need at least 50 mm body depth for fan discharge clearance.')
    if rail and (depth < sash_slot_w + 29 or rail < sash_engagement + 7):
        raise ValueError('Top rail needs enough body depth for the sash channel and 7 mm below its groove.')
    controller = raw.get('controller', 'right')
    side = raw.get('side', 'right')
    panel_mode = raw.get('panel_mode', 'auto')
    if controller not in ('none', 'left', 'right') or side not in ('left', 'right', 'split') or panel_mode not in ('auto', 'manual'):
        raise ValueError('Invalid controller or side-panel setting.')
    pattern = raw.get('pattern') or '/'.join(['F' * slots] * rows)
    pattern_rows = pattern.split('/')
    if len(pattern_rows) != rows or any(len(row) != slots or set(row) - {'F', 'S'} for row in pattern_rows):
        raise ValueError('Fan/solid pattern must contain one F or S for each cell.')
    usable_width = width - clearance_x
    usable_height = height - clearance_y
    remainder = usable_width - 24 - slots * 140 - (80 if controller != 'none' else 0)
    if remainder < 0:
        raise ValueError(f'Layout is {-remainder} mm wider than the usable opening. Remove a fan slot or controller.')
    if panel_mode == 'manual':
        left = panel_list(raw.get('left_panels', ''))
        right = panel_list(raw.get('right_panels', ''))
        if sum(left) + sum(right) != remainder:
            raise ValueError(f'Side panels total {sum(left) + sum(right)} mm; {remainder} mm is required.')
    elif side == 'left':
        left, right = split_panels(remainder), []
    elif side == 'right':
        left, right = [], split_panels(remainder)
    else:
        if remainder >= 44:
            left = split_panels(remainder // 2)
            right = split_panels(remainder - remainder // 2)
        else:
            left, right = [], split_panels(remainder)
    built_height = rows * 140 + rail
    if built_height > usable_height:
        raise ValueError(f'Layout is {built_height - usable_height} mm taller than the usable opening. Reduce rows or top rail height.')
    columns = [('left_cap', 12)]
    columns += [('filler', value) for value in left]
    if controller == 'left':
        columns.append(('controller', 80))
    columns += [('slot', 140) for _ in range(slots)]
    if controller == 'right':
        columns.append(('controller', 80))
    columns += [('filler', value) for value in right]
    columns.append(('right_cap', 12))
    return {'width': width, 'height': height, 'slots': slots, 'rows': rows,
            'clearance_x': clearance_x, 'clearance_y': clearance_y,
            'usable_width': usable_width, 'usable_height': usable_height,
            'built_height': built_height, 'top_gap': usable_height - built_height,
            'rail': rail, 'controller': controller, 'side': side,
            'depth': depth, 'sash_slot_w': sash_slot_w,
            'sash_engagement': sash_engagement, 'sash_thickness': sash_thickness,
            'sash_gasket': sash_gasket, 'louvers': louvers,
            'insulated': insulated, 'fan_covers': fan_covers, 'cover_depth': cover_depth,
            'dovetail_clearance': dovetail_clearance, 'pin_clearance': pin_clearance,
            'magnet_d': magnet_d, 'magnet_h': magnet_h, 'magnet_clearance': magnet_clearance,
            'strike_d': strike_d, 'strike_h': strike_h,
            'cleat_clearance': cleat_clearance, 'gasket_thickness': gasket_thickness,
            'panel_mode': panel_mode, 'left_panels': left, 'right_panels': right,
            'pattern': pattern, 'columns': columns,
            'fan_count': sum(row.count('F') for row in pattern_rows),
            'solid_count': sum(row.count('S') for row in pattern_rows),
            'louver_screws': 4 * sum(row.count('F') for row in pattern_rows) if louvers else 0}


def spec_name(part, width=0, height=0, edge='middle'):
    if part in ('filler', 'panel_lid'):
        return f'{part}_{width}mm'
    if part == 'top_rail':
        return f'top_rail_{edge}_{width}x{height}mm'
    return part


def kit_parts(cfg):
    counts = Counter()
    for part in ('test_dovetail_male', 'test_dovetail_female', 'test_pin_male', 'test_pin_female'):
        counts[part] = 1
    for row in cfg['pattern'].split('/'):
        counts['fan'] += row.count('F')
        counts['grill'] += row.count('F')
        if cfg['louvers']:
            counts['louver'] += row.count('F')
        counts['spacer'] += row.count('S')
        if cfg['fan_covers']:
            counts['fan_cover'] += row.count('F')
            counts['fan_cover_lid'] += row.count('F')
            counts['magnet_spacer'] += 2 * row.count('F')
        counts['left_cap'] += 1
        counts['right_cap'] += 1
    if cfg['controller'] != 'none':
        counts['controller'] = 1
        counts['controller_lid'] = 1
        counts['controller_blank'] = cfg['rows'] - 1
    for width in cfg['left_panels'] + cfg['right_panels']:
        counts[spec_name('filler', width)] += cfg['rows']
    for width, count in panel_lid_counts(cfg).items():
        counts[spec_name('panel_lid', width)] += count
    if cfg['rail']:
        for i, (_, width) in enumerate(cfg['columns']):
            edge = 'left' if i == 0 else 'right' if i == len(cfg['columns']) - 1 else 'middle'
            counts[spec_name('top_rail', width, cfg['rail'], edge)] += 1
    return {name: count for name, count in counts.items() if count}


def all_specs(cfg):
    specs = [('left_cap', 0, 0, 'middle'), ('right_cap', 0, 0, 'middle')]
    specs += [(part, 0, 0, 'middle') for part in ('test_dovetail_male', 'test_dovetail_female', 'test_pin_male', 'test_pin_female')]
    if cfg['fan_count']:
        specs += [('fan', 0, 0, 'middle'), ('grill', 0, 0, 'middle')]
        if cfg['louvers']:
            specs.append(('louver', 0, 0, 'middle'))
        if cfg['fan_covers']:
            specs += [('fan_cover', 0, 0, 'middle'), ('fan_cover_lid', 0, 0, 'middle'),
                      ('magnet_spacer', 0, 0, 'middle')]
    if cfg['solid_count']:
        specs.append(('spacer', 0, 0, 'middle'))
    if cfg['controller'] != 'none':
        specs += [('controller', 0, 0, 'middle'), ('controller_lid', 0, 0, 'middle')]
        if cfg['rows'] > 1:
            specs.append(('controller_blank', 0, 0, 'middle'))
    specs += [('filler', width, 0, 'middle') for width in dict.fromkeys(cfg['left_panels'] + cfg['right_panels'])]
    specs += [('panel_lid', width, 0, 'middle') for width in panel_lid_counts(cfg)]
    if cfg['rail']:
        specs += [('top_rail', width, cfg['rail'], 'left' if i == 0 else 'right' if i == len(cfg['columns']) - 1 else 'middle')
                  for i, (_, width) in enumerate(cfg['columns'])]
    return list(dict.fromkeys(specs))


def components(cfg):
    """One entry for every distinct printable STL in the kit."""
    labels = {
        'fan': 'Fan housing', 'grill': 'Front grille', 'spacer': 'Solid 140 mm panel',
        'left_cap': 'Left end cap', 'right_cap': 'Right end cap',
        'controller': 'Controller housing', 'controller_lid': 'Controller lid',
        'controller_blank': 'Controller blank', 'filler': 'Side filler',
        'top_rail': 'Top rail', 'louver': 'Bolt-on output louver',
        'panel_lid': 'Insulation back skin', 'fan_cover': 'Insulated fan cover shell',
        'fan_cover_lid': 'Fan cover back skin',
        'magnet_spacer': 'Magnet retention spacer',
        'test_dovetail_male': 'Dovetail test · male', 'test_dovetail_female': 'Dovetail test · female',
        'test_pin_male': 'Pin test · male', 'test_pin_female': 'Pin test · female',
    }
    quantities = kit_parts(cfg)
    result = []
    for part, width, height, edge in all_specs(cfg):
        name = spec_name(part, width, height, edge)
        if part == 'top_rail':
            label = f'Top rail · {edge} · {width} × {height} mm'
        elif part == 'filler':
            label = f'Side filler · {width} × 140 mm'
        elif part == 'panel_lid':
            label = f'Insulation back skin · {width} mm'
        else:
            label = labels[part]
        result.append({'name': name, 'label': label, 'quantity': quantities[name],
                       'part': part, 'width': width, 'height': height, 'edge': edge})
    return result


def panel_lid_counts(cfg):
    counts = Counter()
    counts[140] += cfg['solid_count']
    if cfg['controller'] != 'none':
        counts[80] += cfg['rows'] - 1
    for width in cfg['left_panels'] + cfg['right_panels']:
        if width >= 40:
            counts[width] += cfg['rows']
    return {width: count for width, count in counts.items() if count}


def foam_cuts(cfg):
    cuts = [{'for': f'{width} mm solid panel', 'width': width - 17, 'height': 121,
             'thickness': cfg['depth'] - 5, 'quantity': count}
            for width, count in panel_lid_counts(cfg).items()] if cfg['insulated'] else []
    if cfg['fan_covers'] and cfg['fan_count']:
        cuts.append({'for': 'Off-cycle fan cover', 'width': 121, 'height': 121,
                     'thickness': cfg['cover_depth'] - 10, 'quantity': cfg['fan_count']})
    return cuts


def _int(raw, key, default, low, high):
    try:
        value = int(raw.get(key, default))
    except (TypeError, ValueError):
        value = default
    return max(low, min(high, value))


def _clearance(raw, key):
    try:
        value = float(raw.get(key, 0.30))
    except (TypeError, ValueError):
        value = 0.30
    if not 0.10 <= value <= 0.80:
        value = 0.30
    return round(value, 2)


def _fit_panel_list(values, target):
    """Keep entered widths where possible and make their total fit the opening."""
    if target == 0:
        return []
    widths = [max(22, min(220, value)) for value in values[:20]]
    if not widths:
        return split_panels(target)
    while sum(widths) != target:
        difference = target - sum(widths)
        if difference > 0:
            index = next((i for i in range(len(widths)-1, -1, -1) if widths[i] < 220), None)
            if index is not None:
                widths[index] += min(difference, 220 - widths[index])
            elif difference >= 22:
                widths += split_panels(difference)
            else:
                difference += widths.pop()
                widths += split_panels(difference)
        else:
            index = next((i for i in range(len(widths)-1, -1, -1) if widths[i] > 22), None)
            if index is not None:
                widths[index] -= min(-difference, widths[index] - 22)
            else:
                widths.pop()
                if not widths:
                    widths = split_panels(target)
    return widths


def _entered_panels(value):
    result = []
    for item in value.split(',')[:20]:
        try:
            result.append(int(item.strip()))
        except ValueError:
            pass
    return result


def resolve(raw):
    """Turn UI choices into a valid printable configuration without a fit error."""
    width = _int(raw, 'width', 664, 200, 4000)
    height = _int(raw, 'height', 280, 140, 1200)
    clearance_x = _int(raw, 'clearance_x', 0, 0, 20)
    clearance_y = min(_int(raw, 'clearance_y', 0, 0, 20), height - 140)
    wanted_slots = _int(raw, 'slots', 3, 1, 20)
    wanted_rows = _int(raw, 'rows', 2, 1, 8)
    controller = raw.get('controller', 'right')
    if controller not in ('none', 'left', 'right'):
        controller = 'right'
    side = raw.get('side', 'right') if raw.get('side') in ('left', 'right', 'split') else 'right'
    mode = raw.get('panel_mode', 'auto') if raw.get('panel_mode') in ('auto', 'manual') else 'auto'
    chosen = None
    for candidate_controller in (controller, 'none') if controller != 'none' else ('none',):
        for candidate_clearance in range(clearance_x, -1, -1):
            for candidate_slots in range(wanted_slots, 0, -1):
                remainder = width - candidate_clearance - 24 - candidate_slots * 140 - (80 if candidate_controller != 'none' else 0)
                if remainder == 0 or remainder >= 22:
                    chosen = (candidate_controller, candidate_clearance, candidate_slots, remainder)
                    break
            if chosen:
                break
        if chosen:
            break
    # Width >= 200 guarantees at least one 140 mm cell with a printable filler.
    controller, clearance_x, slots, remainder = chosen
    rows = min(wanted_rows, (height - clearance_y) // 140)
    available_rail = height - clearance_y - rows * 140
    rail = min(_int(raw, 'rail', 0, 0, 100), available_rail)
    if rail:
        rail = max(10, rail) if available_rail >= 10 else 0
    sash_slot_w = _int(raw, 'sash_slot_w', 22, 6, 50)
    sash_engagement = _int(raw, 'sash_engagement', 10, 3, 20)
    try:
        sash_gasket = max(0.5, min(3, float(raw.get('sash_gasket', 2))))
    except (TypeError, ValueError):
        sash_gasket = 2
    try:
        sash_thickness = max(4, min(44, float(raw.get('sash_thickness', 18))))
    except (TypeError, ValueError):
        sash_thickness = 18
    if rail:
        sash_engagement = min(sash_engagement, rail - 7)
    sash_gasket = min(sash_gasket, sash_engagement - 0.5)
    if sash_thickness + 2 * sash_gasket < 6:
        sash_gasket = (6 - sash_thickness) / 2
    sash_slot_w = ceil(sash_thickness + 2 * sash_gasket)
    if sash_slot_w > 50:
        sash_slot_w = 50
        sash_thickness = 50 - 2 * sash_gasket
    louvers = raw.get('louvers', '1') != '0'
    depth = _int(raw, 'depth', 55, 32, 250)
    if louvers:
        depth = max(depth, 50)
    if rail:
        depth = max(depth, sash_slot_w + 29)
    insulated = raw.get('insulated', '1') != '0'
    fan_covers = raw.get('fan_covers', '1') != '0'
    cover_depth = _int(raw, 'cover_depth', 45, 20, 80)
    dovetail_clearance = _clearance(raw, 'dovetail_clearance')
    pin_clearance = _clearance(raw, 'pin_clearance')
    def fit_float(key, default, low, high):
        try:
            return max(low, min(high, float(raw.get(key, default))))
        except (TypeError, ValueError):
            return default
    magnet_d = fit_float('magnet_d', 6, 4, 8)
    magnet_h = fit_float('magnet_h', 2, 1, 3)
    strike_d = max(magnet_d, fit_float('strike_d', 9, 4, 10))
    strike_h = fit_float('strike_h', 1, 0.5, 1.5)
    magnet_clearance = fit_float('magnet_clearance', 0.20, 0.10, 0.60)
    cleat_clearance = fit_float('cleat_clearance', 0.30, 0.10, 0.80)
    gasket_thickness = fit_float('gasket_thickness', 1.2, 0.5, 2)

    old_rows = (raw.get('pattern') or '').split('/')
    pattern = '/'.join(''.join(old_rows[r][c] if r < len(old_rows) and c < len(old_rows[r]) and old_rows[r][c] in 'FS' else 'F'
                               for c in range(slots)) for r in range(rows))
    left = _entered_panels(raw.get('left_panels', ''))
    right = _entered_panels(raw.get('right_panels', ''))
    if mode == 'manual':
        focus = raw.get('panel_focus', '')
        if focus == 'right_panels':
            right_total = max(0, min(sum(right), remainder))
            left_total = remainder - right_total
        else:
            left_total = max(0, min(sum(left), remainder))
            right_total = remainder - left_total
        if 0 < left_total < 22:
            left_total, right_total = 0, remainder
        if 0 < right_total < 22:
            left_total, right_total = remainder, 0
        left = _fit_panel_list(left, left_total)
        right = _fit_panel_list(right, right_total)

    normalized = {'width': str(width), 'height': str(height), 'slots': str(slots), 'rows': str(rows),
                  'clearance_x': str(clearance_x), 'clearance_y': str(clearance_y),
                  'controller': controller, 'side': side, 'panel_mode': mode,
                  'left_panels': ', '.join(map(str, left)) if mode == 'manual' else raw.get('left_panels', ''),
                  'right_panels': ', '.join(map(str, right)) if mode == 'manual' else raw.get('right_panels', ''),
                  'rail': str(rail), 'depth': str(depth), 'sash_slot_w': str(sash_slot_w),
                  'sash_engagement': str(sash_engagement),
                  'sash_thickness': f'{sash_thickness:.2f}', 'sash_gasket': f'{sash_gasket:.2f}',
                  'louvers': '1' if louvers else '0',
                  'insulated': '1' if insulated else '0',
                  'fan_covers': '1' if fan_covers else '0', 'cover_depth': str(cover_depth),
                  'dovetail_clearance': f'{dovetail_clearance:.2f}',
                  'pin_clearance': f'{pin_clearance:.2f}',
                  'magnet_d': f'{magnet_d:.2f}', 'magnet_h': f'{magnet_h:.2f}',
                  'strike_d': f'{strike_d:.2f}', 'strike_h': f'{strike_h:.2f}',
                  'magnet_clearance': f'{magnet_clearance:.2f}',
                  'cleat_clearance': f'{cleat_clearance:.2f}',
                  'gasket_thickness': f'{gasket_thickness:.2f}',
                  'pattern': pattern}
    cfg = validated(normalized)
    adjusted = [key for key in ('width', 'height', 'slots', 'rows', 'clearance_x', 'clearance_y', 'controller', 'rail',
                               'depth', 'sash_slot_w', 'sash_engagement', 'sash_thickness', 'sash_gasket', 'louvers',
                               'insulated', 'fan_covers', 'cover_depth',
                               'dovetail_clearance', 'pin_clearance', 'magnet_d', 'magnet_h',
                               'magnet_clearance', 'cleat_clearance', 'gasket_thickness',
                               'strike_d', 'strike_h')
                if str(raw.get(key, normalized[key])) != normalized[key]]
    if mode == 'manual' and (_entered_panels(raw.get('left_panels', '')) != cfg['left_panels'] or
                             _entered_panels(raw.get('right_panels', '')) != cfg['right_panels']):
        adjusted.append('panel widths')
    return cfg, normalized, adjusted
