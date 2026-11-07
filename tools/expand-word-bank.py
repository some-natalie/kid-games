"""Rebuild the subject-screened WordNet portion of the checked-in word bank."""

import argparse
import hashlib
import json
import re
from functools import cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASH = "cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59"
NOUN_HASH = "489f145e0f68877c0be5bd0eb4117adaaac52f38f6204eb8d85dbe2158b614cc"
SOURCE_TAG = "wordnet"
TARGET = 25000
SUBJECTS = {
    5: ["animals", "biology"],
    6: ["objects"],
    13: ["food"],
    17: ["nature", "geology"],
    19: ["nature", "science"],
    20: ["plants", "botany"],
    23: ["mathematics"],
    25: ["shapes", "mathematics"],
    28: ["time"],
}
THEMES = {
    "bird": "birds", "insect": "insects", "fish": "fish",
    "mammal": "mammals", "reptile": "reptiles", "dinosaur": "dinosaurs",
    "flower": "flowers", "tree": "trees", "fruit": "fruit",
    "vegetable": "vegetables", "musical_instrument": "music",
    "vehicle": "transportation", "clothing": "clothing",
    "furniture": "home", "building": "architecture", "tool": "tools",
    "game": "games", "sport": "sports", "fabric": "textiles",
    "container": "containers", "machine": "engineering",
    "rock": "rocks", "mineral": "minerals", "celestial_body": "space",
    "weather": "weather",
}
EXCLUDED_ROOTS = {
    "weapon", "ammunition", "explosive", "bomb", "military_vehicle",
    "military_uniform", "drug", "controlled_substance", "alcohol",
    "alcoholic_beverage", "tobacco", "smoking", "cigarette",
    "medical_instrument", "surgical_instrument", "contraceptive",
    "restraint", "instrument_of_execution", "torture",
    "religious_symbol", "religious_building", "place_of_worship",
    "religious_person", "religious_ceremony", "religious_text",
    "religious_holiday", "holy_day", "holy_day_of_obligation",
    "jewish_calendar_month", "islamic_calendar_month",
    "jewish_calendar", "islamic_calendar", "church_calendar",
    "burial", "coffin", "grave", "gambling", "pornography",
    "military_installation", "military_equipment", "prison",
}
UNSUITABLE = re.compile(
    r"\b(offensive|vulgar|obscene|derogatory|disparaging|slur|profanity|"
    r"sexual|sexually|genital|genitals|pornographic|pornography|erotic|"
    r"intercourse|prostitute|prostitution|rape|rapist|incest|"
    r"religious|religion|worship|deity|deities|theology|sacred|"
    r"christian|christianity|judaism|islam|buddhism|hinduism|"
    r"weapon|weapons|ammunition|warfare|torture|execution|"
    r"narcotic|narcotics|cocaine|heroin|marijuana|cannabis|"
    r"alcoholic|intoxicating|intoxicated|drunk|drunken|tobacco|cigarette|"
    r"gambling|suicide|military|slavery|slave|prison|"
    r"gun|rifle|pistol|bomb|missile|grenade|"
    r"beer|wine|whiskey|whisky|brandy|vodka|liquor|"
    r"holy|church|prayer|christmas|bible|altar|mosque|synagogue|"
    r"corpse|funeral|burial|deceased|cremation|cemetery|dead)\b",
    re.IGNORECASE,
)
BLOCKED_WORDS = {
    "ass", "bastard", "bitch", "bloody", "boob", "boobs", "cock", "crap",
    "damn", "damned", "dick", "fag", "faggot", "fuck", "hell", "jerk",
    "nigger", "piss", "porn", "prick", "shit", "slut", "tit", "tits", "whore",
    "anal", "anus", "breast", "buttock", "buttocks", "clitoris", "condom",
    "erection", "fetish", "nude", "nudity", "orgasm", "penis", "rectum",
    "scrotum", "semen", "sex", "sperm", "testicle", "vagina", "vulva",
    "beer", "wine", "whiskey", "whisky", "brandy", "vodka", "gin", "rum",
    "booze", "liquor", "brewery", "winery", "winepress", "cigar",
    "gun", "rifle", "pistol", "gunboat", "gunlock", "gunstock",
    "gunnery", "gunshot", "gunsight", "gunpowder", "blowgun", "shotgun",
    "bomb", "missile", "grenade", "cartridge", "bayonet", "war",
    "prison", "funeral", "death", "deathrate", "deathtrap", "deathcap",
    "dead", "corpse", "gallows", "guillotine",
    "holy", "church", "prayer", "christ", "christopher", "christmas",
    "christmasberry", "christmastide", "bible", "biblical", "christian",
    "jew", "jewish", "islamic", "muslim", "hindu", "buddhist", "buddha",
    "easter", "lent", "lenten", "hanukkah", "chanukah", "ramadan",
    "diwali", "nissan", "sabbath", "sabbatic", "sabbatical", "seder",
    "menorah", "rosary", "crucifix", "crucifixion",
    "rapeseed", "clitoria", "clitocybe",
    "military", "slave", "slavery", "casino", "altar", "temple", "mosque",
    "synagogue", "monastery", "nunnery", "deity", "god", "goddess",
    "saint", "devil", "demon", "sword", "spear", "bullet", "torpedo",
    "idiot", "dunce", "moron", "imbecile",
    "jewfish", "jewbush", "gypsy", "gypsyweed", "gypsywort",
}
EXPLICIT_FRAGMENTS = re.compile(r"nigg|fagg|fuck|shit|cunt", re.IGNORECASE)


