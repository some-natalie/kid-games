# Contributing

Thanks for helping make kid-games better! Please follow our
[Code of Conduct](CODE_OF_CONDUCT.md). Beginners, small fixes, accessibility
improvements, and educational feedback are welcome.

## Bugs and ideas

Search existing issues before opening a new one. For bugs, describe what you
expected, what happened, how to reproduce it, and your browser/device.
For ideas, explain the problem and who the change would help.
Discuss large changes or new games before implementing them.

Never include children's names, photos, recordings, saved browser data, or
other identifying information in issues, screenshots, or test fixtures.
For vulnerabilities, follow [SECURITY.md](SECURITY.md) rather than opening a
public issue.

## Development

See [README.md](README.md#local-development) for setup and
[AGENTS.md](AGENTS.md) for project layout and conventions. Use the latest Zola
release and the latest Node.js LTS release supported by Playwright.

```sh
npm ci
npx playwright install --with-deps chromium webkit
zola serve
```

Games use vanilla JavaScript ES modules, with no frontend framework or bundler.
Keep testable logic in each game's helper modules and DOM behavior in its UI
module. Keep links compatible with GitHub Pages project paths.

## Pull requests

1. Create a branch from `main` (or fork the repository if needed).
2. Keep changes focused and update related tests and documentation.
3. Explain the change, user-visible effects, and validation in your pull request.

Before submitting, run:

```sh
npm test
npm run test:python
zola check
```

For UI, copy, or interaction changes, also run `npm run test:e2e`.
Browser tests cover Chromium, WebKit, and touch Chromium. Add browser tests for
every new game. Do not commit generated `public/`, dependencies, browser reports,
or test results.

Preserve keyboard and touch support, accurate accessible labels, non-color
feedback, light/dark styling, reduced-motion behavior, and the optional
OpenDyslexic font. Keep language and content suitable for children.

For workflow changes, follow the pinned-action and least-privilege rules in
[AGENTS.md](AGENTS.md#github-actions-rules).

## Attribution and licensing

You may add your preferred public name or handle to
[CONTRIBUTORS.md](CONTRIBUTORS.md); this is optional.
Contribute only material you have the right to share under this project's
[MIT license](LICENSE). Original contributions are accepted under that same
license; no contributor license agreement is required.
Preserve third-party notices and disclose the source and license of any added
assets. Do not copy proprietary worksheets, game assets, or unlicensed word lists.
