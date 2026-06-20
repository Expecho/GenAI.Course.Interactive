/**
 * Default editable code for Topic 1 — "Calling an LLM and showing the raw response".
 *
 * `client` (an Azure AI Foundry OpenAI-compatible client) and `deployment` (your
 * model deployment name) are injected into the sandbox. The API key stays on the
 * server and is never visible to this code.
 *
 * The code returns the response; the lesson steps below show the answer text, the
 * raw response object, and the token usage from that returned value.
 */
export const topic01DefaultCode = `// A Responses API call: pick the model (your deployment), send an input,
// and get back a structured response object.
const res = await client.responses.create({
  model: deployment,
  input: "Explain what an LLM is in one sentence.",
});

// Return it so the steps below can show the answer, raw response, and usage.
return res;
`;
