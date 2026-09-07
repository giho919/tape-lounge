import importlib.util
import json
import subprocess
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location("onchain_report", Path(__file__).with_name("onchain_report.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class Publication(unittest.TestCase):
    def test_dirty_working_copy_preserved_and_remote_updated(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            remote, source = base / "remote.git", base / "source"
            def run(*args, cwd=None):
                return subprocess.run(["git", *map(str,args)], cwd=cwd, text=True, capture_output=True, check=True)
            run("init", "--bare", "--initial-branch=main", remote)
            run("clone", remote, source)
            run("config", "user.name", "Test", cwd=source)
            run("config", "user.email", "test@example.invalid", cwd=source)
            (source / "unrelated.txt").write_text("original")
            run("add", ".", cwd=source)
            run("commit", "-m", "initial", cwd=source)
            run("push", "origin", "main", cwd=source)
            (source / "unrelated.txt").write_text("user work stays")
            def git(*args, repo=source):
                return subprocess.run(["git","-C",str(repo),*args], text=True, capture_output=True)
            now = datetime.now(timezone.utc)
            report = {"as_of":"2026-09-06","generated_at":now.isoformat(),"history":[{}]}
            with mock.patch.object(mod, "git", side_effect=git), mock.patch.object(mod.Path, "home", return_value=base):
                mod.publish_isolated(report, now, Path("reports/onchain.json"))
                mod.publish_isolated(report, now, Path("reports/onchain.json"))
            self.assertEqual((source / "unrelated.txt").read_text(), "user work stays")
            actual = run("--git-dir", remote, "show", "main:reports/onchain.json").stdout
            self.assertEqual(json.loads(actual), report)
            self.assertEqual(run("rev-list","--count","main",cwd=source).stdout.strip(), "1")
            self.assertEqual(run("--git-dir",remote,"rev-list","--count","main").stdout.strip(), "2")

    def test_commit_error_is_not_silently_skipped(self):
        with mock.patch.object(mod, "git", side_effect=[mock.Mock(returncode=0), mock.Mock(returncode=1)]):
            with self.assertRaises(RuntimeError):
                mod.publish(mod.REPO / "reports/onchain.json", datetime.now(timezone.utc))

if __name__ == "__main__":
    unittest.main()
