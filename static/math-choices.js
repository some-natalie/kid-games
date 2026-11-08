export function answerChoices(left, right, operation, { max, unit = 1, earlierTotal }, random = Math.random) {
  const calculate = (a, b) => operation === "+" ? a + b : a - b;
  const answer = calculate(left, right);
  const candidates = [];
  const add = (value) => {
    if (Number.isInteger(value) && value >= 0 && value <= max &&
        value % unit === 0 && value !== answer && !candidates.includes(value)) {
      candidates.push(value);
    }
  };
  const leftOnes = left % 10;
  const rightOnes = right % 10;
  if (operation === "+" && leftOnes + rightOnes >= 10) {
    add(answer - 10); // Forget the carry from the ones column.
  }
  if (operation === "-" && leftOnes < rightOnes) {
    add(answer + 10); // Borrow without reducing the tens column.
    add(left - leftOnes - (right - rightOnes) + Math.abs(leftOnes - rightOnes));
  }
  add(operation === "+" ? Math.abs(left - right) : left + right);
  if (earlierTotal !== undefined && earlierTotal !== left) add(calculate(earlierTotal, right));
  add(left); // Ignore the change entirely.
  add(right); // Report the change rather than the new total.
  if (right >= 10) add(calculate(left, rightOnes)); // Ignore the change's tens.
  if (left >= 10) add(calculate(leftOnes, right)); // Ignore the starting number's tens.
  if (rightOnes > 0) add(calculate(left, right - rightOnes));
  if (leftOnes > 0) add(calculate(left - leftOnes, right));
  // Tiny problems may need counting errors when the other mistakes coincide.
  for (let count = 1; count <= 3 && candidates.length < 3; count += 1) {
    const offset = count * unit;
    add(calculate(left, right + offset));
    if (right >= offset) add(calculate(left, right - offset));
    add(calculate(left + offset, right));
    if (left >= offset) add(calculate(left - offset, right));
  }
  if (candidates.length < 3) throw new RangeError("Not enough distinct arithmetic mistakes for four choices.");
  const choices = [answer, ...candidates.slice(0, 3)];
  for (let index = choices.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("Random values must be between 0 (inclusive) and 1 (exclusive).");
    }
    const swap = Math.floor(value * (index + 1));
    [choices[index], choices[swap]] = [choices[swap], choices[index]];
  }
  return choices;
}
