// Mistakes use the {wrong>right#type} format described in proofreading-engine.js.
export const LEVELS = Object.freeze([
  {
    title: "Sunny start",
    hint: "Look at the very first letter of the sentence.",
    sentences: ["{my>My#capitalization} cat likes to nap in the sun."],
  },
  {
    title: "Punctuation patrol",
    hint: "Look closely at the commas and periods.",
    sentences: ["We like{,>#comma} to play with a big{.>#period} red ball."],
  },
  {
    title: "Spelling and spaces",
    hint: "Check the spelling and the space between words.",
    sentences: ["My {freind>friend#spelling} has a{  > #spacing}new puppy."],
  },
  {
    title: "Fish tank",
    hint: "Watch for a number facing the wrong way and a word that sounds like another.",
    sentences: [
      "{we>We#capitalization} have {^7>7#flipped} fish in our class.",
      "{There>Their#homonym} tank is big.",
    ],
  },
  {
    title: "Fruit snacks",
    hint: "Check the spaces after commas, plus periods and spelling.",
    sentences: [
      "I like {apples,pears>apples, pears#space-after}, and {grapse>grapes#spelling}.",
      "We eat them at the{.>#period} park.",
    ],
  },
  {
    title: "School day",
    hint: "Look for days of the week, joined-up words, and sound-alike words.",
    sentences: [
      "On {monday>Monday#capitalization} we have {artclass>art class#spacing}.",
      "I love painting {becuase>because#spelling} it is fun.",
      "My friend likes it {to>too#homonym}.",
    ],
  },
  {
    title: "Zoo trip",
    hint: "One sentence is already perfect. Can you tell which?",
    sentences: [
      "Our class went to the zoo today.",
      "We saw a {giraff>giraffe#spelling} eat leaves{,>#comma} from a tall tree.",
      "{Their>They're#homonym} so tall that I felt {tiney>tiny#spelling}.",
    ],
  },
  {
    title: "Picnic day",
    hint: "Some sentences are perfect. Check every one.",
    sentences: [
      "It was a sunny Saturday.",
      "We packed {sandwiches,apples>sandwiches, apples#space-after}, and juice.",
      "Mia and Leo sat{.>#period} under a big tree with {there>their#homonym} dog.",
      "We had a {wonderfull>wonderful#spelling} time and ate {^3>3#flipped} cookies.",
    ],
  },
  {
    title: "Space class",
    hint: "Check capital letters, spaces, punctuation, and sound-alike words.",
    sentences: [
      "{my>My#capitalization} class is learning about {spase>space#spelling}.",
      "The moon goes around the Earth.",
      "We drew planets with {red,blue>red, blue#space-after}, and yellow crayons.",
      "{Their>They're#homonym} the best{.>#period} part of{  > #spacing}school.",
    ],
  },
  {
    title: "Beach day",
    hint: "A whole paragraph! Some sentences are perfect, and others hide several mistakes.",
    sentences: [
      "Last summer, my family went to the beach.",
      "I packed {^3>3#flipped} towels and my {dag>bag#flipped}.",
      "{Their>There#homonym} was a {wierd>weird#spelling} crab{,>#comma} near the rocks.",
      "My brother and I built a huge sandcastle.",
      "{we>We#capitalization} had the {bestday>best day#spacing}!",
    ],
  },
]);

export const CELEBRATION_MESSAGES = Object.freeze([
  "Eagle eyes!",
  "You spotted them all!",
  "Super proofreader!",
  "Mistake spotter!",
  "Great detective work!",
  "Spot on!",
  "Fantastic!",
  "Wonderful work!",
  "Hooray for you!",
  "High five!",
]);
