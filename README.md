# kid-games

A small Zola site for kid-games.dev, with responsive game tiles and automatic
light/dark styling based on the device preference. Alphabetical Adventure is
the first playable game; the other game pages are placeholders.

## Local development

Install [Zola 0.23.6](https://www.getzola.org/documentation/getting-started/installation/),
then run these commands from the repository root:

```sh
zola serve
```

Open http://127.0.0.1:1111. To validate or generate the site:

```sh
zola check
zola build
```

Generated files go into `public/` and are not committed.

## Add a game

Each game has a directory under `content/`, containing an `index.md`. Copy an
existing game directory and edit its title, description, weight (tile order),
and icon. The root page lists these games automatically. The shared
`templates/game.html` provides an HTML5 canvas placeholder. The alphabetical
game uses `templates/alphabetical-order.html` and `static/alphabetical-order.js`;
it loads the tagged word bank from `static/words.json`. Each new round randomly
selects 12 appropriate words; retries keep the same set in a new order.

## Alphabetical Adventure word bank

`static/words.json` contains about 25,000 unique words and terms in tagged groups.
These include scientific names and established multiword names, not invented
inflections or filler. Groups keep the bank compact:
each word inherits the group's `tags`. When a word appears in multiple groups,
`static/alphabet-word-lists.mjs` merges its tags case-insensitively, so it is never
selected twice in one round. Add words or groups using this structure:

```json
{"tags": ["general", "vowel-team"], "words": ["rain", "boat", "seed"]}
```

The `general` tag makes a word eligible for the first two levels. Other tags
include `two-letter-blend`, `three-letter-blend`, `vowel-team`, `dinosaurs`,
`halloween`, and everyday themes such as `animals` and `food`. Phonics tags
describe consonant blends and vowel spelling patterns; words may have several
tags. Two-letter digraphs such as `sh` and `ch` are not consonant blends.
Theme-only words are excluded from the general pool unless also tagged
`general`. Future custom lists can use the same format. Single spaces and hyphens
are allowed in compound terms such as `sweet pea` and `black-eyed susan`.

Themes cover spring, summer, autumn, winter, birthdays, and secular observances
including New Year, Valentine's Day (friendship and kindness), Earth Day, Arbor
Day, Independence Day, Labor Day, and Thanksgiving (food and gratitude).
International observances include World Book Day, World Oceans Day, the
International Day of Peace, and World Kindness Day.
Other collections cover flowers, gardening, space, weather, rocks, oceans,
habitats, insects, chemistry, physics, computing, robotics, mathematics,
archaeology, ancient civilizations, medieval crafts, exploration, fossils,
geography, art, music, crafts, stories, sports, and pets. Historical themes
focus on everyday life and discoveries, not religion or warfare.

The original 1,439-word elementary pool and 84 dinosaur names remain unchanged.
The larger, subject-screened WordNet collection is tagged `advanced` and
`wordnet`, **not** `general` or `dinosaurs`, so it cannot accidentally introduce
obscure taxonomy or advanced vocabulary into the current game. This imported
collection is automatically screened, not individually teacher-reviewed;
review entries before promoting them into a playable elementary pool.

### Sources and rebuilding

Seasonal, holiday, history, and other small theme groups are authored here.
The expanded collection is drawn from Princeton WordNet 3.0 with its permissive
redistribution license preserved in `static/wordnet-license.txt`. Source details
and the archive checksum are included in `words.json`. No dictionary service or
network connection beyond loading the site's JSON is required to play.

`tools/expand-word-bank.py` admits selected subject categories, excludes
unsuitable subject hierarchies, screens definitions across **all noun senses**
for adult, offensive, religious, and violent content, and applies a term guard.
It uses deterministic sampling and case-insensitive deduplication to produce
25,000 entries, preserving manually authored groups. The checks reduce risk
but are not a substitute for an educator reviewing new playable lists.

Download and extract the pinned WordNet archive listed in `words.json`, verify
its SHA-256 checksum, and run:

```sh
python3 tools/expand-word-bank.py --wordnet /path/to/extracted/wordnet
```

The builder also verifies the noun database checksum. Rebuilding requires only
Python's standard library and produces the same bank from the same inputs.

Level one uses 12 different first letters. Level two uses six pairs with matching
first letters but different second letters, so third letters are not needed.
The dinosaur level includes at least one pair with matching first two letters.
Selection validates the bank and reports loading errors instead of substituting
a fixed word set.

Run the word-bank checks (also run by CI) with:

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p '*_test.py'
```

For a standalone HTML5 game, place its HTML, JavaScript, and assets in
`static/<game-name>/`; Zola copies these unchanged into the matching output
directory. Remove the corresponding content placeholder first so that both
sources do not generate the same URL.

## GitHub Pages

In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
The Pages workflow checks and builds pull requests, then builds and deploys
pushes to `main`. It can also be run manually on `main`.

Deployment uses the URL supplied by GitHub Pages, including any project path.
For `kid-games.dev`, configure that custom domain in Pages settings and configure
its DNS using [GitHub's custom domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
Enable **Enforce HTTPS** once the certificate is ready. The `base_url` in
`zola.toml` is the default for local builds; the workflow overrides it with the
configured Pages URL.
