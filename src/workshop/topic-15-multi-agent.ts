/**
 * Topic 15 — "Multi-agent systems". A single code block: an orchestrator agent
 * whose tools are themselves specialist sub-agents (agents-as-tools). The
 * explanation covers multi-agent patterns, MCP, and the A2A protocol.
 */
export const topic15DefaultCode = `// Each specialist is its own agent: a focused LLM call with its own instructions.
async function researcher(topic) {
  const r = await client.responses.create({ model: deployment, input: [
    { role: "system", content: "You are a concise researcher. Give exactly two key facts, one short sentence each." },
    { role: "user", content: "Topic: " + topic },
  ]});
  return r.output_text;
}
async function translator(text) {
  const r = await client.responses.create({ model: deployment, input: [
    { role: "system", content: "Translate the user's text to French. Output only the translation." },
    { role: "user", content: text },
  ]});
  return r.output_text;
}

// The ORCHESTRATOR agent — its "tools" are the specialist agents above.
const tools = [
  { type: "function", name: "researcher", description: "Researches a topic and returns key facts.",
    parameters: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"], additionalProperties: false } },
  { type: "function", name: "translator", description: "Translates text to French.",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false } },
];

const input = [{ role: "user", content: "Research the planet Mars, then translate the findings into French." }];

let res, rounds = 0;
while (rounds++ < 6) {
  res = await client.responses.create({ model: deployment, input, tools });
  const calls = res.output.filter((o) => o.type === "function_call");
  if (calls.length === 0) break;
  for (const call of calls) {
    const args = JSON.parse(call.arguments);
    // Delegating to a tool here means running another agent.
    const out = call.name === "researcher" ? await researcher(args.topic) : await translator(args.text);
    console.log("orchestrator → " + call.name + "()");
    input.push(call);
    input.push({ type: "function_call_output", call_id: call.call_id, output: out });
  }
}

return res; // the orchestrator coordinated two specialist agents to produce this
`;
