/**
 * Topic 13 — "Guardrails, evals & tests". Two code blocks:
 *  - default (broken): ship a feature on one manual spot-check ("looks right").
 *  - fixed: a tiny eval harness — labelled cases, run each, score automatically.
 *  The feature is a sentiment classifier; the enum structured output (Topic 9)
 *  doubles as an output guardrail.
 */
export const topic13DefaultCode = `// Our feature: classify a message's sentiment. Let's eyeball ONE example.
const res = await client.responses.create({
  model: deployment,
  input: 'Classify the sentiment (positive, neutral, or negative): "I love this!"',
});

console.log("Looks right to me: " + res.output_text);
// ...but is it correct for every input? We only ever checked this one.
return res;
`;

export const topic13EvalCode = `// A tiny labelled test set — inputs with their KNOWN-correct answers.
const cases = [
  { text: "I absolutely love this product!", expected: "positive" },
  { text: "It arrived on Tuesday.", expected: "neutral" },
  { text: "This is the worst purchase I have ever made.", expected: "negative" },
  { text: "Well, that was certainly... an experience.", expected: "negative" },
  { text: "The package was fine, nothing special.", expected: "neutral" },
];

// The feature under test. The enum structured output is itself a GUARDRAIL:
// the model can only ever return one of the three allowed labels.
async function classify(text) {
  const res = await client.responses.create({
    model: deployment,
    input: "Classify the sentiment of this message: " + text,
    text: {
      format: {
        type: "json_schema",
        name: "sentiment",
        schema: {
          type: "object",
          properties: { sentiment: { type: "string", enum: ["positive", "neutral", "negative"] } },
          required: ["sentiment"],
          additionalProperties: false,
        },
        strict: true,
      },
    },
  });
  return JSON.parse(res.output_text).sentiment;
}

// The EVAL: run every case and score the output against the expected label.
let passed = 0;
for (const c of cases) {
  const got = await classify(c.text);
  const ok = got === c.expected;
  if (ok) passed++;
  console.log((ok ? "PASS" : "FAIL") + "  expected=" + c.expected + "  got=" + got + "   | " + c.text);
}

console.log("\\nScore: " + passed + "/" + cases.length + " passed");
// A failing case is the eval doing its job — something one spot-check would miss.
`;
