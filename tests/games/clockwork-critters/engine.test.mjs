import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS, STEPS_PER_LEVEL, advanceTime, buildRound, clockDescription,
  formatTime, handAngles, hintText, timeChoices,
} from "../../../static/clockwork-critters-engine.js";

test("the levels progress from whole hours through five-minute intervals", () => {
  assert.equal(LEVELS.length, 4);
  assert.equal(STEPS_PER_LEVEL, 5);
  assert.deepEqual(LEVELS.map(({ interval }) => interval), [60, 30, 15, 5]);
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(buildRound(index).length, STEPS_PER_LEVEL);
    assert.ok(level.times.every((time) => time % level.interval === 0));
  }
});

test("minute and hour hands stay mathematically aligned at boundaries and between hours", () => {
  assert.deepEqual(handAngles(0), { minute: 0, hour: 0 });
  assert.deepEqual(handAngles(720), { minute: 0, hour: 0 });
  assert.deepEqual(handAngles(12 * 60 + 30), { minute: 180, hour: 15 });
  assert.deepEqual(handAngles(11 * 60 + 59), { minute: 354, hour: 359.5 });
  assert.deepEqual(handAngles(60 + 15), { minute: 90, hour: 37.5 });
  assert.deepEqual(handAngles(60 * 23 + 59), { minute: 354, hour: 359.5 });
  for (const time of [-1, 1440, 1.5, NaN, undefined]) {
    assert.throws(() => handAngles(time), RangeError);
  }
});

test("time adjustments wrap in both directions across hour and day boundaries", () => {
  assert.equal(advanceTime(11 * 60 + 55, 10), 12 * 60 + 5);
  assert.equal(advanceTime(12 * 60 + 5, -10), 11 * 60 + 55);
  assert.equal(advanceTime(1435, 10), 5);
  assert.equal(advanceTime(5, -10), 1435);
  assert.throws(() => advanceTime(60, 1.5), RangeError);
});

test("display text and accessible descriptions identify both hands without color", () => {
  assert.equal(formatTime(0), "12:00");
  assert.equal(formatTime(12 * 60 + 5), "12:05");
  assert.equal(formatTime(7 * 60 + 30), "7:30");
  assert.match(clockDescription(7 * 60 + 35), /long minute hand points to 7 \(35 minutes past the hour\)/);
  assert.match(clockDescription(7 * 60 + 35), /short hour hand is between 7 and 8/);
  assert.match(clockDescription(12 * 60 + 30), /short hour hand is between 12 and 1/);
  assert.match(clockDescription(11 * 60), /short hour hand is on 11/);
});

test("choice sets include one exact time and nearby valid distractors", () => {
  for (const { time, interval } of LEVELS.flatMap((_, index) =>
    buildRound(index).map((question) => ({ ...question })))) {
    const choices = timeChoices(time, interval);
    assert.equal(choices.length, 4);
    assert.equal(new Set(choices).size, 4);
    assert.ok(choices.includes(time));
    assert.ok(choices.every((choice) => choice % interval === 0));
  }
  assert.throws(() => timeChoices(10, 7), RangeError);
});

test("hints explain how minutes map to the dial and where the hour hand belongs", () => {
  assert.match(hintText(7 * 60 + 35, 5, "set"), /each number is 5 minutes/);
  assert.match(hintText(7 * 60 + 35, 5, "set"), /between 7 and 8/);
  assert.match(hintText(8 * 60, 60, "read"), /points straight up to 12/);
});

test("rounds use fictional routine prompts and reject invalid levels", () => {
  assert.match(buildRound(0)[0].routine, /Fox/);
  assert.throws(() => buildRound(-1), RangeError);
  assert.throws(() => buildRound(LEVELS.length), RangeError);
});
