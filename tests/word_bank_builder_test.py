import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("builder", ROOT / "tools/expand-word-bank.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class WordBankSafetyTests(unittest.TestCase):
    def test_checked_in_entries_pass_the_content_guard(self):
        bank = json.loads((ROOT / "static/words.json").read_text())
        for group in bank["groups"]:
            for word in group["words"]:
                with self.subTest(word=word):
                    self.assertTrue(builder.suitable_term(word))

    def test_restricted_subjects_and_their_compounds_are_blocked(self):
        for word in [
            "wine bottle", "beer mug", "gun barrel", "prison camp",
            "prayer mat", "christmas tree", "church year", "slave ship",
            "military quarters", "holy week", "casino-hotel",
        ]:
            with self.subTest(word=word):
                self.assertFalse(builder.suitable_term(word))

    def test_benign_substrings_are_not_mistaken_for_restricted_words(self):
        for word in [
            "grape", "grapefruit", "trapezoid", "warbler", "cassowary",
            "salamander", "computer hardware", "whisk", "sweet pea",
        ]:
            with self.subTest(word=word):
                self.assertTrue(builder.suitable_term(word))
