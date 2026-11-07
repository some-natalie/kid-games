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
selects appropriate words for the current level; retries keep the same set in a
new order.

The game is a 10-level quest that ramps from 4 words to 12:

| Level | Words | What changes |
|---|---|---|
| 1–3 | 4, 5, 6 | Every word starts with a different letter |
| 4–7 | 7, 8, 9, 10 | One to four pairs share a first letter (look at the second letter) |
| 8 | 11 | Adds a pair sharing two letters (look at the third letter) |
| 9 | 12 | Two third-letter pairs and four second-letter pairs |
| 10 | 12 | Dinosaur challenge, with at least one pair sharing two letters |

Arrange the list by dragging words up or down with a mouse, pen,
or finger, then press **Check order**. Dragging near the screen edge scrolls
the page; dropping outside the list or pressing Escape cancels a move.
Keyboard users can focus a word and use Up/Down, Home, or End to move it.
**Undo move** reverses the last change. Incorrect checks leave the list editable,
so players can fix their order without starting over.

Text and word tiles are sized for young readers. A vertical A–Z reference bar
stays pinned to the right side while scrolling, with space reserved so it does
not cover the game on phones or tablets. A correct answer shows a short
cheer plus either confetti bursting from a random corner or a sparkle shower
before **Next level** is offered. With reduced motion turned on, a few still
sparkles appear instead. Finishing level 10 shows a dancing dinosaur and
**Show your parent!**, then clears the saved quest so **Play again** starts at
level 1.

## Themes and browser preferences

Use **Pick your theme** before or during play. The default **ABC adventure (all
topics)** uses the letter rules above and the final dinosaur challenge.
Choosing a specific theme keeps the same 10-level word counts, using randomly
selected words from that theme without first- or second-letter restrictions.
Each theme keeps its own saved level, so changing themes resumes that theme or
starts it at level 1. Retries preserve the current set.
Only curated themes with at least 12 non-advanced entries appear in the menu.
Imported advanced vocabulary is never used by these themed rounds.

The chosen theme is stored in `localStorage` under
`kid-games.alphabetical-order.preferences`, as `{"version":1,"theme":"dinosaurs"}`.
Quest progress autosaves after each move, undo, and level change under
`kid-games.alphabetical-order.progress`, as
`{"version":1,"themes":{"dinosaurs":{"level":3,"roundWords":[...],"words":[...]}}}`.
Reloading offers **Keep playing level N** with the same words and order;
**Start a new quest** discards that theme's progress. Completing the quest
clears it.

Everything stays on that browser and site origin; no player name or scores are
sent anywhere. Clearing site data removes the preference and progress.
If storage is blocked, full, or contains invalid data, the game shows a notice
and remains playable. Unknown saved themes return to ABC adventure, and invalid
progress starts fresh.

## Alphabetical Adventure word bank

`static/words.json` contains about 25,000 unique words and terms in tagged groups.
These include scientific names and established multiword names, not invented
inflections or filler. Groups keep the bank compact:
each word inherits the group's `tags`. When a word appears in multiple groups,
`static/alphabet-word-lists.js` merges its tags case-insensitively, so it is never
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

ABC adventure levels use letters-only `general` words. Each comparison pair
shares exactly the letters before the one being taught, and every other word has
a unique first letter, so players never need a deeper letter than the level
teaches. Selection validates the bank and reports loading errors instead of substituting
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
checking and retrying, the full 10-level quest and finale, celebrations,
autosave and resume, theme persistence, and loading/storage
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

Browser ES modules use the `.js` extension so static hosts serve them with a
JavaScript content type. Browser tests also cover hosts that serve `.mjs` files
as binary downloads; those files cannot be imported by browsers.

The word list disables text selection, Safari long-press callouts, and native
browser dragging so they do not interrupt finger dragging. These protections
are limited to the word list; other page text remains selectable.

### Workflow security and updates

Every action is pinned to a full commit SHA with its version in a comment.
Workflows start with no token permissions and grant each job only what it
needs, with a comment explaining each permission. The `GitHub Actions security`
workflow runs [zizmor](https://docs.zizmor.sh/) in pedantic mode on every
workflow and on `dependabot.yml`. Run it locally with:

```sh
GH_TOKEN="$(gh auth token)" zizmor --persona=pedantic --collect=all .
```

Dependabot checks the GitHub Actions and npm manifests weekly. It waits until a
release is 7 days old and groups updates into one PR per ecosystem, with a
separate group for security fixes. The zizmor version is pinned in
`zizmor.yml`; Dependabot does not update it, so update it manually.

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
