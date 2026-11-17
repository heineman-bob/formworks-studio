"""Transport and archive contracts without running expensive OpenSCAD renders."""

import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
from config import validated
from kit import package
from server import Handler


class ApiTests(unittest.TestCase):
    def request(self, path):
        handler = Handler.__new__(Handler)
        handler.path = path
        responses = []
        handler.respond = lambda body, ctype='application/octet-stream', status=200, filename=None: (
            responses.append((status, ctype, body))
        )
        handler.do_GET()
        return responses[0]

    def test_resolve_returns_print_plan_and_no_fit_error(self):
        status, content_type, body = self.request(
            '/api/resolve?width=664&height=300&slots=3&rows=2&rail=20'
        )
        data = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(content_type, 'application/json')
        self.assertEqual(data['config']['sash_slot_w'], 22)
        self.assertEqual(data['quantities']['fan'], 6)
        self.assertGreater(data['hardware']['sash_gasket_tape_mm'], 0)

    def test_health_does_not_require_configuration(self):
        status, content_type, body = self.request('/api/health')
        self.assertEqual((status, content_type), (200, 'application/json'))
        self.assertEqual(json.loads(body), {'status': 'ok'})

    def test_unknown_api_path_is_404(self):
        status, _, body = self.request('/api/does-not-exist')
        self.assertEqual(status, 404)
        self.assertIn(b'Not found', body)

    def test_designer_planning_module_is_served(self):
        status, content_type, body = self.request('/planning.mjs')
        self.assertEqual(status, 200)
        self.assertEqual(content_type, 'text/javascript; charset=utf-8')
        self.assertIn(b'export function specs', body)

    def test_zip_contains_each_distinct_stl_and_manifest(self):
        cfg = validated({'width': '664', 'height': '300', 'rail': '20'})
        with tempfile.TemporaryDirectory() as directory:
            fake_stl = Path(directory) / 'part.stl'
            fake_stl.write_bytes(b'\x00' * 84)
            with patch('kit.stl', return_value=fake_stl):
                archive_bytes = package(cfg)
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            names = archive.namelist()
            manifest = json.loads(archive.read('configuration.json'))
            self.assertEqual(
                len([name for name in names if name.startswith('stl/')]),
                len(manifest['components']),
            )
            self.assertEqual(manifest['quantities']['fan'], 6)
            self.assertIn('lower sash', archive.read('BUILD.txt').decode())


if __name__ == '__main__':
    unittest.main()
