/**
 * Topic 10 — "MCP servers". A single code block: attach a *remote* MCP server
 * (Microsoft Learn) to the call. The model discovers the server's tools, calls
 * them, and answers — we never wrote a single tool definition or run loop.
 */
export const topic10DefaultCode = `// Attach a remote MCP server. The model discovers its tools and uses them —
// no tool schemas to write, no call loop to run (compare with Topic 5).
const res = await client.responses.create({
  model: deployment,
  tools: [
    {
      type: "mcp",
      server_label: "microsoft_learn",
      server_url: "https://learn.microsoft.com/api/mcp",
      require_approval: "never",
    },
  ],
  input:
    "Use the Microsoft Learn tools to answer: what is the default api-version behaviour for the Azure OpenAI v1 API? Answer in one sentence.",
});

// Notice the extra item types the MCP tool adds to the output.
console.log("output items: " + res.output.map((o) => o.type).join(", "));

return res; // answered using a tool the model found on the MCP server
`;
