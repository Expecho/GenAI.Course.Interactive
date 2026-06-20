/**
 * Topic 4 — "Tools & live data". Two code blocks:
 *  - default (broken): ask for the current date/time; the model can't really know.
 *  - fixed: give the model a `get_current_datetime` tool it can call, run it, and
 *    feed the result back so it can answer with live data.
 */
export const topic04DefaultCode = `// The model has no clock and no live data — let's just ask it directly.
const res = await client.responses.create({
  model: deployment,
  input: "What is the current date and time right now?",
});

return res; // watch it admit it can't actually know
`;

export const topic04ToolCode = `// A tool is a function the model can ask us to run. We describe it here.
const tools = [
  {
    type: "function",
    name: "get_current_datetime",
    description: "Returns the current date and time in ISO 8601 format.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

const input = [{ role: "user", content: "What is the current date and time right now?" }];

// 1) Ask the model. With a tool available, it asks us to call it.
let res = await client.responses.create({ model: deployment, input, tools });

// 2) Run each tool the model requested, and hand the result back.
for (const item of res.output) {
  if (item.type === "function_call" && item.name === "get_current_datetime") {
    const now = new Date().toISOString();
    console.log("Model called get_current_datetime → " + now);
    input.push(item); // the model's function call
    input.push({ type: "function_call_output", call_id: item.call_id, output: now });
  }
}

// 3) Call again with the tool result so the model can answer.
res = await client.responses.create({ model: deployment, input, tools });

return res; // now it states the real current date and time
`;
