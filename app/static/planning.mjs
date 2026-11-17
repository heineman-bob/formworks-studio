// Pure preview part planning; mirrors the validated server kit contract.
export function query(raw) {
  return new URLSearchParams(raw).toString();
}
export function spec(part, width = 0, height = 0, edge = 'middle') {
  return { part, width, height, edge };
}
export function matrixComponents(printParts, cuts) {
  return [
    ...printParts,
    ...cuts.map((cut, index) => ({
      name: `foam_cut_${index}`,
      part: 'foam_core',
      label: `${cut.for} foam core`,
      quantity: cut.quantity,
      width: cut.width,
      height: cut.height,
      thickness: cut.thickness,
      kind: 'cut',
    })),
  ];
}
export function key(item, cfg) {
  const common = ['depth', 'dovetail_clearance', 'pin_clearance'];
  const depends =
    {
      fan: [...common, 'louvers', 'strike_d', 'strike_h', 'cleat_clearance'],
      grill: [],
      louver: [],
      panel_lid: [],
      fan_cover: ['cover_depth'],
      fan_cover_lid: ['magnet_d', 'magnet_clearance', 'gasket_thickness'],
      magnet_spacer: ['magnet_d', 'magnet_h', 'magnet_clearance', 'gasket_thickness'],
      controller_lid: ['depth'],
      test_dovetail_male: [],
      test_dovetail_female: ['dovetail_clearance'],
      test_pin_male: ['depth'],
      test_pin_female: ['depth', 'pin_clearance'],
      left_cap: ['depth', 'pin_clearance'],
      right_cap: common,
      top_rail: [...common, 'sash_slot_w', 'sash_engagement'],
      controller: common,
      controller_blank: common,
      spacer: common,
      filler: common,
    }[item.part] || common;
  return [
    item.part,
    item.width,
    item.height,
    item.edge,
    ...depends.map((name) => cfg?.[name]),
  ].join(':');
}
export function specs(cfg) {
  const found = new Map();
  const add = (item) => found.set(key(item, cfg), item);
  add(spec('left_cap'));
  add(spec('right_cap'));
  for (const part of [
    'test_dovetail_male',
    'test_dovetail_female',
    'test_pin_male',
    'test_pin_female',
  ])
    add(spec(part));
  if (cfg.fan_count) {
    add(spec('fan'));
    add(spec('grill'));
    if (cfg.louvers) add(spec('louver'));
    if (cfg.fan_covers) {
      add(spec('fan_cover'));
      add(spec('fan_cover_lid'));
      add(spec('magnet_spacer'));
    }
  }
  if (cfg.solid_count) add(spec('spacer'));
  if (cfg.controller !== 'none') {
    add(spec('controller'));
    add(spec('controller_lid'));
    if (cfg.rows > 1) add(spec('controller_blank'));
  }
  for (const width of [...cfg.left_panels, ...cfg.right_panels]) add(spec('filler', width));
  if (cfg.solid_count) add(spec('panel_lid', 140));
  if (cfg.controller !== 'none' && cfg.rows > 1) add(spec('panel_lid', 80));
  for (const width of [...cfg.left_panels, ...cfg.right_panels])
    if (width >= 40) add(spec('panel_lid', width));
  if (cfg.rail)
    cfg.columns.forEach((column, i) => {
      const edge = i === 0 ? 'left' : i === cfg.columns.length - 1 ? 'right' : 'middle';
      add(spec('top_rail', column[1], cfg.rail, edge));
    });
  return [...found.values()];
}
