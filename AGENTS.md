# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## Project

kid-games.dev is a static [Zola](https://www.getzola.org/) site (pinned to 0.23.6) of
small browser games for kids, with responsive tiles and automatic light/dark styling.
There is no bundler or framework: games are plain ES modules in `static/`.
Games include Alphabetical Adventure (ABC ordering), Proofreading Detectives
(finding writing mistakes), Number Trail (a 10-level woodland math quest),
and Acorn Adventure (cumulative addition and subtraction).

## Layout

- `content/<game>/index.md` – one directory per game; front matter sets title, description, weight, template, icon. The home page lists games automatically.
- `templates/` – Zola templates (`base.html`, `index.html`, and one per game).
- `static/` – game UI modules and testable helpers (`alphabet-*.js`, `proofreading-*.js`, `number-trail-engine.js`, `acorn-adventure-engine.js`), shared `level-progress.js`, `style.css`, `words.json` (tagged word bank), `celebrations.json`.
- `tools/expand-word-bank.py` – builds the word bank (WordNet; see `static/wordnet-license.txt`).
- `tests/games/<game>/` – unit tests (`*.test.mjs`, `*_test.py`) and `browser/*.spec.js` Playwright tests.

## Commands

```sh
zola serve                 # dev server at http://127.0.0.1:1111
zola check && zola build   # validate / build into public/ (not committed)
npm ci                     # install Playwright
npm test                   # Node unit tests (tests/games/*/*.test.mjs)
npm run test:python        # Python unit tests
npx playwright install chromium webkit   # first time only
npm run test:e2e           # browser tests (builds the site and serves it on :8880)
```

CI (`.github/workflows/pages.yml`) runs `zola check`, unit tests, and the browser tests
in chromium, webkit and touch-chromium for every game. Run the relevant tests before
opening a PR; browser tests assert on user-visible text, so changing copy (for example
the "Keep dragging" feedback message) can break them. Update tests together with copy.

## Conventions

- Keep it dependency-free: vanilla JS, one shared `static/style.css`, no build step.
- Keep testable game logic in helper modules; keep DOM code in the game's UI module (`alphabetical-order.js`, `proofreading.js`, `number-trail.js`, or `acorn-adventure.js`).
- Accessibility matters: don't rely on colour alone (pair it with text), keep `aria-label`s accurate, support keyboard moves and touch, and keep dark-mode styles in the `prefers-color-scheme` blocks.
- Build links with `get_url`, `page.permalink` or `config.base_url`; Pages overrides `base_url`, so never hard-code the host.
- Every game under `content/` must have browser tests in `tests/games/<game>/browser/` or CI fails.

## Adding a game

1. Create `content/<game>/index.md` and a template in `templates/`.
2. Add scripts/assets in `static/`.
3. Add unit tests and `tests/games/<game>/browser/*.spec.js`.
4. Document it in `README.md`.

## GitHub Actions rules

zizmor (pedantic) runs in CI. Pin every action to a full commit SHA with a version
comment, set `permissions: {}` at workflow level and least-privilege per job (with a
comment explaining each), and use `persist-credentials: false` on checkout. Pass
untrusted values through `env:` rather than interpolating `${{ }}` into `run:`.

## Pull requests

Work on a branch, keep changes small and focused, and open a PR against `main`.
Don't commit `public/`, `node_modules/`, `playwright-report/` or `test-results/`.
