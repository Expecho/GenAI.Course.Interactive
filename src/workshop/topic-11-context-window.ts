/**
 * Topic 11 — "Context windows". Two code blocks:
 *  - default (broken): a long answer is capped too low, so it's cut off mid-text
 *    (status "incomplete") — a concrete, cheap stand-in for hitting a token limit.
 *  - fixed: raise the cap so the whole answer fits.
 */
export const topic11DefaultCode = `// The context window is a fixed token budget shared by input AND output.
// max_output_tokens caps the OUTPUT side. We set it far too low on purpose.
const res = await client.responses.create({
  model: deployment,
  input:
    "Explain the history of the Roman Empire: its founding, expansion, and fall.",
  max_output_tokens: 32,
});

console.log("status: " + res.status);
console.log("why it stopped: " + JSON.stringify(res.incomplete_details));
console.log("usage: " + JSON.stringify(res.usage));

return res; // the answer is cut off mid-sentence — it ran out of budget
`;

export const topic11FixedCode = `// Give the output enough room and the answer completes normally.
const res = await client.responses.create({
  model: deployment,
  input:
    "Explain the history of the Roman Empire: its founding, expansion, and fall.",
  max_output_tokens: 2000,
});

console.log("status: " + res.status); // "completed"
console.log("usage: " + JSON.stringify(res.usage));

return res;
`;
