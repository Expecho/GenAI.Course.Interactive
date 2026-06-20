/**
 * Topic 3 — "State & memory". Two code blocks:
 *  - default (broken): two independent calls; the model forgets between them.
 *  - fixed: keep an in-memory history and resend it, so the model "remembers".
 */
export const topic03DefaultCode = `// Each call is independent — the model keeps NO memory between calls.
const first = await client.responses.create({
  model: deployment,
  input: "Hi! My name is Sam.",
});
console.log("Call 1 →", first.output_text);

// A brand-new, separate call. The model never saw "My name is Sam".
const second = await client.responses.create({
  model: deployment,
  input: "What is my name?",
});
console.log("Call 2 →", second.output_text);

return second; // the Answer shows it doesn't know your name
`;

export const topic03FixedCode = `// We keep the conversation ourselves and send the whole history every call.
const history = [];

// Turn 1 — introduce yourself.
history.push({ role: "user", content: "Hi! My name is Sam." });
const first = await client.responses.create({ model: deployment, input: history });
history.push({ role: "assistant", content: first.output_text });
console.log("Call 1 →", first.output_text);

// Turn 2 — this request now includes everything said so far.
history.push({ role: "user", content: "What is my name?" });
const second = await client.responses.create({ model: deployment, input: history });
console.log("Call 2 →", second.output_text);

return second; // now it remembers your name
`;
