/**
 * Topic 17 — "Code interpreter". Two code blocks:
 *  - default (broken): ask the model to compute a statistic "in its head"; it
 *    predicts tokens rather than calculating, so the exact answer is unreliable
 *    (and you can't easily verify it).
 *  - fixed: give the model the built-in `code_interpreter` tool — a real Python
 *    sandbox. It writes Python, the platform runs it in a container, and the model
 *    answers from the actual result. We also print the Python it generated.
 */
export const topic17DefaultCode = `// An LLM doesn't calculate — it predicts tokens (Topic 1). So exact arithmetic is
// unreliable. Ask it to compute a statistic by hand, with no tools, and look closely.
const res = await client.responses.create({
  model: deployment,
  input:
    "Compute the population standard deviation of these numbers, doing the arithmetic " +
    "yourself without any tools: [12, 47, 5, 88, 23, 56, 7, 91, 34, 60, 19, 75]. " +
    "Give the result to 4 decimal places.",
});

return res; // a confident, neatly-formatted number — but is it right, and can you tell?
`;

export const topic17CodeInterpreterCode = `// Give the model a real Python sandbox: the built-in code_interpreter tool. It
// WRITES Python, the platform RUNS it in a container, and the model answers from
// the actual output. No loop on our side — it all happens in one call.
const res = await client.responses.create({
  model: deployment,
  tools: [{ type: "code_interpreter", container: { type: "auto" } }],
  input:
    "Compute the population standard deviation of these numbers: " +
    "[12, 47, 5, 88, 23, 56, 7, 91, 34, 60, 19, 75]. Give the result to 4 decimal places.",
});

// The Python the model wrote and ran shows up as a code_interpreter_call item.
for (const item of res.output) {
  if (item.type === "code_interpreter_call") {
    console.log("The model wrote and ran this Python:\\n" + item.code);
  }
}

return res; // an exact answer, computed by code you can actually read
`;
