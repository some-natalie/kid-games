# kid-games

A small Zola site for kid-games.dev, with responsive game tiles and automatic
light/dark styling based on the device preference. Alphabetical Adventure is
the site's alphabetical-order game, Proofreading Detectives is its
proofreading game, Number Trail is its woodland math adventure,
Acorn Adventure introduces cumulative, multistep arithmetic, and Picnic Pizza
introduces equal shares and visual fractions, while Ribbon
Workshop explores fractions with equal-length ribbons, and Fraction Bridge
helps children find, compare, and order fractions on a number line. Place-Value
Builders visualizes hundreds, tens, ones, and regrouping. Math Meteor Patrol
adds optional, gently timed arithmetic-fluency practice.

## Quiz mode

Add `?quiz=1` to the home page or any game URL to opt into quiz mode.
The landing page's **For grown-ups** link opens a page with a quiz-mode toggle,
the public GitHub repository, and MIT licensing and third-party attribution
information. The toggle changes the URL setting, not a saved browser preference.
Internal navigation keeps the flag; omit it (or use `?quiz=0`) for normal play.
Quiz mode removes worked examples, reference hints, and immediate grading.
**Next question**, **Previous question**, and **Review answers** let players
change any answer as often as they like before **Submit quiz**.
The “Show your parent!” screen then gives a rounded percent correct and
expandable **Answer details**, including incorrect responses and corrections.

Each completely correct question earns one point: an entire word order or
proofreading passage, one Number Trail puzzle, one Acorn Adventure stop, one
Picnic Pizza or Ribbon Workshop fraction question, one Fraction Bridge
challenge, or one Place-Value Builders question.
Unanswered questions count as incorrect. Proofreading requires marking every
mistake without marking correct text. Acorn Adventure uses a numeric input
instead of answer choices and carries the player's entered totals, so later
stops cannot reveal whether an earlier answer was right. Each stop is scored
against the original journey; revising a total does not automatically rewrite
later answers. Alphabetical quiz words use the selected theme and have keyboard-
and touch-friendly Up/Down controls.

Quiz answers live only in memory: leaving or reloading discards them, and
ordinary saved game progress is neither loaded nor changed.
Ribbon Workshop quiz questions use the same level progression and score one
point for each fully correct fraction response.
Place-Value Builders quizzes ask about the same place-value representations
and comparisons; answers can be revised before submission, and grading waits
until then.

## Community and license

Original project code and content are licensed under [MIT](LICENSE).
Bundled OpenDyslexic fonts and WordNet-derived data retain their separate
licenses; see [Third-party notices](THIRD_PARTY_NOTICES.md).

Contributions are welcome! Start with [Contributing](CONTRIBUTING.md), meet the
[contributors](CONTRIBUTORS.md), and follow our
[Code of Conduct](CODE_OF_CONDUCT.md).
Report vulnerabilities privately as described in [Security](SECURITY.md).

## Local development

