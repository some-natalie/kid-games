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
it loads the curated word bank from `static/words.json`. Each new round randomly
selects 12 appropriate words; retries keep the same set in a new order.

## Alphabetical Adventure word bank

`static/words.json` contains tagged groups of words. Groups keep the bank compact:
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
`general`. These groups are authored here, with no external dictionary or runtime
service required. Future custom lists can use the same format.

Level one uses 12 different first letters. Level two uses six pairs with matching
first letters but different second letters, so third letters are not needed.
The dinosaur level includes at least one pair with matching first two letters.
Selection validates the bank and reports loading errors instead of substituting
a fixed word set.

Run the word-bank and selection checks with `node --test tests/*.test.mjs`.

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
