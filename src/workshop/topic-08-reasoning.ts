/**
 * Topic 8 — "Reasoning models". A single code block: ask a reasoning model a
 * trick question and inspect the hidden reasoning tokens in usage. It uses the
 * injected `reasoningDeployment` (e.g. gpt-5) — the regular `deployment`
 * (gpt-5-chat) is a non-reasoning model.
 */
export const topic08DefaultCode = `// reasoningDeployment is a *reasoning* model — it thinks through the problem
// before answering. (Classic trick question: the intuitive answer of $0.10 is wrong.)
const res = await client.responses.create({
  model: reasoningDeployment,
  input:
    "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?",
});

console.log("Answer: " + res.output_text);
console.log("usage: " + JSON.stringify(res.usage, null, 2));

return res;
`;
