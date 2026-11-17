import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
from config import all_specs, components, foam_cuts, kit_parts, resolve, validated


class ConfigTests(unittest.TestCase):
    def test_mesh_cache_reuses_parts_when_unrelated_settings_change(self):
        from server import mesh_key
        base = validated({'width': '664', 'height': '280', 'depth': '55'})
        wider = validated({'width': '914', 'height': '280', 'depth': '55'})
        deeper = validated({'width': '664', 'height': '280', 'depth': '65'})
        self.assertEqual(mesh_key('fan', cfg=base), mesh_key('fan', cfg=wider))
        self.assertNotEqual(mesh_key('fan', cfg=base), mesh_key('fan', cfg=deeper))
        self.assertEqual(mesh_key('grill', cfg=base), mesh_key('grill', cfg=deeper))
        taller_magnet = validated({'magnet_h': '3'})
        self.assertEqual(mesh_key('fan_cover_lid', cfg=base), mesh_key('fan_cover_lid', cfg=taller_magnet))
        self.assertNotEqual(mesh_key('magnet_spacer', cfg=base), mesh_key('magnet_spacer', cfg=taller_magnet))

    def test_lower_sash_gasket_fits_channel_and_appears_in_hardware(self):
        from server import hardware
        cfg, normalized, _ = resolve({'height': '300', 'rail': '20',
                                      'sash_thickness': '31', 'sash_gasket': '2',
                                      'sash_slot_w': '22'})
        self.assertEqual(cfg['sash_slot_w'], 35)
        self.assertEqual(cfg['sash_thickness'], 31)
        self.assertEqual(cfg['sash_gasket'], 2)
        self.assertEqual(hardware(cfg)['sash_gasket_tape_mm'], 3 * cfg['usable_width'])
        self.assertEqual(validated(normalized), cfg)

    def test_wide_opening_splits_into_printable_panels(self):
        cfg = validated({'width': '3000', 'height': '280', 'slots': '3', 'rows': '2'})
        panels = cfg['right_panels']
        self.assertGreater(len(panels), 1)
        self.assertEqual(sum(panels), 3000 - 24 - 3 * 140 - 80)
        self.assertTrue(all(22 <= width <= 220 for width in panels))
        self.assertEqual(sum(width for _, width in cfg['columns']), cfg['usable_width'])

    def test_extra_fan_can_replace_140_mm_panel(self):
        cfg = validated({'width': '664', 'height': '280', 'slots': '4', 'rows': '2'})
        self.assertEqual(cfg['left_panels'] + cfg['right_panels'], [])
        self.assertEqual(cfg['fan_count'], 8)

    def test_mixed_rows_manual_panels_and_rail_quantities(self):
        cfg = validated({'width': '664', 'height': '300', 'slots': '3', 'rows': '2',
                         'pattern': 'FSF/SSF', 'panel_mode': 'manual',
                         'left_panels': '60', 'right_panels': '80', 'rail': '20'})
        parts = kit_parts(cfg)
        self.assertEqual(cfg['top_gap'], 0)
        self.assertEqual(parts['fan'], 3)
        self.assertEqual(parts['spacer'], 3)
        self.assertEqual(parts['filler_60mm'], 2)
        self.assertEqual(parts['filler_80mm'], 2)
        self.assertEqual(sum(count for name, count in parts.items() if name.startswith('top_rail_')),
                         len(cfg['columns']))
        self.assertIn(('top_rail', 12, 20, 'left'), all_specs(cfg))
        self.assertIn(('top_rail', 12, 20, 'right'), all_specs(cfg))

    def test_invalid_manual_total_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'required'):
            validated({'panel_mode': 'manual', 'left_panels': '60', 'right_panels': '60'})

    def test_too_tall_rail_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'taller'):
            validated({'height': '280', 'rail': '20'})

    def test_resolver_keeps_exact_fit_and_repairs_impossible_choices(self):
        exact, normalized, adjusted = resolve({'width': '664', 'height': '280',
                                                'slots': '4', 'rows': '2'})
        self.assertEqual(exact['left_panels'] + exact['right_panels'], [])
        self.assertEqual(adjusted, [])
        self.assertEqual(validated(normalized), exact)
        small, normalized, adjusted = resolve({'width': '200', 'height': '140',
                                                'slots': '4', 'rows': '2',
                                                'clearance_x': '20', 'clearance_y': '20',
                                                'controller': 'right', 'rail': '50'})
        self.assertEqual(small['controller'], 'none')
        self.assertEqual(small['slots'], 1)
        self.assertEqual(small['rows'], 1)
        self.assertEqual(small['rail'], 0)
        self.assertEqual(sum(width for _, width in small['columns']), small['usable_width'])
        self.assertTrue(adjusted)

    def test_resolver_adjusts_manual_panels_and_components_match_quantities(self):
        cfg, normalized, _ = resolve({'width': '664', 'height': '300', 'slots': '3', 'rows': '2',
                                      'rail': '20', 'panel_mode': 'manual',
                                      'left_panels': '60', 'right_panels': '70',
                                      'panel_focus': 'left_panels'})
        self.assertEqual(cfg['left_panels'], [60])
        self.assertEqual(cfg['right_panels'], [80])
        self.assertEqual(validated(normalized), cfg)
        self.assertEqual({item['name']: item['quantity'] for item in components(cfg)}, kit_parts(cfg))

    def test_sash_channel_and_louvers_follow_selected_fans(self):
        cfg, normalized, adjusted = resolve({'width': '664', 'height': '300', 'slots': '3', 'rows': '2',
                                              'pattern': 'FSF/SSF', 'rail': '20', 'depth': '32',
                                              'sash_slot_w': '40', 'sash_engagement': '18',
                                              'sash_thickness': '36', 'sash_gasket': '2',
                                              'louvers': '1'})
        self.assertEqual(cfg['depth'], 69)
        self.assertEqual(cfg['sash_engagement'], 13)
        self.assertIn('depth', adjusted)
        self.assertEqual(cfg['fan_count'], 3)
        self.assertEqual(cfg['louver_screws'], 12)
        self.assertEqual(kit_parts(cfg)['louver'], 3)
        self.assertEqual(validated(normalized), cfg)

    def test_louvers_can_be_omitted_for_shallow_body(self):
        cfg, normalized, _ = resolve({'depth': '32', 'louvers': '0'})
        self.assertEqual(cfg['depth'], 32)
        self.assertNotIn('louver', kit_parts(cfg))
        self.assertEqual(cfg['louver_screws'], 0)
        self.assertEqual(validated(normalized), cfg)

    def test_insulated_cassettes_and_fan_covers_have_matching_cut_list(self):
        cfg = validated({'width': '664', 'height': '300', 'slots': '3', 'rows': '2',
                         'rail': '20', 'pattern': 'FSF/SSF', 'insulated': '1',
                         'fan_covers': '1', 'cover_depth': '45'})
        parts = kit_parts(cfg)
        self.assertEqual(parts['panel_lid_140mm'], 5)
        self.assertEqual(parts['panel_lid_80mm'], 1)
        self.assertEqual(parts['fan_cover'], 3)
        self.assertEqual(parts['fan_cover_lid'], 3)
        self.assertEqual(parts['magnet_spacer'], 6)
        cuts = {item['for']: item for item in foam_cuts(cfg)}
        self.assertEqual(cuts['140 mm solid panel']['thickness'], 50)
        self.assertEqual(cuts['140 mm solid panel']['quantity'], 5)
        self.assertEqual(cuts['Off-cycle fan cover']['thickness'], 35)
        self.assertEqual(cuts['Off-cycle fan cover']['quantity'], 3)
        self.assertEqual({item['name']: item['quantity'] for item in components(cfg)}, parts)

    def test_magnetic_cover_dimensions_resolve_and_count(self):
        from server import hardware
        cfg, normalized, _ = resolve({'magnet_d': '8', 'magnet_h': '3',
                                      'strike_d': '7', 'strike_h': '1.5',
                                      'magnet_clearance': '0.6', 'cleat_clearance': '0.8',
                                      'gasket_thickness': '2'})
        self.assertEqual(validated(normalized), cfg)
        self.assertEqual(cfg['strike_d'], 8)
        self.assertEqual(kit_parts(cfg)['magnet_spacer'], 2 * cfg['fan_count'])
        self.assertEqual(hardware(cfg)['cover_magnets'], 2 * cfg['fan_count'])
        self.assertEqual(hardware(cfg)['M3_strike_washer_screws'], 2 * cfg['fan_count'])

    def test_narrow_filler_stays_solid_without_unusable_foam_pocket(self):
        cfg = validated({'width': '200', 'height': '140', 'slots': '1', 'rows': '1',
                         'clearance_x': '14', 'controller': 'none',
                         'fan_covers': '0', 'insulated': '1'})
        self.assertEqual(cfg['right_panels'], [22])
        self.assertNotIn('panel_lid_22mm', kit_parts(cfg))
        self.assertEqual(foam_cuts(cfg), [])

    def test_no_foam_option_still_closes_every_wide_cassette(self):
        cfg = validated({'width': '664', 'height': '280', 'slots': '3', 'rows': '2',
                         'pattern': 'FSF/FFF', 'insulated': '0', 'fan_covers': '0'})
        parts = kit_parts(cfg)
        self.assertEqual(parts['panel_lid_140mm'], 3)
        self.assertEqual(parts['panel_lid_80mm'], 1)
        self.assertEqual(parts['panel_lid_140mm'],
                         next(item['quantity'] for item in components(cfg) if item['name'] == 'panel_lid_140mm'))
        self.assertEqual(foam_cuts(cfg), [])

    def test_independent_joint_clearances_and_fit_coupons(self):
        cfg, normalized, _ = resolve({'dovetail_clearance': '0.45', 'pin_clearance': '0.20'})
        self.assertEqual((cfg['dovetail_clearance'], cfg['pin_clearance']), (0.45, 0.20))
        self.assertEqual(validated(normalized), cfg)
        for part in ('test_dovetail_male', 'test_dovetail_female',
                     'test_pin_male', 'test_pin_female'):
            self.assertEqual(kit_parts(cfg)[part], 1)
            self.assertIn((part, 0, 0, 'middle'), all_specs(cfg))

    def test_deep_wall_extends_panel_foam_without_changing_fit(self):
        cfg = validated({'depth': '250', 'pattern': 'FSF/FFF'})
        self.assertEqual(cfg['depth'], 250)
        self.assertEqual(next(cut['thickness'] for cut in foam_cuts(cfg)
                              if cut['for'] == '140 mm solid panel'), 245)
        resolved, normalized, _ = resolve({'depth': '250', 'pattern': 'FSF/FFF'})
        self.assertEqual(resolved, cfg)
        self.assertEqual(validated(normalized), cfg)


if __name__ == '__main__':
    unittest.main()