Install the latest [Zola release](https://www.getzola.org/documentation/getting-started/installation/)
and the latest Node.js LTS release supported by Playwright,
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
these games automatically. Every game also needs at least 10 themed rewards
(see [Themed rewards](#themed-rewards)). The alphabetical
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

## Themed rewards

Every game celebrates right answers (and its finale) with at least 10 rewards
that match its theme, drawn at random by the shared celebration layer in
`static/alphabet-celebration.js`. Each reward set also has themed cheers that
prefix the success feedback.

| Game | Reward set | Examples |
|---|---|---|
| Alphabetical Adventure (both modes) | `static/celebrations.json` | letter showers, letter blocks, storybooks, pencils, sparkles, dinosaurs |
| Proofreading Detectives | `GAME_CELEBRATIONS.proofreading` | magnifying glasses, clue notes, check marks, detective badges, footprints |
| Number Trail | `GAME_CELEBRATIONS["number-trail"]` | number showers, stepping stones, foxes, deer, wildflowers, star paths |
| Acorn Adventure | `GAME_CELEBRATIONS["acorn-adventure"]` | acorn rain, autumn leaves, squirrels, hedgehogs, owls, fireflies |
| Fraction Bridge | `GAME_CELEBRATIONS["fraction-bridge"]` | pond bubbles, lily blossoms, frogs, ducks, turtle friends, fraction stars |
| Picnic Pizza | `GAME_CELEBRATIONS["picnic-pizza"]` | pizza slices, picnic fruit, ladybugs, marching ants, checkered confetti |
| Ribbon Workshop | `GAME_CELEBRATIONS["ribbon-workshop"]` | ribbon confetti, bows, thread spools, yarn, sequins, fraction tags |
| Math Meteor Patrol | `GAME_CELEBRATIONS["math-meteor-patrol"]` | meteor sparkles, rockets, planets, satellites, shields, galaxy confetti |
| Place-Value Builders | `GAME_CELEBRATIONS["place-value-builders"]` | base-ten blocks, number columns, hundred squares, rods, builder confetti |

`GAME_CELEBRATIONS` lives in `static/game-celebrations.js`. Each set is checked
by `readCelebrations` and must use every motion (`burst`, `shower`, and `rise`).
`tests/games/shared/celebrations.test.mjs` fails if any game under `content/`
has fewer than 10 rewards or reuses another game's set. Wrong answers and quiz
mode never celebrate. With reduced motion, five still pieces appear instead of
the animation.

### Sort in smaller lists

Choose **Sort in smaller lists** on the Alphabetical Adventure page for a
separate seven-level quest (`?sort=groups`). Create and name your own working
lists, move words into first-letter groups, and refine matching groups by
their second, third, fourth, fifth, sixth, or seventh letters. Nothing is
grouped or ordered automatically. Only compare a later letter once earlier
letters match; a shorter word comes first when it ends at the shared prefix.

Each working list has a chosen comparison position, highlighted with an
underline in normal play. Use Up/Down buttons or arrow keys, Home, and End to
arrange its words. Send each smaller list to the end of the **Final ABC list**
in your chosen order, then **Check order**. You can move words back into
working lists, remove empty lists, undo changes, and retry without a timer.
Success text stays fully opaque throughout its pop animation to preserve contrast.
The curated rounds deliberately include comparisons at each level's target
depth, including words that end at a shared prefix.

Lists and their current order are saved under the separate `@letter-groups`
entry in `kid-games.alphabetical-order.progress`; classic quest and theme saves
are unchanged. Reloading resumes the same workspace. The new quest has six
words initially and grows to twelve; themes remain available in the classic
quest rather than diluting the deeper-letter progression.

With `?sort=groups&quiz=1`, all seven rounds use the same list-building tools
without worked examples, highlighted comparison letters, hints, or correctness
feedback. You can revise and revisit each workspace before submitting. Each
question earns one point only when its final list contains every word in the
correct order; intermediate group names and arrangements are not scored.
Final answer details explain the correct order. Quiz mode never accesses normal
saved progress.

### Classic quest controls

Arrange the list by dragging words up or down with a mouse, pen,
or finger, or tap the large **Up/Down** buttons beside a word for a precise
one-position move. Then press **Check order**. Dragging snaps the center of the
word to the nearest row, keeping the original grip offset; the thick line shows
the insertion position. Dragging near the screen edge scrolls the page.
Drops within 48 pixels of the list edges still land; dropping farther outside
the list or pressing Escape cancels a move.
Keyboard users can focus a word and use Up/Down, Home, or End to move it.
**Undo move** reverses the last change. Incorrect checks leave the list editable,
so players can fix their order without starting over.

Text and word tiles are sized for young readers. Once a level starts, the site
header, game intro, and theme help collapse into a slim bar with **← All games**
and the theme picker; drag directions move into a **How to play** toggle.
Storage warnings stay visible. A vertical A–Z reference bar
stays pinned to the right side while scrolling, with space reserved so it does
not cover the game on phones or tablets. A correct answer shows a short
cheer and a random celebration before **Next level** is offered. With reduced
motion turned on, a few still pieces appear instead. Finishing level 10 randomly
selects one of ten victory scenes: the original dancing dinosaur, a dancing robot,
a rocket, butterflies, an ocean parade, a rainbow, balloons, blooming flowers,
twinkling stars, or dancing penguins. Each scene has an accessible description
and uses still artwork when reduced motion is enabled. The finale still says
**Show your parent!** and clears the saved quest so **Play again** starts at
level 1.

The stylesheet URL includes Zola's content hash, so browsers fetch updated
styles after deployment instead of reusing a cached version of the layout.

### Celebrations

Cheers and effects for both Alphabetical Adventure modes are picked at random
from `static/celebrations.json` (letter showers, letter blocks, storybooks,
pencils, sparkles, flowers, stars, confetti, balloons, dinosaurs, and more).
Add an effect with this structure:

```json
{"id": "flowers", "label": "Flowers", "motion": "shower", "count": 45, "symbols": ["🌸", "🌼"], "colors": []}
```

`motion` is `burst` (from a random corner), `shower` (falls from the top), or
`rise` (floats up from the bottom). `count` is 1–150. An effect needs `symbols`,
`colors`, or both; colors alone make confetti pieces, and colors tint text
symbols such as `★`. If the file is missing or invalid, the game uses built-in
confetti and sparkles.

## Fraction Bridge

Fraction Bridge is an untimed eight-level number-line game. It starts
with guided halves and quarters, introduces thirds, sixths, and eighths, and then
practices equivalent positions, ordering, and comparison. Fraction placement and
comparison use exact rational arithmetic; each puzzle keeps one fixed unit length
and only offers mathematically valid tick positions. The denominator counts equal
intervals, while the number line includes both endpoint tick marks. Each tick on
the bridge is labelled with its fraction and name (for example, “1/2 one half”).
Players tap the bridge, or tap and drag, to move Tilly the turtle; she snaps to the
nearest valid tick and turns to face the way she is walking; letting go checks the spot.
Each placement puzzle shows a large “Walk Tilly to” card with the target fraction
and its name, and the level's tip is muted beneath the title. The part from 0 to
Tilly is shaded with stripes, and a compact line such as “Shaded: 5/8 · Unshaded:
3/8” names both parts; screen readers hear the full fraction names. Keyboard
directions are given to screen readers through the bridge's description instead
of on screen, since the tutorial explains tapping, dragging, and keys.
With a keyboard, the bridge is a slider: arrow keys, Home, and End move Tilly, and
Enter, Space, or **Check Tilly’s spot** checks the answer. On narrow screens the
bridge turns vertical, with 0 at the bottom and 1 at the top, so every label stays
readable. Players can use hints to restore partition guides and their labels, and
retry without losing points. The comparison level shows a non-interactive bridge.
Each right answer starts one of ten randomly chosen pond-themed celebrations from
`GAME_CELEBRATIONS["fraction-bridge"]` (such as pond bubbles, lily blossoms, frog
hops, duck parades, turtle friends, or fraction stars), using the shared celebration
layer with a cheer such as “Tilly made it!”. On the bridge, Tilly hops, the chosen
label twinkles, and the stripes shimmer. Wrong answers and quiz mode never
celebrate, and reduced-motion settings show still sparkles without animation.
In quiz mode, moving Tilly only records the answer; there is no check and no
correctness feedback until the quiz is submitted. Normal progress is saved in
this browser under `kid-games.fraction-bridge.progress`; quiz answers remain in
memory and do not load or change that progress.

## Themes and browser preferences

Choose **Use OpenDyslexic font** in the footer on any page to opt in; uncheck it
to return to the default system font. The choice applies across the site,
including game words and controls, and is saved only in this browser under
`kid-games.font` (`opendyslexic` or `default`). The control stays available during
play. If storage is unavailable, the choice still works on the current page
and a notice explains that it cannot be saved.

OpenDyslexic's regular, bold, italic, and bold italic fonts are served locally
from `static/fonts/`, with no third-party font requests. The unmodified WOFF2
files come from the upstream `antijingoist/opendyslexic` repository at revision
`1824da5c0e41dc3e13ffc7f3a636dcaf695d61b7` and are redistributed under the
SIL Open Font License 1.1, preserved in `static/fonts/OFL.txt`.

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

## Proofreading Detectives

A 10-level proofreading game for kids (`content/proofreading/`,
`templates/proofreading.html`, `static/proofreading*.js`). Players tap every
whole word if any letter looks wrong, or a punctuation mark or wide gap, then
press **Check**. An optional interactive example demonstrates marking “my” and
checking its capital-letter correction before starting the case.
All word errors, including capitalization and flipped letters, target the whole
word. Word targets fit their text without extra horizontal padding; punctuation
is attached to its word when correct. Punctuation mistakes stay separate and
closely spaced, with a wider invisible tap zone just above the mark instead of
padding that spreads the sentence out.
Extra spacing is shown as a larger blank gap, without dots. Correct marks are fixed
in place after checking, even before the whole round is solved. Those fixes
stay in place when changing or clearing the remaining marks.
Level 1 is a single sentence with one mistake; level 10 is a five-sentence
paragraph with seven mistakes where some sentences are already correct. Mistake
kinds: capital letters, misplaced commas and periods, spacing between words,
spacing after punctuation, commonly misspelled words, flipped (mirrored) letters
and numbers, and sound-alike words (there/their/they're and similar).

Each level holds 11 hand-written variants (`variants` in
`static/proofreading-levels.js`); one is picked at random every time a level
starts. New variants must keep the level's sentence and mistake counts, which
the unit tests enforce.

An incorrect check fixes and highlights correctly identified mistakes in green,
while remaining marks stay editable. It shows which marked spots were already
correct (✗), how many mistakes remain, and which sentences still hide some.
Changing a mark clears retry feedback but preserves confirmed fixes. Each
confirmed fix is listed with a short tip. Changed letters and inserted spaces
are bold and underlined. Removed punctuation stays visible in red with a
strikethrough and still counts as fixed, including after clearing other marks.
Progress autosaves under
`kid-games.proofreading.progress` as `{"version":1,"level":3}` and is cleared
after level 10. Celebrations use the detective-themed rewards in
`GAME_CELEBRATIONS.proofreading` with the game's own cheers.

Final corrections stay available until the player chooses **Finish case**.
Decorative victory animations stop within five seconds and respect reduced
motion. See [Accessibility](#accessibility) for review coverage and limitations.

Levels live in `static/proofreading-levels.js`. Write the text normally and
wrap each mistake as `{wrong>right#type}`, for example
`{their>there#homonym}` or `{,>#comma}` (the fix is to remove it). Types are
`capitalization`, `comma`, `period`, `spacing`, `space-after`, `spelling`,
`flipped`, and `homonym`. Use two spaces as the wrong text for an extra space
(`{  > #spacing}`), and a `^` to mirror the next character (`{^3>3#flipped}`).
Keep topics friendly and kid-appropriate; `tests/games/proofreading/` checks the
level shape and that every mistake type is used.

## Number Trail

Help Bunny get home by choosing the missing number from four stepping stones.
There are 10 untimed levels with five puzzles each:

| Levels | Puzzles |
|---|---|
| 1–2 | Addition, then subtraction, within 10 |
| 3–4 | Addition, then subtraction, within 20 |
| 5–6 | Missing operands in addition, then subtraction, within 20 |
| 7–8 | Addition, then subtraction, with multiples of 10 within 100 |
| 9 | Mixed addition and subtraction within 100 |
| 10 | Mixed missing operands within 100 |

A worked example introduces the game. Tap an answer or use Tab and Enter/Space.
Wrong answers offer a strategy hint and unlimited retries, with no lost points
or time pressure. **Show hint** is also available before answering.
Correct answers show the full equation and wait for **Next step**, **Next level**,
or **Finish trail**. Finishing brings Bunny home with a short celebration.

Each level draws five distinct randomized puzzles; answers are whole numbers
between 0 and the level's limit, with no negative subtraction results. The math
and distractor generation live in `static/number-trail-engine.js`, separate from
the DOM code in `static/number-trail.js`.
Both math games use `static/math-choices.js` for mistake-based answer choices:
forgotten carries, incorrect borrowing, the wrong operation, ignored operands
or place values, and (in Acorn Adventure) using the original basket instead of
the carried total. Duplicate, correct, negative, and out-of-range decoys are
excluded. Small problems use counting mistakes when other errors produce too
few distinct options; choices are shuffled, not a run of neighboring numbers.
Number Trail's missing operands use the corresponding inverse calculation.

The current unlocked level is saved under `kid-games.number-trail.progress`
as `{"version":1,"level":3}`. Returning starts that level with new puzzles;
individual stones within a level are not saved. **Start a new trail** resets
progress; **Finish trail** clears it. Storage errors show a warning without
blocking play. Proofreading and Number Trail share `static/level-progress.js`
for versioned level storage, retaining separate keys.

## Math Meteor Patrol

Choose addition, subtraction, or optional multiplication, then select untimed
practice, gentle patrol, or challenge patrol. Equations start within 10 and
grow toward 20 a little at a time; subtraction stays nonnegative and
multiplication keeps its products within the selected limit. The worked example
explains a counting-on strategy before play.

Timed modes explain their countdown before starting: gentle patrol begins at
18 seconds per meteor and challenge at 12 seconds. Correct answers clear the
active meteor and provide a short breather. Wrong entries can be edited; if a
timed meteor reaches the shield, the game shows the correct equation and a
strategy without a penalty. Pause/resume freezes the countdown, and switching
tabs suspends movement and timing until the game is visible again. Reduced
motion keeps the meteor card stationary and uses the countdown indicator
instead. Keyboard entry and touch-friendly number buttons are both available.

Selected mode and target are saved only in local browser storage, with a
visible warning if the browser cannot save them. Quiz mode is a separate,
untimed set of revisable questions: it hides the worked example and withholds
answer feedback until submission. Quiz answers stay in memory and do not read
or change saved patrol choices.

## Acorn Adventure

Help Squirrel gather and share nuts for the winter pantry. Each level is one
cumulative journey: solve a stop, carry the new basket total forward, then
continue. The full expression stays visible with the current operation
underlined and outlined; a completed-step log preserves earlier equations.
Hazelnut emoji stand in for the woodland nuts.
The worked example shows one nut emoji per nut in each resulting basket.
During gameplay, a compact squirrel-and-nut line displays the numeric total
instead of repeating nut emojis.

Addition and subtraction have equal priority: chains containing only these
operations are evaluated **left to right**, not by doing addition first.
A worked `5 + 4 − 3 + 6 = 12` example demonstrates each running total,
keeping the tutorial basket at no more than 12 nuts.
This game prepares players for multistep arithmetic; it does not introduce
multiplication, division, parentheses, or their precedence rules.

| Levels | Stops per journey | Largest running total |
|---|---|---|
| 1–2 | 2 | 10 |
| 3–4 | 2 | 20 |
| 5 | 3 | 20 |
| 6 | 3 | 30 |
| 7 | 3 | 50 |
| 8 | 4 | 50 |
| 9–10 | 4 | 100 |

Tap an answer or use Tab and Enter/Space. Strategy hints and unlimited retries
leave earlier steps intact, and there is no timer. Correct answers wait for
**Next stop**, **Next level**, or **Finish adventure** before proceeding.
The final journey remains readable until the player explicitly finishes.

`static/acorn-adventure-engine.js` generates bounded, whole-number journeys
without negative totals; `static/acorn-adventure.js` handles the UI. The shared
level-progress helper saves the unlocked level separately under
`kid-games.acorn-adventure.progress` as `{"version":1,"level":3}`.
Returning begins that level with a new journey; individual stops are not saved.
Starting a new adventure or finishing clears that save without touching other
games. Storage failures display a warning and do not block play.

## Ribbon Workshop

Fold equal-length rectangular ribbons into halves, thirds, quarters, sixths,
and eighths. The worked example shows how two of four equal parts have the same
length as one half. Its nine untimed levels progress from selecting halves and
quarters, through thirds and equivalent lengths, to eighths, comparisons, and
completing a whole.

| Levels | Fraction skill |
|---|---|
| 1–3 | Select 1/2, 1/4, and 3/4 |
| 4–5 | Select 2/3; align 1/2 and 2/4 |
| 6–7 | Match 1/2 = 4/8 and 1/3 = 2/6 |
| 8–9 | Compare 3/4 and 2/3; complete a whole from 5/8 |

Use the fold buttons to divide a ribbon into equal parts, and the large
**Select one more part** and **Remove one selected part** controls to color its
length. The aligned overlay uses a shared origin and whole length, with distinct
partition guides and hatching. Selection labels name both the fraction and the
number of equal parts. Wrong attempts keep the current selection, show a hint,
and can be retried without a timer or point loss. Right answers add a themed
cheer and a ribbon, bow, or sewing celebration.

Fraction and partition logic lives in `static/ribbon-workshop-engine.js`;
`static/ribbon-workshop.js` renders the accessible HTML controls and overlay.
Exact comparisons use integer numerators and denominators with BigInt
cross-products, not floating-point equality. The unlocked level is saved
locally as `kid-games.ribbon-workshop.progress`; quiz mode neither reads nor
changes that key. In quiz mode, the same nine skills are asked as revisable
fraction questions, with grading and answer details held until submission.

## Place-Value Builders

Build and compare numbers with visible hundreds, tens, and ones blocks. Ten
ones exchange for one ten, and ten tens exchange for one hundred; the reverse
exchanges are available too, and every trade preserves the represented total.
The ten untimed levels progress from two-digit building and comparisons to
three-digit regrouping, including 40, 105, and 206 so that zero-place values
are practiced.

Use the add, remove, and exchange buttons with a mouse, touch, or keyboard.
The block pictures include printed place values and have matching text
descriptions, so the quantities do not depend on color. Hints and unlimited
retries are available without lost points. Progress saves the unlocked level
locally as `kid-games.place-value-builders.progress`; storage errors are
reported, and quiz mode never reads or changes normal progress.

`static/place-value-builders-engine.js` contains the bounded block operations,
place-value checks, comparisons, and quiz questions. The UI in
`static/place-value-builders.js` supplies the interactive workspace and
themed celebrations. Quiz mode asks one revisable question per level, with
no hints or answer feedback before submission.

## Picnic Pizza

Prepare a fair picnic by sharing pizzas and rectangular foods into equal-area
pieces. The worked example introduces one half (1/2), the numerator (selected
pieces), and the denominator (all equal pieces). Seven untimed levels progress
from equal and unequal shares, naming and building halves and quarters,
to thirds, sixths, and eighths, comparing same-size wholes, matching
equivalent coverage, and completing a whole by looking for its missing pieces.
Unequal-area cuts are explicitly identified as not being equal shares.
Formal fraction arithmetic and number-line placement are not included.

Tap piece controls or use the keyboard; hints and unlimited retries never cost
points. Right answers add a picnic cheer and a picnic-themed celebration. Circles and rectangles show the quantity, with synchronized fraction
words and notation. `static/picnic-pizza-engine.js` contains the fraction and
puzzle logic; `static/picnic-pizza.js` handles the DOM. The unlocked level is
saved locally under `kid-games.picnic-pizza.progress` as
`{"version":1,"level":3}` using the shared level-progress helper. Quiz mode
offers seven questions, keeps answers in memory, and scores each question only
after submission; it never reads or changes saved game progress.

## Fraction Bridge

Find fractions on a number line from zero to one. The eight levels move from
placing halves, quarters, thirds, and eighths to recognizing equivalent
positions, ordering fractions, comparing values, and placing fractions when
partition guides are hidden. The number-line model complements Picnic Pizza's
serving activities and Ribbon Workshop's equal-length overlays.

`static/fraction-bridge-engine.js` keeps exact fraction comparison, tick
placement, equivalence, and ordering separate from the UI in
`static/fraction-bridge.js`. The game supports keyboard and touch, provides
visual and text feedback, and stores its unlocked level locally with the shared
level-progress helper. Quiz mode asks six revisable placement, equivalence,
comparison, and ordering questions without loading or modifying normal progress.

## Accessibility

The site targets WCAG 2.2 AA. Automated axe checks run with the browser suite,
alongside keyboard, touch, reflow, and reduced-motion regression tests. Games
provide non-dragging controls, text feedback in addition to color, and an
optional OpenDyslexic font. The skip link moves focus into the main content.

Automated checks are not certification of conformance. The November 2026 review
covers the built site and tested game states, not every device or browser
configuration. Screen-reader testing with NVDA/Firefox and VoiceOver/Safari,
and usability testing with disabled players, are still needed before claiming
full WCAG conformance. Proofreading intentionally contains incorrect and
mirrored text; its accessible descriptions need particular attention in that
testing.

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
