export const QUIZ_NOTICE = "You're in quiz mode. You can change your answers as often as you like. You'll see how you did at the end.";

export function isQuizMode(search) {
  return new URLSearchParams(search).get("quiz") === "1";
}

export function gradeQuiz(questions, responses) {
  if (questions.length === 0) throw new RangeError("A quiz needs questions.");
  const results = questions.map((question, index) => {
    const response = responses[index];
    const correct = Array.isArray(question.expected)
      ? Array.isArray(response) && response.length === question.expected.length &&
        (question.kind === "proof"
          ? question.expected.every((key) => response.includes(key))
          : question.expected.every((word, position) => response[position] === word))
      : response !== undefined && response !== "" && Number(response) === question.expected;
    return { question, response, correct };
  });
  const correct = results.filter((result) => result.correct).length;
  return { results, correct, total: questions.length, percent: Math.round(correct / questions.length * 100) };
}
