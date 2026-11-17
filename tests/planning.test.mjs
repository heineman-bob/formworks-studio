import assert from 'node:assert/strict';
import test from 'node:test';
import { key, matrixComponents, spec, specs } from '../app/static/planning.mjs';

const layout = {
  depth: 55,
  dovetail_clearance: 0.3,
  pin_clearance: 0.3,
  louvers: true,
  fan_covers: true,
  fan_count: 2,
  solid_count: 1,
  controller: 'right',
  rows: 2,
  rail: 20,
  left_panels: [80],
  right_panels: [],
  columns: [
    ['left_cap', 12],
    ['filler', 80],
    ['slot', 140],
    ['controller', 80],
    ['right_cap', 12],
  ],
};

test('preview includes printable rail segments and fit coupons', () => {
  const parts = specs(layout);
  const rails = parts.filter((part) => part.part === 'top_rail');
  assert.equal(rails.length, 4);
  assert.deepEqual(
    rails.map((part) => part.edge),
    ['left', 'middle', 'middle', 'right'],
  );
  assert(parts.some((part) => part.part === 'test_pin_female'));
  assert(parts.some((part) => part.part === 'magnet_spacer'));
});

test('mesh keys change only for dimensions used by that part', () => {
  const fan = spec('fan');
  const grille = spec('grill');
  assert.notEqual(key(fan, layout), key(fan, { ...layout, depth: 60 }));
  assert.equal(key(grille, layout), key(grille, { ...layout, depth: 60 }));
});

test('foam cuts appear alongside printable parts in the matrix', () => {
  const matrix = matrixComponents(
    [{ part: 'fan', name: 'fan' }],
    [{ for: 'filler', quantity: 2, width: 70, height: 130, thickness: 40 }],
  );
  assert.equal(matrix.length, 2);
  assert.equal(matrix[1].kind, 'cut');
  assert.equal(matrix[1].quantity, 2);
});