def suitable_term(word):
    return not (
        UNSUITABLE.search(word)
        or EXPLICIT_FRAGMENTS.search(word)
        or set(re.split("[ -]", word.lower())) & BLOCKED_WORDS
    )


def read_nodes(directory):
    source = (directory / "data.noun").read_bytes()
    if hashlib.sha256(source).hexdigest() != NOUN_HASH:
        raise ValueError("Expected the pinned WordNet 3.0 noun database.")
    nodes = {}
    for line in source.decode("utf8").splitlines():
        if not line or not line[0].isdigit():
            continue
        fields, gloss = line.split("|", 1)
        fields = fields.split()
        count = int(fields[3], 16)
        pointer_start = 4 + count * 2
        pointer_count = int(fields[pointer_start])
        pointers = [
            fields[pointer_start + 1 + index * 4:pointer_start + 5 + index * 4]
            for index in range(pointer_count)
        ]
        nodes[fields[0]] = {
            "subject": int(fields[1]),
            "words": fields[4:4 + count * 2:2],
            "parents": [pointer[1] for pointer in pointers if pointer[0] in ("@", "@i")],
            "gloss": gloss,
        }
    return nodes


def expand(directory, output):
    nodes = read_nodes(directory)

    @cache
    def ancestors(offset):
        return frozenset({offset}).union(
            *(ancestors(parent) for parent in nodes[offset]["parents"])
        )

    roots = {}
    for offset, node in nodes.items():
        for word in (word.lower() for word in node["words"]):
            if word in THEMES or word in EXCLUDED_ROOTS:
                roots.setdefault(word, set()).add(offset)
    excluded = set().union(*(roots.get(word, set()) for word in EXCLUDED_ROOTS))
    unsafe_words = set()
    for node in nodes.values():
        if UNSUITABLE.search(node["gloss"]):
            unsafe_words.update(word.lower().replace("_", " ") for word in node["words"])

    bank = json.loads(output.read_text())
    groups = [group for group in bank["groups"] if SOURCE_TAG not in group["tags"]]
    existing = {word.lower() for group in groups for word in group["words"]}
    candidates = {}
    for offset, node in nodes.items():
        if node["subject"] not in SUBJECTS:
            continue
        lineage = ancestors(offset)
        if lineage & excluded or UNSUITABLE.search(node["gloss"]):
            continue
        tags = set(SUBJECTS[node["subject"]])
        for root, theme in THEMES.items():
            if lineage & roots.get(root, set()):
                tags.add(theme)
        for raw in node["words"]:
            word = raw.lower().replace("_", " ")
            if not re.fullmatch(r"[a-z]+(?:[ -][a-z]+)*", word):
                continue
            if len(word) > 60 or len(word.split()) > 5:
                continue
            if word in unsafe_words or not suitable_term(word):
                continue
            # The playable dinosaur pool remains the hand-reviewed collection.
            tags.discard("dinosaurs")
            if word not in existing:
                candidates.setdefault(word, set()).update(tags)

    needed = TARGET - len(existing)
    if needed < 0 or len(candidates) < needed:
        raise ValueError(f"Need {needed} entries; only {len(candidates)} screened candidates.")
    # Hash ordering samples across the alphabet without machine-dependent randomness.
    selected = sorted(candidates, key=lambda word: hashlib.sha256(word.encode()).hexdigest())[:needed]
    tagged_groups = {}
    for word in selected:
        tags = tuple(sorted({SOURCE_TAG, "advanced", *candidates[word]}))
        tagged_groups.setdefault(tags, []).append(word)
    for tags, words in sorted(tagged_groups.items()):
        groups.append({"tags": list(tags), "words": sorted(words)})
    bank["groups"] = groups
    bank["sources"] = [{
        "name": "Princeton WordNet 3.0",
        "url": "https://wordnet.princeton.edu/",
        "download": "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip",
        "sha256": SOURCE_HASH,
        "license": "wordnet-license.txt",
        "selection": "Subject allowlist, excluded hierarchies, and cross-sense content screening; advanced pool only.",
    }]
    output.write_text(json.dumps(bank, indent=2, ensure_ascii=True) + "\n")
    print(f"{len(existing) + len(selected)} unique entries; {len(candidates)} screened source candidates.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wordnet", required=True, type=Path, help="Extracted WordNet 3.0 directory")
    parser.add_argument("--output", type=Path, default=ROOT / "static/words.json")
    args = parser.parse_args()
    expand(args.wordnet, args.output)
