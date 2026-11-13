export const STEPS_PER_LEVEL = 5;

export const LEVELS = Object.freeze([
  { title: "Whole-hour workshop", interval: 60, times: [360, 420, 480, 540, 600] },
  { title: "Half-hour workshop", interval: 30, times: [390, 450, 510, 570, 630] },
  { title: "Quarter-hour workshop", interval: 15, times: [375, 465, 555, 645, 435] },
  { title: "Five-minute workshop", interval: 5, times: [365, 455, 545, 635, 415] },
].map((level) => Object.freeze({ ...level, times: Object.freeze(level.times) })));

const ROUTINES = Object.freeze([
  "Fox opens the bakery",
  "Owl starts the garden rounds",
  "Hedgehog visits the post office",
  "Rabbit sets out the picnic",
  "Squirrel closes the storybook shop",
]);

function assertTime(time) {
  if (!Number.isInteger(time) || time < 0 || time >= 1440) {
    throw new RangeError("Time must be a whole number of minutes in one day.");
  }
}

export function advanceTime(time, minutes) {
  assertTime(time);
  if (!Number.isInteger(minutes)) throw new RangeError("Clock changes must be whole minutes.");
  return ((time + minutes) % 1440 + 1440) % 1440;
}

export function handAngles(time) {
  assertTime(time);
  const minutes = time % 60;
  return {
    minute: minutes * 6,
    hour: ((time % 720) / 720) * 360,
  };
}

export function formatTime(time) {
  assertTime(time);
  const hour = Math.floor(time / 60) % 12 || 12;
  const minute = String(time % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function clockDescription(time) {
  assertTime(time);
  const hour = Math.floor(time / 60) % 12 || 12;
  const minute = time % 60;
  const nextHour = hour === 12 ? 1 : hour + 1;
  const hourPosition = minute === 0 ? `on ${hour}` : `between ${hour} and ${nextHour}`;
  const minutePosition = minute === 0 ? "12" : String(minute / 5);
  return `The clock shows ${formatTime(time)}. The long minute hand points to ${minutePosition} (${minute} minutes past the hour); the short hour hand is ${hourPosition}.`;
}

export function buildRound(levelIndex) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) {
    throw new RangeError("Choose an existing Clockwork Critters level.");
  }
  const level = LEVELS[levelIndex];
  return level.times.map((time, index) => ({
    time,
    routine: ROUTINES[index],
    interval: level.interval,
  }));
}

export function timeChoices(time, interval) {
  assertTime(time);
  if (!Number.isInteger(interval) || interval < 1 || 1440 % interval !== 0) {
    throw new RangeError("The interval must divide a full day into whole minutes.");
  }
  return [...new Set([-2, -1, 0, 1, 2].map((offset) => advanceTime(time, offset * interval)))].slice(0, 4);
}

export function hintText(time, interval, mode) {
  assertTime(time);
  const hour = Math.floor(time / 60) % 12 || 12;
  const nextHour = hour === 12 ? 1 : hour + 1;
  const minute = time % 60;
  const minuteNumber = minute / 5 || 12;
  const minuteHint = minute === 0
    ? "The minute hand points straight up to 12 for zero minutes."
    : `The minute hand points to ${minuteNumber}; each number is 5 minutes, so ${minuteNumber} means ${minute} minutes.`;
  const hourHint = minute === 0
    ? `The hour hand points to ${hour}.`
    : `The hour hand sits between ${hour} and ${nextHour}, moving toward ${nextHour}.`;
  return mode === "set"
    ? `First set the minute hand: ${minuteHint} Then place the short hour hand: ${hourHint}`
    : `${minuteHint} ${hourHint}`;
}
