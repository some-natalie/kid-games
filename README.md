# kid-games

A small Zola site for kid-games.dev, with responsive game tiles and automatic
light/dark styling based on the device preference. Alphabetical Adventure is
the site's alphabetical-order game.

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

Each game has a directory under `content/`, containing an `index.md`. Set its
title, description, weight (tile order), template, and icon. The root page lists
these games automatically. The alphabetical
game uses `templates/alphabetical-order.html` and `static/alphabetical-order.js`;
it loads the tagged word bank from `static/words.json`. Each new round randomly
selects 12 appropriate words; retries keep the same set in a new order.

Arrange the full 12-word list by dragging words up or down with a mouse, pen,
or finger, then press **Check order**. Dragging near the screen edge scrolls
the page; dropping outside the list or pressing Escape cancels a move.
Keyboard users can focus a word and use Up/Down, Home, or End to move it.
**Undo move** reverses the last change. Incorrect checks leave the list editable,
so players can fix their order without starting over.

## Themes and browser preferences

Use **Pick your theme** before or during play. The default **ABC adventure (all
topics)** keeps the beginner progression and final dinosaur challenge.
Choosing a specific theme uses 12 randomly selected words from that theme for
every round, without first- or second-letter restrictions. Changing themes
starts a new game; retries preserve the current set and replays draw fresh sets.
Only curated themes with at least 12 non-advanced entries appear in the menu.
Imported advanced vocabulary is never used by these themed rounds.

The chosen theme is stored in `localStorage` under
`kid-games.alphabetical-order.preferences`, as `{"version":1,"theme":"dinosaurs"}`.
It stays on that browser and site origin; no player name, answers, or scores are
stored or sent anywhere. Clearing site data removes the preference.
If storage is blocked, full, or contains an invalid preference, the game shows
a notice and remains playable. Unknown saved themes return to ABC adventure.

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
npm test
npm run test:python
```

## Browser tests

With Zola on `PATH`, install and run the Playwright suite:

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

Playwright builds Zola for localhost and starts its own static server. Tests run
in Chromium, Safari's WebKit engine, and touch-enabled tablet Chromium.
They cover dragging, real touch input and edge scrolling, keyboard sorting,
checking and retrying, progression, theme persistence, and loading/storage
failures. Failure reports, screenshots, and traces are kept for seven days. Local reports appear
in `playwright-report/`; use `npx playwright show-report` to open them.

### Continuous integration

The Pages workflow builds once, then fans out:

1. `build` runs `zola check`, finds every game in `content/<game>/index.md`,
   builds a localhost copy of the site, and uploads it as the `test-site`
   artifact (plus the Pages artifact on `main`).
2. `test` runs a matrix of every game × `chromium`, `webkit`, and
   `touch-chromium`. Each job downloads the built site, serves it with
   `PREBUILT_SITE=1`, and runs only `tests/games/<game>/browser/`. The Chromium
   job also runs that game's Node (`*.test.mjs`) and Python (`*_test.py`) tests.
3. `deploy` publishes only after every matrix job passes.

Each game keeps its tests in `tests/games/<game>/`, with browser specs in a
`browser/` subdirectory. A new game joins the matrix automatically; the build
fails if a game has no browser specs.

For a standalone HTML5 game, place its HTML, JavaScript, and assets in
`static/<game-name>/`; Zola copies these unchanged into the matching output
directory. Avoid a corresponding content page so that both
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
