/**
 * Topic 9 — "Streaming". A single code block: stream the response and append
 * each text chunk to the Answer panel live via the injected `write(...)`.
 */
export const topic09DefaultCode = `// Streaming: show each chunk of the answer as it's generated, instead of waiting
// for the whole thing. \`write(...)\` appends text to the Answer above, live.
const stream = client.responses.stream({
  model: deployment,
  input: "Write a short haiku about the sea.",
});

let usage;
for await (const event of stream) {
  // Text arrives in small pieces as the model generates them.
  if (event.type === "response.output_text.delta") write(event.delta);
  // The final event carries the usage totals.
  if (event.type === "response.completed") usage = event.response.usage;
}

console.log("usage: " + JSON.stringify(usage, null, 2));
// Nothing to return — the answer already streamed in above.
`;
