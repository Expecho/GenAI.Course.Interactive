/**
 * Topic 14 — "Agent frameworks". A single code block: build a tiny agent loop
 * by hand with the raw SDK — the model calls tools across multiple rounds until
 * it produces a final answer. The explanation then shows how frameworks
 * (LangChain, Microsoft Agent Framework, Microsoft.Extensions.AI) package this.
 */
export const topic14DefaultCode = `// An "agent" = the model in a LOOP with tools: it decides which tool to call,
// we run it, feed the result back, and repeat until it has a final answer.
const tools = [
  { type: "function", name: "get_current_datetime", description: "Returns the current date/time in ISO 8601.",
    parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "multiply", description: "Multiplies two numbers.",
    parameters: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"], additionalProperties: false } },
];

const input = [{ role: "user", content: "What is the current calendar year multiplied by 2? Show the year and the result." }];

// The agent loop. Each turn the model may call tools; we run them and loop.
let res, rounds = 0;
while (rounds++ < 6) {
  res = await client.responses.create({ model: deployment, input, tools });

  const calls = res.output.filter((o) => o.type === "function_call");
  if (calls.length === 0) break; // no more tools requested → the model is done

  for (const call of calls) {
    let output;
    if (call.name === "get_current_datetime") output = new Date().toISOString();
    else if (call.name === "multiply") { const { a, b } = JSON.parse(call.arguments); output = String(a * b); }
    console.log("→ called " + call.name + "(" + call.arguments + ") = " + output);
    input.push(call);
    input.push({ type: "function_call_output", call_id: call.call_id, output });
  }
}

console.log("Finished in " + rounds + " rounds.");
return res; // the final answer, after the model chained tools on its own
`;
