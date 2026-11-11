import { readCelebrations } from "./alphabet-celebration.js";
import { CELEBRATION_MESSAGES } from "./proofreading-levels.js";

export const MIN_THEMED_REWARDS = 10;

const RAINBOW = ["#ff5d8f", "#ffb627", "#3ccf91", "#3fa7f5", "#9b5de5", "#ff7a3d"];
const set = (messages, effects) => readCelebrations({ version: 1, messages, effects });
const effect = (id, label, motion, count, symbols, colors = []) => ({ id, label, motion, count, symbols, colors });

// Each game's themed reward set. Alphabetical Order loads its own list from celebrations.json.
export const GAME_CELEBRATIONS = Object.freeze({
  "acorn-adventure": set(
    ["Nutty-good!", "Squirrel-tastic!", "Acorn ace!", "Great gathering!", "Your basket is bursting!", "You counted it right!"],
    [
      effect("acorn-rain", "Acorn rain", "shower", 45, ["🌰"]),
      effect("autumn-leaves", "Autumn leaves", "shower", 45, ["🍂", "🍁"]),
      effect("squirrel-friends", "Squirrel friends", "rise", 24, ["🐿️"]),
      effect("mushroom-pop", "Mushroom pop", "burst", 40, ["🍄"]),
      effect("berry-burst", "Berry burst", "burst", 50, ["🫐", "🍓", "🍒"]),
      effect("owl-flight", "Owl flight", "rise", 24, ["🦉", "🪶"]),
      effect("hedgehog-hop", "Hedgehog hop", "rise", 24, ["🦔"]),
      effect("pine-forest", "Pine forest", "burst", 40, ["🌲", "🌳"]),
      effect("fireflies", "Fireflies", "rise", 50, ["✦", "✨", "•"], ["#ffd23f", "#ffb627", "#c5f277"]),
      effect("nut-confetti", "Nut confetti", "burst", 90, [], ["#8b5a2b", "#c47a3c", "#ffb627", "#ff7a3d", "#3ccf91"]),
    ],
  ),
  "fraction-bridge": set(
    ["Tilly made it!", "Right on the spot!", "Fraction star!", "Shell-ebrate!", "Perfect step!", "Bridge champion!"],
    [
      effect("sparkles", "Sparkles", "shower", 60, ["✦", "✧", "★", "✨"], ["#ffb627", "#9b5de5", "#3fa7f5", "#ff5d8f"]),
      effect("pond-bubbles", "Pond bubbles", "rise", 45, ["🫧", "💧", "○"], ["#3fa7f5", "#3ccf91"]),
      effect("falling-leaves", "Falling leaves", "shower", 40, ["🍃", "🌿", "🍀", "🍂"]),
      effect("turtle-friends", "Turtle friends", "rise", 24, ["🐢", "💚", "✨"]),
      effect("lily-blossoms", "Lily blossoms", "burst", 50, ["🪷", "🌸", "🌼"]),
      effect("fraction-stars", "Fraction stars", "burst", 60, ["½", "¼", "¾", "⅛", "⅓", "★"], RAINBOW.slice(0, 5)),
      effect("frog-hops", "Frog hops", "burst", 30, ["🐸"]),
      effect("fish-splash", "Fish splash", "rise", 30, ["🐟", "🐠", "💦"]),
      effect("duck-parade", "Duck parade", "shower", 24, ["🦆"]),
      effect("river-rainbows", "River rainbows", "shower", 20, ["🌈"]),
    ],
  ),
  "number-trail": set(
    ["Trail blazer!", "Math explorer!", "Stone by stone!", "Onward, explorer!", "You crossed it!", "Number whiz!"],
    [
      effect("number-shower", "Number shower", "shower", 60, ["1", "2", "3", "+", "−", "="], RAINBOW),
      effect("stepping-stones", "Stepping stones", "burst", 40, ["🪨"]),
      effect("trail-sparkles", "Trail sparkles", "shower", 60, ["✦", "✧", "★", "✨"], RAINBOW),
      effect("forest-leaves", "Forest leaves", "shower", 45, ["🍃", "🌿"]),
      effect("fox-friends", "Fox friends", "rise", 24, ["🦊"]),
      effect("deer-dash", "Deer dash", "rise", 24, ["🦌"]),
      effect("mushroom-ring", "Mushroom ring", "burst", 40, ["🍄"]),
      effect("bird-song", "Bird song", "rise", 30, ["🐦", "🎵", "🎶"]),
      effect("wildflowers", "Wildflowers", "burst", 50, ["🌼", "🌷", "🌸"]),
      effect("star-path", "Star path", "shower", 40, ["⭐", "🌟"]),
    ],
  ),
  "picnic-pizza": set(
    ["Slice of genius!", "Perfect portions!", "Picnic perfect!", "Fair shares!", "Delicious work!", "Pizza-zazz!"],
    [
      effect("pizza-party", "Pizza party", "shower", 40, ["🍕"]),
      effect("picnic-fruit", "Picnic fruit", "burst", 50, ["🍎", "🍉", "🍇", "🍓"]),
      effect("cheese-sprinkle", "Cheese sprinkle", "shower", 40, ["🧀"]),
      effect("basil-leaves", "Basil leaves", "shower", 45, ["🌿", "🍃"]),
      effect("ladybugs", "Ladybugs", "rise", 30, ["🐞"]),
      effect("marching-ants", "Marching ants", "rise", 30, ["🐜"]),
      effect("lemonade-bubbles", "Lemonade bubbles", "rise", 40, ["🫧", "🍋"]),
      effect("sunshine", "Sunshine", "burst", 40, ["☀️", "🌻"]),
      effect("checkered-confetti", "Checkered confetti", "burst", 90, [], ["#d7263d", "#ffffff", "#3ccf91", "#ffb627"]),
      effect("picnic-sparkles", "Picnic sparkles", "shower", 60, ["✦", "✧", "★", "✨"], RAINBOW),
    ],
  ),
  proofreading: set(
    CELEBRATION_MESSAGES,
    [
      effect("magnifiers", "Magnifying glasses", "shower", 40, ["🔍", "🔎"]),
      effect("clue-notes", "Clue notes", "shower", 40, ["📝", "📄"]),
      effect("pencil-burst", "Pencil burst", "burst", 45, ["✏️", "🖍️"]),
      effect("check-marks", "Check marks", "rise", 45, ["✔", "✓"], ["#3ccf91", "#2a9d8f", "#3fa7f5"]),
      effect("detective-badges", "Detective badges", "burst", 35, ["🏅", "🎖️"]),
      effect("bright-ideas", "Bright ideas", "rise", 30, ["💡"]),
      effect("footprints", "Detective footprints", "shower", 35, ["👣"]),
      effect("book-stack", "Book stack", "rise", 30, ["📚", "📖"]),
      effect("gold-stars", "Gold stars", "shower", 50, ["⭐", "🌟"]),
      effect("ink-confetti", "Ink confetti", "burst", 90, [], ["#22243a", "#5546b8", "#3fa7f5", "#ff5d8f", "#ffb627"]),
    ],
  ),
  "ribbon-workshop": set(
    ["Ribbon-tastic!", "Sew good!", "Perfect measure!", "Neat as a bow!", "Workshop wizard!", "Cut to fit!"],
    [
      effect("ribbon-confetti", "Ribbon confetti", "burst", 90, [], RAINBOW),
      effect("bows", "Bows", "rise", 30, ["🎀"]),
      effect("thread-spools", "Thread spools", "shower", 35, ["🧵"]),
      effect("yarn-balls", "Yarn balls", "burst", 35, ["🧶"]),
      effect("snips", "Snips", "shower", 30, ["✂️"]),
      effect("gift-boxes", "Gift boxes", "rise", 30, ["🎁"]),
      effect("sequins", "Sequins", "shower", 60, ["✦", "✧", "✨", "◆"], RAINBOW),
      effect("rainbow-ribbons", "Rainbow ribbons", "burst", 25, ["🌈"]),
      effect("stitched-hearts", "Stitched hearts", "rise", 40, ["💖", "💗", "💜"]),
      effect("fraction-tags", "Fraction tags", "shower", 50, ["½", "⅓", "¼", "⅙", "⅛"], RAINBOW),
    ],
  ),
  "math-meteor-patrol": set(
    ["Meteor master!", "Shield superstar!", "Orbit on target!", "Asteroid ace!", "A star solution!", "Space math whiz!"],
    [
      effect("meteor-sparkles", "Meteor sparkles", "shower", 36, ["✦", "✧", "✨"], ["#ffb627", "#9b5de5", "#3fa7f5"]),
      effect("rocket-boost", "Rocket boost", "rise", 24, ["🚀", "🌠"]),
      effect("planet-rings", "Planet rings", "burst", 32, ["🪐"]),
      effect("star-map", "Star map", "shower", 40, ["⭐", "🌟"]),
      effect("moon-dust", "Moon dust", "rise", 36, ["🌙", "✨"]),
      effect("satellite-flight", "Satellite flight", "rise", 24, ["🛰️"]),
      effect("comet-trail", "Comet trail", "burst", 30, ["☄️"]),
      effect("space-numbers", "Space numbers", "shower", 36, ["1", "2", "3", "+", "−", "×"], RAINBOW),
      effect("shield-shimmer", "Shield shimmer", "burst", 30, ["🛡️", "💫"]),
      effect("galaxy-confetti", "Galaxy confetti", "shower", 72, [], ["#1d4ed8", "#9b5de5", "#ffb627", "#3fa7f5"]),
    ],
  ),
});
