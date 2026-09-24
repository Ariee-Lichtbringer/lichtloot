import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('upload',Path(__file__).with_name('upload.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ReaderTests(unittest.TestCase):
    def test_inert_read_and_duplicates(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'SavedVariables.lua'
            item={'version':1,'game':'forever','itemId':240123}
            record='GFL1:'+json.dumps(item).encode().hex()
            path.write_text('os.execute("never run");\n"'+record+'"\n"'+record+'"')
            self.assertEqual(module.read_events(path),[item])
    def test_reject_era(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'export.txt'
            path.write_text('GFL1:'+json.dumps({'version':1,'game':'era'}).encode().hex())
            with self.assertRaises(ValueError):module.read_events(path)
    def test_no_redirects(self):
        with self.assertRaises(ValueError):module.NoRedirect().redirect_request(None,None,302,'',{},'https://other.example')
    def test_batches_and_fixed_endpoint(self):
        events=[{'version':1,'game':'forever','itemId':i} for i in range(251)]
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self):return b'{"success":true,"changed":1}'
        class Opener:
            def open(self,req,timeout):
                self.requests.append(req)
                return Response()
            requests=[]
        opener=Opener()
        with patch.object(module,'read_events',return_value=events),patch.object(module.urllib.request,'build_opener',return_value=opener):
            self.assertEqual(module.upload(Path('unused'),'guild','secret'),(251,2))
        self.assertEqual(len(opener.requests),2)
        self.assertEqual(opener.requests[0].full_url,'https://lichtloot-production.up.railway.app/api/forever')
        self.assertEqual(len(json.loads(opener.requests[1].data)['events']),1)
if __name__=='__main__':unittest.main()
