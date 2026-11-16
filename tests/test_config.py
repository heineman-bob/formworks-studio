import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
from config import all_specs, components, kit_parts, resolve, validated


class ConfigTests(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
